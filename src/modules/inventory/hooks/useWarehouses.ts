/**
 * Hook for subscribing to warehouses
 */

import { useState, useEffect } from 'react';
import type { Warehouse } from '../types/warehouse';
import { subscribeToWarehouses } from '../services/warehouseService';

export function useWarehouses(subsidiaryId: string | null) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subsidiaryId) return;

    setLoading(true);
    const unsubscribe = subscribeToWarehouses(subsidiaryId, (fetched) => {
      setWarehouses(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [subsidiaryId]);

  return { warehouses, loading };
}
