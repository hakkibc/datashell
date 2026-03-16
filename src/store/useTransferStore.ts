import { create } from 'zustand';

export interface Transfer {
  id: string;
  fileName: string;
  direction: 'upload' | 'download';
  bytes: number;
  total: number;
  percentage: number;
  speed: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'error';
  startedAt: number;
}

interface TransferState {
  transfers: Transfer[];

  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (id: string, data: Partial<Transfer>) => void;
  removeTransfer: (id: string) => void;
  cancelTransfer: (id: string) => void;
  clearCompleted: () => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: [],

  addTransfer: (transfer) =>
    set((state) => ({ transfers: [...state.transfers, transfer] })),

  updateTransfer: (id, data) =>
    set((state) => ({
      transfers: state.transfers.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),

  removeTransfer: (id) =>
    set((state) => ({
      transfers: state.transfers.filter((t) => t.id !== id),
    })),

  cancelTransfer: (id) => {
    window.electronAPI?.sftp.cancel(id);
    set((state) => ({
      transfers: state.transfers.map((t) =>
        t.id === id ? { ...t, status: 'cancelled' as const } : t
      ),
    }));
  },

  clearCompleted: () =>
    set((state) => ({
      transfers: state.transfers.filter((t) => t.status === 'active' || t.status === 'paused'),
    })),
}));
