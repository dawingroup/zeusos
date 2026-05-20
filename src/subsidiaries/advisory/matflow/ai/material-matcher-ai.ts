/**
 * Material Matcher AI
 * 
 * AI-powered matching of BOQ items to material library entries.
 */

import type { AlternativeMatch, MaterialMatchType } from '../types/parsing';
import type { MaterialCategoryExtended } from '../types/material';

// ============================================================================
// TYPES
// ============================================================================

export interface MatchingInput {
  itemId: string;
  description: string;
  unit: string;
  rate?: number;
}

export interface MaterialLibraryEntry {
  id: string;
  name: string;
  code?: string;
  category: MaterialCategoryExtended;
  unit: string;
  rate?: number;
  aliases?: string[];
  keywords?: string[];
}

export interface MatchingResult {
  itemId: string;
  itemDescription: string;
  bestMatch: {
    materialId: string;
    materialName: string;
    materialCategory: MaterialCategoryExtended;
    matchScore: number;
    matchType: MaterialMatchType;
    matchReason: string;
  } | null;
  alternatives: AlternativeMatch[];
  rateComparison?: {
    parsedRate: number;
    libraryRate: number | null;
    variance: number | null;
    varianceFlag: 'normal' | 'high' | 'very_high' | null;
  };
}

// ============================================================================
// LOCAL MATCHING (Non-AI fallback)
// ============================================================================

/**
 * Match items to materials using text similarity (client-side)
 */
export const matchMaterialsLocally = (
  items: MatchingInput[],
  materials: MaterialLibraryEntry[]
): MatchingResult[] => {
  return items.map(item => matchSingleItem(item, materials));
};

const matchSingleItem = (
  item: MatchingInput,
  materials: MaterialLibraryEntry[]
): MatchingResult => {
  const scores: Array<{ material: MaterialLibraryEntry; score: number; reason: string }> = [];

  for (const material of materials) {
    const score = calculateMatchScore(item, material);
    if (score.score > 0.3) {
      scores.push({ material, ...score });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const bestMatch = scores[0];
  const alternatives = scores.slice(1, 4).map(s => ({
    materialId: s.material.id,
    materialName: s.material.name,
    matchScore: s.score,
    matchReason: s.reason,
  }));

  // Calculate rate variance
  let rateComparison;
  if (item.rate !== undefined && bestMatch?.material.rate !== undefined) {
    const variance = (item.rate - bestMatch.material.rate) / bestMatch.material.rate;
    rateComparison = {
      parsedRate: item.rate,
      libraryRate: bestMatch.material.rate,
      variance,
      varianceFlag: getVarianceFlag(Math.abs(variance)),
    };
  }

  return {
    itemId: item.itemId,
    itemDescription: item.description,
    bestMatch: bestMatch ? {
      materialId: bestMatch.material.id,
      materialName: bestMatch.material.name,
      materialCategory: bestMatch.material.category,
      matchScore: bestMatch.score,
      matchType: getMatchType(bestMatch.score),
      matchReason: bestMatch.reason,
    } : null,
    alternatives,
    rateComparison,
  };
};

const calculateMatchScore = (
  item: MatchingInput,
  material: MaterialLibraryEntry
): { score: number; reason: string } => {
  const itemDesc = item.description.toLowerCase();
  const materialName = material.name.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  // Exact name match
  if (itemDesc.includes(materialName) || materialName.includes(itemDesc)) {
    score += 0.5;
    reasons.push('Name match');
  }

  // Check aliases
  if (material.aliases) {
    for (const alias of material.aliases) {
      if (itemDesc.includes(alias.toLowerCase())) {
        score += 0.3;
        reasons.push(`Alias match: ${alias}`);
        break;
      }
    }
  }

  // Check keywords
  if (material.keywords) {
    const matchedKeywords = material.keywords.filter(kw => 
      itemDesc.includes(kw.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      score += Math.min(0.3, matchedKeywords.length * 0.1);
      reasons.push(`Keywords: ${matchedKeywords.join(', ')}`);
    }
  }

  // Unit match
  if (normalizeUnit(item.unit) === normalizeUnit(material.unit)) {
    score += 0.1;
    reasons.push('Unit match');
  }

  // Token similarity
  const tokenScore = calculateTokenSimilarity(itemDesc, materialName);
  if (tokenScore > 0.3) {
    score += tokenScore * 0.3;
    reasons.push(`Token similarity: ${(tokenScore * 100).toFixed(0)}%`);
  }

  // Category inference from description
  const inferredCategory = inferCategoryFromDescription(itemDesc);
  if (inferredCategory === material.category) {
    score += 0.1;
    reasons.push('Category match');
  }

  return {
    score: Math.min(1, score),
    reason: reasons.join('; ') || 'Partial text match',
  };
};

// ============================================================================
// TEXT SIMILARITY
// ============================================================================

/**
 * Calculate token-based similarity between two strings
 */
const calculateTokenSimilarity = (str1: string, str2: string): number => {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const intersection = tokens1.filter(t => tokens2.includes(t));
  const union = new Set([...tokens1, ...tokens2]);

  // Jaccard similarity
  return intersection.length / union.size;
};

/**
 * Tokenize text for comparison
 */
const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2)
    .filter(t => !STOP_WORDS.has(t));
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'including', 'per', 'all', 'any',
  'supply', 'provide', 'install', 'including', 'complete', 'etc',
  'works', 'work', 'item', 'items'
]);

// ============================================================================
// CATEGORY INFERENCE
// ============================================================================

/**
 * Infer material category from description
 */
const inferCategoryFromDescription = (description: string): MaterialCategoryExtended | null => {
  const desc = description.toLowerCase();

  const categoryKeywords: Record<MaterialCategoryExtended, string[]> = {
    cement_concrete: ['concrete', 'cement', 'mortar', 'screed', 'grout'],
    steel_reinforcement: ['steel', 'rebar', 'reinforcement', 'mesh', 'brc', 'y-bars'],
    masonry: ['brick', 'block', 'masonry', 'stone', 'hollow'],
    timber: ['timber', 'wood', 'plywood', 'hardwood', 'softwood', 'formwork'],
    roofing: ['roof', 'roofing', 'tiles', 'iron sheets', 'ridge', 'fascia', 'gutter'],
    plumbing: ['pipe', 'plumbing', 'fitting', 'tap', 'valve', 'pvc', 'upvc', 'sanitary'],
    electrical: ['electrical', 'wire', 'cable', 'switch', 'socket', 'conduit', 'db'],
    finishes: ['paint', 'plaster', 'tile', 'terrazzo', 'floor', 'ceiling', 'wall finish'],
    doors_windows: ['door', 'window', 'frame', 'glass', 'handle', 'lock', 'hinge'],
    hardware: ['nail', 'screw', 'bolt', 'nut', 'washer', 'bracket', 'anchor'],
    aggregates: ['sand', 'gravel', 'aggregate', 'hardcore', 'murram', 'ballast'],
    chemicals: ['admixture', 'waterproof', 'sealant', 'epoxy', 'primer', 'adhesive'],
    equipment: ['equipment', 'scaffold', 'machine', 'pump', 'mixer', 'vibrator'],
    other: [],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => desc.includes(kw))) {
      return category as MaterialCategoryExtended;
    }
  }

  return null;
};

// ============================================================================
// UNIT HELPERS
// ============================================================================

/**
 * Normalize unit string for comparison
 */
const normalizeUnit = (unit: string): string => {
  const normalized = unit.toLowerCase().replace(/[.\s]/g, '');

  const unitMappings: Record<string, string> = {
    'sqm': 'm²',
    'sq.m': 'm²',
    'm2': 'm²',
    'cum': 'm³',
    'cu.m': 'm³',
    'm3': 'm³',
    'no': 'nr',
    'nos': 'nr',
    'pcs': 'nr',
    'pc': 'nr',
    'ls': 'l.s.',
    'lumpsum': 'l.s.',
    'sum': 'l.s.',
    'item': 'l.s.',
    'lm': 'lm',
    'rm': 'lm',
    'kg': 'kg',
    'kgs': 'kg',
    't': 't',
    'ton': 't',
    'tonne': 't',
    'tonnes': 't',
  };

  return unitMappings[normalized] || normalized;
};

/**
 * Get variance flag based on percentage difference
 */
const getVarianceFlag = (variance: number): 'normal' | 'high' | 'very_high' => {
  if (variance > 0.5) return 'very_high';
  if (variance > 0.2) return 'high';
  return 'normal';
};

/**
 * Get match type from score
 */
const getMatchType = (score: number): MaterialMatchType => {
  if (score >= 0.9) return 'exact';
  if (score >= 0.7) return 'fuzzy';
  if (score >= 0.5) return 'category';
  return 'none';
};

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process items in batches for better performance
 */
export const matchMaterialsBatched = async (
  items: MatchingInput[],
  materials: MaterialLibraryEntry[],
  batchSize: number = 50,
  onProgress?: (processed: number, total: number) => void
): Promise<MatchingResult[]> => {
  const results: MatchingResult[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = matchMaterialsLocally(batch, materials);
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }

    // Yield to event loop
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
};

/**
 * Apply material matches to parsed items
 */
export const applyMatchesToItems = (
  sections: any[],
  matches: MatchingResult[]
): void => {
  const matchMap = new Map(matches.map(m => [m.itemId, m]));

  for (const section of sections) {
    for (const item of section.items) {
      const match = matchMap.get(item.id);
      if (match?.bestMatch && match.bestMatch.matchScore > 0.3) {
        item.materialMatch = {
          materialId: match.bestMatch.materialId,
          materialName: match.bestMatch.materialName,
          materialCategory: match.bestMatch.materialCategory,
          matchScore: match.bestMatch.matchScore,
          matchType: match.bestMatch.matchType,
          libraryRate: match.rateComparison?.libraryRate,
          parsedRate: match.rateComparison?.parsedRate,
          rateVariance: match.rateComparison?.variance,
          alternatives: match.alternatives,
          confirmed: match.bestMatch.matchScore >= 0.9,
        };
      }
    }
  }
};

export default {
  matchMaterialsLocally,
  matchMaterialsBatched,
  applyMatchesToItems,
  inferCategoryFromDescription,
  normalizeUnit,
};
