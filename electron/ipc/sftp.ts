import { ipcMain, BrowserWindow } from 'electron';
import { Client, SFTPWrapper } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface SFTPSession {
  sftp: SFTPWrapper;
  connectionId: string;
}

const sftpSessions = new Map<string, SFTPSession>();
const activeTransfers = new Map<string, { cancelled: boolean }>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows[0] || null;
}

// SSH connection pool reference (will be set from ssh.ts)
// For now, we keep a reference to clients passed via IPC
const clientPool = new Map<string, Client>();

export function setSFTPClient(connectionId: string, client: Client) {
  clientPool.set(connectionId, client);
}

export function registerSFTPHandlers() {
  // Get user home directory
  ipcMain.handle('local:homedir', () => {
    return os.homedir();
  });

  // Local filesystem listing
  ipcMain.handle('local:readdir', async (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        try {
          const fullPath = path.join(dirPath, entry.name);
          const stats = fs.statSync(fullPath);
          result.push({
            name: entry.name,
            longname: '',
            attrs: {
              size: stats.size,
              mode: stats.mode,
              mtime: Math.floor(stats.mtimeMs / 1000),
              atime: Math.floor(stats.atimeMs / 1000),
              uid: 0,
              gid: 0,
            },
            isDirectory: entry.isDirectory(),
            isSymlink: entry.isSymbolicLink(),
          });
        } catch {
          // Skip files we can't stat (permission errors, etc.)
        }
      }
      return result;
    } catch (err) {
      throw err;
    }
  });

  // Select local directory via dialog
  ipcMain.handle('local:selectDirectory', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Select local file for upload via dialog
  ipcMain.handle('local:selectFile', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
    });
    return result.canceled ? [] : result.filePaths;
  });

  // Select save path for download
  ipcMain.handle('local:selectSavePath', async (_event, defaultName: string) => {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
    });
    return result.canceled ? null : result.filePath;
  });
  ipcMain.handle('sftp:open', async (_event, connectionId: string) => {
    const client = clientPool.get(connectionId);
    if (!client) throw new Error(`No SSH connection found: ${connectionId}`);

    return new Promise<string>((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) return reject(err);
        const sftpId = generateId();
        sftpSessions.set(sftpId, { sftp, connectionId });
        resolve(sftpId);
      });
    });
  });

  ipcMain.handle('sftp:readdir', async (_event, sftpId: string, remotePath: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    return new Promise((resolve, reject) => {
      session.sftp.readdir(remotePath, (err, list) => {
        if (err) return reject(err);
        resolve(
          list.map((item) => ({
            name: item.filename,
            longname: item.longname,
            attrs: {
              size: item.attrs.size,
              mode: item.attrs.mode,
              mtime: item.attrs.mtime,
              atime: item.attrs.atime,
              uid: item.attrs.uid,
              gid: item.attrs.gid,
            },
            isDirectory: (item.attrs.mode & 0o40000) !== 0,
            isSymlink: item.longname.startsWith('l'),
          }))
        );
      });
    });
  });

  ipcMain.handle('sftp:stat', async (_event, sftpId: string, remotePath: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    return new Promise((resolve, reject) => {
      session.sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        resolve(stats);
      });
    });
  });

  ipcMain.handle('sftp:mkdir', async (_event, sftpId: string, remotePath: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    return new Promise<void>((resolve, reject) => {
      session.sftp.mkdir(remotePath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  ipcMain.handle('sftp:rename', async (_event, sftpId: string, oldPath: string, newPath: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    return new Promise<void>((resolve, reject) => {
      session.sftp.rename(oldPath, newPath, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  ipcMain.handle('sftp:delete', async (_event, sftpId: string, remotePath: string, recursive?: boolean) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    if (recursive) {
      await deleteRecursive(session.sftp, remotePath);
    } else {
      return new Promise<void>((resolve, reject) => {
        session.sftp.unlink(remotePath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  });

  ipcMain.handle('sftp:chmod', async (_event, sftpId: string, remotePath: string, mode: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    return new Promise<void>((resolve, reject) => {
      session.sftp.chmod(remotePath, parseInt(mode, 8), (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  ipcMain.handle('sftp:upload', async (_event, sftpId: string, localPath: string, remotePath: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    const transferId = generateId();
    const transferState = { cancelled: false };
    activeTransfers.set(transferId, transferState);

    const stat = fs.statSync(localPath);
    const total = stat.size;
    let transferred = 0;

    const readStream = fs.createReadStream(localPath);
    const writeStream = session.sftp.createWriteStream(remotePath);
    const win = getMainWindow();

    readStream.on('data', (chunk: Buffer) => {
      if (transferState.cancelled) {
        readStream.destroy();
        writeStream.destroy();
        return;
      }
      transferred += chunk.length;
      if (win) {
        win.webContents.send(`sftp:progress:${transferId}`, {
          bytes: transferred,
          total,
          percentage: Math.round((transferred / total) * 100),
        });
      }
    });

    readStream.pipe(writeStream);

    return transferId;
  });

  ipcMain.handle('sftp:download', async (_event, sftpId: string, remotePath: string, localPath: string) => {
    const session = sftpSessions.get(sftpId);
    if (!session) throw new Error(`SFTP session not found: ${sftpId}`);

    const transferId = generateId();
    const transferState = { cancelled: false };
    activeTransfers.set(transferId, transferState);

    // Get file size first, then start streaming in background
    const total = await new Promise<number>((resolve, reject) => {
      session.sftp.stat(remotePath, (err, stats) => {
        if (err) return reject(err);
        resolve(stats.size);
      });
    });

    // Start streaming in background (don't await)
    let transferred = 0;
    const win = getMainWindow();

    const readStream = session.sftp.createReadStream(remotePath);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const writeStream = fs.createWriteStream(localPath);

    readStream.on('data', (chunk: Buffer) => {
      if (transferState.cancelled) {
        readStream.destroy();
        writeStream.destroy();
        return;
      }
      transferred += chunk.length;
      if (win) {
        win.webContents.send(`sftp:progress:${transferId}`, {
          bytes: transferred,
          total,
          percentage: Math.round((transferred / total) * 100),
        });
      }
    });

    readStream.pipe(writeStream);

    // Return transferId immediately so frontend can set up progress listener
    return transferId;
  });

  ipcMain.on('sftp:cancel', (_event, transferId: string) => {
    const transfer = activeTransfers.get(transferId);
    if (transfer) {
      transfer.cancelled = true;
      activeTransfers.delete(transferId);
    }
  });
}

async function deleteRecursive(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (err, stats) => {
      if (err) return reject(err);

      if ((stats.mode & 0o40000) !== 0) {
        // Directory
        sftp.readdir(remotePath, async (err, list) => {
          if (err) return reject(err);
          try {
            for (const item of list) {
              await deleteRecursive(sftp, `${remotePath}/${item.filename}`);
            }
            sftp.rmdir(remotePath, (err) => {
              if (err) return reject(err);
              resolve();
            });
          } catch (e) {
            reject(e);
          }
        });
      } else {
        sftp.unlink(remotePath, (err) => {
          if (err) return reject(err);
          resolve();
        });
      }
    });
  });
}
