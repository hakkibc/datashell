import { create } from 'zustand';
import type { Session, SessionGroup } from '../types/electron';

interface SessionState {
  sessions: Session[];
  groups: SessionGroup[];
  searchQuery: string;
  loading: boolean;

  setSessions: (sessions: Session[]) => void;
  setGroups: (groups: SessionGroup[]) => void;
  setSearchQuery: (query: string) => void;

  fetchAll: () => Promise<void>;
  createSession: (data: Omit<Session, 'id' | 'createdAt'>) => Promise<Session>;
  updateSession: (id: string, data: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  createGroup: (data: Omit<SessionGroup, 'id'>) => Promise<SessionGroup>;
  deleteGroup: (id: string) => Promise<void>;
  toggleGroupExpand: (id: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  groups: [],
  searchQuery: '',
  loading: false,

  setSessions: (sessions) => set({ sessions }),
  setGroups: (groups) => set({ groups }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  fetchAll: async () => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.sessions.getAll();
      set({ sessions: result.sessions, groups: result.groups });
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      set({ loading: false });
    }
  },

  createSession: async (data) => {
    const session = await window.electronAPI.sessions.create(data);
    set((state) => ({ sessions: [...state.sessions, session] }));
    return session;
  },

  updateSession: async (id, data) => {
    await window.electronAPI.sessions.update(id, data);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...data } : s)),
    }));
  },

  deleteSession: async (id) => {
    await window.electronAPI.sessions.delete(id);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    }));
  },

  createGroup: async (data) => {
    const group = await window.electronAPI.sessions.createGroup(data);
    set((state) => ({ groups: [...state.groups, group] }));
    return group;
  },

  deleteGroup: async (id) => {
    await window.electronAPI.sessions.deleteGroup(id);
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
      sessions: state.sessions.map((s) => (s.groupId === id ? { ...s, groupId: undefined } : s)),
    }));
  },

  toggleGroupExpand: (id) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === id ? { ...g, expanded: !g.expanded } : g
      ),
    }));
  },
}));
