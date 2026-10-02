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
  toggleDevTools: () => ipcRenderer.send('devtools:toggle'),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
