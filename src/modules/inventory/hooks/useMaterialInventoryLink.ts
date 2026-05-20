/**
 * Hook for material-inventory linking operations
 */

import { useState, useCallback, useEffect } from 'react';
import {
  linkMaterialToInventory,
  unlinkMaterialFromInventory,
  batchResolveMaterialsWithInventory,
} from '../services/materialInventoryLinkService';
import type { Material, MaterialTier, MaterialWithInventory } from '@/modules/design-manager/types/materials';

/**
 * Hook for linking/unlinking materials to inventory items
 */
export function useMaterialInventoryLink(userId: string) {
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const link = useCallback(
    async (
      materialId: string,
      tier: MaterialTier,
      scopeId: string | undefined,
      inventoryItemId: string,
      inventoryItemSku: string
    ) => {
      setLinking(true);
      setError(null);
      try {
        await linkMaterialToInventory(
          materialId,
          tier,
          scopeId,
          inventoryItemId,
          inventoryItemSku,
          userId
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to link material to inventory');
        setError(error);
        throw error;
      } finally {
        setLinking(false);
      }
    },
    [userId]
  );

  const unlink = useCallback(
    async (
      materialId: string,
      tier: MaterialTier,
      scopeId: string | undefined,
      inventoryItemId: string
    ) => {
      setUnlinking(true);
      setError(null);
      try {
        await unlinkMaterialFromInventory(materialId, tier, scopeId, inventoryItemId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to unlink material from inventory');
        setError(error);
        throw error;
      } finally {
        setUnlinking(false);
      }
    },
    [userId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    link,
    unlink,
    linking,
    unlinking,
    error,
    clearError,
  };
}

/**
 * Hook to resolve materials with their linked inventory data
 * Automatically resolves when materials change
 */
export function useMaterialsWithInventory(materials: Material[]) {
  const [resolved, setResolved] = useState<MaterialWithInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resolve = useCallback(async () => {
    if (materials.length === 0) {
      setResolved([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await batchResolveMaterialsWithInventory(materials);
      setResolved(results);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to resolve materials with inventory');
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [materials]);

  // Auto-resolve when materials change
  useEffect(() => {
    resolve();
  }, [resolve]);

  return {
    resolved,
    loading,
    error,
    refresh: resolve,
  };
}

/**
 * Hook to manage supplier pricing for an inventory item
 */
export function useSupplierPricing(inventoryItemId: string | null, userId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addSupplier = useCallback(
    async (
      pricing: {
        supplierId: string;
        supplierName: string;
        supplierCode?: string;
        unitPrice: number;
        currency: string;
        minimumOrder?: number;
        leadTimeDays?: number;
        notes?: string;
      },
      setAsPreferred: boolean = false
    ) => {
      if (!inventoryItemId) throw new Error('No inventory item selected');

      setLoading(true);
      setError(null);
      try {
        const { addSupplierPricing } = await import('../services/inventoryService');
        await addSupplierPricing(inventoryItemId, pricing, userId, setAsPreferred);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add supplier');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [inventoryItemId, userId]
  );

  const removeSupplier = useCallback(
    async (supplierId: string) => {
      if (!inventoryItemId) throw new Error('No inventory item selected');

      setLoading(true);
      setError(null);
      try {
        const { removeSupplierPricing } = await import('../services/inventoryService');
        await removeSupplierPricing(inventoryItemId, supplierId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to remove supplier');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [inventoryItemId, userId]
  );

  const setPreferred = useCallback(
    async (supplierId: string) => {
      if (!inventoryItemId) throw new Error('No inventory item selected');

      setLoading(true);
      setError(null);
      try {
        const { setPreferredSupplier } = await import('../services/inventoryService');
        await setPreferredSupplier(inventoryItemId, supplierId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to set preferred supplier');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [inventoryItemId, userId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    addSupplier,
    removeSupplier,
    setPreferred,
    loading,
    error,
    clearError,
  };
}
