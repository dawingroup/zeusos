/**
 * Hook: subscribe to a list of Construction Orders.
 */

import { useEffect, useState } from 'react';
import type { ConstructionOrder, ConstructionOrderStatus } from '../types';
import { subscribeToConstructionOrders } from '../services/constructionOrderService';

export function useConstructionOrders(filters?: {
  status?: ConstructionOrderStatus;
  projectId?: string;
}) {
  const [orders, setOrders] = useState<ConstructionOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToConstructionOrders((list) => {
      setOrders(list);
      setLoading(false);
    }, filters);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.status, filters?.projectId]);

  return { orders, loading };
}
