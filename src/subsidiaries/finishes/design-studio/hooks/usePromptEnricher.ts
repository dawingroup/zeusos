/**
 * usePromptEnricher — Wraps enrichPrompt for React components
 */
import { useState, useCallback } from 'react';
import { enrichPrompt, type EnrichmentResult } from '../services/promptEnrichment.service';

export function usePromptEnricher() {
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);

  const enrich = useCallback(
    async (
      description: string,
      dimensions?: { width: number; depth: number; height: number },
    ) => {
      setIsEnriching(true);
      try {
        const enrichmentResult = await enrichPrompt(description, dimensions);
        setResult(enrichmentResult);
        return enrichmentResult;
      } finally {
        setIsEnriching(false);
      }
    },
    [],
  );

  return {
    enrich,
    result,
    isEnriching,
    enrichedPrompt: result?.enrichedPrompt ?? null,
    matchedArchetype: result?.matchedArchetype ?? null,
    wasEnriched: result?.wasEnriched ?? false,
  };
}
