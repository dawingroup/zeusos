/**
 * Material Resolver
 *
 * When the AI Formula Assistant generates formula components it only knows the
 * material name — no library ID, no price.  This service bridges that gap:
 *
 *  1. Searches the Materials library for an existing entry whose name matches
 *     (case-insensitive substring or exact match).
 *  2. If found → returns its ID and current standard rate.
 *  3. If NOT found → creates a stub entry in the library (rate = 0, marked as
 *     ai-seeded) so the material is visible and can be priced later.
 *
 * Usage:
 *   const { materialId, unitPrice } = await resolveOrSeedMaterial(
 *     { materialName: 'Ordinary Portland Cement 50kg', unit: 'bags', formulaCategory: 'CONCRETE' },
 *     userId
 *   );
 */

import { materialService } from './material-service';
import type { MaterialCategoryExtended } from '../types/material';

export interface ResolvedMaterial {
  materialId: string;
  unitPrice: number;
  wasCreated: boolean; // true if a new stub was seeded into the library
}

export interface ResolveInput {
  materialName: string;
  unit: string;
  formulaCategory: string; // CONCRETE, MASONRY, etc. — from FormulaBreakdown.category
}

// ─── Formula category → Material category mapping ────────────────────────────

const FORMULA_TO_MATERIAL_CATEGORY: Record<string, MaterialCategoryExtended> = {
  CONCRETE:       'cement_concrete',
  CEMENT:         'cement_concrete',
  STEEL:          'steel_reinforcement',
  REINFORCEMENT:  'steel_reinforcement',
  MASONRY:        'masonry',
  BRICK:          'masonry',
  BLOCK:          'masonry',
  TIMBER:         'timber',
  WOOD:           'timber',
  ROOFING:        'roofing',
  PLUMBING:       'plumbing',
  ELECTRICAL:     'electrical',
  FINISHES:       'finishes',
  FINISH:         'finishes',
  DOORS_WINDOWS:  'doors_windows',
  HARDWARE:       'hardware',
  AGGREGATES:     'aggregates',
  AGGREGATE:      'aggregates',
  EARTHWORKS:     'other',
  OTHER:          'other',
};

function inferCategory(formulaCategory: string): MaterialCategoryExtended {
  const upper = formulaCategory.toUpperCase().trim();
  // Try exact key first, then partial match
  for (const [key, cat] of Object.entries(FORMULA_TO_MATERIAL_CATEGORY)) {
    if (upper === key || upper.includes(key)) return cat;
  }
  return 'other';
}

// ─── Generate a tidy material code from a name ───────────────────────────────

function nameToCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 24);
}

// ─── Name matching ────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function isMatch(libraryName: string, searchName: string): boolean {
  const lib = normalise(libraryName);
  const srch = normalise(searchName);
  // Exact match
  if (lib === srch) return true;
  // One contains the other (handles "Cement OPC 50kg" ↔ "Cement")
  if (lib.includes(srch) || srch.includes(lib)) return true;
  // First-word match (e.g. "Cement" matches "Cement (OPC 42.5N)")
  const libFirst = lib.split(' ')[0];
  const srchFirst = srch.split(' ')[0];
  if (libFirst.length >= 4 && libFirst === srchFirst) return true;
  return false;
}

// ─── In-memory cache to avoid duplicate lookups in the same session ──────────
// Key: normalised materialName → { materialId, unitPrice }

const _cache = new Map<string, { materialId: string; unitPrice: number }>();

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a material name to a library entry, creating a stub if necessary.
 * Results are cached for the lifetime of the browser session.
 */
export async function resolveOrSeedMaterial(
  input: ResolveInput,
  userId: string,
): Promise<ResolvedMaterial> {
  const cacheKey = normalise(input.materialName);

  // 1. Check session cache
  const cached = _cache.get(cacheKey);
  if (cached) {
    return { ...cached, wasCreated: false };
  }

  // 2. Search the materials library
  try {
    const matches = await materialService.searchMaterials(input.materialName);
    const exactMatch = matches.find(m => isMatch(m.name, input.materialName));

    if (exactMatch) {
      const unitPrice = exactMatch.standardRate?.amount ?? 0;
      _cache.set(cacheKey, { materialId: exactMatch.id, unitPrice });
      return { materialId: exactMatch.id, unitPrice, wasCreated: false };
    }
  } catch {
    // If search fails, fall through to create
  }

  // 3. Not found — create a stub entry
  const category = inferCategory(input.formulaCategory);
  const code = nameToCode(input.materialName);

  try {
    const materialId = await materialService.createMaterial(
      {
        code,
        name: input.materialName,
        description: `Auto-seeded by AI Formula Assistant. Update rate before use.`,
        category,
        baseUnit: input.unit,
        standardRate: { amount: 0, currency: 'UGX' },
        specifications: [],
        preferredSuppliers: [],
      },
      userId,
    );

    _cache.set(cacheKey, { materialId, unitPrice: 0 });
    return { materialId, unitPrice: 0, wasCreated: true };
  } catch (err) {
    // If creation also fails (e.g. duplicate code), return an empty ID
    // so the formula still saves — it just won't have pricing
    console.warn(`materialResolver: could not seed "${input.materialName}":`, err);
    return { materialId: '', unitPrice: 0, wasCreated: false };
  }
}

/**
 * Resolve all components in a formula breakdown in parallel.
 * Returns a map of materialName (normalised) → { materialId, unitPrice }.
 */
export async function resolveAllComponents(
  components: Array<{ materialName: string; unit: string }>,
  formulaCategory: string,
  userId: string,
): Promise<Map<string, { materialId: string; unitPrice: number; wasCreated: boolean }>> {
  const results = await Promise.all(
    components.map(c =>
      resolveOrSeedMaterial(
        { materialName: c.materialName, unit: c.unit, formulaCategory },
        userId,
      ).then(r => [normalise(c.materialName), r] as const),
    ),
  );
  return new Map(results);
}
