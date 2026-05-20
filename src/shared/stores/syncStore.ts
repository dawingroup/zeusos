/**
 * Sync Store
 * Offline sync state management with Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PendingChange {
  id: string;
  collection: string;
  documentId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingChanges: PendingChange[];
  syncErrors: SyncError[];

  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSyncTime: (time: number) => void;
  addPendingChange: (change: Omit<PendingChange, 'id' | 'timestamp' | 'retryCount'>) => void;
  removePendingChange: (id: string) => void;
  incrementRetryCount: (id: string) => void;
  addSyncError: (error: Omit<SyncError, 'id' | 'timestamp'>) => void;
  clearSyncErrors: () => void;
  clearAllPendingChanges: () => void;
}

interface SyncError {
  id: string;
  changeId: string;
  message: string;
  timestamp: number;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
      lastSyncTime: null,
      pendingChanges: [],
      syncErrors: [],

      setOnline: (online) => set({ isOnline: online }),

      setSyncing: (syncing) => set({ isSyncing: syncing }),

      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      addPendingChange: (change) =>
        set((state) => ({
          pendingChanges: [
            ...state.pendingChanges,
            {
              ...change,
              id: `change-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
              retryCount: 0,
            },
          ],
        })),

      removePendingChange: (id) =>
        set((state) => ({
          pendingChanges: state.pendingChanges.filter((c) => c.id !== id),
        })),

      incrementRetryCount: (id) =>
        set((state) => ({
          pendingChanges: state.pendingChanges.map((c) =>
            c.id === id ? { ...c, retryCount: c.retryCount + 1 } : c
          ),
        })),

      addSyncError: (error) =>
        set((state) => ({
          syncErrors: [
            ...state.syncErrors,
            {
              ...error,
              id: `error-${Date.now()}`,
              timestamp: Date.now(),
            },
          ],
        })),

      clearSyncErrors: () => set({ syncErrors: [] }),

      clearAllPendingChanges: () => set({ pendingChanges: [] }),
    }),
    {
      name: 'sync-storage',
      partialize: (state) => ({
        pendingChanges: state.pendingChanges,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);
