/**
 * Firebase Offline Configuration
 * Initialize and manage Firestore offline persistence
 */

import {
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
  onSnapshotsInSync,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';

// ============================================================================
// PERSISTENCE INITIALIZATION
// ============================================================================

// Persistence is now enabled globally via initializeFirestore() in
// src/shared/services/firebase/firestore.ts with persistentLocalCache +
// persistentMultipleTabManager. This function is kept for backwards
// compatibility but is a no-op.

/**
 * Initialize Firestore offline persistence
 * @deprecated Persistence is now configured globally at Firestore init time.
 */
export async function initializeOfflinePersistence(): Promise<{
  success: boolean;
  error?: Error;
  multiTabSupported: boolean;
}> {
  return { success: true, multiTabSupported: true };
}

/**
 * Get persistence initialization status
 * @deprecated Persistence is now always enabled at init time.
 */
export function getPersistenceStatus(): {
  initialized: boolean;
  error: Error | null;
} {
  return {
    initialized: true,
    error: null,
  };
}

// ============================================================================
// NETWORK CONTROL
// ============================================================================

/**
 * Manually disable network access (force offline mode)
 */
export async function goOffline(): Promise<void> {
  await disableNetwork(db);
  console.log('[Offline] Network disabled');
}

/**
 * Re-enable network access
 */
export async function goOnline(): Promise<void> {
  await enableNetwork(db);
  console.log('[Offline] Network enabled');
}

/**
 * Wait for all pending writes to complete
 */
export async function waitForSync(): Promise<void> {
  await waitForPendingWrites(db);
  console.log('[Offline] All pending writes synced');
}

/**
 * Subscribe to snapshot sync events
 */
export function onSyncComplete(callback: () => void): () => void {
  return onSnapshotsInSync(db, callback);
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Estimate current cache size
 */
export async function estimateCacheSize(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentUsed: estimate.quota
        ? ((estimate.usage || 0) / estimate.quota) * 100
        : 0,
    };
  }
  
  return { usage: 0, quota: 0, percentUsed: 0 };
}

/**
 * Request persistent storage (prevents browser from evicting cache)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      return await navigator.storage.persist();
    }
    return true;
  }
  return false;
}

/**
 * Clear Firestore cache (use with caution)
 */
export async function clearCache(): Promise<void> {
  // Note: Firestore doesn't provide a direct method to clear cache
  // The cache is managed automatically
  // This is a placeholder for manual IndexedDB clearing if needed
  
  if ('indexedDB' in window) {
    const databases = await indexedDB.databases();
    for (const dbInfo of databases) {
      if (dbInfo.name?.includes('firestore')) {
        console.warn('[Offline] Firestore cache found:', dbInfo.name);
        // Don't actually delete - just log for now
        // indexedDB.deleteDatabase(dbInfo.name);
      }
    }
  }
}

export const offlineConfig = {
  initializeOfflinePersistence,
  getPersistenceStatus,
  goOffline,
  goOnline,
  waitForSync,
  onSyncComplete,
  estimateCacheSize,
  requestPersistentStorage,
  clearCache,
};

export default offlineConfig;
