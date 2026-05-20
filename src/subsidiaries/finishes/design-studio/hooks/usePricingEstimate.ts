/**
 * usePricingEstimate — Format pricing from Design Manager's estimation engine
 *
 * Calls the estimation bridge which delegates to getMaterialUnitCost()
 * for real pricing via Design Manager's 3-tier fallback.
 */
import { useQuery } from '@tanstack/react-query';
import { computePricingFromBOM } from '../services/estimationBridge.service';
import { getPDD } from '../services/pdd.service';
import type { ComputedBOMLine, PricingBreakdown } from '../types/constraintEngine.types';

const PRICING_KEYS = {
  estimate: (pddId: string, bomHash: string) =>
    ['pricingEstimate', pddId, bomHash] as const,
};

/**
 * Compute pricing for BOM lines via the estimation bridge.
 * Returns formatted pricing breakdown from Design Manager's material pricing.
 */
export function usePricingEstimate(
  pddId: string | undefined,
  bomLines: ComputedBOMLine[],
  projectId?: string,
) {
  // Simple hash of BOM to detect changes
  const bomHash = bomLines.map(l => `${l.bomTemplateLineKey}:${l.quantity}`).join('|');

  return useQuery<PricingBreakdown | null>({
    queryKey: PRICING_KEYS.estimate(pddId || '', bomHash),
    queryFn: async (): Promise<PricingBreakdown | null> => {
      if (!pddId || bomLines.length === 0) return null;

      const pdd = await getPDD(pddId);
      if (!pdd) return null;

      return computePricingFromBOM(pdd, bomLines, projectId);
    },
    enabled: !!pddId && bomLines.length > 0,
    staleTime: 30_000, // Cache for 30s to avoid rapid re-fetches during config changes
  });
}
