/**
 * Hook for subscribing to a single manufacturing order with mutations
 */

import { useState, useEffect, useCallback } from 'react';
import type { ManufacturingOrder, QualityCheck } from '../types';
import {
  subscribeToManufacturingOrder,
  approveManufacturingOrder,
  startProduction,
  advanceStage,
  recordMaterialConsumption,
  recordQualityCheck,
  putOnHold,
  resumeFromHold,
  cancelManufacturingOrder,
  deleteManufacturingOrder,
  type CompletionData,
} from '../services/manufacturingOrderService';

interface UseManufacturingOrderResult {
  order: ManufacturingOrder | null;
  loading: boolean;
  error: string | null;
  actions: {
    approve: (defaultWarehouseId: string) => Promise<{ success: boolean; shortages: Array<{ itemName: string; required: number; available: number }> }>;
    startProduction: () => Promise<void>;
    advanceStage: (notes?: string, completionData?: CompletionData) => Promise<void>;
    consumeMaterials: (items: Array<{ bomEntryId: string; inventoryItemId: string; warehouseId: string; quantity: number; notes?: string }>) => Promise<void>;
    recordQC: (qc: QualityCheck) => Promise<void>;
    hold: (reason: string) => Promise<void>;
    resume: () => Promise<void>;
    cancel: (reason: string) => Promise<void>;
    delete: () => Promise<void>;
  };
}

export function useManufacturingOrder(
  moId: string | null,
  userId: string,
): UseManufacturingOrderResult {
  const [order, setOrder] = useState<ManufacturingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToManufacturingOrder(moId, (fetched) => {
      setOrder(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [moId]);

  const actions = {
    approve: useCallback(
      async (defaultWarehouseId: string) => {
        if (!moId) throw new Error('No MO selected');
        try {
          return await approveManufacturingOrder(moId, userId, defaultWarehouseId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [moId, userId],
    ),

    startProduction: useCallback(async () => {
      if (!moId) return;
      try {
        await startProduction(moId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [moId, userId]),

    advanceStage: useCallback(
      async (notes?: string, completionData?: CompletionData) => {
        if (!moId) return;
        try {
          await advanceStage(moId, userId, notes, completionData);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [moId, userId],
    ),

    consumeMaterials: useCallback(
      async (items: Array<{ bomEntryId: string; inventoryItemId: string; warehouseId: string; quantity: number; notes?: string }>) => {
        if (!moId) return;
        try {
          await recordMaterialConsumption(moId, items, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [moId, userId],
    ),

    recordQC: useCallback(
      async (qc: QualityCheck) => {
        if (!moId) return;
        try {
          await recordQualityCheck(moId, qc, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [moId, userId],
    ),

    hold: useCallback(
      async (reason: string) => {
        if (!moId) return;
        try {
          await putOnHold(moId, userId, reason);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [moId, userId],
    ),

    resume: useCallback(async () => {
      if (!moId) return;
      try {
        await resumeFromHold(moId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [moId, userId]),

    cancel: useCallback(
      async (reason: string) => {
        if (!moId) return;
        try {
          await cancelManufacturingOrder(moId, userId, reason);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [moId, userId],
    ),

    delete: useCallback(async () => {
      if (!moId) return;
      try {
        await deleteManufacturingOrder(moId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [moId, userId]),
  };

  return { order, loading, error, actions };
}
