import { ipcMain, BrowserWindow, app } from 'electron';
import { Client, ClientChannel } from 'ssh2';
import Store from 'electron-store';
import fs from 'fs';
import type { Session, AuthConfig } from './sessions';
import { setSFTPClient } from './sftp';
import { setTunnelClient, removeTunnelClient } from './tunnels';

interface SSHConnection {
  client: Client;
  shell?: ClientChannel;
  connectionId: string;
  sessionId: string;
  jumpClient?: Client;
}

const connections = new Map<string, SSHConnection>();

const dataDir = app.getPath('userData');
const sessionStore = new Store({ name: 'sessions', cwd: dataDir });
const knownHostsStore = new Store({ name: 'known_hosts', cwd: dataDir, defaults: { hosts: {} as Record<string, string> } });

let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows[0] || null;
}

async function resolvePrivateKey(keyPath: string, passphrase?: string): Promise<{ key: Buffer; passphrase?: string }> {
  const content = fs.readFileSync(keyPath);
  // PPK detection — PuTTY key format
  if (content.toString('utf8').startsWith('PuTTY-User-Key-File')) {
    // ssh2 can handle PPK files directly in newer versions
    return { key: content, passphrase };
  }
  return { key: content, passphrase };
}

function buildClientConfig(auth: AuthConfig): Record<string, unknown> {
  const config: Record<string, unknown> = {
    username: auth.username,
  };

  switch (auth.method) {
    case 'password':
      config.password = auth.password;
      break;
    case 'privateKey':
      if (auth.privateKeyPath) {
        const { key, passphrase } = resolvePrivateKey as never; // resolved async in connect
        config.privateKey = key;
        if (passphrase) config.passphrase = passphrase;
      }
      break;
    case 'agent':
      config.agent = process.env.SSH_AUTH_SOCK || '\\\\.\\pipe\\openssh-ssh-agent';
      break;
  }

  return config;
}

function connectClient(client: Client, host: string, port: number, auth: AuthConfig): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const config: Record<string, unknown> = {
      host,
      port,
      username: auth.username,
      readyTimeout: 30000,
      keepaliveInterval: 30000,
    };

    switch (auth.method) {
      case 'password':
        config.password = auth.password;
        break;
      case 'privateKey':
        if (auth.privateKeyPath) {
          const resolved = await resolvePrivateKey(auth.privateKeyPath, auth.privateKeyPassphrase);
          config.privateKey = resolved.key;
          if (resolved.passphrase) config.passphrase = resolved.passphrase;
        }
        break;
      case 'agent':
        config.agent = process.env.SSH_AUTH_SOCK || '\\\\.\\pipe\\openssh-ssh-agent';
        break;
    }

    // Host key verification
    config.hostVerifier = (key: Buffer) => {
      const fingerprint = key.toString('hex');
      const knownHosts = knownHostsStore.get('hosts', {}) as Record<string, string>;
      const hostKey = `${host}:${port}`;

      if (knownHosts[hostKey]) {
        if (knownHosts[hostKey] !== fingerprint) {
          const win = getMainWindow();
          if (win) {
            win.webContents.send('ssh:hostkey-changed', { host, port, fingerprint });
          }
          return false;
        }
        return true;
      }

      // Auto-accept first connection, save to known hosts
      knownHosts[hostKey] = fingerprint;
      knownHostsStore.set('hosts', knownHosts);
      return true;
    };

    client.on('ready', () => resolve());
    client.on('error', (err) => reject(err));
    client.connect(config as never);
  });
}

async function connectViaJump(session: Session): Promise<{ target: Client; jump: Client }> {
  if (!session.jumpHost) throw new Error('No jump host configured');

  const jump = new Client();
  await connectClient(jump, session.jumpHost.host, session.jumpHost.port, session.jumpHost.auth);

  return new Promise((resolve, reject) => {
    jump.forwardOut('127.0.0.1', 0, session.host, session.port, async (err, stream) => {
      if (err) {
        jump.end();
        return reject(err);
      }

      const target = new Client();
      const config: Record<string, unknown> = {
        sock: stream,
        username: session.auth.username,
        readyTimeout: 30000,
      };

      switch (session.auth.method) {
        case 'password':
          config.password = session.auth.password;
          break;
        case 'privateKey':
          if (session.auth.privateKeyPath) {
            const resolved = await resolvePrivateKey(session.auth.privateKeyPath, session.auth.privateKeyPassphrase);
            config.privateKey = resolved.key;
            if (resolved.passphrase) config.passphrase = resolved.passphrase;
          }
          break;
        case 'agent':
          config.agent = process.env.SSH_AUTH_SOCK || '\\\\.\\pipe\\openssh-ssh-agent';
          break;
      }

      target.on('ready', () => resolve({ target, jump }));
      target.on('error', (err) => {
        jump.end();
        reject(err);
      });
      target.connect(config as never);
    });
  });
}

function startKeepalive() {
  if (keepaliveInterval) return;
  keepaliveInterval = setInterval(() => {
    for (const [, conn] of connections) {
      try {
        conn.client.exec('echo', () => {});
      } catch {
        // Connection might be dead
      }
    }
  }, 30000);
}

function stopKeepaliveIfEmpty() {
  if (connections.size === 0 && keepaliveInterval) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

export function registerSSHHandlers() {
  ipcMain.handle('ssh:connect', async (_event, sessionId: string) => {
    const sessions = sessionStore.get('sessions', []) as Session[];
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const connectionId = generateId();

    try {
      let client: Client;
      let jumpClient: Client | undefined;

      if (session.jumpHost) {
        const result = await connectViaJump(session);
        client = result.target;
        jumpClient = result.jump;
      } else {
        client = new Client();
        await connectClient(client, session.host, session.port, session.auth);
      }

      const connection: SSHConnection = {
        client,
        connectionId,
        sessionId,
        jumpClient,
      };

      connections.set(connectionId, connection);

      // Register client for SFTP and tunnel usage
      setSFTPClient(connectionId, client);
      setTunnelClient(connectionId, client);

      // Handle disconnect
      client.on('close', () => {
        const win = getMainWindow();
        if (win) {
          win.webContents.send(`ssh:disconnected:${connectionId}`, 'Connection closed');
        }
        connections.delete(connectionId);
        removeTunnelClient(connectionId);
        jumpClient?.end();
        stopKeepaliveIfEmpty();
      });

      client.on('error', (err) => {
        const win = getMainWindow();
        if (win) {
          win.webContents.send(`ssh:disconnected:${connectionId}`, err.message);
        }
        connections.delete(connectionId);
        removeTunnelClient(connectionId);
        jumpClient?.end();
        stopKeepaliveIfEmpty();
      });

      // Update last connected
      const idx = sessions.findIndex((s) => s.id === sessionId);
      if (idx !== -1) {
        sessions[idx].lastConnected = Date.now();
        sessionStore.set('sessions', sessions);
      }

      startKeepalive();
      return connectionId;
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('Authentication')) {
        throw new Error(`Kimlik doğrulama hatası: ${error.message}`);
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        throw new Error(`Sunucu bulunamadı: ${session.host}`);
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
        throw new Error(`Bağlantı zaman aşımı: ${session.host}:${session.port}`);
      }
      throw new Error(`Bağlantı hatası: ${error.message}`);
    }
  });

  ipcMain.handle('ssh:shell', async (_event, connectionId: string, options?: { cols?: number; rows?: number }) => {
    const conn = connections.get(connectionId);
    if (!conn) throw new Error(`Connection not found: ${connectionId}`);

    return new Promise<void>((resolve, reject) => {
      conn.client.shell(
        {
          cols: options?.cols || 80,
          rows: options?.rows || 24,
          term: 'xterm-256color',
        },
        (err, stream) => {
          if (err) return reject(err);

          conn.shell = stream;

          stream.on('data', (data: Buffer) => {
            const win = getMainWindow();
            if (win) {
              win.webContents.send(`ssh:data:${connectionId}`, data.toString('utf8'));
            }
          });

          stream.on('close', () => {
            const win = getMainWindow();
            if (win) {
              win.webContents.send(`ssh:disconnected:${connectionId}`, 'Shell closed');
            }
          });

          resolve();
        }
      );
    });
  });

  // Handle input from renderer
  ipcMain.on('ssh:input', (_event, connectionId: string, data: string) => {
    const conn = connections.get(connectionId);
    if (conn?.shell) {
      conn.shell.write(data);
    }
  });

  ipcMain.handle('ssh:resize', async (_event, connectionId: string, cols: number, rows: number) => {
    const conn = connections.get(connectionId);
    if (conn?.shell) {
      conn.shell.setWindow(rows, cols, 0, 0);
    }
  });

  ipcMain.handle('ssh:disconnect', async (_event, connectionId: string) => {
    const conn = connections.get(connectionId);
    if (conn) {
      conn.shell?.close();
      conn.client.end();
      conn.jumpClient?.end();
      connections.delete(connectionId);
      stopKeepaliveIfEmpty();
    }
  });
}
