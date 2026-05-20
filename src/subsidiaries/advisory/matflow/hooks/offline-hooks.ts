/**
 * Offline Hooks
 * Hooks for offline status and sync management
 */

import { useState, useEffect } from 'react';

// ============================================================================
// USE OFFLINE STATUS
// ============================================================================

export interface UseOfflineStatusReturn {
  isOnline: boolean;
  pendingChanges: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  syncing: boolean;
}

export const useOfflineStatus = (): UseOfflineStatusReturn => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check pending changes periodically
  useEffect(() => {
    const checkPendingChanges = async () => {
      // Placeholder - will connect to actual sync service
      // const count = await getSyncQueueCount();
      setPendingChanges(0);
    };

    checkPendingChanges();
    const interval = setInterval(checkPendingChanges, 30000);

    return () => clearInterval(interval);
  }, []);

  const syncNow = async () => {
    if (syncing || !isOnline) return;

    setSyncing(true);
    try {
      // Placeholder - will connect to actual sync service
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSyncTime(new Date());
      setPendingChanges(0);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  return {
    isOnline,
    pendingChanges,
    lastSyncTime,
    syncNow,
    syncing,
  };
};

export default {
  useOfflineStatus,
};
