/**
 * Hook for subscribing to a single outsourced purchase order with OPO-specific mutations
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  PurchaseOrder,
  POLineItem,
  LandedCosts,
  OPORecipeRow,
} from '../types/purchaseOrder';
import {
  subscribeToPurchaseOrder,
  submitForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  markAsSent,
  closePurchaseOrder,
  cancelPurchaseOrder,
} from '../services/purchaseOrderService';
import {
  updateOPO,
  updateOPORecipe,
  receiveOPO,
  revertOPOReceipt,
  deleteOPO,
  reserveOPOIngredients,
  releaseOPOIngredients,
  createStockTransferFromOPO,
  type OPOReceiveInput,
  type DispatchMaterialsInput,
} from '../services/outsourcedPurchaseOrderService';
import { syncPOToBill } from '@/modules/finance/services/qboSyncService';

interface UseOutsourcedPurchaseOrderResult {
  order: PurchaseOrder | null;
  loading: boolean;
  error: string | null;
  actions: {
    /** Update general OPO fields (supplier, dates, items, costs) */
    update: (data: Partial<{
      supplierName: string;
      supplierContact: string;
      supplierId: string;
      lineItems: POLineItem[];
      landedCosts: LandedCosts;
      shipToWarehouseId: string;
      shipToWarehouseName: string;
      trackIngredientsWarehouseId: string;
      trackIngredientsWarehouseName: string;
      expectedDeliveryDate: Date | null;
      notes: string;
    }>) => Promise<void>;

    /** Update recipe rows (add, remove, modify ingredients) */
    updateRecipe: (rows: OPORecipeRow[]) => Promise<void>;

    /** Standard PO lifecycle actions */
    submitForApproval: () => Promise<void>;
    approve: (approverName: string, notes?: string) => Promise<void>;
    reject: (approverName: string, notes: string) => Promise<void>;
    markSent: () => Promise<void>;
    close: () => Promise<void>;
    cancel: (reason: string) => Promise<void>;

    /** OPO-specific actions */
    receive: (receipt: OPOReceiveInput) => Promise<void>;
    revert: () => Promise<void>;
    delete: () => Promise<void>;
    reserveIngredients: () => Promise<{ allReserved: boolean; failures: string[] }>;
    releaseIngredients: () => Promise<void>;
    dispatchMaterials: (input: DispatchMaterialsInput) => Promise<void>;
    syncToBill: () => Promise<void>;
    duplicate: () => Promise<string>;
  };
}

export function useOutsourcedPurchaseOrder(
  opoId: string | null,
  userId: string,
): UseOutsourcedPurchaseOrderResult {
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opoId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToPurchaseOrder(opoId, (fetched) => {
      setOrder(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [opoId]);

  const actions = {
    update: useCallback(
      async (data: Parameters<typeof updateOPO>[1]) => {
        if (!opoId) return;
        try {
          await updateOPO(opoId, data, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    updateRecipe: useCallback(
      async (rows: OPORecipeRow[]) => {
        if (!opoId) return;
        try {
          await updateOPORecipe(opoId, rows, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    submitForApproval: useCallback(async () => {
      if (!opoId) return;
      try {
        await submitForApproval(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    approve: useCallback(
      async (approverName: string, notes?: string) => {
        if (!opoId) return;
        try {
          await approvePurchaseOrder(opoId, userId, approverName, notes);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    reject: useCallback(
      async (approverName: string, notes: string) => {
        if (!opoId) return;
        try {
          await rejectPurchaseOrder(opoId, userId, approverName, notes);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    markSent: useCallback(async () => {
      if (!opoId) return;
      try {
        await markAsSent(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    close: useCallback(async () => {
      if (!opoId) return;
      try {
        await closePurchaseOrder(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    cancel: useCallback(
      async (reason: string) => {
        if (!opoId) return;
        try {
          await cancelPurchaseOrder(opoId, userId, reason);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    receive: useCallback(
      async (receipt: OPOReceiveInput) => {
        if (!opoId) return;
        try {
          await receiveOPO(opoId, receipt, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    revert: useCallback(async () => {
      if (!opoId) return;
      try {
        await revertOPOReceipt(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    delete: useCallback(async () => {
      if (!opoId) return;
      try {
        await deleteOPO(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    reserveIngredients: useCallback(async () => {
      if (!opoId) return { allReserved: false, failures: ['No OPO ID'] };
      try {
        return await reserveOPOIngredients(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    releaseIngredients: useCallback(async () => {
      if (!opoId) return;
      try {
        await releaseOPOIngredients(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),

    dispatchMaterials: useCallback(
      async (input: DispatchMaterialsInput) => {
        if (!opoId) return;
        try {
          await createStockTransferFromOPO(opoId, input, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [opoId, userId],
    ),

    syncToBill: useCallback(async () => {
      if (!opoId) return;
      try {
        await syncPOToBill(opoId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId]),

    duplicate: useCallback(async () => {
      if (!opoId) return '';
      try {
        const { duplicateOPO } = await import('../services/outsourcedPurchaseOrderService');
        return await duplicateOPO(opoId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [opoId, userId]),
  };

  return { order, loading, error, actions };
}
