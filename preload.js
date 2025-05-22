const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
 
  getScreenSources: () => {
    console.log('Preload: Calling get-screen-sources');
    return ipcRenderer.invoke('get-screen-sources');
  },
  toggleAppFullscreen: () => {
    return ipcRenderer.invoke('toggle-app-fullscreen');
  },
  // Add fullscreen support
  enterFullscreen: () => {
    return ipcRenderer.invoke('enter-fullscreen');
  },
  
  exitFullscreen: () => {
    return ipcRenderer.invoke('exit-fullscreen');
  }
});
