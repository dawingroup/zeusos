/**
 * Variant Key Utilities
 * Deterministic key generation for product+finish+attributes combinations.
 * Used to deduplicate variants — same key means same physical stock item.
 *
 * ⚠️ CRITICAL: Only includes attributes listed in the product's requiredAttributes.
 * Adding a new optional attribute later does NOT create a "new" variant for
 * what is physically the same stock item.
 */

/**
 * Normalize an attribute value to a canonical string representation.
 * Prevents key mismatches from type inconsistency (18 vs "18" vs 18.0).
 */
export function normalizeAttrValue(value: string | number | boolean): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : parseFloat(value.toPrecision(10)).toString();
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return value.trim().toLowerCase();
}

/**
 * Generate a deterministic variant key from product, finish, and attributes.
 *
 * @param productId - The product document ID
 * @param finishId - The finish document ID
 * @param attributes - The selected attribute values
 * @param requiredAttributes - The product's requiredAttributes array (defines which attrs are part of the key)
 *
 * @example
 * generateVariantKey('PROD123', 'FIN456', { thickness_mm: 18, sheet_width_mm: 1220, sheet_length_mm: 2440 }, ['thickness_mm', 'sheet_width_mm', 'sheet_length_mm'])
 * // => "PROD123_FIN456_sheet_length_mm=2440|sheet_width_mm=1220|thickness_mm=18"
 */
export function generateVariantKey(
  productId: string,
  finishId: string,
  attributes: Record<string, string | number | boolean>,
  requiredAttributes: string[]
): string {
  const keyAttrs = requiredAttributes
    .filter(k => attributes[k] !== undefined)
    .sort()
    .map(k => `${k}=${normalizeAttrValue(attributes[k])}`)
    .join('|');
  return `${productId}_${finishId}_${keyAttrs}`;
}

/**
 * Parse a variant key back into its components.
 * Returns null if the key format is invalid.
 */
export function parseVariantKey(key: string): {
  productId: string;
  finishId: string;
  attributes: Record<string, string>;
} | null {
  const parts = key.split('_');
  if (parts.length < 3) return null;

  const productId = parts[0];
  const finishId = parts[1];
  const attrString = parts.slice(2).join('_');

  const attributes: Record<string, string> = {};
  if (attrString) {
    for (const pair of attrString.split('|')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        attributes[pair.substring(0, eqIdx)] = pair.substring(eqIdx + 1);
      }
    }
  }

  return { productId, finishId, attributes };
}

/**
 * Check if two variant keys refer to the same variant.
 */
export function variantKeyEquals(a: string, b: string): boolean {
  return a === b;
}
