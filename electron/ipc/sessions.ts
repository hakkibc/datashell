import { ipcMain, app } from 'electron';
import Store from 'electron-store';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Types
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

interface StoreSchema {
  sessions: Session[];
  groups: SessionGroup[];
}

// Portable: verileri exe yanındaki data/ klasöründe tut
const dataDir = app.getPath('userData');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const store = new Store<StoreSchema>({
  name: 'sessions',
  cwd: dataDir,
  defaults: {
    sessions: [],
    groups: [],
  },
});

export function registerSessionHandlers() {
  ipcMain.handle('sessions:getAll', () => {
    return {
      sessions: store.get('sessions', []),
      groups: store.get('groups', []),
    };
  });

  ipcMain.handle('sessions:create', (_event, sessionData: Omit<Session, 'id' | 'createdAt'>) => {
    const session: Session = {
      ...sessionData,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const sessions = store.get('sessions', []);
    sessions.push(session);
    store.set('sessions', sessions);
    return session;
  });

  ipcMain.handle('sessions:update', (_event, id: string, data: Partial<Session>) => {
    const sessions = store.get('sessions', []);
    const index = sessions.findIndex((s) => s.id === id);
    if (index === -1) throw new Error(`Session not found: ${id}`);
    sessions[index] = { ...sessions[index], ...data };
    store.set('sessions', sessions);
    return sessions[index];
  });

  ipcMain.handle('sessions:delete', (_event, id: string) => {
    const sessions = store.get('sessions', []);
    store.set(
      'sessions',
      sessions.filter((s) => s.id !== id)
    );
  });

  ipcMain.handle('sessions:createGroup', (_event, groupData: Omit<SessionGroup, 'id'>) => {
    const group: SessionGroup = {
      ...groupData,
      id: crypto.randomUUID(),
    };
    const groups = store.get('groups', []);
    groups.push(group);
    store.set('groups', groups);
    return group;
  });

  ipcMain.handle('sessions:deleteGroup', (_event, id: string) => {
    const groups = store.get('groups', []);
    store.set(
      'groups',
      groups.filter((g) => g.id !== id)
    );
    // Move sessions from deleted group to ungrouped
    const sessions = store.get('sessions', []);
    store.set(
      'sessions',
      sessions.map((s) => (s.groupId === id ? { ...s, groupId: undefined } : s))
    );
  });

  ipcMain.handle('sessions:search', (_event, query: string) => {
    const sessions = store.get('sessions', []);
    const q = query.toLowerCase();
    return sessions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });
}
