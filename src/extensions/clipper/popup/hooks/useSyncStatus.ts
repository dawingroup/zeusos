import { useState, useEffect, useCallback } from 'react';

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error' | 'success';
  pendingCount: number;
  lastSync: Date | null;
  error?: string;
  progress?: {
    synced: number;
    total: number;
  };
}

interface UseSyncStatusReturn {
  syncStatus: SyncStatus;
  triggerSync: () => Promise<{ success: boolean; synced: number; failed: number }>;
  refreshStatus: () => Promise<void>;
}

export function useSyncStatus(): UseSyncStatusReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle',
    pendingCount: 0,
    lastSync: null,
  });

  const refreshStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
      if (response) {
        setSyncStatus({
          status: response.status,
          pendingCount: response.pendingCount,
          lastSync: response.lastSync ? new Date(response.lastSync) : null,
          error: response.error,
        });
      }
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, []);

  useEffect(() => {
    // Initial status fetch
    refreshStatus();

    // Listen for sync status updates from service worker
    const handleMessage = (message: { 
      type: string; 
      status?: string; 
      synced?: number; 
      total?: number;
      failed?: number;
    }) => {
      if (message.type === 'SYNC_STATUS_UPDATE') {
        setSyncStatus(prev => ({
          ...prev,
          status: message.status as SyncStatus['status'],
          error: message.failed && message.failed > 0 
            ? `${message.failed} clips failed to sync` 
            : undefined,
        }));
        
        // Show success briefly then go back to idle
        if (message.status === 'idle' && message.synced && message.synced > 0) {
          setSyncStatus(prev => ({ ...prev, status: 'success' }));
          setTimeout(() => {
            setSyncStatus(prev => ({ ...prev, status: 'idle' }));
            refreshStatus();
          }, 2000);
        }
      }
      
      if (message.type === 'SYNC_PROGRESS') {
        setSyncStatus(prev => ({
          ...prev,
          status: 'syncing',
          progress: {
            synced: message.synced || 0,
            total: message.total || 0,
          },
        }));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Also listen for storage changes to update pending count
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.clips || changes.isSyncing || changes.lastSyncTime) {
        refreshStatus();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [refreshStatus]);

  const triggerSync = useCallback(async () => {
    setSyncStatus(prev => ({ ...prev, status: 'syncing', progress: undefined }));
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'REQUEST_SYNC' });
      return {
        success: response?.success ?? false,
        synced: response?.synced ?? 0,
        failed: response?.failed ?? 0,
      };
    } catch (error) {
      setSyncStatus(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Sync failed' 
      }));
      return { success: false, synced: 0, failed: 0 };
    }
  }, []);

  return { syncStatus, triggerSync, refreshStatus };
}
