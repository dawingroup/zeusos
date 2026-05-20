/**
 * Variant Attribute Utilities
 * Merges category-specific attribute definitions with common attributes
 * to produce a unified list of attribute options for the VariantManager.
 */

import type { AttributeDefinition, AttributeValueType } from '../types/finishAttributes';
import type { FinishCategory } from '../types/finishLibrary';
import type { InventoryCategory } from '../types/inventory';
import { COMMON_VARIANT_ATTRIBUTES } from '../types/inventory';
import {
  BOARD_ATTRIBUTE_SEEDS,
  PAINT_ATTRIBUTE_SEEDS,
  TILE_ATTRIBUTE_SEEDS,
  HARDWARE_ATTRIBUTE_SEEDS,
  SOLID_WOOD_ATTRIBUTE_SEEDS,
  EDGE_BANDING_ATTRIBUTE_SEEDS,
} from '../types/finishAttributes';

/**
 * A single attribute option for display in the VariantManager dropdown.
 */
export interface VariantAttributeOption {
  key: string;
  label: string;
  type: AttributeValueType;
  enumValues?: (string | number)[];
  unit?: string;
  source: 'category' | 'common' | 'custom';
}

/**
 * Map InventoryCategory → FinishCategory for attribute lookup.
 * Not all inventory categories have a corresponding finish category.
 */
const INVENTORY_TO_FINISH_CATEGORY: Partial<Record<InventoryCategory, FinishCategory>> = {
  'sheet-goods': 'board',
  'solid-wood': 'veneer',
  'edge-banding': 'laminate',
  'finishing': 'paint',
};

/**
 * Get local seed attributes for a given FinishCategory.
 * Used as a fallback when Firestore attribute definitions haven't been loaded.
 */
function getLocalSeedsForCategory(
  finishCategory?: FinishCategory,
): Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] {
  if (!finishCategory) return [];
  switch (finishCategory) {
    case 'board': return BOARD_ATTRIBUTE_SEEDS;
    case 'paint': return PAINT_ATTRIBUTE_SEEDS;
    case 'tile': return TILE_ATTRIBUTE_SEEDS;
    case 'veneer': return SOLID_WOOD_ATTRIBUTE_SEEDS;
    case 'laminate': return EDGE_BANDING_ATTRIBUTE_SEEDS;
    default: return [];
  }
}

/**
 * Get local seed attributes for an InventoryCategory (hardware, etc.)
 */
function getLocalSeedsForInventoryCategory(
  inventoryCategory?: InventoryCategory,
): Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] {
  if (!inventoryCategory) return [];
  switch (inventoryCategory) {
    case 'hardware':
    case 'fasteners':
      return HARDWARE_ATTRIBUTE_SEEDS;
    case 'solid-wood':
      return SOLID_WOOD_ATTRIBUTE_SEEDS;
    case 'edge-banding':
      return EDGE_BANDING_ATTRIBUTE_SEEDS;
    case 'sheet-goods':
      return BOARD_ATTRIBUTE_SEEDS;
    case 'finishing':
      return PAINT_ATTRIBUTE_SEEDS;
    default:
      return [];
  }
}

/**
 * Format an attribute key into a display label.
 * e.g., 'thickness_mm' → 'Thickness mm', 'moisture_resistance' → 'Moisture resistance'
 */
function keyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/, (c) => c.toUpperCase());
}

/**
 * Build a merged, deduplicated list of variant attribute options.
 *
 * Priority order:
 * 1. Category-specific definitions from Firestore (sorted by sortOrder)
 * 2. Local seed fallbacks for the item's category (if no Firestore defs loaded)
 * 3. COMMON_VARIANT_ATTRIBUTES (deduped against category ones)
 * 4. A special "__custom__" option for free-text attribute entry
 *
 * @param categoryDefs - AttributeDefinitions loaded from Firestore for this category
 * @param finishCategory - The item's finishCategory (if set)
 * @param inventoryCategory - The item's InventoryCategory
 */
export function getVariantAttributeOptions(
  categoryDefs: AttributeDefinition[] | null,
  finishCategory?: FinishCategory,
  inventoryCategory?: InventoryCategory,
): VariantAttributeOption[] {
  const options: VariantAttributeOption[] = [];
  const seenKeys = new Set<string>();

  // 1. Category-specific from Firestore (highest priority)
  if (categoryDefs && categoryDefs.length > 0) {
    const sorted = [...categoryDefs].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const def of sorted) {
      if (!seenKeys.has(def.key)) {
        seenKeys.add(def.key);
        options.push({
          key: def.key,
          label: def.label,
          type: def.type,
          enumValues: def.enumValues,
          unit: def.unit,
          source: 'category',
        });
      }
    }
  } else {
    // 2. Fallback: local seeds for this category
    const resolvedFinishCat = finishCategory || (inventoryCategory ? INVENTORY_TO_FINISH_CATEGORY[inventoryCategory] : undefined);
    const seeds = resolvedFinishCat
      ? getLocalSeedsForCategory(resolvedFinishCat)
      : getLocalSeedsForInventoryCategory(inventoryCategory);

    const sorted = [...seeds].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const seed of sorted) {
      if (!seenKeys.has(seed.key)) {
        seenKeys.add(seed.key);
        options.push({
          key: seed.key,
          label: seed.label,
          type: seed.type,
          enumValues: seed.enumValues,
          unit: seed.unit,
          source: 'category',
        });
      }
    }
  }

  // 3. Common attributes (deduped)
  for (const key of COMMON_VARIANT_ATTRIBUTES) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      options.push({
        key,
        label: keyToLabel(key),
        type: 'string',
        source: 'common',
      });
    }
  }

  // 4. Custom attribute option
  options.push({
    key: '__custom__',
    label: 'Custom attribute...',
    type: 'string',
    source: 'custom',
  });

  return options;
}

export { INVENTORY_TO_FINISH_CATEGORY };
