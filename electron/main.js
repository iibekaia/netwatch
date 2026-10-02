const path = require('path');
const { app, BrowserWindow, ipcMain, Menu, Notification, powerMonitor } = require('electron');
const { ConnectionMonitor } = require('./connection-monitor');

// --dev: Angular იტვირთება ng serve-დან (http://localhost:4200), DevTools ავტომატურად იხსნება
const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:4200';
const PROD_INDEX = path.join(__dirname, '..', 'dist', 'netwatch', 'browser', 'index.html');

const monitor = new ConnectionMonitor();
let win = null;

// ─────────────────────────────────────────────
//  ჰენდლერები — აქ წერ, რა მოხდეს გათიშვის/ჩართვისას
// ─────────────────────────────────────────────

function handleOffline(status, prev) {
  console.log(`[netwatch] ❌ ინტერნეტი გაითიშა (${status.reason})`);
  // პირველ შემოწმებაზე (როცა წინა მდგომარეობა უცნობია) შეტყობინებას არ ვაჩვენებთ
  if (prev.online !== null) {
    notify('ინტერნეტი გაითიშა', 'კავშირი დაიკარგა. ველოდები აღდგენას…');
  }
  win?.flashFrame(true);
}

function handleOnline(status, prev) {
  console.log(`[netwatch] ✅ ინტერნეტი ჩაირთო (${status.latencyMs} ms)`);
  if (prev.online === false) {
    const downFor = Math.round((status.since - prev.since) / 1000);
    notify('ინტერნეტი აღდგა', `კავშირი არ იყო ${downFor} წამი.`);
  }
  win?.flashFrame(false);
}

function handleChange(status) {
  if (!win || win.isDestroyed()) return;
  win.setTitle(status.online ? 'NetWatch — ონლაინ' : 'NetWatch — ოფლაინ');
  win.webContents.send('net:change', status);
}

monitor.on('offline', handleOffline);
monitor.on('online', handleOnline);
monitor.on('change', handleChange);
monitor.on('status', (status) => {
  if (win && !win.isDestroyed()) win.webContents.send('net:status', status);
});

function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

// ─────────────────────────────────────────────
//  IPC — renderer-თან კომუნიკაცია
// ─────────────────────────────────────────────

ipcMain.handle('net:get-status', () => monitor.getStatus());
ipcMain.handle('net:check-now', async (_e, trigger = 'manual') => {
  await monitor.checkNow(trigger);
  return monitor.getStatus();
});
ipcMain.on('devtools:toggle', () => win?.webContents.toggleDevTools());

// ─────────────────────────────────────────────
//  ფანჯარა + DevTools (Inspect)
// ─────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 400,
    minHeight: 560,
    title: 'NetWatch',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: true,
    },
  });

  // F12 ან Ctrl+Shift+I (macOS: Cmd+Opt+I) — DevTools გახსნა/დახურვა
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const combo = (input.control || input.meta) && input.shift && key === 'i';
    const macCombo = input.meta && input.alt && key === 'i';
    if (input.key === 'F12' || combo || macCombo) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // მარჯვენა ღილაკი → "Inspect Element"
  win.webContents.on('context-menu', (_event, params) => {
    Menu.buildFromTemplate([
      { label: 'Inspect Element', click: () => win.webContents.inspectElement(params.x, params.y) },
      { label: 'Toggle DevTools', click: () => win.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Reload', role: 'reload' },
    ]).popup({ window: win });
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(PROD_INDEX);
  }

  win.on('closed', () => (win = null));
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Shift+I' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
        ],
      },
      {
        label: 'Network',
        submenu: [
          { label: 'Check now', accelerator: 'CmdOrCtrl+K', click: () => monitor.checkNow('menu') },
        ],
      },
    ])
  );
}

// Windows-ზე შეტყობინებები სწორად რომ გამოჩნდეს დაინსტალირებულ აპში
if (process.platform === 'win32') app.setAppUserModelId('com.iibekaia.netwatch');

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  monitor.start();

  // ძილიდან გაღვიძება / ეკრანის განბლოკვა — მაშინვე ვამოწმებთ
  powerMonitor.on('resume', () => monitor.checkNow('resume'));
  powerMonitor.on('unlock-screen', () => monitor.checkNow('unlock'));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  monitor.stop();
  if (process.platform !== 'darwin') app.quit();
});
