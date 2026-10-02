const path = require('path');
const { app, BrowserWindow, ipcMain, Menu, Notification, powerMonitor } = require('electron');
const { ConnectionMonitor } = require('./connection-monitor');
const lanScanner = require('./lan-scanner');
const { PeerDiscovery } = require('./peer-discovery');
const { SpeedTest, providerInfo } = require('./speed-test');
const { Updater } = require('./updater');

// --dev: Angular იტვირთება ng serve-დან (http://localhost:4200), DevTools ავტომატურად იხსნება
const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:4200';
const PROD_INDEX = path.join(__dirname, '..', 'dist', 'netwatch', 'browser', 'index.html');

const monitor = new ConnectionMonitor();
const peers = new PeerDiscovery({ version: app.getVersion() });
const speedTest = new SpeedTest();
const updater = new Updater();
updater.on('state', (state) => {
  if (win && !win.isDestroyed()) win.webContents.send('update:state', state);
});
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
  peers.announce();
  scanLan();
  loadProvider();
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

// ─────────────────────────────────────────────
//  ლოკალური ქსელი — მოწყობილობები და NetWatch-ის სხვა მომხმარებლები
// ─────────────────────────────────────────────

const LAN_SCAN_INTERVAL_MS = 60000;
let lanScan = null; // ბოლო სკანირების შედეგი
let lanScanning = null; // მიმდინარე სკანირების Promise
let lanTimer = null;

function lanState() {
  const peerList = peers.list();
  const byIp = new Map();
  for (const p of peerList) for (const ip of p.addresses) if (!byIp.has(ip)) byIp.set(ip, p);
  const devices = (lanScan?.devices ?? []).map((d) => ({ ...d, peer: byIp.get(d.ip) ?? null }));
  // NetWatch-მა უპასუხა, მაგრამ სკანირებაში არ ჩანს (მაგ. სხვა subnet-იდან)
  for (const p of peerList) {
    if (!devices.some((d) => d.peer?.id === p.id)) devices.push({ ip: p.ip, mac: null, peer: p });
  }
  return {
    scanning: !!lanScanning,
    scannedAt: lanScan?.scannedAt ?? null,
    subnets: lanScan?.subnets ?? [],
    gateway: lanScan?.gateway ?? null,
    selfId: peers.id,
    devices,
  };
}

function sendLan() {
  if (win && !win.isDestroyed()) win.webContents.send('lan:update', lanState());
}

function scanLan() {
  if (lanScanning) return lanScanning;
  lanScanning = lanScanner
    .scan({ onProbe: (ip) => peers.probe(ip) })
    .then((result) => (lanScan = result))
    .catch((err) => console.warn('[lan] scan failed', err))
    .finally(() => {
      lanScanning = null;
      sendLan();
      clearTimeout(lanTimer);
      lanTimer = setTimeout(scanLan, LAN_SCAN_INTERVAL_MS);
    });
  sendLan();
  return lanScanning;
}

peers.on('change', sendLan);

// ─────────────────────────────────────────────
//  სიჩქარის ტესტი + პროვაიდერი
// ─────────────────────────────────────────────

let provider = null; // ბოლოს მიღებული პროვაიდერის ინფო
let providerLoading = null;

function loadProvider() {
  providerLoading ??= providerInfo()
    .then((info) => (provider = { ...info, at: Date.now() }))
    .catch((err) => console.warn('[isp] failed', err.message))
    .finally(() => {
      providerLoading = null;
      if (win && !win.isDestroyed()) win.webContents.send('isp:update', provider);
    });
  return providerLoading;
}

speedTest.on('progress', (p) => {
  if (win && !win.isDestroyed()) win.webContents.send('speed:progress', p);
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
ipcMain.handle('lan:get', () => lanState());
ipcMain.handle('lan:scan', async () => {
  await scanLan();
  return lanState();
});
ipcMain.handle('isp:get', async (_e, refresh = false) => {
  if (refresh || !provider) await loadProvider();
  return provider;
});
ipcMain.handle('speed:run', async () => {
  loadProvider(); // IP/პროვაიდერი შეიძლება შეიცვალა
  try {
    return { ok: true, result: await speedTest.run() };
  } catch (err) {
    return { ok: false, error: speedTest.running ? 'busy' : String(err?.message ?? err) };
  }
});
ipcMain.on('speed:cancel', () => speedTest.cancel());
ipcMain.handle('update:get', () => updater.state);
ipcMain.handle('update:check', () => updater.check());
ipcMain.on('update:install', () => updater.install());
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
    // macOS-ზე იკონკა აპის bundle-იდან მოდის, აქ — Windows (.ico) და Linux (.png)
    icon: path.join(__dirname, '..', 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    // მენიუს ზოლი (View / Network) დამალულია — Alt აჩენს, shortcut-ები (Ctrl+K და ა.შ.) მუშაობს
    autoHideMenuBar: true,
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
  peers.start();
  scanLan();
  loadProvider();
  updater.start();

  // ძილიდან გაღვიძება / ეკრანის განბლოკვა — მაშინვე ვამოწმებთ
  powerMonitor.on('resume', () => {
    monitor.checkNow('resume');
    peers.announce();
    scanLan();
  });
  powerMonitor.on('unlock-screen', () => monitor.checkNow('unlock'));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  monitor.stop();
  peers.stop();
  speedTest.cancel();
  updater.stop();
  clearTimeout(lanTimer);
  if (process.platform !== 'darwin') app.quit();
});
