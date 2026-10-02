const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, BrowserWindow, dialog, ipcMain, Menu, Notification, powerMonitor, shell } = require('electron');
const { ConnectionMonitor } = require('./connection-monitor');
const lanScanner = require('./lan-scanner');
const { PeerDiscovery } = require('./peer-discovery');
const { SpeedTest, providerInfo } = require('./speed-test');
const { Updater } = require('./updater');
const { runDiagnostics } = require('./diagnostics');
const { HistoryStore } = require('./history-store');
const { queryHistory } = require('./history-stats');
const historyExport = require('./history-export');
const autostart = require('./autostart');
const { AppTray } = require('./tray');
const { Settings } = require('./settings');
const { openDatabase } = require('./db');
const { SpeedStore } = require('./speed-store');
const { i18n, SUPPORTED, LOCALES } = require('./i18n');

// ერთი ასლი: NetWatch-ს თუ ხელახლა გაუშვებენ (ან ავტომატურ ჩართვასთან ერთად) —
// მეორე არ იხსნება, პირველის ფანჯარა ჩნდება
const isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) app.quit();
app.on('second-instance', () => showWindow());

// ✕ ფანჯარას მალავს (აპი tray-ში რჩება); რეალური გასვლა — მხოლოდ tray-ის მენიუდან ან განახლებისას
let isQuitting = false;
app.on('before-quit', () => (isQuitting = true));

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
let tray = null;
// მომხმარებლის მონაცემები — SQLite: %APPDATA%\NetWatch\netwatch.db
// (პარამეტრები, გათიშვების ისტორია, სიჩქარის გაზომვები; ძველი .json ფაილები ერთხელ გადმოდის)
const db = openDatabase(app.getPath('userData'));
const settings = new Settings(db);
const speedStore = new SpeedStore(db);

// ენა: შენახული არჩევანი, ან — რეგიონის/სისტემის მიხედვით (electron/i18n.js)
// ready-მდე app.getPreferredSystemLanguages() შეიძლება ცარიელი იყოს — init ხელახლა whenReady-ში
i18n.on('change', (lang) => {
  settings.set('lang', lang);
  updateWindowTitle();
  if (win && !win.isDestroyed()) win.webContents.send('i18n:changed', lang);
});

// გათიშვების ისტორია — იგივე ბაზაში (outages, sessions)
const history = new HistoryStore(db);
history.on('change', () => {
  if (win && !win.isDestroyed()) win.webContents.send('history:update');
});

// ─────────────────────────────────────────────
//  ჰენდლერები — აქ წერ, რა მოხდეს გათიშვის/ჩართვისას
// ─────────────────────────────────────────────

function handleOffline(status, prev) {
  console.log(`[netwatch] ❌ ინტერნეტი გაითიშა (${status.reason})`);
  win?.flashFrame(true);
  history.startOutage(status.since, status.reason);

  // დიაგნოსტიკა ავტომატურად — შეტყობინებაში უკვე მიზეზი ეწერება ("როუტერი არ პასუხობს" …)
  diagnose('offline').then((result) => {
    const v = result?.verdict;
    history.annotate(v); // მიზეზი ისტორიაშიც — საჩივრისთვის
    // პირველ შემოწმებაზე (როცა წინა მდგომარეობა უცნობია) შეტყობინებას არ ვაჩვენებთ
    if (prev.online === null) return;
    if (v && v.level !== 'ok') {
      notify(
        i18n.t('notify.offlineCause', { cause: i18n.t(`diag.verdict.${v.code}.title`) }),
        i18n.t(`diag.verdict.${v.code}.advice`)
      );
    } else {
      notify(i18n.t('notify.offline'), i18n.t('notify.offlineBody'));
    }
  });
}

function handleOnline(status, prev) {
  console.log(`[netwatch] ✅ ინტერნეტი ჩაირთო (${status.latencyMs} ms)`);
  if (prev.online === false) {
    notify(i18n.t('notify.online'), i18n.t('notify.onlineBody', { time: i18n.duration(status.since - prev.since) }));
  }
  win?.flashFrame(false);
  history.endOutage(status.since);
  peers.announce();
  scanLan();
  loadProvider();
  // ბოლო დიაგნოსტიკამ პრობლემა აჩვენა — თავიდან, რომ ეკრანზე ძველი "წითელი" არ დარჩეს
  if (diag.result && diag.result.verdict.level !== 'ok') diagnose('online');
}

// ─────────────────────────────────────────────
//  დიაგნოსტიკა — „სად არის პრობლემა?“
// ─────────────────────────────────────────────

const diag = { running: false, trigger: null, result: null };
let diagRunning = null;

function sendDiag() {
  if (win && !win.isDestroyed()) win.webContents.send('diag:update', diag);
}

/** ერთდროულად მხოლოდ ერთი დიაგნოსტიკა; მიმდინარეს თუ ითხოვენ — იგივე Promise ბრუნდება */
function diagnose(trigger) {
  if (diagRunning) return diagRunning;
  diag.running = true;
  diag.trigger = trigger;
  sendDiag();
  diagRunning = runDiagnostics()
    .then((result) => (diag.result = result))
    .catch((err) => {
      console.warn('[diag] failed', err);
      return null;
    })
    .finally(() => {
      diag.running = false;
      diagRunning = null;
      sendDiag();
      // ოფლაინ — tray-ის tooltip-ში მიზეზი ("ოფლაინ — როუტერი არ პასუხობს")
      const status = monitor.getStatus();
      if (status.online === false) {
        const v = diag.result?.verdict;
        tray?.update(false, v && v.level !== 'ok' ? `diag.verdict.${v.code}.title` : null);
      }
    });
  return diagRunning;
}

function handleChange(status) {
  // tray: ფერი მაშინვე; მიზეზი — დიაგნოსტიკის დასრულებისას (იხ. diagnose)
  tray?.update(status.online, status.online ? null : 'tray.checkingCause');
  if (!win || win.isDestroyed()) return;
  updateWindowTitle();
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
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.on('click', () => showWindow()); // შეტყობინებაზე დაკლიკება ხსნის აპს (თუნდაც tray-შია)
  n.show();
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
    const result = await speedTest.run();
    speedStore.add(result);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: speedTest.running ? 'busy' : String(err?.message ?? err) };
  }
});
ipcMain.on('speed:cancel', () => speedTest.cancel());
ipcMain.handle('diag:get', () => diag);
ipcMain.handle('history:query', (_e, range) => queryHistory(history.snapshot(range), range));
ipcMain.handle('speed:history', (_e, limit) => speedStore.list(limit));
// ძველი ვერსიების localStorage-ის გაზომვები → ბაზა (ერთხელ)
ipcMain.handle('speed:import', (_e, list) => speedStore.importLegacy(list));
ipcMain.handle('history:clear', () => history.clear());
ipcMain.handle('history:export', (_e, opts) => exportHistory(opts));
ipcMain.handle('diag:run', async () => {
  await diagnose('manual');
  return diag;
});
ipcMain.handle('update:get', () => updater.state);
ipcMain.handle('update:check', () => updater.check());
ipcMain.on('update:install', () => updater.install());
ipcMain.on('devtools:toggle', () => win?.webContents.toggleDevTools());
// ენა — preload-ი სინქრონულად იღებს, რომ პირველივე კადრი სწორ ენაზე იყოს
ipcMain.on('i18n:initial', (event) => {
  event.returnValue = {
    lang: i18n.lang,
    languages: SUPPORTED.map((code) => ({ code, name: LOCALES[code].meta.native })),
  };
});
ipcMain.handle('i18n:set', (_e, lang) => {
  i18n.set(lang);
  return i18n.lang;
});

function updateWindowTitle() {
  if (!win || win.isDestroyed()) return;
  const online = monitor.getStatus().online;
  win.setTitle(online === null ? 'NetWatch' : i18n.t(online ? 'window.online' : 'window.offline'));
}

ipcMain.handle('autostart:get', () => ({ supported: autostart.supported(), enabled: autostart.isEnabled() }));
ipcMain.handle('autostart:set', (_e, enabled) => setAutostart(enabled));

/** ავტომატური ჩართვა — UI-დან და tray-ის მენიუდან ერთი გზით, რომ ორივე სინქრონში იყოს */
function setAutostart(enabled) {
  autostart.setEnabled(!!enabled);
  tray?.refresh();
  const state = { supported: autostart.supported(), enabled: autostart.isEnabled() };
  if (win && !win.isDestroyed()) win.webContents.send('autostart:update', state);
  return state;
}

// ─────────────────────────────────────────────
//  ფანჯარა + DevTools (Inspect)
// ─────────────────────────────────────────────

/** ფანჯრის ჩვენება: tray-დან, შეტყობინებიდან, მეორე გაშვებიდან */
function showWindow() {
  if (!app.isReady()) return;
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow({ show = true } = {}) {
  win = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 400,
    minHeight: 560,
    title: 'NetWatch',
    // კომპიუტრის ჩართვისას (--hidden) ფანჯარა არ ჩანს — მხოლოდ tray
    show,
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

  // ✕ — ფანჯარა იმალება, მონიტორინგი გრძელდება (tray). გასვლა — tray-ის მენიუდან
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
    if (!settings.get('trayHintShown', false)) {
      settings.set('trayHintShown', true);
      notify(
        i18n.t('notify.bgTitle'),
        i18n.t('notify.bgBody')
      );
    }
  });
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
  if (!isPrimary) return; // მეორე ასლი — უკვე იხურება

  // ენა — ფანჯრამდე. ავტომატურად განსაზღვრული არ ინახება: თუ მომხმარებელს არ აურჩევია,
  // სისტემის/რეგიონის ცვლილება შემდეგ გაშვებაზეც აისახება
  i18n.init(settings.get('lang'));

  // პირველი გაშვება (დაყენებული აპი): კომპიუტერთან ერთად ჩართვა ნაგულისხმევად ჩართულია —
  // მონიტორი მაშინ მუშაობს, როცა ფანჯარა დახურულია; გამორთვა — tray-ის მენიუდან ან footer-იდან
  if (!settings.get('firstRunDone', false) && autostart.supported()) {
    autostart.setEnabled(true);
    settings.set('firstRunDone', true);
  }

  history.start(); // მონიტორამდე — რომ საწყისი "ოფლაინ"-იც ჩაიწეროს
  buildMenu();
  createWindow({ show: !autostart.launchedHidden() });
  tray = new AppTray({
    autostart,
    onOpen: () => showWindow(),
    onCheck: () => monitor.checkNow('tray'),
    onToggleAutostart: (enabled) => setAutostart(enabled),
    onQuit: () => app.quit(),
  });
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

  // macOS: Dock-ის იკონკაზე დაკლიკება
  app.on('activate', () => showWindow());
});

// ფანჯრები მხოლოდ გასვლისას იხურება (✕ მალავს) — მაშინ აპიც სრულდება
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ნებისმიერი გასვლა: tray-ის მენიუ, განახლების დაყენება (quitAndInstall), macOS-ზე Cmd+Q
app.on('will-quit', shutdown);

let shutDown = false;
function shutdown() {
  if (shutDown || !isPrimary) return;
  shutDown = true;
  monitor.stop();
  peers.stop();
  speedTest.cancel();
  updater.stop();
  history.stop();
  clearTimeout(lanTimer);
  tray?.destroy();
}

// ─────────────────────────────────────────────
//  ისტორიის ექსპორტი — CSV / PDF
// ─────────────────────────────────────────────

async function exportHistory({ format, from, to, periodLabel }) {
  const report = queryHistory(history.snapshot({ from, to }), { from, to });
  const stamp = historyExport.dateTime(Date.now()).slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: i18n.t(format === 'pdf' ? 'dialog.savePdf' : 'dialog.saveCsv'),
    defaultPath: path.join(app.getPath('documents'), `netwatch-${format === 'pdf' ? 'report' : 'outages'}-${stamp}.${format}`),
    filters: [format === 'pdf' ? { name: 'PDF', extensions: ['pdf'] } : { name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    if (format === 'pdf') {
      const meta = { isp: provider?.isp, ip: provider?.ip, host: os.hostname(), periodLabel };
      fs.writeFileSync(filePath, await historyExport.toPdf(report, meta));
    } else {
      fs.writeFileSync(filePath, historyExport.toCsv(report), 'utf8');
    }
    shell.showItemInFolder(filePath);
    return { ok: true, path: filePath };
  } catch (err) {
    console.warn('[history] export failed', err);
    return { ok: false, error: String(err?.message ?? err) };
  }
}
