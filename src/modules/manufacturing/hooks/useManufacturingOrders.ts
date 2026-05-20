/**
 * Hook for subscribing to manufacturing orders list
 */

import { useState, useEffect } from 'react';
import type { ManufacturingOrder, ManufacturingOrderStatus, MOStage, MOFilters } from '../types';
import { subscribeToManufacturingOrders } from '../services/manufacturingOrderService';
import { groupManufacturingOrdersByProjectSalesOrder } from '../utils/moGrouping';
// MO_STAGES used indirectly via stats computation

interface UseManufacturingOrdersResult {
  orders: ManufacturingOrder[];
  loading: boolean;
  error: string | null;
  stats: {
    total: number;
    byStatus: Record<ManufacturingOrderStatus, number>;
    byStage: Record<MOStage, number>;
    byProjectSalesOrder: Record<string, number>;
  };
}

const EMPTY_STATUS: Record<ManufacturingOrderStatus, number> = {
  draft: 0,
  'pending-approval': 0,
  approved: 0,
  'in-progress': 0,
  'on-hold': 0,
  'partially-complete': 0,
  completed: 0,
  'closed-out': 0,
  cancelled: 0,
};

const EMPTY_STAGES: Record<MOStage, number> = {
  queued: 0,
  cutting: 0,
  assembly: 0,
  finishing: 0,
  qc: 0,
  ready: 0,
};

export function useManufacturingOrders(
  subsidiaryId: string,
  filters?: MOFilters,
): UseManufacturingOrdersResult {
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsidiaryId) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToManufacturingOrders(
      { ...filters, subsidiaryId },
      (fetched) => {
        setOrders(fetched);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [
    subsidiaryId,
    filters?.status,
    filters?.currentStage,
    filters?.search,
    filters?.projectId,
    filters?.salesOrderId,
    filters?.batchId,
  ]);

  const stats = {
    total: orders.length,
    byStatus: orders.reduce(
      (acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }),
      { ...EMPTY_STATUS },
    ),
    byStage: orders.reduce(
      (acc, o) => ({ ...acc, [o.currentStage]: (acc[o.currentStage] || 0) + 1 }),
      { ...EMPTY_STAGES },
    ),
    byProjectSalesOrder: groupManufacturingOrdersByProjectSalesOrder(orders).reduce(
      (acc, group) => ({ ...acc, [group.key]: group.orders.length }),
      {} as Record<string, number>,
    ),
  };

  return { orders, loading, error, stats };
}
