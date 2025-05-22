const { app,BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
   
  
 mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });
  mainWindow.loadFile('index.html');
 
}



// Wait for the app to be ready
app.whenReady().then(() => {
  createWindow();
  

  ipcMain.handle('get-screen-sources', async () => {
    console.log('Main process: get-screen-sources handler called');
    try {
      const sources = await desktopCapturer.getSources({ 
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 }
      });
      
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
      }));
    } catch (error) {
      console.error('Error in get-screen-sources:', error);
      throw error;
    }
  });
});

ipcMain.handle('toggle-app-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  
  const isFullScreen = win.isFullScreen();
  win.setFullScreen(!isFullScreen);
  return !isFullScreen;
});







app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
