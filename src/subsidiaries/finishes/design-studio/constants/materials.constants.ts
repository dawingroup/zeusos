/**
 * Material Constants — PBR defaults and material matching configuration
 *
 * Roughness/metalness defaults per finish category, used when no texture maps
 * are available. Values approximate physically-based rendering expectations.
 */

import type { FinishCategory } from '@/modules/inventory/types/finishLibrary';

export interface PBRDefaults {
  roughness: number;
  metalness: number;
}

/**
 * Default PBR material properties per finish category.
 * Applied when a finish is matched but has no texture assets uploaded.
 */
export const PBR_CATEGORY_DEFAULTS: Record<FinishCategory, PBRDefaults> = {
  board: { roughness: 0.5, metalness: 0.0 },
  paint: { roughness: 0.4, metalness: 0.0 },
  tile: { roughness: 0.3, metalness: 0.02 },
  laminate: { roughness: 0.3, metalness: 0.0 },
  veneer: { roughness: 0.55, metalness: 0.0 },
  fabric: { roughness: 0.95, metalness: 0.0 },
  metal: { roughness: 0.4, metalness: 0.8 },
  stone: { roughness: 0.6, metalness: 0.02 },
  glass: { roughness: 0.05, metalness: 0.1 },
  custom: { roughness: 0.5, metalness: 0.0 },
};

/**
 * Subtype-specific PBR overrides for common board/paint subtypes.
 * Keyed by subtype string — falls back to category defaults if not found.
 */
export const PBR_SUBTYPE_OVERRIDES: Record<string, PBRDefaults> = {
  // Board subtypes
  melamine: { roughness: 0.3, metalness: 0.0 },
  mdf: { roughness: 0.85, metalness: 0.0 },
  hdf: { roughness: 0.8, metalness: 0.0 },
  plywood: { roughness: 0.7, metalness: 0.0 },
  chipboard: { roughness: 0.9, metalness: 0.0 },
  hardwood: { roughness: 0.6, metalness: 0.0 },
  softwood: { roughness: 0.65, metalness: 0.0 },
  compact_laminate: { roughness: 0.2, metalness: 0.0 },

  // Paint subtypes
  gloss: { roughness: 0.1, metalness: 0.0 },
  satin: { roughness: 0.25, metalness: 0.0 },
  matte: { roughness: 0.8, metalness: 0.0 },
  eggshell: { roughness: 0.35, metalness: 0.0 },
  lacquer: { roughness: 0.1, metalness: 0.0 },
  metallic: { roughness: 0.3, metalness: 0.5 },

  // Metal subtypes
  brushed_metal: { roughness: 0.4, metalness: 0.85 },
  polished_metal: { roughness: 0.1, metalness: 0.95 },
};

/**
 * Minimum confidence score for auto-applying a fuzzy match.
 * Below this threshold, the material stays at its original 3DS color.
 */
export const AUTO_MATCH_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Maximum CIE76 deltaE for color-proximity matching.
 * 15 is approximately "clearly noticeable but same tone" in human perception.
 */
export const COLOR_MATCH_MAX_DELTA_E = 15;

/**
 * Maximum Levenshtein distance for fuzzy name matching.
 */
export const FUZZY_NAME_MAX_DISTANCE = 3;

/**
 * Minimum token overlap percentage for token-based name matching.
 */
export const TOKEN_OVERLAP_MIN_PERCENT = 0.7;

/**
 * Maximum textures to keep in the LRU cache.
 */
export const TEXTURE_CACHE_MAX_SIZE = 50;
