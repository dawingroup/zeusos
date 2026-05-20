/**
 * useExpandableChildren Hook
 * Lazy-loads and caches children for expandable parent rows in list views.
 * Supports both legacy variants (parentItemId) and Family/SKU hierarchy (familyId).
 */

import { useState, useCallback } from 'react';
import type { InventoryItem } from '../types';
import { getVariants, getFamilySkus } from '../services/inventoryService';

interface UseExpandableChildrenResult {
  /** Set of currently expanded parent IDs */
  expandedIds: Set<string>;
  /** Cached children keyed by parent ID */
  childrenMap: Record<string, InventoryItem[]>;
  /** Set of parent IDs currently loading */
  loadingIds: Set<string>;
  /** Toggle expand/collapse for a parent item */
  toggleExpand: (parentId: string, isFamily: boolean) => Promise<void>;
  /** Get aggregated stock count for a parent's children */
  getStockRollup: (parentId: string) => number;
  /** Get min/max cost range for a parent's children */
  getCostRange: (parentId: string) => { min: number; max: number } | null;
}

export function useExpandableChildren(): UseExpandableChildrenResult {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childrenMap, setChildrenMap] = useState<Record<string, InventoryItem[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback(async (parentId: string, isFamily: boolean) => {
    // If already expanded, collapse
    if (expandedIds.has(parentId)) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
      return;
    }

    // If already cached, just expand
    if (childrenMap[parentId]) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
      return;
    }

    // Load children from Firestore
    setLoadingIds((prev) => new Set(prev).add(parentId));
    try {
      const children = isFamily
        ? await getFamilySkus(parentId)
        : await getVariants(parentId);

      setChildrenMap((prev) => ({ ...prev, [parentId]: children }));
      setExpandedIds((prev) => new Set(prev).add(parentId));
    } catch (err) {
      console.error('Failed to load children for', parentId, err);
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  }, [expandedIds, childrenMap]);

  const getStockRollup = useCallback((parentId: string): number => {
    const children = childrenMap[parentId];
    if (!children || children.length === 0) return 0;
    return children.reduce((sum, child) => sum + (child.inventory?.inStock || 0), 0);
  }, [childrenMap]);

  const getCostRange = useCallback((parentId: string): { min: number; max: number } | null => {
    const children = childrenMap[parentId];
    if (!children || children.length === 0) return null;

    const costs = children
      .map((c) => c.pricing?.costPerUnit)
      .filter((c): c is number => typeof c === 'number' && c > 0);

    if (costs.length === 0) return null;
    return { min: Math.min(...costs), max: Math.max(...costs) };
  }, [childrenMap]);

  return {
    expandedIds,
    childrenMap,
    loadingIds,
    toggleExpand,
    getStockRollup,
    getCostRange,
  };
}
