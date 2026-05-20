/**
 * useChangeOrders — Subscribe to change orders for a given sales order.
 */

import { useState, useEffect } from 'react';
import type { ChangeOrder } from '../types';
import { subscribeToChangeOrders } from '../services/changeOrderService';

export interface UseChangeOrdersResult {
  changeOrders: ChangeOrder[];
  loading: boolean;
  error: string | null;
  pendingCount: number;
  approvedCount: number;
  draftCount: number;
  totalPriceImpact: number;
}

export function useChangeOrders(salesOrderId: string | undefined): UseChangeOrdersResult {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salesOrderId) {
      setChangeOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToChangeOrders(salesOrderId, (fetched) => {
      setChangeOrders(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [salesOrderId]);

  const pendingCount = changeOrders.filter(
    (co) => co.status === 'pending_internal' || co.status === 'pending_client',
  ).length;

  const approvedCount = changeOrders.filter((co) => co.status === 'approved').length;

  const draftCount = changeOrders.filter((co) => co.status === 'draft').length;

  const totalPriceImpact = changeOrders
    .filter((co) => co.status === 'approved')
    .reduce((sum, co) => sum + co.priceImpact, 0);

  return {
    changeOrders,
    loading,
    error,
    pendingCount,
    approvedCount,
    draftCount,
    totalPriceImpact,
  };
}
