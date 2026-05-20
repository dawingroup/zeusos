/**
 * Hook for subscribing to a single purchase order with mutations
 */

import { useState, useEffect, useCallback } from 'react';
import type { PurchaseOrder, POLineItem, LandedCosts, GoodsReceipt } from '../types/purchaseOrder';
import {
  subscribeToPurchaseOrder,
  updatePurchaseOrder,
  submitForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  markAsSent,
  receiveGoods,
  editGoodsReceipt,
  closePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
} from '../services/purchaseOrderService';
import { syncPOToBill, syncBillCorrection } from '@/modules/finance/services/qboSyncService';

interface UsePurchaseOrderResult {
  order: PurchaseOrder | null;
  loading: boolean;
  error: string | null;
  actions: {
    update: (data: {
      supplierName?: string;
      supplierContact?: string;
      supplierId?: string;
      lineItems?: POLineItem[];
      landedCosts?: LandedCosts;
      notes?: string;
      orderDate?: Date;
    }, options?: { isAdminEdit?: boolean }) => Promise<void>;
    submitForApproval: () => Promise<void>;
    approve: (approverName: string, notes?: string) => Promise<void>;
    reject: (approverName: string, notes: string) => Promise<void>;
    markSent: () => Promise<void>;
    receive: (receipt: Omit<GoodsReceipt, 'id'>) => Promise<void>;
    close: () => Promise<void>;
    cancel: (reason: string) => Promise<void>;
    delete: () => Promise<void>;
    syncToBill: () => Promise<void>;
    syncBillCorrection: () => Promise<void>;
    editReceipt: (
      receiptId: string,
      updatedLines: { lineItemId: string; quantityReceived: number }[],
      updatedReceivedDate: Date | undefined,
      reason: string,
    ) => Promise<void>;
  };
}

export function usePurchaseOrder(
  poId: string | null,
  userId: string,
): UsePurchaseOrderResult {
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!poId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToPurchaseOrder(poId, (fetched) => {
      setOrder(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [poId]);

  const actions = {
    update: useCallback(
      async (data: Parameters<typeof updatePurchaseOrder>[1], options?: { isAdminEdit?: boolean }) => {
        if (!poId) return;
        try {
          await updatePurchaseOrder(poId, data, userId, options);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [poId, userId],
    ),

    submitForApproval: useCallback(async () => {
      if (!poId) return;
      try {
        await submitForApproval(poId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [poId, userId]),

    approve: useCallback(
      async (approverName: string, notes?: string) => {
        if (!poId) return;
        try {
          await approvePurchaseOrder(poId, userId, approverName, notes);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [poId, userId],
    ),

    reject: useCallback(
      async (approverName: string, notes: string) => {
        if (!poId) return;
        try {
          await rejectPurchaseOrder(poId, userId, approverName, notes);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [poId, userId],
    ),

    markSent: useCallback(async () => {
      if (!poId) return;
      try {
        await markAsSent(poId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [poId, userId]),

    receive: useCallback(
      async (receipt: Omit<GoodsReceipt, 'id'>) => {
        if (!poId) return;
        try {
          await receiveGoods(poId, receipt, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [poId, userId],
    ),

    close: useCallback(async () => {
      if (!poId) return;
      try {
        await closePurchaseOrder(poId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [poId, userId]),

    cancel: useCallback(
      async (reason: string) => {
        if (!poId) return;
        try {
          await cancelPurchaseOrder(poId, userId, reason);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [poId, userId],
    ),

    delete: useCallback(async () => {
      if (!poId) return;
      try {
        await deletePurchaseOrder(poId, userId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [poId, userId]),

    syncToBill: useCallback(async () => {
      if (!poId) return;
      try {
        await syncPOToBill(poId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [poId]),

    syncBillCorrection: useCallback(async () => {
      if (!poId) return;
      try {
        await syncBillCorrection(poId);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, [poId]),

    editReceipt: useCallback(
      async (
        receiptId: string,
        updatedLines: { lineItemId: string; quantityReceived: number }[],
        updatedReceivedDate: Date | undefined,
        reason: string,
      ) => {
        if (!poId) return;
        try {
          await editGoodsReceipt(poId, receiptId, updatedLines, updatedReceivedDate, reason, userId);
        } catch (e) {
          setError((e as Error).message);
          throw e;
        }
      },
      [poId, userId],
    ),
  };

  return { order, loading, error, actions };
}
