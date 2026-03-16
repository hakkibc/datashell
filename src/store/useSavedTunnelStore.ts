import { create } from 'zustand';
import type { SavedTunnel } from '../types/electron';

interface SavedTunnelState {
  tunnels: SavedTunnel[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  createTunnel: (data: Omit<SavedTunnel, 'id' | 'createdAt'>) => Promise<SavedTunnel>;
  updateTunnel: (id: string, data: Partial<SavedTunnel>) => Promise<void>;
  deleteTunnel: (id: string) => Promise<void>;
}

export const useSavedTunnelStore = create<SavedTunnelState>((set) => ({
  tunnels: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const tunnels = await window.electronAPI.savedTunnels.getAll();
      set({ tunnels });
    } catch (err) {
      console.error('Failed to fetch saved tunnels:', err);
    } finally {
      set({ loading: false });
    }
  },

  createTunnel: async (data) => {
    const tunnel = await window.electronAPI.savedTunnels.create(data);
    set((state) => ({ tunnels: [...state.tunnels, tunnel] }));
    return tunnel;
  },

  updateTunnel: async (id, data) => {
    await window.electronAPI.savedTunnels.update(id, data);
    set((state) => ({
      tunnels: state.tunnels.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }));
  },

  deleteTunnel: async (id) => {
    await window.electronAPI.savedTunnels.delete(id);
    set((state) => ({
      tunnels: state.tunnels.filter((t) => t.id !== id),
    }));
  },
}));
