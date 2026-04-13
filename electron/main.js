const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

if (isDev) {
  app.setAsDefaultProtocolClient('applyneu', process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient('applyneu');
}

// Store URL if deep link fires before the window is ready
let pendingOAuthUrl = null;

const sendOAuthUrl = (url) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('oauth-callback', url);
    win.focus();
  } else {
    pendingOAuthUrl = url;
  }
};

// macOS: register open-url before whenReady so it isn't missed
app.on('open-url', (event, url) => {
  event.preventDefault();
  sendOAuthUrl(url);
});

// Windows/Linux: enforce single instance and capture deep link from argv
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    const url = argv.find(arg => arg.startsWith('applyneu://'));
    if (url) sendOAuthUrl(url);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,  // Enable webview tag
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Open all new window requests in the user's default browser instead of a new Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      shell.openExternal(url);
    } catch (err) {
      console.error('Failed to open external URL', err);
    }
    return { action: 'deny' };
  });

  // Allow webview to load external content
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src * \'unsafe-inline\' \'unsafe-eval\'; script-src * \'unsafe-inline\' \'unsafe-eval\'; connect-src * \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src *; style-src * \'unsafe-inline\';']
      }
    })
  })

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Flush any deep link URL that arrived before the window was ready
  win.webContents.once('did-finish-load', () => {
    if (pendingOAuthUrl) {
      win.webContents.send('oauth-callback', pendingOAuthUrl);
      pendingOAuthUrl = null;
    }
  });
}

app.whenReady().then(() => {
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

