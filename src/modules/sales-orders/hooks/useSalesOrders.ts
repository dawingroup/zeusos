/**
 * useSalesOrders — Subscribe to sales orders list with filtering and computed stats.
 */

import { useState, useEffect, useMemo } from 'react';
import type { SalesOrder, SalesOrderFilters, SalesOrderDashboardStats } from '../types';
import { subscribeToSalesOrders, computeDashboardStats } from '../services/salesOrderService';

export interface UseSalesOrdersResult {
  orders: SalesOrder[];
  loading: boolean;
  error: string | null;
  stats: SalesOrderDashboardStats;
}

export function useSalesOrders(
  subsidiaryId: string,
  filters?: SalesOrderFilters,
): UseSalesOrdersResult {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsidiaryId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSalesOrders(
      subsidiaryId,
      filters ?? {},
      (fetched) => {
        setOrders(fetched);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [
    subsidiaryId,
    filters?.status?.join(','),
    filters?.search,
    filters?.customerId,
    filters?.hasRiskFlags,
    filters?.createdBy,
  ]);

  const stats = useMemo(() => computeDashboardStats(orders), [orders]);

  return { orders, loading, error, stats };
}
