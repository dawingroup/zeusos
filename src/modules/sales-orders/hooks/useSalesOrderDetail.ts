/**
 * useSalesOrderDetail — Subscribe to a single sales order by ID.
 */

import { useState, useEffect } from 'react';
import type { SalesOrder } from '../types';
import { subscribeToSalesOrder } from '../services/salesOrderService';

export interface UseSalesOrderDetailResult {
  order: SalesOrder | null;
  loading: boolean;
  error: string | null;
}

export function useSalesOrderDetail(orderId: string | undefined): UseSalesOrderDetailResult {
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSalesOrder(orderId, (fetched) => {
      setOrder(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [orderId]);

  return { order, loading, error };
}
