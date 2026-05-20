/**
 * useFamilyRollup Hook
 * Loads aggregated stock/cost rollup data for a family item.
 */

import { useState, useEffect, useCallback } from 'react';
import { getFamilyStockRollup } from '../services/inventoryService';
import type { FamilyStockRollup } from '../types';

interface UseFamilyRollupResult {
  rollup: FamilyStockRollup | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useFamilyRollup(familyId: string | null): UseFamilyRollupResult {
  const [rollup, setRollup] = useState<FamilyStockRollup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!familyId) {
      setRollup(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getFamilyStockRollup(familyId);
      setRollup(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load family rollup'));
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rollup, loading, error, refresh };
}
