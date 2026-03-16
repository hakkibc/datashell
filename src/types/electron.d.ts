export interface ElectronAPI {
  sessions: {
    getAll: () => Promise<{ sessions: Session[]; groups: SessionGroup[] }>;
    create: (session: Omit<Session, 'id' | 'createdAt'>) => Promise<Session>;
    update: (id: string, data: Partial<Session>) => Promise<Session>;
    delete: (id: string) => Promise<void>;
    createGroup: (group: Omit<SessionGroup, 'id'>) => Promise<SessionGroup>;
    deleteGroup: (id: string) => Promise<void>;
    search: (query: string) => Promise<Session[]>;
  };
  ssh: {
    connect: (sessionId: string) => Promise<string>;
    openShell: (connectionId: string, options?: { cols?: number; rows?: number }) => Promise<void>;
    sendInput: (connectionId: string, data: string) => void;
    resize: (connectionId: string, cols: number, rows: number) => Promise<void>;
    disconnect: (connectionId: string) => Promise<void>;
    onData: (connectionId: string, callback: (data: string) => void) => () => void;
    onDisconnected: (connectionId: string, callback: (reason: string) => void) => () => void;
    onHostKeyChanged: (callback: (data: unknown) => void) => () => void;
  };
  sftp: {
    open: (connectionId: string) => Promise<string>;
    readdir: (sftpId: string, remotePath: string) => Promise<FileEntry[]>;
    stat: (sftpId: string, remotePath: string) => Promise<unknown>;
    mkdir: (sftpId: string, remotePath: string) => Promise<void>;
    rename: (sftpId: string, oldPath: string, newPath: string) => Promise<void>;
    delete: (sftpId: string, remotePath: string, recursive?: boolean) => Promise<void>;
    chmod: (sftpId: string, remotePath: string, mode: string) => Promise<void>;
    upload: (sftpId: string, localPath: string, remotePath: string) => Promise<string>;
    download: (sftpId: string, remotePath: string, localPath: string) => Promise<string>;
    cancel: (transferId: string) => void;
    onProgress: (transferId: string, callback: (progress: TransferProgress) => void) => () => void;
  };
  tunnel: {
    start: (connectionId: string, config: TunnelConfig) => Promise<string>;
    stop: (tunnelId: string) => Promise<void>;
    list: () => Promise<ActiveTunnel[]>;
    listForConnection: (connectionId: string) => Promise<ActiveTunnel[]>;
  };
  local: {
    readdir: (dirPath: string) => Promise<FileEntry[]>;
    selectDirectory: () => Promise<string | null>;
    selectFile: () => Promise<string[]>;
    selectSavePath: (defaultName: string) => Promise<string | null>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isMaximized: () => Promise<boolean>;
  };
}

export interface AuthConfig {
  method: 'password' | 'privateKey' | 'agent';
  username: string;
  password?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  useAgent?: boolean;
}

export interface JumpHost {
  host: string;
  port: number;
  auth: AuthConfig;
}

export interface TunnelConfig {
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  description?: string;
}

export interface Session {
  id: string;
  name: string;
  groupId?: string;
  host: string;
  port: number;
  auth: AuthConfig;
  jumpHost?: JumpHost;
  tunnels?: TunnelConfig[];
  tags?: string[];
  lastConnected?: number;
  color?: string;
  createdAt: number;
}

export interface SessionGroup {
  id: string;
  name: string;
  parentId?: string;
  expanded?: boolean;
}

export interface FileEntry {
  name: string;
  longname: string;
  attrs: {
    size: number;
    mode: number;
    mtime: number;
    atime: number;
    uid: number;
    gid: number;
  };
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface TransferProgress {
  bytes: number;
  total: number;
  percentage: number;
}

export interface ActiveTunnel {
  tunnelId: string;
  connectionId: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  status: 'active' | 'error';
  connectedClients: number;
  bytesIn: number;
  bytesOut: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
