/**
 * useChangeOrderPriceImpact — load pricingService output for a saved CO.
 * Refetches on `coId` change and exposes a manual `refresh()` so UIs
 * can re-run the calculation after, e.g. an item edit.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChangeOrderPriceImpact } from '../types';
import { recalculateChangeOrderImpact } from '../services/pricingService';

export interface UseChangeOrderPriceImpactResult {
  impact: ChangeOrderPriceImpact | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useChangeOrderPriceImpact(
  coId: string | undefined,
): UseChangeOrderPriceImpactResult {
  const [impact, setImpact] = useState<ChangeOrderPriceImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!coId) {
      setImpact(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await recalculateChangeOrderImpact(coId);
      setImpact(result);
    } catch (err) {
      setError((err as Error).message);
      setImpact(null);
    } finally {
      setLoading(false);
    }
  }, [coId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { impact, loading, error, refresh: load };
}
