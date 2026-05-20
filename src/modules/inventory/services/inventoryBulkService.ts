/**
 * Inventory Bulk Service
 * Firestore batch operations for bulk update and delete of inventory items.
 * Chunks operations into 500-item batches (Firestore writeBatch limit).
 */

import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  InventoryCategory,
  InventoryStatus,
  InventoryClassification,
} from '../types';

const COLLECTION_NAME = 'inventoryItems';
const BATCH_LIMIT = 500;

// ============================================
// Result Types
// ============================================

export interface BulkOperationResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    itemId: string;
    itemName: string;
    success: boolean;
    error?: string;
  }>;
}

export interface BulkUpdateFields {
  category?: InventoryCategory;
  subcategory?: string;
  status?: InventoryStatus;
  classification?: InventoryClassification;
  brand?: string;
  tags?: string[];
}

// ============================================
// Batch Update
// ============================================

export async function batchUpdateItems(
  itemIds: string[],
  updates: BulkUpdateFields,
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: itemIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  const chunks = chunkArray(itemIds, BATCH_LIMIT);
  let processed = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const itemId of chunk) {
      const docRef = doc(db, COLLECTION_NAME, itemId);
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      };

      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.classification !== undefined) updateData.classification = updates.classification;
      if (updates.brand !== undefined) updateData.brand = updates.brand;
      if (updates.tags !== undefined) updateData.tags = updates.tags;

      batch.update(docRef, updateData);
    }

    try {
      await batch.commit();
      for (const itemId of chunk) {
        result.results.push({ itemId, itemName: '', success: true });
        result.successCount++;
      }
    } catch (err) {
      for (const itemId of chunk) {
        result.results.push({
          itemId,
          itemName: '',
          success: false,
          error: (err as Error).message,
        });
        result.failureCount++;
      }
    }

    processed += chunk.length;
    onProgress?.(processed, itemIds.length);
  }

  return result;
}

// ============================================
// Batch Delete
// ============================================

export async function batchDeleteItems(
  itemIds: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: itemIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  const chunks = chunkArray(itemIds, BATCH_LIMIT);
  let processed = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);

    for (const itemId of chunk) {
      const docRef = doc(db, COLLECTION_NAME, itemId);
      batch.delete(docRef);
    }

    try {
      await batch.commit();
      for (const itemId of chunk) {
        result.results.push({ itemId, itemName: '', success: true });
        result.successCount++;
      }
    } catch (err) {
      for (const itemId of chunk) {
        result.results.push({
          itemId,
          itemName: '',
          success: false,
          error: (err as Error).message,
        });
        result.failureCount++;
      }
    }

    processed += chunk.length;
    onProgress?.(processed, itemIds.length);
  }

  return result;
}

// ============================================
// Helper
// ============================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
