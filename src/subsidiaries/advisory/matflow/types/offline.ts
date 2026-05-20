/**
 * Offline Configuration Types
 * Types for offline persistence, sync, and conflict resolution
 */

// ============================================================================
// NETWORK STATUS
// ============================================================================

export type NetworkStatus = 'online' | 'offline' | 'slow' | 'reconnecting';

export interface NetworkState {
  status: NetworkStatus;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  connectionQuality: 'good' | 'poor' | 'unknown';
  isMetered: boolean; // Mobile data vs WiFi
}

// ============================================================================
// SYNC STATUS
// ============================================================================

export type SyncStatus = 
  | 'synced'           // All data synchronized
  | 'pending'          // Has pending writes
  | 'syncing'          // Currently syncing
  | 'error'            // Sync failed
  | 'offline';         // Working offline

export interface SyncState {
  status: SyncStatus;
  pendingWrites: number;
  lastSyncAt: Date | null;
  syncErrors: SyncError[];
  isHydrated: boolean; // Initial data loaded from cache
}

export interface SyncError {
  id: string;
  operation: OfflineOperation;
  error: string;
  timestamp: Date;
  retryCount: number;
  resolved: boolean;
}

// ============================================================================
// OFFLINE OPERATIONS
// ============================================================================

export type OfflineOperationType = 
  | 'create'
  | 'update'
  | 'delete'
  | 'batch';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  collection: string;
  documentId: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  retryCount: number;
  priority: 'high' | 'normal' | 'low';
  status: 'pending' | 'processing' | 'failed' | 'completed';
  error?: string;
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

export type ConflictStrategy = 
  | 'server-wins'      // Always use server data
  | 'client-wins'      // Always use client data
  | 'latest-wins'      // Use most recently modified
  | 'merge'            // Attempt to merge changes
  | 'manual';          // Prompt user to resolve

export interface DataConflict {
  id: string;
  collection: string;
  documentId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  localTimestamp: Date;
  serverTimestamp: Date;
  strategy: ConflictStrategy;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merged' | 'discarded';
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export interface CacheConfig {
  // Collections to cache for offline use
  cachedCollections: string[];
  
  // Maximum cache size in bytes (default 100MB)
  maxCacheSize: number;
  
  // How long to keep cached data (in days)
  cacheDuration: number;
  
  // Collections that require sync before use
  criticalCollections: string[];
  
  // Whether to sync in background when online
  backgroundSync: boolean;
  
  // Sync interval in milliseconds
  syncInterval: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  cachedCollections: [
    'matflow_projects',
    'matflow_projects/{projectId}/boq_items',
    'matflow_projects/{projectId}/procurement_entries',
    'matflow_projects/{projectId}/stage_progress',
    'formulas',
    'material_categories',
  ],
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  cacheDuration: 30, // 30 days
  criticalCollections: ['formulas', 'material_categories'],
  backgroundSync: true,
  syncInterval: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// OFFLINE STORAGE KEYS
// ============================================================================

export const OFFLINE_STORAGE_KEYS = {
  PENDING_OPERATIONS: 'matflow_pending_operations',
  SYNC_STATE: 'matflow_sync_state',
  CONFLICTS: 'matflow_conflicts',
  LAST_SYNC: 'matflow_last_sync',
  CACHE_MANIFEST: 'matflow_cache_manifest',
  SYNC_ERRORS: 'matflow_sync_errors',
} as const;

// ============================================================================
// EVENTS
// ============================================================================

export type OfflineEventType = 
  | 'online'
  | 'offline'
  | 'sync-start'
  | 'sync-complete'
  | 'sync-error'
  | 'conflict-detected'
  | 'conflict-resolved'
  | 'operation-queued'
  | 'operation-completed';

export interface OfflineEvent {
  type: OfflineEventType;
  timestamp: Date;
  data?: unknown;
}
