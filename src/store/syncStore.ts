import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface SyncStore {
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  syncError: string | null;

  setIsOnline: (online: boolean) => void;
  setLastSyncAt: (iso: string) => void;
  setPendingCount: (count: number) => void;
  setSyncError: (error: string | null) => void;
}

export const useSyncStore = create<SyncStore>()(
  immer(set => ({
    isOnline: true,
    lastSyncAt: null,
    pendingCount: 0,
    syncError: null,

    setIsOnline: online => set(s => { s.isOnline = online; }),
    setLastSyncAt: iso => set(s => { s.lastSyncAt = iso; }),
    setPendingCount: count => set(s => { s.pendingCount = count; }),
    setSyncError: error => set(s => { s.syncError = error; }),
  })),
);
