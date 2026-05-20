/**
 * Hook for subscribing to purchase orders list
 */

import { useState, useEffect } from 'react';
import type { PurchaseOrder, POFilters, PurchaseOrderStatus } from '../types/purchaseOrder';
import { subscribeToPurchaseOrders } from '../services/purchaseOrderService';

interface UsePurchaseOrdersResult {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
  stats: {
    total: number;
    byStatus: Record<PurchaseOrderStatus, number>;
  };
}

const EMPTY_STATUS_COUNTS: Record<PurchaseOrderStatus, number> = {
  draft: 0,
  'pending-approval': 0,
  approved: 0,
  rejected: 0,
  sent: 0,
  'partially-received': 0,
  received: 0,
  closed: 0,
  cancelled: 0,
};

export function usePurchaseOrders(
  subsidiaryId: string,
  filters?: POFilters,
): UsePurchaseOrdersResult {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsidiaryId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToPurchaseOrders(
      { ...filters, subsidiaryId },
      (fetchedOrders) => {
        setOrders(fetchedOrders);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [subsidiaryId, filters?.status, filters?.search, filters?.supplierName]);

  const stats = {
    total: orders.length,
    byStatus: orders.reduce(
      (acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }),
      { ...EMPTY_STATUS_COUNTS },
    ),
  };

  return { orders, loading, error, stats };
}
