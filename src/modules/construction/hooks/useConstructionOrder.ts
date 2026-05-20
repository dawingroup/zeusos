/**
 * Hook: subscribe to a single Construction Order doc.
 */

import { useEffect, useState } from 'react';
import type { ConstructionOrder } from '../types';
import { subscribeToConstructionOrder } from '../services/constructionOrderService';

export function useConstructionOrder(coId: string | null | undefined) {
  const [order, setOrder] = useState<ConstructionOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToConstructionOrder(coId, (co) => {
      setOrder(co);
      setLoading(false);
    });
    return unsub;
  }, [coId]);

  return { order, loading };
}
