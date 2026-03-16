import { create } from 'zustand';

export type TabType = 'terminal' | 'sftp';
export type TabStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface Tab {
  id: string;
  sessionId: string;
  sessionName: string;
  host: string;
  type: TabType;
  connectionId?: string;
  status: TabStatus;
  color?: string;
  errorMessage?: string;
  autoSftp?: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;

  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, data: Partial<Tab>) => void;
  nextTab: () => void;
  prevTab: () => void;
  closeOthers: (id: string) => void;
  closeAll: () => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActive = state.activeTabId;
      if (state.activeTabId === id) {
        const idx = state.tabs.findIndex((t) => t.id === id);
        newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
      }
      return { tabs: newTabs, activeTabId: newActive };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, data) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),

  nextTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = (idx + 1) % tabs.length;
    set({ activeTabId: tabs[next].id });
  },

  prevTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = (idx - 1 + tabs.length) % tabs.length;
    set({ activeTabId: tabs[prev].id });
  },

  closeOthers: (id) =>
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    })),

  closeAll: () => set({ tabs: [], activeTabId: null }),
}));
