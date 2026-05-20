/**
 * useSupplierAnalysis Hook
 * Computes supplier rankings and price analysis for an inventory item
 */

import { useState, useEffect, useCallback } from 'react';
import { calculateSupplierRankings, getPriceSummary } from '../services/supplierAnalysisService';
import type {
  SupplierInventoryPricing,
  SupplierRankingResult,
  SupplierRankingWeights,
} from '../types';
import { DEFAULT_RANKING_WEIGHTS } from '../types';

interface UseSupplierAnalysisResult {
  rankings: SupplierRankingResult[];
  priceSummary: ReturnType<typeof getPriceSummary>;
  loading: boolean;
  error: Error | null;
  recalculate: (weights?: SupplierRankingWeights) => Promise<void>;
}

export function useSupplierAnalysis(
  supplierPricing: SupplierInventoryPricing[],
  autoCalculate: boolean = true
): UseSupplierAnalysisResult {
  const [rankings, setRankings] = useState<SupplierRankingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const priceSummary = getPriceSummary(supplierPricing);

  const recalculate = useCallback(async (
    weights: SupplierRankingWeights = DEFAULT_RANKING_WEIGHTS
  ) => {
    if (supplierPricing.length === 0) {
      setRankings([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await calculateSupplierRankings(supplierPricing, weights);
      setRankings(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to calculate rankings'));
    } finally {
      setLoading(false);
    }
  }, [supplierPricing]);

  useEffect(() => {
    if (autoCalculate && supplierPricing.length > 0) {
      recalculate();
    }
  }, [autoCalculate, recalculate]);

  return { rankings, priceSummary, loading, error, recalculate };
}
