/**
 * useBulkOperations Hook
 * Orchestrates bulk inventory operations (update, delete, AI enhancement) with progress tracking.
 */

import { useState, useCallback } from 'react';
import {
  batchUpdateItems,
  batchDeleteItems,
  type BulkUpdateFields,
  type BulkOperationResult,
} from '../services/inventoryBulkService';
import { getInventoryItem, updateInventoryItem } from '../services/inventoryService';
import { enhanceInventoryItemAI } from '../services/inventoryAIService';
import type { InventoryListItem } from '../types';

export type BulkOperationType = 'update' | 'delete' | 'ai-enhance' | null;

export interface BulkProgress {
  current: number;
  total: number;
  currentItemName?: string;
}

export interface UseBulkOperationsResult {
  operating: boolean;
  operationType: BulkOperationType;
  progress: BulkProgress | null;
  result: BulkOperationResult | null;
  error: string | null;

  runBulkUpdate: (
    itemIds: string[],
    updates: BulkUpdateFields,
    userId: string
  ) => Promise<BulkOperationResult>;
  runBulkDelete: (itemIds: string[]) => Promise<BulkOperationResult>;
  runBulkAIEnhancement: (
    items: InventoryListItem[],
    userId: string,
    confidenceThreshold?: number,
    existingItems?: Array<{ name: string; sku: string; category: string; subcategory?: string }>
  ) => Promise<BulkOperationResult>;
  clearResult: () => void;
}

export function useBulkOperations(): UseBulkOperationsResult {
  const [operating, setOperating] = useState(false);
  const [operationType, setOperationType] = useState<BulkOperationType>(null);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [result, setResult] = useState<BulkOperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBulkUpdate = useCallback(
    async (itemIds: string[], updates: BulkUpdateFields, userId: string) => {
      setOperating(true);
      setOperationType('update');
      setError(null);
      setResult(null);
      setProgress({ current: 0, total: itemIds.length });

      try {
        const res = await batchUpdateItems(itemIds, updates, userId, (done, total) => {
          setProgress({ current: done, total });
        });
        setResult(res);
        return res;
      } catch (err) {
        const msg = (err as Error).message || 'Bulk update failed';
        setError(msg);
        throw err;
      } finally {
        setOperating(false);
        setOperationType(null);
      }
    },
    []
  );

  const runBulkDelete = useCallback(async (itemIds: string[]) => {
    setOperating(true);
    setOperationType('delete');
    setError(null);
    setResult(null);
    setProgress({ current: 0, total: itemIds.length });

    try {
      const res = await batchDeleteItems(itemIds, (done, total) => {
        setProgress({ current: done, total });
      });
      setResult(res);
      return res;
    } catch (err) {
      const msg = (err as Error).message || 'Bulk delete failed';
      setError(msg);
      throw err;
    } finally {
      setOperating(false);
      setOperationType(null);
    }
  }, []);

  const runBulkAIEnhancement = useCallback(
    async (
      items: InventoryListItem[],
      userId: string,
      confidenceThreshold: number = 0.75,
      existingItems?: Array<{ name: string; sku: string; category: string; subcategory?: string }>
    ) => {
      setOperating(true);
      setOperationType('ai-enhance');
      setError(null);
      setResult(null);
      setProgress({ current: 0, total: items.length });

      const opResult: BulkOperationResult = {
        totalProcessed: items.length,
        successCount: 0,
        failureCount: 0,
        results: [],
      };

      for (let i = 0; i < items.length; i++) {
        const listItem = items[i];
        setProgress({
          current: i,
          total: items.length,
          currentItemName: listItem.displayName || listItem.name,
        });

        try {
          const fullItem = await getInventoryItem(listItem.id);
          if (!fullItem) {
            opResult.results.push({
              itemId: listItem.id,
              itemName: listItem.name,
              success: false,
              error: 'Item not found',
            });
            opResult.failureCount++;
            continue;
          }

          const enhancement = await enhanceInventoryItemAI(fullItem, existingItems);

          // Auto-apply suggestions above confidence threshold
          const updates: Record<string, unknown> = {};
          const suggestions = enhancement.suggestions;

          for (const [key, suggestion] of Object.entries(suggestions)) {
            if (
              suggestion &&
              suggestion.confidence >= confidenceThreshold &&
              suggestion.current !== suggestion.suggested
            ) {
              updates[key] = suggestion.suggested;
            }
          }

          if (Object.keys(updates).length > 0) {
            await updateInventoryItem(listItem.id, updates as any, userId);
          }

          opResult.results.push({
            itemId: listItem.id,
            itemName: listItem.name,
            success: true,
          });
          opResult.successCount++;
        } catch (err) {
          opResult.results.push({
            itemId: listItem.id,
            itemName: listItem.name,
            success: false,
            error: (err as Error).message,
          });
          opResult.failureCount++;
        }
      }

      setProgress({ current: items.length, total: items.length });
      setResult(opResult);
      setOperating(false);
      setOperationType(null);

      return opResult;
    },
    []
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    operating,
    operationType,
    progress,
    result,
    error,
    runBulkUpdate,
    runBulkDelete,
    runBulkAIEnhancement,
    clearResult,
  };
}
