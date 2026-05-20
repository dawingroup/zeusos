/**
 * Packaging utility functions for supplier purchase UOM.
 * Pure functions — no Firebase dependencies.
 */

import type { InventoryUnit } from '../types';

/**
 * Result of a packaging order calculation.
 */
export interface PackagingOrderResult {
  requiredQty: number;
  packagingUnit: InventoryUnit;
  packagingQty: number;
  packagesNeeded: number;
  totalUnitsOrdered: number;
  overage: number;
  totalCost: number;
  unitCost: number;
  pricePerPackage: number;
}

/**
 * Compute the per-unit price from package price and quantity.
 * Returns undefined if packaging data is incomplete.
 */
export function computeUnitPriceFromPackage(
  pricePerPackage?: number,
  packagingQty?: number
): number | undefined {
  if (
    pricePerPackage == null ||
    packagingQty == null ||
    packagingQty <= 0 ||
    pricePerPackage < 0
  ) {
    return undefined;
  }
  return pricePerPackage / packagingQty;
}

/**
 * Calculate how many packages to order for a required quantity.
 * Always rounds UP to whole packages.
 */
export function calculatePackagesNeeded(
  requiredQty: number,
  packagingQty: number,
  pricePerPackage: number,
  packagingUnit: InventoryUnit
): PackagingOrderResult {
  if (packagingQty <= 0) {
    throw new Error('packagingQty must be greater than 0');
  }
  const packagesNeeded = Math.ceil(requiredQty / packagingQty);
  const totalUnitsOrdered = packagesNeeded * packagingQty;
  return {
    requiredQty,
    packagingUnit,
    packagingQty,
    packagesNeeded,
    totalUnitsOrdered,
    overage: totalUnitsOrdered - requiredQty,
    totalCost: packagesNeeded * pricePerPackage,
    unitCost: pricePerPackage / packagingQty,
    pricePerPackage,
  };
}

/**
 * Check whether a supplier pricing or vendor source entry has complete packaging data.
 */
export function hasPackagingDefined(
  entry: { packagingUnit?: InventoryUnit; packagingQty?: number; pricePerPackage?: number }
): boolean {
  return (
    entry.packagingUnit != null &&
    entry.packagingQty != null &&
    entry.packagingQty > 0 &&
    entry.pricePerPackage != null &&
    entry.pricePerPackage > 0
  );
}
