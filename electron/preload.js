const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onOAuthCallback: (cb) => ipcRenderer.on('oauth-callback', (_, url) => cb(url)),
});

