/**
 * useMDPGenerator — MDP generation lifecycle hook
 *
 * NOTE: createMOFromMDP / createQuoteFromMDP / checkAndCreatePOs were renamed
 * in mdpGenerator.service to prepareMOHandoff / prepareQuoteHandoff /
 * flagShortages with different signatures. The createMO / createQuote /
 * checkShortages methods below are temporarily disabled — call sites should
 * migrate to the new handoff API directly.
 */
import { useState, useCallback } from 'react';
import { generateMDP } from '../services/mdpGenerator.service';
import type { ManufacturingDataPackage } from '../types/mdp.types';

export function useMDPGenerator() {
  const [mdp, setMDP] = useState<ManufacturingDataPackage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      pddId: string,
      configuration: Record<string, unknown>,
      finishSelections: Record<string, string>,
    ) => {
      setIsGenerating(true);
      setError(null);
      try {
        const result = await generateMDP(pddId, configuration, finishSelections);
        setMDP(result);
        return result;
      } catch (err) {
        setError((err as Error).message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  const createMO = useCallback(
    async (_priority: string, _projectId?: string) => {
      if (!mdp) throw new Error('No MDP generated');
      throw new Error('createMO is disabled — migrate to prepareMOHandoff');
    },
    [mdp],
  );

  const createQuote = useCallback(
    async (_customerId: string, _projectId?: string) => {
      if (!mdp) throw new Error('No MDP generated');
      throw new Error('createQuote is disabled — migrate to prepareQuoteHandoff');
    },
    [mdp],
  );

  const checkShortages = useCallback(
    async () => {
      if (!mdp) throw new Error('No MDP generated');
      throw new Error('checkShortages is disabled — migrate to flagShortages');
    },
    [mdp],
  );

  return {
    mdp,
    isGenerating,
    error,
    generate,
    createMO,
    createQuote,
    checkShortages,
    shortages: mdp?.shortages ?? [],
    bom: mdp?.bom ?? [],
    pricingBreakdown: mdp?.pricingBreakdown ?? null,
  };
}
