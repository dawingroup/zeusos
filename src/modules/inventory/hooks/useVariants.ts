/**
 * useVariants Hook
 * Fetch and manage variants for a parent inventory item
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getVariants,
  createVariant,
  removeVariant,
  getFamilySkus,
  createFamilySku,
  removeFamilySku,
} from '../services/inventoryService';
import type { InventoryItem, InventoryItemFormData, SkuFormData } from '../types';

interface UseVariantsResult {
  variants: InventoryItem[];
  loading: boolean;
  error: Error | null;
  addVariant: (data: InventoryItemFormData) => Promise<string>;
  deleteVariant: (variantId: string) => Promise<void>;
  /** Add a SKU to a family (new hierarchy pattern) */
  addFamilySku: (data: SkuFormData) => Promise<string>;
  /** Remove a SKU from a family (new hierarchy pattern) */
  deleteFamilySku: (skuId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useVariants(parentItemId: string | null, userId: string, isFamily?: boolean): UseVariantsResult {
  const [variants, setVariants] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!parentItemId) {
      setVariants([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Use new family pattern if isFamily flag is set, else legacy
      const items = isFamily
        ? await getFamilySkus(parentItemId)
        : await getVariants(parentItemId);
      setVariants(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load variants'));
    } finally {
      setLoading(false);
    }
  }, [parentItemId, isFamily]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addVariant = useCallback(async (data: InventoryItemFormData) => {
    if (!parentItemId) throw new Error('No parent item');
    const id = await createVariant(parentItemId, data, userId);
    await refresh();
    return id;
  }, [parentItemId, userId, refresh]);

  const deleteVariant = useCallback(async (variantId: string) => {
    await removeVariant(variantId, userId);
    await refresh();
  }, [userId, refresh]);

  const addFamilySku = useCallback(async (data: SkuFormData) => {
    if (!parentItemId) throw new Error('No parent family');
    const id = await createFamilySku(parentItemId, data, userId);
    await refresh();
    return id;
  }, [parentItemId, userId, refresh]);

  const deleteFamilySku = useCallback(async (skuId: string) => {
    await removeFamilySku(skuId, userId);
    await refresh();
  }, [userId, refresh]);

  return { variants, loading, error, addVariant, deleteVariant, addFamilySku, deleteFamilySku, refresh };
}
