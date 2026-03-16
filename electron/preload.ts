import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Session management
  sessions: {
    getAll: () => ipcRenderer.invoke('sessions:getAll'),
    create: (session: unknown) => ipcRenderer.invoke('sessions:create', session),
    update: (id: string, data: unknown) => ipcRenderer.invoke('sessions:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('sessions:delete', id),
    createGroup: (group: unknown) => ipcRenderer.invoke('sessions:createGroup', group),
    deleteGroup: (id: string) => ipcRenderer.invoke('sessions:deleteGroup', id),
    search: (query: string) => ipcRenderer.invoke('sessions:search', query),
  },

  // SSH connection
  ssh: {
    connect: (sessionId: string) => ipcRenderer.invoke('ssh:connect', sessionId),
    openShell: (connectionId: string, options: unknown) =>
      ipcRenderer.invoke('ssh:shell', connectionId, options),
    sendInput: (connectionId: string, data: string) =>
      ipcRenderer.send('ssh:input', connectionId, data),
    resize: (connectionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:resize', connectionId, cols, rows),
    disconnect: (connectionId: string) =>
      ipcRenderer.invoke('ssh:disconnect', connectionId),
    onData: (connectionId: string, callback: (data: string) => void) => {
      const channel = `ssh:data:${connectionId}`;
      const listener = (_event: unknown, data: string) => callback(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    onDisconnected: (connectionId: string, callback: (reason: string) => void) => {
      const channel = `ssh:disconnected:${connectionId}`;
      const listener = (_event: unknown, reason: string) => callback(reason);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    onHostKeyChanged: (callback: (data: unknown) => void) => {
      const listener = (_event: unknown, data: unknown) => callback(data);
      ipcRenderer.on('ssh:hostkey-changed', listener);
      return () => ipcRenderer.removeListener('ssh:hostkey-changed', listener);
    },
  },

  // SFTP operations
  sftp: {
    open: (connectionId: string) => ipcRenderer.invoke('sftp:open', connectionId),
    readdir: (sftpId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:readdir', sftpId, remotePath),
    stat: (sftpId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:stat', sftpId, remotePath),
    mkdir: (sftpId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:mkdir', sftpId, remotePath),
    rename: (sftpId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', sftpId, oldPath, newPath),
    delete: (sftpId: string, remotePath: string, recursive?: boolean) =>
      ipcRenderer.invoke('sftp:delete', sftpId, remotePath, recursive),
    chmod: (sftpId: string, remotePath: string, mode: string) =>
      ipcRenderer.invoke('sftp:chmod', sftpId, remotePath, mode),
    upload: (sftpId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:upload', sftpId, localPath, remotePath),
    download: (sftpId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke('sftp:download', sftpId, remotePath, localPath),
    cancel: (transferId: string) => ipcRenderer.send('sftp:cancel', transferId),
    onProgress: (transferId: string, callback: (progress: unknown) => void) => {
      const channel = `sftp:progress:${transferId}`;
      const listener = (_event: unknown, progress: unknown) => callback(progress);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },

  // Tunnel / Port forwarding
  tunnel: {
    start: (connectionId: string, config: unknown) =>
      ipcRenderer.invoke('tunnel:start', connectionId, config),
    stop: (tunnelId: string) => ipcRenderer.invoke('tunnel:stop', tunnelId),
    list: () => ipcRenderer.invoke('tunnel:list'),
    listForConnection: (connectionId: string) =>
      ipcRenderer.invoke('tunnel:listForConnection', connectionId),
  },

  // Local filesystem
  local: {
    readdir: (dirPath: string) => ipcRenderer.invoke('local:readdir', dirPath),
    selectDirectory: () => ipcRenderer.invoke('local:selectDirectory'),
    selectFile: () => ipcRenderer.invoke('local:selectFile'),
    selectSavePath: (defaultName: string) => ipcRenderer.invoke('local:selectSavePath', defaultName),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
});
