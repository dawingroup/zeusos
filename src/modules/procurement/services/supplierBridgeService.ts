/**
 * Supplier Bridge Service
 * Bridges the unified supplier module to the manufacturing module
 * Provides supplier search, lookup, and fuzzy resolution for manufacturing contexts
 *
 * Now uses the unified supplier module from src/modules/suppliers/
 */

import {
  getSupplier,
  getActiveSuppliers as getActiveSuppliersFromModule,
  getSuppliers,
  searchSuppliers as searchSuppliersFromModule,
  getSuppliersByMaterial as getSuppliersByMaterialFromModule,
  getSuppliersByCategory as getSuppliersByCategoryFromModule,
} from '@/modules/suppliers';
import type { Supplier, MaterialRate, SubsidiaryId } from '@/modules/suppliers';

// Re-export types for backwards compatibility
export type { Supplier, MaterialRate, SubsidiaryId };

// Default subsidiary if not specified
const DEFAULT_SUBSIDIARY: SubsidiaryId = 'finishes';

// ============================================
// Supplier Lookup (delegated to unified module)
// ============================================

/**
 * Get a supplier by ID
 */
export async function getSupplierById(
  supplierId: string,
  _subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<Supplier | null> {
  return getSupplier(supplierId);
}

/**
 * Get all active suppliers for a subsidiary
 */
export async function getActiveSuppliers(
  subsidiaryId?: string
): Promise<Supplier[]> {
  return getActiveSuppliersFromModule(subsidiaryId as SubsidiaryId | undefined);
}

/**
 * Get all suppliers (active and inactive) for a subsidiary
 */
export async function getAllSuppliers(
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<Supplier[]> {
  return getSuppliers({ subsidiaryId: subsidiaryId as SubsidiaryId });
}

/**
 * Search suppliers by name, code, or contact person
 */
export async function searchSuppliers(
  searchTerm: string,
  subsidiaryId?: string
): Promise<Supplier[]> {
  return searchSuppliersFromModule(searchTerm, subsidiaryId as SubsidiaryId | undefined);
}

/**
 * Get suppliers that supply a specific material
 */
export async function getSuppliersByMaterial(
  materialId: string,
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<Supplier[]> {
  return getSuppliersByMaterialFromModule(materialId, subsidiaryId as SubsidiaryId);
}

/**
 * Get suppliers by category
 */
export async function getSuppliersByCategory(
  category: string,
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<Supplier[]> {
  return getSuppliersByCategoryFromModule(category, subsidiaryId as SubsidiaryId);
}

// ============================================
// Material Rates
// ============================================

/**
 * Get material rates for a supplier
 * Material rates are stored as a map on the supplier doc: materialRates.{materialId}
 */
export async function getSupplierMaterialRates(
  supplierId: string,
  _subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<MaterialRate[]> {
  const supplier = await getSupplier(supplierId);
  if (!supplier) return [];

  const ratesMap = (supplier as unknown as { materialRates?: Record<string, MaterialRate> })
    .materialRates;
  if (!ratesMap) return [];

  return Object.values(ratesMap);
}

// ============================================
// Fuzzy Supplier Resolution
// (Manufacturing-specific functionality)
// ============================================

/**
 * Attempt to resolve a plain-text supplier name to a supplier record.
 * Used during design-to-manufacturing handover to link special parts to known suppliers.
 *
 * Returns the best match if similarity is above threshold, null otherwise.
 */
export async function resolveSupplierFromText(
  supplierText: string,
  subsidiaryId: string = DEFAULT_SUBSIDIARY
): Promise<{ supplierId: string; supplierName: string } | null> {
  if (!supplierText?.trim()) return null;

  const suppliers = await getActiveSuppliers(subsidiaryId);
  const needle = supplierText.toLowerCase().trim();

  let bestMatch: Supplier | null = null;
  let bestScore = 0;

  for (const supplier of suppliers) {
    const candidates = [
      supplier.name.toLowerCase(),
      supplier.tradeName?.toLowerCase(),
      supplier.code.toLowerCase(),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const score = similarityScore(needle, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = supplier;
      }
    }
  }

  // Require at least 60% similarity for a match
  if (bestMatch && bestScore >= 0.6) {
    return {
      supplierId: bestMatch.id,
      supplierName: bestMatch.name,
    };
  }

  return null;
}

/**
 * Simple similarity score between two strings.
 * Uses normalized longest common subsequence ratio.
 */
function similarityScore(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  // Exact containment
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  // Longest common subsequence ratio
  const lcsLen = lcs(a, b);
  return (2 * lcsLen) / (a.length + b.length);
}

/**
 * Length of longest common subsequence
 */
function lcs(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use rolling array for memory efficiency
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}

// ============================================
// Subsidiary Info
// ============================================

/**
 * Get available subsidiary IDs that have supplier collections
 */
export function getAvailableSubsidiaries(): string[] {
  return ['finishes', 'advisory', 'matflow'];
}

/**
 * Check if a subsidiary has a supplier collection
 */
export function hasSupplierCollection(subsidiaryId: string): boolean {
  return ['finishes', 'advisory', 'matflow'].includes(subsidiaryId);
}
