const { contextBridge, shell } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => {
    try {
      shell.openExternal(url);
    } catch (err) {
      console.error('openExternal failed', err);
    }
  },
});

