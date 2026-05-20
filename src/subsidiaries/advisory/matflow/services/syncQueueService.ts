/**
 * Sync Queue Service
 * Manage offline operations queue and synchronization
 */

import {
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type {
  OfflineOperation,
  OfflineOperationType,
  SyncError,
} from '../types/offline';
import { OFFLINE_STORAGE_KEYS } from '../types/offline';

// Generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

function getStoredOperations(): OfflineOperation[] {
  try {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEYS.PENDING_OPERATIONS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeOperations(operations: OfflineOperation[]): void {
  localStorage.setItem(
    OFFLINE_STORAGE_KEYS.PENDING_OPERATIONS,
    JSON.stringify(operations)
  );
}

function getStoredErrors(): SyncError[] {
  try {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEYS.SYNC_ERRORS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeErrors(errors: SyncError[]): void {
  localStorage.setItem(OFFLINE_STORAGE_KEYS.SYNC_ERRORS, JSON.stringify(errors));
}

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

/**
 * Add operation to sync queue
 */
export function queueOperation(
  type: OfflineOperationType,
  collection: string,
  documentId: string,
  data?: Record<string, unknown>,
  priority: 'high' | 'normal' | 'low' = 'normal'
): string {
  const operations = getStoredOperations();
  
  const operation: OfflineOperation = {
    id: generateId(),
    type,
    collection,
    documentId,
    data,
    timestamp: new Date(),
    retryCount: 0,
    priority,
    status: 'pending',
  };
  
  // Add to queue based on priority
  if (priority === 'high') {
    operations.unshift(operation);
  } else {
    operations.push(operation);
  }
  
  storeOperations(operations);
  
  // Dispatch event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('offline-operation-queued', { detail: operation })
    );
  }
  
  return operation.id;
}

/**
 * Get all pending operations
 */
export function getPendingOperations(): OfflineOperation[] {
  return getStoredOperations().filter((op) => op.status === 'pending');
}

/**
 * Get count of pending operations
 */
export function getPendingCount(): number {
  return getPendingOperations().length;
}

/**
 * Remove operation from queue
 */
export function removeOperation(operationId: string): void {
  const operations = getStoredOperations();
  const filtered = operations.filter((op) => op.id !== operationId);
  storeOperations(filtered);
}

/**
 * Mark operation as completed
 */
export function completeOperation(operationId: string): void {
  const operations = getStoredOperations();
  const updated = operations.map((op) =>
    op.id === operationId ? { ...op, status: 'completed' as const } : op
  );
  storeOperations(updated);
  
  // Clean up completed operations older than 1 hour
  cleanupCompletedOperations();
}

/**
 * Mark operation as failed
 */
export function failOperation(operationId: string, error: string): void {
  const operations = getStoredOperations();
  const operation = operations.find((op) => op.id === operationId);
  
  const updated = operations.map((op) =>
    op.id === operationId
      ? { ...op, status: 'failed' as const, error, retryCount: op.retryCount + 1 }
      : op
  );
  storeOperations(updated);
  
  // Log sync error
  if (operation) {
    addSyncError(operation, error);
  }
}

/**
 * Clean up old completed operations
 */
function cleanupCompletedOperations(): void {
  const operations = getStoredOperations();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  const filtered = operations.filter(
    (op) =>
      op.status !== 'completed' ||
      new Date(op.timestamp).getTime() > oneHourAgo
  );
  
  storeOperations(filtered);
}

// ============================================================================
// SYNC EXECUTION
// ============================================================================

/**
 * Process a single operation
 */
async function processOperation(operation: OfflineOperation): Promise<void> {
  const docRef = doc(db, operation.collection, operation.documentId);
  
  switch (operation.type) {
    case 'create':
    case 'update':
      if (operation.data) {
        const dataWithTimestamp = {
          ...operation.data,
          updatedAt: Timestamp.now(),
          _syncedAt: Timestamp.now(),
        };
        await setDoc(docRef, dataWithTimestamp, { merge: operation.type === 'update' });
      }
      break;
      
    case 'delete':
      await deleteDoc(docRef);
      break;
      
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

/**
 * Process all pending operations
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
  errors: SyncError[];
}> {
  const operations = getPendingOperations();
  let processed = 0;
  let failed = 0;
  const errors: SyncError[] = [];
  
  // Sort by priority and timestamp
  const sorted = [...operations].sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  for (const operation of sorted) {
    try {
      // Mark as processing
      updateOperationStatus(operation.id, 'processing');
      
      await processOperation(operation);
      
      completeOperation(operation.id);
      processed++;
      
      // Dispatch success event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('offline-operation-completed', { detail: operation })
        );
      }
    } catch (error: unknown) {
      const errorMessage = (error as Error).message || 'Unknown error';
      failOperation(operation.id, errorMessage);
      failed++;
      
      const syncError = addSyncError(operation, errorMessage);
      errors.push(syncError);
      
      // Don't continue if too many failures
      if (failed >= 5) {
        console.warn('[Sync] Too many failures, stopping sync');
        break;
      }
    }
  }
  
  return { processed, failed, errors };
}

function updateOperationStatus(
  operationId: string,
  status: OfflineOperation['status']
): void {
  const operations = getStoredOperations();
  const updated = operations.map((op) =>
    op.id === operationId ? { ...op, status } : op
  );
  storeOperations(updated);
}

// ============================================================================
// ERROR MANAGEMENT
// ============================================================================

function addSyncError(operation: OfflineOperation, error: string): SyncError {
  const errors = getStoredErrors();
  
  const syncError: SyncError = {
    id: generateId(),
    operation,
    error,
    timestamp: new Date(),
    retryCount: operation.retryCount,
    resolved: false,
  };
  
  errors.push(syncError);
  
  // Keep only last 50 errors
  const trimmed = errors.slice(-50);
  storeErrors(trimmed);
  
  return syncError;
}

/**
 * Get recent sync errors
 */
export function getSyncErrors(limit = 10): SyncError[] {
  return getStoredErrors().slice(-limit);
}

/**
 * Mark error as resolved
 */
export function resolveError(errorId: string): void {
  const errors = getStoredErrors();
  const updated = errors.map((err) =>
    err.id === errorId ? { ...err, resolved: true } : err
  );
  storeErrors(updated);
}

/**
 * Clear all errors
 */
export function clearErrors(): void {
  storeErrors([]);
}

/**
 * Retry failed operations
 */
export async function retryFailedOperations(): Promise<{
  retried: number;
  succeeded: number;
}> {
  const failedOps = getStoredOperations().filter(
    (op) => op.status === 'failed' && op.retryCount < 3
  );
  
  // Reset status to pending for retry
  const allOperations = getStoredOperations();
  const updated = allOperations.map((op) =>
    op.status === 'failed' && op.retryCount < 3
      ? { ...op, status: 'pending' as const }
      : op
  );
  storeOperations(updated);
  
  const result = await processSyncQueue();
  
  return {
    retried: failedOps.length,
    succeeded: result.processed,
  };
}

export const syncQueueService = {
  queueOperation,
  getPendingOperations,
  getPendingCount,
  removeOperation,
  completeOperation,
  failOperation,
  processSyncQueue,
  getSyncErrors,
  resolveError,
  clearErrors,
  retryFailedOperations,
};

export default syncQueueService;
