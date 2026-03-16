import { ipcMain, app } from 'electron';
import { Client } from 'ssh2';
import net from 'net';
import Store from 'electron-store';
import crypto from 'crypto';
import fs from 'fs';

// ── Types ──

export interface SavedTunnel {
  id: string;
  name: string;
  sessionId: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  createdAt: number;
}

interface ActiveTunnelInfo {
  tunnelId: string;
  connectionId: string;
  savedTunnelId?: string;
  type: 'local' | 'remote' | 'dynamic';
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  status: 'active' | 'error';
  server?: net.Server;
  connectedClients: number;
  bytesIn: number;
  bytesOut: number;
}

interface StoreSchema {
  savedTunnels: SavedTunnel[];
}

// ── State ──

const dataDir = app.getPath('userData');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const store = new Store<StoreSchema>({
  name: 'tunnels',
  cwd: dataDir,
  defaults: {
    savedTunnels: [],
  },
});

const activeTunnels = new Map<string, ActiveTunnelInfo>();

// Reference to SSH client pool (set from ssh.ts via sftp.ts's clientPool or directly)
const tunnelClientPool = new Map<string, Client>();

export function setTunnelClient(connectionId: string, client: Client) {
  tunnelClientPool.set(connectionId, client);
}

export function removeTunnelClient(connectionId: string) {
  // Stop all tunnels for this connection
  for (const [id, tunnel] of activeTunnels) {
    if (tunnel.connectionId === connectionId) {
      tunnel.server?.close();
      activeTunnels.delete(id);
    }
  }
  tunnelClientPool.delete(connectionId);
}

function generateId(): string {
  return crypto.randomUUID();
}

// ── Tunnel Operations ──

function startLocalTunnel(
  client: Client,
  connectionId: string,
  localPort: number,
  remoteHost: string,
  remotePort: number,
  savedTunnelId?: string
): string {
  const tunnelId = generateId();

  const server = net.createServer((socket) => {
    const tunnel = activeTunnels.get(tunnelId);
    if (tunnel) tunnel.connectedClients++;

    client.forwardOut(
      socket.remoteAddress || '127.0.0.1',
      socket.remotePort || 0,
      remoteHost,
      remotePort,
      (err, stream) => {
        if (err) {
          socket.end();
          return;
        }
        socket.pipe(stream);
        stream.pipe(socket);

        stream.on('data', (data: Buffer) => {
          const t = activeTunnels.get(tunnelId);
          if (t) t.bytesIn += data.length;
        });
        socket.on('data', (data: Buffer) => {
          const t = activeTunnels.get(tunnelId);
          if (t) t.bytesOut += data.length;
        });

        socket.on('close', () => {
          const t = activeTunnels.get(tunnelId);
          if (t) t.connectedClients = Math.max(0, t.connectedClients - 1);
        });
      }
    );
  });

  server.listen(localPort, '127.0.0.1');

  activeTunnels.set(tunnelId, {
    tunnelId,
    connectionId,
    savedTunnelId,
    type: 'local',
    localPort,
    remoteHost,
    remotePort,
    status: 'active',
    server,
    connectedClients: 0,
    bytesIn: 0,
    bytesOut: 0,
  });

  server.on('error', () => {
    const t = activeTunnels.get(tunnelId);
    if (t) t.status = 'error';
  });

  return tunnelId;
}

function startRemoteTunnel(
  client: Client,
  connectionId: string,
  localPort: number,
  remoteHost: string,
  remotePort: number,
  savedTunnelId?: string
): Promise<string> {
  const tunnelId = generateId();

  return new Promise((resolve, reject) => {
    client.forwardIn(remoteHost, remotePort, (err) => {
      if (err) return reject(err);

      activeTunnels.set(tunnelId, {
        tunnelId,
        connectionId,
        savedTunnelId,
        type: 'remote',
        localPort,
        remoteHost,
        remotePort,
        status: 'active',
        connectedClients: 0,
        bytesIn: 0,
        bytesOut: 0,
      });

      resolve(tunnelId);
    });

    client.on('tcp connection', (info, accept) => {
      const stream = accept();
      const socket = net.connect(localPort, '127.0.0.1');
      stream.pipe(socket);
      socket.pipe(stream);

      stream.on('data', (data: Buffer) => {
        const t = activeTunnels.get(tunnelId);
        if (t) t.bytesIn += data.length;
      });
      socket.on('data', (data: Buffer) => {
        const t = activeTunnels.get(tunnelId);
        if (t) t.bytesOut += data.length;
      });
    });
  });
}

function startDynamicTunnel(
  client: Client,
  connectionId: string,
  localPort: number,
  savedTunnelId?: string
): string {
  const tunnelId = generateId();

  const server = net.createServer((socket) => {
    const tunnel = activeTunnels.get(tunnelId);
    if (tunnel) tunnel.connectedClients++;

    // Simple SOCKS5 proxy
    socket.once('data', (greeting) => {
      // SOCKS5 greeting response: version 5, no auth
      socket.write(Buffer.from([0x05, 0x00]));

      socket.once('data', (request) => {
        const cmd = request[1];
        if (cmd !== 0x01) {
          // Only CONNECT supported
          socket.end(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          return;
        }

        const addrType = request[3];
        let destHost: string;
        let destPort: number;

        if (addrType === 0x01) {
          // IPv4
          destHost = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
          destPort = request.readUInt16BE(8);
        } else if (addrType === 0x03) {
          // Domain
          const len = request[4];
          destHost = request.subarray(5, 5 + len).toString();
          destPort = request.readUInt16BE(5 + len);
        } else {
          socket.end(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          return;
        }

        client.forwardOut('127.0.0.1', 0, destHost, destPort, (err, stream) => {
          if (err) {
            socket.end(Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            return;
          }

          // Success response
          socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          socket.pipe(stream);
          stream.pipe(socket);

          stream.on('data', (data: Buffer) => {
            const t = activeTunnels.get(tunnelId);
            if (t) t.bytesIn += data.length;
          });
          socket.on('data', (data: Buffer) => {
            const t = activeTunnels.get(tunnelId);
            if (t) t.bytesOut += data.length;
          });
        });
      });
    });

    socket.on('close', () => {
      const t = activeTunnels.get(tunnelId);
      if (t) t.connectedClients = Math.max(0, t.connectedClients - 1);
    });
  });

  server.listen(localPort, '127.0.0.1');

  activeTunnels.set(tunnelId, {
    tunnelId,
    connectionId,
    savedTunnelId,
    type: 'dynamic',
    localPort,
    status: 'active',
    server,
    connectedClients: 0,
    bytesIn: 0,
    bytesOut: 0,
  });

  server.on('error', () => {
    const t = activeTunnels.get(tunnelId);
    if (t) t.status = 'error';
  });

  return tunnelId;
}

// ── IPC Handlers ──

export function registerTunnelHandlers() {
  // ── Saved Tunnel CRUD ──

  ipcMain.handle('savedTunnels:getAll', () => {
    return store.get('savedTunnels', []);
  });

  ipcMain.handle('savedTunnels:create', (_event, data: Omit<SavedTunnel, 'id' | 'createdAt'>) => {
    const tunnel: SavedTunnel = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
    };
    const tunnels = store.get('savedTunnels', []);
    tunnels.push(tunnel);
    store.set('savedTunnels', tunnels);
    return tunnel;
  });

  ipcMain.handle('savedTunnels:update', (_event, id: string, data: Partial<SavedTunnel>) => {
    const tunnels = store.get('savedTunnels', []);
    const index = tunnels.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Saved tunnel not found: ${id}`);
    tunnels[index] = { ...tunnels[index], ...data };
    store.set('savedTunnels', tunnels);
    return tunnels[index];
  });

  ipcMain.handle('savedTunnels:delete', (_event, id: string) => {
    const tunnels = store.get('savedTunnels', []);
    store.set('savedTunnels', tunnels.filter((t) => t.id !== id));
  });

  // ── Active Tunnel Management ──

  ipcMain.handle('tunnel:start', async (_event, connectionId: string, config: {
    type: 'local' | 'remote' | 'dynamic';
    localPort: number;
    remoteHost?: string;
    remotePort?: number;
    savedTunnelId?: string;
  }) => {
    const client = tunnelClientPool.get(connectionId);
    if (!client) throw new Error(`No SSH connection found: ${connectionId}`);

    switch (config.type) {
      case 'local':
        return startLocalTunnel(
          client, connectionId, config.localPort,
          config.remoteHost || '127.0.0.1', config.remotePort || 80,
          config.savedTunnelId
        );
      case 'remote':
        return startRemoteTunnel(
          client, connectionId, config.localPort,
          config.remoteHost || '0.0.0.0', config.remotePort || 80,
          config.savedTunnelId
        );
      case 'dynamic':
        return startDynamicTunnel(
          client, connectionId, config.localPort,
          config.savedTunnelId
        );
      default:
        throw new Error(`Unknown tunnel type: ${config.type}`);
    }
  });

  ipcMain.handle('tunnel:stop', async (_event, tunnelId: string) => {
    const tunnel = activeTunnels.get(tunnelId);
    if (!tunnel) return;

    tunnel.server?.close();
    activeTunnels.delete(tunnelId);
  });

  ipcMain.handle('tunnel:list', () => {
    return Array.from(activeTunnels.values()).map(({ server, ...rest }) => rest);
  });

  ipcMain.handle('tunnel:listForConnection', (_event, connectionId: string) => {
    return Array.from(activeTunnels.values())
      .filter((t) => t.connectionId === connectionId)
      .map(({ server, ...rest }) => rest);
  });
}
