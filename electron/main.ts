import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { registerSessionHandlers } from './ipc/sessions';
import { registerSSHHandlers } from './ipc/ssh';
import { registerSFTPHandlers } from './ipc/sftp';

// ssh2 native modül olmadan da çalışsın
process.env.NODE_SSH2_NO_NATIVE = '1';

// ── Portable mod: tüm kullanıcı verileri exe'nin yanındaki "data" klasöründe ──
const isPackaged = app.isPackaged;
const exeDir = isPackaged
  ? path.dirname(app.getPath('exe'))        // release/win-unpacked/
  : path.resolve(__dirname, '..');           // dev modda proje kökü

const portableDataDir = path.join(exeDir, 'data');

// Electron'un kendi userData yolunu portable klasöre yönlendir
app.setPath('userData', portableDataDir);
// Diğer yollar da portable olsun
app.setPath('appData', portableDataDir);
app.setPath('logs', path.join(portableDataDir, 'logs'));
app.setPath('temp', path.join(portableDataDir, 'temp'));

let mainWindow: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
  });

  // Window control IPC handlers
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler'ları kaydet
registerSessionHandlers();
registerSSHHandlers();
registerSFTPHandlers();

app.whenReady().then(createWindow);

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
