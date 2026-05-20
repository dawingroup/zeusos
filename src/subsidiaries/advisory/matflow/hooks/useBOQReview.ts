/**
 * BOQ Review Hook
 * Manages state and actions for reviewing parsed BOQ items
 */

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import type { ParsedBOQItem } from '../ai/schemas/boqSchema';
import { ConstructionStage } from '../types';
import {
  type ReviewableItem,
  type FilterCriteria,
  createReviewableItems,
  getCurrentItemState,
  calculateReviewStats,
  filterReviewItems,
  sortByReviewPriority,
  validateItemForImport,
} from '../utils/reviewHelpers';
import { importParsedItems } from '../services/parsingService';

// Default organization ID
const DEFAULT_ORG_ID = 'default';

interface UseBOQReviewOptions {
  projectId: string;
  parsedItems: ParsedBOQItem[];
  onImportComplete?: (importedCount: number) => void;
}

export function useBOQReview({
  projectId,
  parsedItems,
  onImportComplete,
}: UseBOQReviewOptions) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  // State
  const [items, setItems] = useState<ReviewableItem[]>(() =>
    createReviewableItems(parsedItems)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Derived state
  const filteredItems = useMemo(() => {
    return filterReviewItems(items, filters);
  }, [items, filters]);

  const sortedItems = useMemo(() => {
    return sortByReviewPriority(filteredItems);
  }, [filteredItems]);

  const stats = useMemo(() => {
    return calculateReviewStats(items);
  }, [items]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.reviewId));
  }, [items, selectedIds]);

  // Item updates
  const updateItem = useCallback((reviewId: string, updates: Partial<ReviewableItem>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.reviewId === reviewId
          ? { ...item, ...updates }
          : item
      )
    );
  }, []);

  // Status changes
  const approveItem = useCallback((reviewId: string) => {
    const item = items.find((i) => i.reviewId === reviewId);
    if (!item) return;

    const validation = validateItemForImport(item);
    if (!validation.isValid) {
      console.warn('Cannot approve item with validation errors:', validation.errors);
      return;
    }

    updateItem(reviewId, {
      reviewStatus: 'approved',
      reviewedAt: new Date(),
    });
  }, [items, updateItem]);

  const rejectItem = useCallback((reviewId: string) => {
    updateItem(reviewId, {
      reviewStatus: 'rejected',
      reviewedAt: new Date(),
    });
  }, [updateItem]);

  // Bulk operations
  const bulkApprove = useCallback(() => {
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.reviewId === id);
      if (item && item.reviewStatus !== 'approved') {
        const validation = validateItemForImport(item);
        if (validation.isValid) {
          approveItem(id);
        }
      }
    });
  }, [selectedIds, items, approveItem]);

  const bulkReject = useCallback(() => {
    selectedIds.forEach((id) => rejectItem(id));
  }, [selectedIds, rejectItem]);

  const bulkAssignFormula = useCallback((formulaCode: string) => {
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.reviewId === id);
      if (item) {
        updateItem(id, {
          modifications: {
            ...item.modifications,
            suggestedFormulaCode: formulaCode,
          },
          reviewStatus: 'modified',
        });
      }
    });
  }, [selectedIds, items, updateItem]);

  const bulkSetStage = useCallback((stage: ConstructionStage) => {
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.reviewId === id);
      if (item) {
        updateItem(id, {
          modifications: {
            ...item.modifications,
            stage,
          },
          reviewStatus: 'modified',
        });
      }
    });
  }, [selectedIds, items, updateItem]);

  const bulkDelete = useCallback(() => {
    setItems((prev) => prev.filter((item) => !selectedIds.has(item.reviewId)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Selection
  const toggleSelect = useCallback((reviewId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((i) => i.reviewId)));
  }, [filteredItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useMemo(() => {
    return filteredItems.length > 0 && 
      filteredItems.every((item) => selectedIds.has(item.reviewId));
  }, [filteredItems, selectedIds]);

  // Import approved items
  const importApprovedItems = useCallback(async () => {
    if (!userId) {
      console.error('User not authenticated');
      return;
    }

    const approvedItems = items.filter((item) => item.reviewStatus === 'approved');
    if (approvedItems.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Convert ReviewableItems to ParsedBOQItems with current state
      const itemsToImport: ParsedBOQItem[] = approvedItems.map((item) => 
        getCurrentItemState(item)
      );

      // Import using the parsing service
      const importedIds = await importParsedItems(
        orgId,
        projectId,
        itemsToImport,
        userId
      );

      setImportProgress(100);
      onImportComplete?.(importedIds.length);
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    } finally {
      setIsImporting(false);
    }
  }, [items, userId, orgId, projectId, onImportComplete]);

  return {
    // Items
    items: sortedItems,
    allItems: items,
    stats,
    
    // Selection
    selectedItems,
    selectedIds,
    isAllSelected,
    toggleSelect,
    selectAll,
    deselectAll,
    
    // Filters
    filters,
    setFilters,
    
    // Individual actions
    updateItem,
    approveItem,
    rejectItem,
    
    // Bulk actions
    bulkApprove,
    bulkReject,
    bulkAssignFormula,
    bulkSetStage,
    bulkDelete,
    
    // Import
    importApprovedItems,
    isImporting,
    importProgress,
  };
}
