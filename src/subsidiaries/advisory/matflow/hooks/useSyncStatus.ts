/**
 * Sync Status Hook
 * Monitor and manage data synchronization state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SyncState, OfflineOperation } from '../types/offline';
import { useNetworkStatus } from './useNetworkStatus';
import { waitForSync, onSyncComplete } from '../services/offlineConfig';
import syncQueueService from '../services/syncQueueService';

// Simple notification helper
const notify = (message: string, type: 'success' | 'error' = 'success') => {
  if (type === 'error') {
    console.error('[Sync]', message);
  } else {
    console.log('[Sync]', message);
  }
};

interface UseSyncStatusOptions {
  autoSync?: boolean;
  syncInterval?: number;
  showNotifications?: boolean;
}

export function useSyncStatus(options: UseSyncStatusOptions = {}) {
  const {
    autoSync = true,
    syncInterval = 30000, // 30 seconds
    showNotifications = true,
  } = options;

  const { isOnline, isOffline, status: networkStatus } = useNetworkStatus();
  
  const [state, setState] = useState<SyncState>({
    status: 'synced',
    pendingWrites: 0,
    lastSyncAt: null,
    syncErrors: [],
    isHydrated: false,
  });

  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  // Update pending count
  const updatePendingCount = useCallback(() => {
    const count = syncQueueService.getPendingCount();
    setState((prev) => ({
      ...prev,
      pendingWrites: count,
      status: count > 0 ? 'pending' : prev.status === 'syncing' ? 'syncing' : 'synced',
    }));
  }, []);

  // Perform sync
  const performSync = useCallback(async (): Promise<boolean> => {
    if (isSyncingRef.current || !isOnline) {
      return false;
    }

    isSyncingRef.current = true;
    setState((prev) => ({ ...prev, status: 'syncing' }));

    try {
      // Process queued operations
      const result = await syncQueueService.processSyncQueue();
      
      // Wait for Firestore pending writes
      await waitForSync();

      setState((prev) => ({
        ...prev,
        status: result.failed > 0 ? 'error' : 'synced',
        pendingWrites: syncQueueService.getPendingCount(),
        lastSyncAt: new Date(),
        syncErrors: result.errors,
      }));

      if (showNotifications) {
        if (result.processed > 0) {
          notify(`Synced ${result.processed} changes`);
        }
        if (result.failed > 0) {
          notify(`Failed to sync ${result.failed} changes`, 'error');
        }
      }

      return result.failed === 0;
    } catch (error: unknown) {
      const errorMessage = (error as Error).message || 'Unknown error';
      console.error('[Sync] Error:', error);
      
      setState((prev) => ({
        ...prev,
        status: 'error',
        syncErrors: [
          ...prev.syncErrors,
          {
            id: Date.now().toString(),
            operation: {} as OfflineOperation,
            error: errorMessage,
            timestamp: new Date(),
            retryCount: 0,
            resolved: false,
          },
        ],
      }));

      if (showNotifications) {
        notify('Sync failed: ' + errorMessage, 'error');
      }

      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, [isOnline, showNotifications]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && state.pendingWrites > 0 && autoSync) {
      performSync();
    }
  }, [isOnline, state.pendingWrites, autoSync, performSync]);

  // Periodic sync
  useEffect(() => {
    if (!autoSync || !isOnline) return;

    syncTimerRef.current = setInterval(() => {
      if (state.pendingWrites > 0) {
        performSync();
      }
    }, syncInterval);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [autoSync, isOnline, syncInterval, state.pendingWrites, performSync]);

  // Listen for operation events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleQueued = () => updatePendingCount();
    const handleCompleted = () => updatePendingCount();

    window.addEventListener('offline-operation-queued', handleQueued);
    window.addEventListener('offline-operation-completed', handleCompleted);

    return () => {
      window.removeEventListener('offline-operation-queued', handleQueued);
      window.removeEventListener('offline-operation-completed', handleCompleted);
    };
  }, [updatePendingCount]);

  // Subscribe to Firestore sync events
  useEffect(() => {
    const unsubscribe = onSyncComplete(() => {
      setState((prev) => ({
        ...prev,
        isHydrated: true,
      }));
    });

    return () => unsubscribe();
  }, []);

  // Initial pending count
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Update status based on network
  useEffect(() => {
    if (isOffline) {
      setState((prev) => ({ ...prev, status: 'offline' }));
    }
  }, [isOffline]);

  // Retry failed
  const retryFailed = useCallback(async () => {
    const result = await syncQueueService.retryFailedOperations();
    
    if (showNotifications) {
      if (result.succeeded > 0) {
        notify(`Retried ${result.succeeded} operations successfully`);
      } else if (result.retried > 0) {
        notify('Retry failed', 'error');
      }
    }
    
    updatePendingCount();
  }, [showNotifications, updatePendingCount]);

  // Clear errors
  const clearErrors = useCallback(() => {
    syncQueueService.clearErrors();
    setState((prev) => ({ ...prev, syncErrors: [] }));
  }, []);

  return {
    ...state,
    isSyncing: state.status === 'syncing',
    hasPendingWrites: state.pendingWrites > 0,
    hasErrors: state.syncErrors.length > 0,
    sync: performSync,
    retryFailed,
    clearErrors,
    networkStatus,
    isOnline,
    isOffline,
  };
}

export default useSyncStatus;
