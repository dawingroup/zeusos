/**
 * Material Resolver Service — Fuzzy-match 3DS material names to Finish Library
 *
 * Matching cascade:
 * 1. Exact code match (case-insensitive)
 * 2. Exact name match (case-insensitive)
 * 3. Fuzzy name match (Levenshtein distance < 3 or token overlap >= 70%)
 * 4. Fuzzy code match after stripping common prefixes
 * 5. Color proximity match (CIE76 deltaE < 15)
 */

import type { FinishDocument, FinishCategory } from '@/modules/inventory/types/finishLibrary';
import { hexColorDistance, diffuseToHex } from '../utils/colorUtils';
import {
  AUTO_MATCH_CONFIDENCE_THRESHOLD,
  COLOR_MATCH_MAX_DELTA_E,
  FUZZY_NAME_MAX_DISTANCE,
  TOKEN_OVERLAP_MIN_PERCENT,
  PBR_CATEGORY_DEFAULTS,
  PBR_SUBTYPE_OVERRIDES,
  type PBRDefaults,
} from '../constants/materials.constants';

// ============================================================================
// Types
// ============================================================================

export interface TextureAssetUrls {
  diffuseUrl?: string;
  normalUrl?: string;
  roughnessUrl?: string;
  tileRepeat?: [number, number];
}

export interface MaterialMapping {
  threeDsMaterialName: string;
  finishLibraryId: string;
  finishName: string;
  finishCode: string;
  hexColor: string;
  category: FinishCategory;
  subtype: string;
  textureAssets?: TextureAssetUrls;
  pbrDefaults: PBRDefaults;
  confidence: number;
  matchedOn: 'code' | 'name' | 'fuzzy_name' | 'fuzzy_code' | 'color' | 'none';
  /**
   * True when the matched finish is part of the project's curated
   * `materialPalette`. P21.7: the palette is our signal that the designer
   * has committed to a subset of finishes for this project; resolver
   * biases matches toward those before falling back to the global
   * Finish Library, and the UI can badge palette hits so users know
   * they're on-brief.
   */
  viaProjectPalette?: boolean;
}

export interface FuzzyMatchResult {
  finishId: string;
  finishName: string;
  finishCode: string;
  confidence: number;
  matchedOn: MaterialMapping['matchedOn'];
}

// ============================================================================
// String Utilities
// ============================================================================

/** Strip common 3DS/PolyBoard material name prefixes and normalize. */
function normalizeMaterialName(name: string): string {
  return name
    .replace(/^(MEL[-_]?|LAM[-_]?|VEN[-_]?|PNT[-_]?|MTL[-_]?|FAB[-_]?|GL[-_]?)/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Extract meaningful tokens from a material name. */
function tokenize(name: string): string[] {
  return normalizeMaterialName(name)
    .split(/\s+/)
    .filter(t => t.length > 1); // drop single chars
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/** Token overlap percentage: fraction of tokens from A found in B. */
function tokenOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0) return 0;
  const setB = new Set(tokensB);
  const matches = tokensA.filter(t => setB.has(t)).length;
  return matches / tokensA.length;
}

// ============================================================================
// Matching Logic
// ============================================================================

/**
 * Resolve PBR defaults for a finish entry.
 * Checks subtype overrides first, then falls back to category defaults.
 */
export function resolvePBRDefaults(category: FinishCategory, subtype?: string): PBRDefaults {
  if (subtype && PBR_SUBTYPE_OVERRIDES[subtype]) {
    return PBR_SUBTYPE_OVERRIDES[subtype];
  }
  return PBR_CATEGORY_DEFAULTS[category] || PBR_CATEGORY_DEFAULTS.custom;
}

/** Confidence boost applied to candidates that are in the project's palette. */
const PROJECT_PALETTE_BONUS = 0.1;

/** Apply the palette bonus to a raw confidence score, clamped to 1.0. */
function withPaletteBonus(conf: number, inPalette: boolean): number {
  return inPalette ? Math.min(1.0, conf + PROJECT_PALETTE_BONUS) : conf;
}

/**
 * Find the best matching finish for a 3DS material name.
 *
 * When `preferredFinishIds` is provided (project's `materialPalette`),
 * candidates inside it get a small confidence bonus so they outrank
 * equally-good matches from the broader library.
 */
function findBestMatch(
  materialName: string,
  diffuseColor: [number, number, number] | undefined,
  finishes: FinishDocument[],
  preferredFinishIds?: ReadonlySet<string>,
): FuzzyMatchResult | null {
  const normalized = normalizeMaterialName(materialName);
  const tokens = tokenize(materialName);
  const rawCode = materialName.toUpperCase().replace(/[-_\s]+/g, '-');

  let bestMatch: FuzzyMatchResult | null = null;
  let bestConfidence = 0;

  for (const finish of finishes) {
    const finishCode = (finish.code || '').toUpperCase().replace(/[-_\s]+/g, '-');
    const finishNorm = normalizeMaterialName(finish.name);
    const finishTokens = tokenize(finish.name);
    const inPalette = preferredFinishIds?.has(finish.id) ?? false;

    // Pass 1: Exact code match — already max confidence, palette bonus no-op.
    if (rawCode === finishCode && finishCode.length > 0) {
      return {
        finishId: finish.id,
        finishName: finish.name,
        finishCode: finish.code,
        confidence: 1.0,
        matchedOn: 'code',
      };
    }

    // Pass 2: Exact name match
    if (normalized === finishNorm && finishNorm.length > 0) {
      const conf = withPaletteBonus(0.95, inPalette);
      if (conf > bestConfidence) {
        bestConfidence = conf;
        bestMatch = {
          finishId: finish.id,
          finishName: finish.name,
          finishCode: finish.code,
          confidence: conf,
          matchedOn: 'name',
        };
      }
      continue;
    }

    // Pass 3: Fuzzy name match
    if (normalized.length > 0 && finishNorm.length > 0) {
      const dist = levenshtein(normalized, finishNorm);
      if (dist <= FUZZY_NAME_MAX_DISTANCE) {
        const conf = withPaletteBonus(0.85 - (dist * 0.1), inPalette);
        if (conf > bestConfidence) {
          bestConfidence = conf;
          bestMatch = {
            finishId: finish.id,
            finishName: finish.name,
            finishCode: finish.code,
            confidence: conf,
            matchedOn: 'fuzzy_name',
          };
        }
      }

      // Token overlap
      const overlap = tokenOverlap(tokens, finishTokens);
      if (overlap >= TOKEN_OVERLAP_MIN_PERCENT) {
        const conf = withPaletteBonus(0.6 + (overlap * 0.25), inPalette);
        if (conf > bestConfidence) {
          bestConfidence = conf;
          bestMatch = {
            finishId: finish.id,
            finishName: finish.name,
            finishCode: finish.code,
            confidence: conf,
            matchedOn: 'fuzzy_name',
          };
        }
      }
    }

    // Pass 4: Fuzzy code match (strip common prefixes)
    const strippedCode = rawCode.replace(/^(MEL|LAM|VEN|PNT|MTL|FAB|GL)-?/, '');
    const strippedFinishCode = finishCode.replace(/^(MEL|LAM|VEN|PNT|MTL|FAB|GL)-?/, '');
    if (strippedCode.length > 2 && strippedCode === strippedFinishCode) {
      const conf = withPaletteBonus(0.8, inPalette);
      if (conf > bestConfidence) {
        bestConfidence = conf;
        bestMatch = {
          finishId: finish.id,
          finishName: finish.name,
          finishCode: finish.code,
          confidence: conf,
          matchedOn: 'fuzzy_code',
        };
      }
    }
  }

  // Pass 5: Color proximity (only if we have both colors)
  if (diffuseColor && bestConfidence < 0.6) {
    const modelHex = diffuseToHex(diffuseColor);
    for (const finish of finishes) {
      if (!finish.hexColor) continue;
      const inPalette = preferredFinishIds?.has(finish.id) ?? false;
      const dist = hexColorDistance(modelHex, finish.hexColor);
      if (dist < COLOR_MATCH_MAX_DELTA_E) {
        const conf = withPaletteBonus(
          0.5 * (1 - dist / COLOR_MATCH_MAX_DELTA_E),
          inPalette,
        );
        if (conf > bestConfidence) {
          bestConfidence = conf;
          bestMatch = {
            finishId: finish.id,
            finishName: finish.name,
            finishCode: finish.code,
            confidence: conf,
            matchedOn: 'color',
          };
        }
      }
    }
  }

  return bestMatch;
}

// ============================================================================
// Public API
// ============================================================================

/** Options for {@link resolveFromThreeDSNames}. */
export interface ResolveOptions {
  /**
   * IDs of finishes that belong to the project's curated `materialPalette`.
   * Resolver adds a small confidence bonus to candidates in this set so
   * project choices outrank equally-good matches from the global library.
   * Use {@link paletteEntriesToFinishIds} to compute this from a raw
   * palette array.
   */
  preferredFinishIds?: ReadonlySet<string>;
}

/**
 * Match raw `MaterialPaletteEntry`s (from `DesignProject.materialPalette`)
 * against the Finish Library by code (preferred, unambiguous) then by
 * normalized name. Palette entries that don't resolve to a finish doc
 * are dropped — they can still be surfaced in the Item Metadata panel.
 */
export function paletteEntriesToFinishIds(
  palette: ReadonlyArray<{ name?: string; code?: string }>,
  finishes: FinishDocument[],
): Set<string> {
  const ids = new Set<string>();
  if (!palette.length || !finishes.length) return ids;

  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const f of finishes) {
    const code = (f.code || '').toUpperCase().replace(/[-_\s]+/g, '-');
    if (code) byCode.set(code, f.id);
    const name = normalizeMaterialName(f.name || '');
    if (name) byName.set(name, f.id);
  }

  for (const entry of palette) {
    const code = (entry.code || '').toUpperCase().replace(/[-_\s]+/g, '-');
    if (code && byCode.has(code)) {
      ids.add(byCode.get(code)!);
      continue;
    }
    const name = normalizeMaterialName(entry.name || '');
    if (name && byName.has(name)) {
      ids.add(byName.get(name)!);
    }
  }
  return ids;
}

/**
 * Resolve material mappings for all 3DS material names against the Finish Library.
 *
 * Returns a mapping for each material, even unmatched ones (confidence: 0).
 */
export function resolveFromThreeDSNames(
  materials: Record<string, { diffuse: [number, number, number] }>,
  finishes: FinishDocument[],
  options: ResolveOptions = {},
): MaterialMapping[] {
  const mappings: MaterialMapping[] = [];
  const preferredIds = options.preferredFinishIds;

  for (const [matName, matDef] of Object.entries(materials)) {
    const match = findBestMatch(matName, matDef.diffuse, finishes, preferredIds);

    if (match && match.confidence >= AUTO_MATCH_CONFIDENCE_THRESHOLD) {
      const finish = finishes.find(f => f.id === match.finishId);
      const category = finish?.category || 'custom';
      const subtype = finish?.subtype || '';
      const viaProjectPalette = preferredIds?.has(match.finishId) ?? false;

      mappings.push({
        threeDsMaterialName: matName,
        finishLibraryId: match.finishId,
        finishName: match.finishName,
        finishCode: match.finishCode,
        hexColor: finish?.hexColor || diffuseToHex(matDef.diffuse),
        category,
        subtype,
        textureAssets: (finish as unknown as Record<string, unknown>)?.textureAssets as TextureAssetUrls | undefined,
        pbrDefaults: resolvePBRDefaults(category, subtype),
        confidence: match.confidence,
        matchedOn: match.matchedOn,
        viaProjectPalette,
      });
    } else {
      // Unmatched — keep original diffuse color
      mappings.push({
        threeDsMaterialName: matName,
        finishLibraryId: '',
        finishName: '',
        finishCode: '',
        hexColor: diffuseToHex(matDef.diffuse),
        category: 'custom',
        subtype: '',
        pbrDefaults: PBR_CATEGORY_DEFAULTS.custom,
        confidence: match?.confidence || 0,
        matchedOn: match?.matchedOn || 'none',
        viaProjectPalette: false,
      });
    }
  }

  return mappings;
}

/**
 * P21.11 — material-mapper round-trip for bare string names.
 *
 * `resolveFromThreeDSNames` is designed for the 3DS pipeline: each material
 * carries an RGB diffuse color plus a name, and matching fuses both
 * signals. AI part recognition, by contrast, produces *just* a string like
 * "MDF 18mm" or "Oak Veneer" — no color, no texture. This helper closes
 * that gap so every write path into `DesignItem.parts` can stamp a finish
 * library link + inventoryItemId onto each part.
 *
 * Match priority mirrors `paletteEntriesToFinishIds`:
 *   1. Code match against palette      → 'palette-exact', confidence 1.0
 *   2. Normalized-name match in palette → 'palette-fuzzy', confidence 0.9
 *   3. Normalized-name match outside palette → 'ai-guess', confidence 0.7
 *   4. No match → returns null.
 *
 * We deliberately skip fuzzy-string distance (Levenshtein / token overlap)
 * here. The name-based AI output is already a best-guess; layering another
 * heuristic on top tends to produce plausible-but-wrong matches that are
 * hard to notice in the UI. Callers that want fuzzier matching should fall
 * back to the full `resolveFromThreeDSNames` pipeline with synthesised
 * material defs.
 */
export interface ResolvedMaterial {
  finishId: string;
  finishName: string;
  finishCode: string;
  inventoryItemId?: string;
  source: 'palette-exact' | 'palette-fuzzy' | 'ai-guess';
  confidence: number;
}

export function resolveMaterialByName(
  name: string | undefined | null,
  finishes: ReadonlyArray<FinishDocument>,
  preferredFinishIds?: ReadonlySet<string>,
): ResolvedMaterial | null {
  if (!name || !finishes.length) return null;

  const rawCode = name.toUpperCase().replace(/[-_\s]+/g, '-');
  const normalized = normalizeMaterialName(name);
  if (!normalized && !rawCode) return null;

  // Index once. Callers that resolve many names in a loop pay the cost
  // per call; if this ever becomes hot, hoist the indices out.
  const byCode = new Map<string, FinishDocument>();
  const byName = new Map<string, FinishDocument>();
  for (const f of finishes) {
    const code = (f.code || '').toUpperCase().replace(/[-_\s]+/g, '-');
    if (code) byCode.set(code, f);
    const nm = normalizeMaterialName(f.name || '');
    if (nm) byName.set(nm, f);
  }

  // 1. Code match in palette
  if (rawCode && byCode.has(rawCode)) {
    const f = byCode.get(rawCode)!;
    const inPalette = preferredFinishIds?.has(f.id) ?? false;
    return {
      finishId: f.id,
      finishName: f.name,
      finishCode: f.code || '',
      inventoryItemId: f.inventoryItemId,
      source: inPalette ? 'palette-exact' : 'ai-guess',
      confidence: inPalette ? 1.0 : 0.85,
    };
  }

  // 2. Name match
  if (normalized && byName.has(normalized)) {
    const f = byName.get(normalized)!;
    const inPalette = preferredFinishIds?.has(f.id) ?? false;
    return {
      finishId: f.id,
      finishName: f.name,
      finishCode: f.code || '',
      inventoryItemId: f.inventoryItemId,
      source: inPalette ? 'palette-fuzzy' : 'ai-guess',
      confidence: inPalette ? 0.9 : 0.7,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// P21.11.1 — Palette-based material resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a part's `materialName` against the project's `materialPalette`.
 *
 * The Material Palette is the authoritative project-level mapping of design
 * names → inventory items (edited via Design Manager → Material Palette).
 * When a user maps a palette entry to an inventory item, that mapping does
 * NOT auto-propagate to individual parts. This helper lets PartsTab "Resolve
 * materials" do that propagation as a fallback after the Finish Library
 * lookup — so the provenance pills reflect palette mappings too.
 *
 * Matching is structural (designName) and normalised-name based; we don't
 * fuzzy-match for the same reasons as {@link resolveMaterialByName}.
 *
 * Match priority:
 *   1. designName exact (case-insensitive) + palette entry is mapped to
 *      inventory → 'palette-exact', confidence 1.0
 *   2. normalised-name match + mapped to inventory → 'palette-fuzzy', 0.9
 *   3. No match, or match but palette entry isn't mapped → returns null
 *      (resolving to an unmapped palette entry would be worse than leaving
 *      the part flagged 'unresolved').
 */
export interface ResolvedFromPalette {
  paletteEntryId: string;
  designName: string;
  inventoryItemId?: string;
  /**
   * P21.11.1: either the palette entry's own `materialId`, OR — new in
   * P21.12 — the Finish Library doc id stamped on the palette entry via
   * the Finish mapping tab / auto-attach during inventory mapping.
   */
  materialId?: string;
  /** P21.12 — denormalised finish code for the PartsTab chip. */
  finishCode?: string;
  /** P21.12 — denormalised finish name. */
  finishName?: string;
  source: 'palette-exact' | 'palette-fuzzy';
  confidence: number;
}

type PaletteLike = {
  id: string;
  designName: string;
  normalizedName?: string;
  inventoryItemId?: string;
  inventoryId?: string;
  materialId?: string;
  finishId?: string;
  finishCode?: string;
  finishName?: string;
};

function paletteEntryToResolved(
  e: PaletteLike,
  source: 'palette-exact' | 'palette-fuzzy',
  confidence: number,
  finishes?: ReadonlyArray<FinishDocument>,
): ResolvedFromPalette {
  // Pull-through: if the palette entry is linked to a finish but lacks a
  // direct inventoryItemId, consult the finish to recover one.
  let inventoryItemId = e.inventoryItemId || e.inventoryId;
  let finishCode = e.finishCode;
  let finishName = e.finishName;
  if (e.finishId && finishes && finishes.length > 0) {
    const f = finishes.find((x) => x.id === e.finishId);
    if (f) {
      if (!inventoryItemId) inventoryItemId = f.inventoryItemId;
      if (!finishCode) finishCode = f.code;
      if (!finishName) finishName = f.name;
    }
  }

  return {
    paletteEntryId: e.id,
    designName: e.designName,
    inventoryItemId,
    // Prefer the Finish Library id as the canonical materialId when present —
    // it's the richer reference (has code, category, hex, etc.).
    materialId: e.finishId || e.materialId,
    finishCode,
    finishName,
    source,
    confidence,
  };
}

export function resolveMaterialByPalette(
  name: string | undefined | null,
  palette: ReadonlyArray<PaletteLike>,
  finishes?: ReadonlyArray<FinishDocument>,
): ResolvedFromPalette | null {
  if (!name || !palette.length) return null;

  const normalized = normalizeMaterialName(name);
  const lower = name.trim().toLowerCase();

  const hasBinding = (e: PaletteLike): boolean =>
    Boolean(e.inventoryItemId || e.inventoryId || e.materialId || e.finishId);

  for (const e of palette) {
    if (!hasBinding(e)) continue;
    if ((e.designName || '').trim().toLowerCase() === lower) {
      return paletteEntryToResolved(e, 'palette-exact', 1.0, finishes);
    }
  }

  if (normalized) {
    for (const e of palette) {
      if (!hasBinding(e)) continue;
      const paletteNorm = e.normalizedName || normalizeMaterialName(e.designName || '');
      if (paletteNorm && paletteNorm === normalized) {
        return paletteEntryToResolved(e, 'palette-fuzzy', 0.9, finishes);
      }
    }
  }

  return null;
}
