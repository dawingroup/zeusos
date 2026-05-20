import { useState, useEffect, useCallback } from 'react';
import type { CapitalNeed, CapitalNeedFilters, AffordabilityAnalysis, CashFlowGapDetails } from '../types/capital.types';
import type { CapitalNeedInput } from '../schemas/capital.schemas';
import { capitalNeedsService } from '../services/capitalNeedsService';

export function useCapitalNeeds(companyId: string, filters: CapitalNeedFilters = {}) {
  const [needs, setNeeds] = useState<CapitalNeed[]>([]);
  const [detectedGaps, setDetectedGaps] = useState<CashFlowGapDetails[]>([]);
  const [affordability, setAffordability] = useState<AffordabilityAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [needsList, gaps, afford] = await Promise.all([
        capitalNeedsService.getNeeds(companyId, filters),
        capitalNeedsService.detectCapitalNeeds(companyId),
        capitalNeedsService.calculateAffordability(companyId),
      ]);
      setNeeds(needsList);
      setDetectedGaps(gaps);
      setAffordability(afford);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load capital needs');
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createNeed = useCallback(
    async (input: CapitalNeedInput, userId: string) => {
      const need = await capitalNeedsService.createNeed(companyId, input, userId);
      setNeeds(prev => [need, ...prev]);
      return need;
    },
    [companyId],
  );

  const updateNeed = useCallback(
    async (needId: string, updates: Partial<CapitalNeedInput>) => {
      await capitalNeedsService.updateNeed(companyId, needId, updates);
      await refresh();
    },
    [companyId, refresh],
  );

  const deleteNeed = useCallback(
    async (needId: string) => {
      await capitalNeedsService.deleteNeed(companyId, needId);
      setNeeds(prev => prev.filter(n => n.id !== needId));
    },
    [companyId],
  );

  return {
    needs,
    detectedGaps,
    affordability,
    loading,
    error,
    refresh,
    createNeed,
    updateNeed,
    deleteNeed,
  };
}
