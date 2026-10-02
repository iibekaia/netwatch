const { contextBridge, ipcRenderer } = require('electron');

/** ქმნის გამოწერას და აბრუნებს ფუნქციას გამოწერის გასაუქმებლად */
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('netwatch', {
  getStatus: () => ipcRenderer.invoke('net:get-status'),
  checkNow: (trigger) => ipcRenderer.invoke('net:check-now', trigger),
  onStatus: (callback) => subscribe('net:status', callback),
  onChange: (callback) => subscribe('net:change', callback),
  getLan: () => ipcRenderer.invoke('lan:get'),
  scanLan: () => ipcRenderer.invoke('lan:scan'),
  onLan: (callback) => subscribe('lan:update', callback),
  getProvider: (refresh) => ipcRenderer.invoke('isp:get', refresh),
  onProvider: (callback) => subscribe('isp:update', callback),
  runSpeedTest: () => ipcRenderer.invoke('speed:run'),
  cancelSpeedTest: () => ipcRenderer.send('speed:cancel'),
  onSpeedProgress: (callback) => subscribe('speed:progress', callback),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdate: (callback) => subscribe('update:state', callback),
  toggleDevTools: () => ipcRenderer.send('devtools:toggle'),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
