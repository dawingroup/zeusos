/**
 * Structured Name Display Utility
 *
 * Builds human-readable display names from StructuredName fields,
 * emphasizing function over brand. Brands belong on VendorSource records.
 */

import type { StructuredName, InventoryCategory } from '../types/inventory';

/**
 * Build a functional display name from structured name fields.
 * Omits brand and quality tier — those are per-vendor-source.
 *
 * Examples:
 *   "Full Overlay — 110° Soft-Close"
 *   "Inset — 110° Soft-Close"
 *   "Edge Band — 0.5mm PVC White"
 */
export function buildFunctionalDisplayName(
  structuredName?: StructuredName | null,
  _category?: InventoryCategory | string,
  _subcategory?: string,
): string | null {
  if (!structuredName) return null;

  const { function: fn, keySpecs } = structuredName;

  if (!fn && !keySpecs) return null;

  const parts: string[] = [];
  if (fn) parts.push(fn);
  if (keySpecs) parts.push(keySpecs);

  return parts.join(' — ');
}

/**
 * Get the best display name for an inventory item, preferring
 * functional name over raw name.
 */
export function getItemDisplayName(item: {
  displayName?: string;
  name: string;
  structuredName?: StructuredName | null;
  category?: InventoryCategory | string;
  subcategory?: string;
}): string {
  // Explicit displayName override takes priority
  if (item.displayName) return item.displayName;

  // Try to build from structured name
  const functional = buildFunctionalDisplayName(
    item.structuredName,
    item.category,
    item.subcategory,
  );
  if (functional) return functional;

  // Fall back to raw name
  return item.name;
}
