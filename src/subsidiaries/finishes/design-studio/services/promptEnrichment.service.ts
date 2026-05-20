/**
 * Prompt Enrichment Service
 *
 * Wraps the DKB enrichTripoPrompt function with caching and error handling.
 * Used by ImageDraftUploader before calling the Tripo mesh generation API.
 */
import { enrichTripoPrompt as dkbEnrichTripoPrompt, getArchetypeForProduct } from './knowledgeBase.service';
import type { ProductArchetypeEntry } from '../types/knowledgeBase.types';

export interface EnrichmentResult {
  enrichedPrompt: string;
  matchedArchetype: ProductArchetypeEntry | null;
  wasEnriched: boolean;
}

/**
 * Enrich a user's design description with DKB archetype context.
 * Returns both the enriched prompt and metadata about what was matched.
 */
export async function enrichPrompt(
  userDescription: string,
  overallDimensions?: { width: number; depth: number; height: number },
): Promise<EnrichmentResult> {
  try {
    const matchedArchetype = await getArchetypeForProduct(userDescription);
    const enrichedPrompt = await dkbEnrichTripoPrompt(userDescription, overallDimensions);

    return {
      enrichedPrompt,
      matchedArchetype: matchedArchetype ?? null,
      wasEnriched: matchedArchetype !== null,
    };
  } catch {
    // Graceful degradation: return original prompt if enrichment fails
    return {
      enrichedPrompt: userDescription,
      matchedArchetype: null,
      wasEnriched: false,
    };
  }
}
