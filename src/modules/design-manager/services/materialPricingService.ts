/**
 * Material Pricing Service
 * Single source of truth for all material price lookups
 * Implements 3-tier fallback: Palette → Inventory → Defaults
 */

import type { MaterialPaletteEntry, MaterialQualityTier, MaterialType } from '@/shared/types';
import { getMaterialValuationPriceByName } from '@/modules/inventory/services/inventoryPriceService';
import { getMaterial } from './materialService';

/**
 * Price source indicator for traceability
 */
export type MaterialPriceSource = 'palette' | 'inventory' | 'material-service' | 'fallback';

/**
 * Result of material price lookup
 */
export interface MaterialPriceResult {
  cost: number;
  source: MaterialPriceSource;
  currency: string;
  materialId?: string;
  inventoryItemId?: string;
  confidence: 'high' | 'medium' | 'low';
  pricingUnit?: string;
}

/**
 * Cache for material prices to avoid repeated lookups
 * Key format: projectId:materialName:thickness
 */
const priceCache = new Map<string, { result: MaterialPriceResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Default fallback prices by thickness (UGX per square meter)
 * These are conservative estimates used when no other source is available
 */
const DEFAULT_PRICES_BY_THICKNESS: Record<number, number> = {
  6: 15000,   // 6mm sheet
  9: 18000,   // 9mm sheet
  12: 22000,  // 12mm sheet
  15: 27000,  // 15mm sheet
  18: 32000,  // 18mm sheet
  25: 45000,  // 25mm sheet
};

/**
 * Get material unit cost with 3-tier fallback
 * Priority: Material Palette → Inventory → Material Service → Hardcoded Defaults
 *
 * @param materialName - Name of the material (e.g., "Plywood", "MDF")
 * @param thickness - Thickness in mm
 * @param projectId - Project ID for palette lookup
 * @param materialPalette - Optional pre-loaded material palette (avoids fetch)
 * @param materialType - Optional material type for type-aware matching
 * @returns Price result with source tracking and pricing unit
 */
export async function getMaterialUnitCost(
  materialName: string,
  thickness: number,
  projectId: string,
  materialPalette?: MaterialPaletteEntry[],
  _materialType?: MaterialType
): Promise<MaterialPriceResult> {
  // Check cache first
  const cacheKey = `${projectId}:${materialName}:${thickness}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  let result: MaterialPriceResult;

  // Tier 1: Check material palette (project-specific mappings)
  if (materialPalette) {
    console.log(`[MaterialPricing] Looking up: "${materialName}" ${thickness}mm in palette with ${materialPalette.length} entries`);
    const paletteEntry = findPaletteEntry(materialPalette, materialName, thickness);
    if (paletteEntry) {
      console.log(`[MaterialPricing] Found palette entry:`, {
        designName: paletteEntry.designName,
        normalizedName: paletteEntry.normalizedName,
        thickness: paletteEntry.thickness,
        unitCost: paletteEntry.unitCost,
        currency: paletteEntry.currency
      });
    } else {
      console.warn(`[MaterialPricing] No palette match for "${materialName}" ${thickness}mm`);
      console.log('[MaterialPricing] Available palette entries:');
      materialPalette.forEach((e, idx) => {
        console.log(`  Entry ${idx + 1}:`, {
          designName: e.designName || '(not set)',
          normalizedName: e.normalizedName || '(not set)',
          thickness: e.thickness,
          unitCost: e.unitCost
        });
      });
    }
    if (paletteEntry?.unitCost && paletteEntry.unitCost > 0) {
      result = {
        cost: paletteEntry.unitCost,
        source: 'palette',
        currency: paletteEntry.currency || 'UGX',
        materialId: paletteEntry.materialId,
        inventoryItemId: paletteEntry.inventoryItemId,
        confidence: 'high',
        pricingUnit: paletteEntry.costUnit,
      };
      priceCache.set(cacheKey, { result, timestamp: Date.now() });
      console.log(`[MaterialPricing] ✓ Using palette price: ${result.cost} ${result.currency} (${paletteEntry.costUnit || 'unspecified unit'})`);
      return result;
    }
  } else {
    console.warn(`[MaterialPricing] No material palette provided for "${materialName}" ${thickness}mm`);
  }

  // Tier 2: Try inventory direct lookup
  try {
    const inventoryPrice = await getMaterialValuationPriceByName(materialName, thickness);
    if (inventoryPrice.found && inventoryPrice.price?.costPerUnit && inventoryPrice.price.costPerUnit > 0) {
      result = {
        cost: inventoryPrice.price.costPerUnit,
        source: 'inventory',
        currency: inventoryPrice.price?.currency || 'UGX',
        inventoryItemId: (inventoryPrice as any).itemId,
        confidence: 'high',
      };
      priceCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  } catch (err) {
    console.warn('[MaterialPricing] Inventory lookup failed:', err);
  }

  // Tier 3: Try old material service
  try {
    const material = await getMaterial(materialName, 'global');
    if (material?.pricePerSqM && material.pricePerSqM > 0) {
      result = {
        cost: material.pricePerSqM,
        source: 'material-service',
        currency: 'UGX',
        materialId: material.id,
        confidence: 'medium',
      };
      priceCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  } catch (err) {
    console.warn('[MaterialPricing] Material service lookup failed:', err);
  }

  // Tier 4: Fallback to defaults based on thickness
  const defaultPrice = getFallbackPrice(thickness);
  result = {
    cost: defaultPrice,
    source: 'fallback',
    currency: 'UGX',
    confidence: 'low',
  };

  priceCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}

/**
 * Find matching entry in material palette
 * Matches by material name (case-insensitive) and thickness
 */
function findPaletteEntry(
  palette: MaterialPaletteEntry[],
  materialName: string,
  thickness: number
): MaterialPaletteEntry | undefined {
  const normalizedName = materialName.toLowerCase().trim();

  return palette.find(entry => {
    // Use designName (from CSV/Polyboard) or normalizedName (cleaned for matching)
    const entryName = entry.designName?.toLowerCase().trim() ||
                      entry.normalizedName?.toLowerCase().trim() || '';
    const entryThickness = entry.thickness || 0;

    return entryName === normalizedName && Math.abs(entryThickness - thickness) < 0.1;
  });
}

/**
 * Get fallback price based on thickness
 * Interpolates for non-standard thicknesses
 */
function getFallbackPrice(thickness: number): number {
  // Exact match
  if (thickness in DEFAULT_PRICES_BY_THICKNESS) {
    return DEFAULT_PRICES_BY_THICKNESS[thickness];
  }

  // Find nearest thicknesses for interpolation
  const thicknesses = Object.keys(DEFAULT_PRICES_BY_THICKNESS).map(Number).sort((a, b) => a - b);

  // Below minimum
  if (thickness < thicknesses[0]) {
    return DEFAULT_PRICES_BY_THICKNESS[thicknesses[0]];
  }

  // Above maximum
  if (thickness > thicknesses[thicknesses.length - 1]) {
    return DEFAULT_PRICES_BY_THICKNESS[thicknesses[thicknesses.length - 1]];
  }

  // Interpolate between two nearest thicknesses
  for (let i = 0; i < thicknesses.length - 1; i++) {
    const lower = thicknesses[i];
    const upper = thicknesses[i + 1];

    if (thickness >= lower && thickness <= upper) {
      const lowerPrice = DEFAULT_PRICES_BY_THICKNESS[lower];
      const upperPrice = DEFAULT_PRICES_BY_THICKNESS[upper];
      const ratio = (thickness - lower) / (upper - lower);
      return Math.round(lowerPrice + (upperPrice - lowerPrice) * ratio);
    }
  }

  // Fallback to 18mm price
  return DEFAULT_PRICES_BY_THICKNESS[18];
}

/**
 * Batch lookup for multiple materials
 * More efficient than individual lookups
 */
export async function getMaterialUnitCostBatch(
  materials: Array<{ materialName: string; thickness: number }>,
  projectId: string,
  materialPalette?: MaterialPaletteEntry[]
): Promise<Map<string, MaterialPriceResult>> {
  const results = new Map<string, MaterialPriceResult>();

  // Process in parallel
  await Promise.all(
    materials.map(async ({ materialName, thickness }) => {
      const key = `${materialName}:${thickness}`;
      const result = await getMaterialUnitCost(materialName, thickness, projectId, materialPalette);
      results.set(key, result);
    })
  );

  return results;
}

/**
 * Clear price cache for a project
 * Call this when material palette is updated
 */
export function clearPriceCache(projectId: string): void {
  const keysToDelete: string[] = [];

  for (const key of priceCache.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => priceCache.delete(key));
}

/**
 * Clear all price caches
 * Use sparingly, mainly for testing
 */
export function clearAllPriceCache(): void {
  priceCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getPriceCacheStats(): {
  size: number;
  hitRate: number;
  oldestEntry: number | null;
} {
  let hits = 0;
  let misses = 0;
  let oldestTimestamp: number | null = null;

  for (const entry of priceCache.values()) {
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      hits++;
    } else {
      misses++;
    }

    if (!oldestTimestamp || entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
  }

  return {
    size: priceCache.size,
    hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
    oldestEntry: oldestTimestamp,
  };
}

/**
 * Validate that material has valid pricing
 * Used for error checking before estimate generation
 */
export async function validateMaterialPricing(
  materialName: string,
  thickness: number,
  projectId: string,
  materialPalette?: MaterialPaletteEntry[]
): Promise<{
  isValid: boolean;
  source: MaterialPriceSource;
  confidence: 'high' | 'medium' | 'low';
  warning?: string;
}> {
  const result = await getMaterialUnitCost(materialName, thickness, projectId, materialPalette);

  let warning: string | undefined;

  if (result.source === 'fallback') {
    warning = `Using default price for ${materialName} ${thickness}mm. Consider adding to material palette for accurate pricing.`;
  } else if (result.confidence === 'medium') {
    warning = `Material pricing from legacy source. Consider updating material palette.`;
  }

  return {
    isValid: result.cost > 0,
    source: result.source,
    confidence: result.confidence,
    warning,
  };
}

/**
 * Get material unit cost for a specific quality tier.
 * Checks the palette entry's alternative mappings for the requested tier.
 * Falls back to the standard (base) cost if no alternative is mapped.
 *
 * @param materialName - Name of the material
 * @param thickness - Thickness in mm
 * @param projectId - Project ID for palette lookup
 * @param qualityTier - The quality tier to price for
 * @param materialPalette - Pre-loaded material palette entries
 * @returns Price result with substitution flag
 */
export async function getMaterialUnitCostForTier(
  materialName: string,
  thickness: number,
  projectId: string,
  qualityTier: MaterialQualityTier,
  materialPalette?: MaterialPaletteEntry[]
): Promise<MaterialPriceResult & { isSubstituted: boolean }> {
  // For standard tier, use the base cost (no substitution)
  if (qualityTier === 'standard') {
    const result = await getMaterialUnitCost(materialName, thickness, projectId, materialPalette);
    return { ...result, isSubstituted: false };
  }

  // Check if palette has an alternative mapping for this tier
  if (materialPalette) {
    const paletteEntry = findPaletteEntry(materialPalette, materialName, thickness);

    if (paletteEntry?.alternatives) {
      const altMapping = paletteEntry.alternatives.find(a => a.qualityTier === qualityTier);
      if (altMapping && altMapping.unitCost > 0) {
        return {
          cost: altMapping.unitCost,
          source: 'palette',
          currency: altMapping.currency || 'UGX',
          inventoryItemId: altMapping.inventoryId,
          confidence: 'high',
          isSubstituted: true,
        };
      }
    }
  }

  // No alternative mapped for this tier — fall back to standard cost
  const result = await getMaterialUnitCost(materialName, thickness, projectId, materialPalette);
  return { ...result, isSubstituted: false };
}
