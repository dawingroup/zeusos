/**
 * Hook for subscribing to cost history of an inventory item
 */

import { useState, useEffect } from 'react';
import type { CostHistoryEntry } from '../types/warehouse';
import { subscribeToCostHistory } from '../services/stockLevelService';

export function useCostHistory(inventoryItemId: string | null) {
  const [entries, setEntries] = useState<CostHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inventoryItemId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCostHistory(inventoryItemId, (fetched) => {
      setEntries(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [inventoryItemId]);

  return { entries, loading };
}
