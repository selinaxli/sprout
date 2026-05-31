const { contextBridge, ipcRenderer } = require('electron');

// A tiny, safe bridge so the page can ask the window to resize or quit.
// If this is opened in a plain browser (no Electron), window.sprout is
// simply undefined and the UI falls back gracefully.
contextBridge.exposeInMainWorld('sprout', {
  resize: (height) => ipcRenderer.send('resize-window', height),
  quit: () => ipcRenderer.send('quit-app'),
});
