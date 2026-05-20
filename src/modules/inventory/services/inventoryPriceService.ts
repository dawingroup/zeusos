/**
 * Inventory Price Service
 * Centralized pricing resolution - THE ONLY WAY to get material prices across the app
 * 
 * Resolution order:
 * 1. Project-specific override
 * 2. Customer-specific override
 * 3. Global inventory item
 */

import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  InventoryItem,
  InventoryUnit,
  ResolvedPrice,
} from '../types';

const INVENTORY_COLLECTION = 'inventoryItems';

/**
 * Resolve valuation-first cost on stock UoM for an inventory item.
 * Prefers functional-currency cost and applies purchase->stock conversion
 * where configured.
 */
function resolveInventoryValuationPrice(
  item: InventoryItem,
): { costPerUnit: number; currency: string; unit: InventoryUnit } | null {
  const pricing = item.pricing;
  if (
    pricing?.pricingBasis === 'per-cbm' &&
    (pricing.costPerCubicMetre || 0) > 0
  ) {
    return {
      costPerUnit: pricing.costPerCubicMetre as number,
      currency: 'UGX',
      unit: 'cbm',
    };
  }

  const purchaseCost = pricing?.costPerUnit ?? 0;
  if (purchaseCost <= 0) return null;

  const functionalCost = pricing?.functionalCurrencyCost ?? purchaseCost;
  if (functionalCost <= 0) return null;

  const purchaseUom = item.purchaseUom || pricing?.unit;
  const stockUom = item.stockUom || purchaseUom || pricing?.unit;
  if (!stockUom) return null;

  let valuationCost = functionalCost;
  if (purchaseUom && purchaseUom !== stockUom) {
    const conversion = item.uomConversion || 0;
    if (conversion <= 0) return null;
    valuationCost = functionalCost / conversion;
  }

  return {
    costPerUnit: valuationCost,
    // Valuation is maintained in functional currency across inventory rollups.
    currency: 'UGX',
    unit: stockUom,
  };
}

/**
 * Price resolution result
 */
export interface PriceResolutionResult {
  found: boolean;
  price?: ResolvedPrice;
  itemId?: string;
  error?: string;
}

export type InventoryCostBasis = 'purchase' | 'valuation';

function resolveInventoryPurchasePrice(
  item: InventoryItem,
): { costPerUnit: number; currency: string; unit: InventoryUnit } | null {
  const pricing = item.pricing;
  const purchaseCost = pricing?.costPerUnit ?? 0;
  if (purchaseCost <= 0) return null;
  if (!pricing?.currency || !pricing?.unit) return null;
  return {
    costPerUnit: purchaseCost,
    currency: pricing.currency,
    unit: pricing.unit,
  };
}

function resolveInventoryPriceByBasis(
  item: InventoryItem,
  costBasis: InventoryCostBasis,
): { costPerUnit: number; currency: string; unit: InventoryUnit } | null {
  return costBasis === 'purchase'
    ? resolveInventoryPurchasePrice(item)
    : resolveInventoryValuationPrice(item);
}

/**
 * Get material price by SKU - primary lookup method
 * This is THE single entry point for all pricing across the app
 */
export async function getMaterialPrice(
  sku: string,
  projectId?: string,
  customerId?: string,
  thickness?: number,
  costBasis: InventoryCostBasis = 'purchase',
): Promise<PriceResolutionResult> {
  try {
    // 1. Check project-level override
    if (projectId) {
      const projectPrice = await getProjectPriceOverride(projectId, sku);
      if (projectPrice) {
        return { found: true, price: projectPrice };
      }
    }

    // 2. Check customer-level override
    if (customerId) {
      const customerPrice = await getCustomerPriceOverride(customerId, sku);
      if (customerPrice) {
        return { found: true, price: customerPrice };
      }
    }

    // 3. Get from global inventory
    const globalItem = await getGlobalInventoryItem(sku);
    const globalPrice = globalItem ? resolveInventoryPriceByBasis(globalItem, costBasis) : null;
    if (globalItem && globalPrice) {
      return {
        found: true,
        itemId: globalItem.id,
        price: {
          costPerUnit: globalPrice.costPerUnit,
          currency: globalPrice.currency,
          unit: globalPrice.unit,
          source: 'catalogue',
          itemId: globalItem.id,
          itemName: globalItem.displayName || globalItem.name,
        },
      };
    }

    // Family items often carry 0 on the parent and actual prices on child SKUs.
    // Resolve to the best priced active child so linked family materials can still
    // flow into estimation and pricing services.
    if (globalItem?.isFamily) {
      const derived = await deriveFamilyPrice(globalItem.id, thickness, costBasis);
      if (derived) {
        return {
          found: true,
          itemId: derived.itemId,
          price: {
            costPerUnit: derived.costPerUnit,
            currency: derived.currency,
            unit: derived.unit,
            source: 'catalogue',
            itemId: derived.itemId,
            itemName: derived.itemName,
          },
        };
      }
    }

    // 4. No price found
    return {
      found: false,
      error: `No price found for material: ${sku}`,
    };
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : 'Unknown error resolving price',
    };
  }
}

/**
 * Get material price by name (fuzzy match)
 * Tries exact match first, then searches aliases
 */
export async function getMaterialPriceByName(
  materialName: string,
  thickness?: number,
  projectId?: string,
  customerId?: string,
  costBasis: InventoryCostBasis = 'purchase',
): Promise<PriceResolutionResult> {
  try {
    const normalizedName = materialName.toLowerCase().trim();

    // Search for matching item
    const inventoryRef = collection(db, INVENTORY_COLLECTION);
    const snapshot = await getDocs(inventoryRef);

    let bestMatch: InventoryItem | null = null;
    let matchScore = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const item: InventoryItem = {
        id: docSnap.id,
        ...data,
      } as InventoryItem;

      // Skip inactive items
      if (item.status !== 'active') continue;

      // Calculate match score
      let score = 0;

      // Exact SKU match
      if (item.sku.toLowerCase() === normalizedName) {
        score = 100;
      }
      // Exact name match
      else if (item.name.toLowerCase() === normalizedName) {
        score = 90;
      }
      // Display name match
      else if (item.displayName?.toLowerCase() === normalizedName) {
        score = 85;
      }
      // Alias match
      else if (item.aliases?.some((a) => a.toLowerCase() === normalizedName)) {
        score = 80;
      }
      // Partial name match
      else if (item.name.toLowerCase().includes(normalizedName) ||
               normalizedName.includes(item.name.toLowerCase())) {
        score = 50;
      }

      // Boost score if thickness matches
      if (thickness && item.dimensions?.thickness === thickness) {
        score += 10;
      }

      if (score > matchScore) {
        matchScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && matchScore >= 50) {
      // Now resolve price with tier overrides
      return getMaterialPrice(bestMatch.sku, projectId, customerId, thickness, costBasis);
    }

    return {
      found: false,
      error: `No matching material found for: ${materialName}`,
    };
  } catch (error) {
    return {
      found: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get prices for multiple SKUs (batch)
 */
export async function getMaterialPrices(
  skus: string[],
  projectId?: string,
  customerId?: string,
  costBasis: InventoryCostBasis = 'purchase',
): Promise<Map<string, PriceResolutionResult>> {
  const results = new Map<string, PriceResolutionResult>();

  // Process in parallel
  await Promise.all(
    skus.map(async (sku) => {
      const result = await getMaterialPrice(sku, projectId, customerId, undefined, costBasis);
      results.set(sku, result);
    })
  );

  return results;
}

/**
 * Get all prices for a project (for estimation)
 * Returns a map of SKU -> ResolvedPrice
 */
export async function getAllPricesForProject(
  projectId: string,
  customerId?: string,
  costBasis: InventoryCostBasis = 'purchase',
): Promise<Map<string, ResolvedPrice>> {
  const priceMap = new Map<string, ResolvedPrice>();

  // Get all global inventory items
  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  const q = query(
    inventoryRef,
    where('tier', '==', 'catalogue'),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(q);
  const allItems = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as InventoryItem));

  for (const item of allItems) {
    const data = item as any;
    const resolved = resolveInventoryPriceByBasis(item, costBasis);
    if (resolved) {
      priceMap.set(data.sku, {
        costPerUnit: resolved.costPerUnit,
        currency: resolved.currency,
        unit: resolved.unit,
        source: 'catalogue',
        itemId: item.id,
        itemName: data.displayName || data.name,
      });
      continue;
    }

    // Family fallback: derive a representative price from active child SKUs.
    if (data.isFamily) {
      const childCandidates = allItems
        .filter((candidate) => candidate.familyId === item.id)
        .map((candidate) => ({
          candidate,
          resolved: resolveInventoryPriceByBasis(candidate, costBasis),
        }))
        .filter((row): row is { candidate: InventoryItem; resolved: { costPerUnit: number; currency: string; unit: InventoryUnit } } => !!row.resolved);

      if (childCandidates.length > 0) {
        const cheapest = childCandidates.reduce((min, candidate) =>
          (candidate.resolved.costPerUnit < min.resolved.costPerUnit ? candidate : min),
        childCandidates[0]);

        priceMap.set(data.sku, {
          costPerUnit: cheapest.resolved.costPerUnit,
          currency: cheapest.resolved.currency,
          unit: cheapest.resolved.unit,
          source: 'catalogue',
          itemId: cheapest.candidate.id,
          itemName: cheapest.candidate.displayName || cheapest.candidate.name,
        });
      }
    }
  }

  // Override with customer prices
  if (customerId) {
    const customerPrices = await getCustomerPriceOverrides(customerId);
    for (const [sku, price] of customerPrices) {
      priceMap.set(sku, price);
    }
  }

  // Override with project prices
  const projectPrices = await getProjectPriceOverrides(projectId);
  for (const [sku, price] of projectPrices) {
    priceMap.set(sku, price);
  }

  return priceMap;
}

// ---------------------------------------------------------------------------
// Explicit cost-basis wrappers
// ---------------------------------------------------------------------------

/** Purchase-cost lookup (supplier transaction cost). */
export async function getMaterialPurchasePrice(
  sku: string,
  projectId?: string,
  customerId?: string,
  thickness?: number,
): Promise<PriceResolutionResult> {
  return getMaterialPrice(sku, projectId, customerId, thickness, 'purchase');
}

/** Valuation-cost lookup (functional currency + stock-UoM basis). */
export async function getMaterialValuationPrice(
  sku: string,
  projectId?: string,
  customerId?: string,
  thickness?: number,
): Promise<PriceResolutionResult> {
  return getMaterialPrice(sku, projectId, customerId, thickness, 'valuation');
}

/** Purchase-cost lookup by material name. */
export async function getMaterialPurchasePriceByName(
  materialName: string,
  thickness?: number,
  projectId?: string,
  customerId?: string,
): Promise<PriceResolutionResult> {
  return getMaterialPriceByName(materialName, thickness, projectId, customerId, 'purchase');
}

/** Valuation-cost lookup by material name. */
export async function getMaterialValuationPriceByName(
  materialName: string,
  thickness?: number,
  projectId?: string,
  customerId?: string,
): Promise<PriceResolutionResult> {
  return getMaterialPriceByName(materialName, thickness, projectId, customerId, 'valuation');
}

/** Batch purchase-cost lookup by SKU. */
export async function getMaterialPurchasePrices(
  skus: string[],
  projectId?: string,
  customerId?: string,
): Promise<Map<string, PriceResolutionResult>> {
  return getMaterialPrices(skus, projectId, customerId, 'purchase');
}

/** Batch valuation-cost lookup by SKU. */
export async function getMaterialValuationPrices(
  skus: string[],
  projectId?: string,
  customerId?: string,
): Promise<Map<string, PriceResolutionResult>> {
  return getMaterialPrices(skus, projectId, customerId, 'valuation');
}

/** Project price map on purchase-cost basis. */
export async function getAllPurchasePricesForProject(
  projectId: string,
  customerId?: string,
): Promise<Map<string, ResolvedPrice>> {
  return getAllPricesForProject(projectId, customerId, 'purchase');
}

/** Project price map on valuation-cost basis. */
export async function getAllValuationPricesForProject(
  projectId: string,
  customerId?: string,
): Promise<Map<string, ResolvedPrice>> {
  return getAllPricesForProject(projectId, customerId, 'valuation');
}

// === Helper functions ===

async function getGlobalInventoryItem(sku: string): Promise<InventoryItem | null> {
  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  const q = query(inventoryRef, where('sku', '==', sku), where('tier', '==', 'catalogue'));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as InventoryItem;
  }

  // Try matching by name or alias
  const allDocs = await getDocs(inventoryRef);
  const normalizedSku = sku.toLowerCase().trim();

  for (const docSnap of allDocs.docs) {
    const data = docSnap.data();
    if (data.tier !== 'catalogue') continue;

    if (
      data.name?.toLowerCase() === normalizedSku ||
      data.displayName?.toLowerCase() === normalizedSku ||
      data.aliases?.some((a: string) => a.toLowerCase() === normalizedSku)
    ) {
      return { id: docSnap.id, ...data } as InventoryItem;
    }
  }

  return null;
}

async function deriveFamilyPrice(
  familyId: string,
  thickness?: number,
  costBasis: InventoryCostBasis = 'purchase',
): Promise<{ itemId: string; itemName: string; costPerUnit: number; currency: string; unit: InventoryUnit } | null> {
  const inventoryRef = collection(db, INVENTORY_COLLECTION);
  const q = query(
    inventoryRef,
    where('familyId', '==', familyId),
    where('status', '==', 'active'),
  );
  const snapshot = await getDocs(q);

  const children = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as InventoryItem))
    .map((item) => ({
      item,
      resolved: resolveInventoryPriceByBasis(item, costBasis),
    }))
    .filter((row): row is { item: InventoryItem; resolved: { costPerUnit: number; currency: string; unit: InventoryUnit } } => !!row.resolved);

  if (children.length === 0) return null;

  // Prefer thickness-matched children when requested by estimation pipelines.
  const withMatchingThickness = typeof thickness === 'number'
    ? children.filter((child) => child.item.dimensions?.thickness === thickness)
    : [];
  const candidates = withMatchingThickness.length > 0 ? withMatchingThickness : children;

  const cheapest = candidates.reduce((min, child) =>
    (child.resolved.costPerUnit < min.resolved.costPerUnit ? child : min),
  candidates[0]);

  return {
    itemId: cheapest.item.id,
    itemName: cheapest.item.displayName || cheapest.item.name,
    costPerUnit: cheapest.resolved.costPerUnit,
    currency: cheapest.resolved.currency,
    unit: cheapest.resolved.unit,
  };
}

async function getProjectPriceOverride(
  projectId: string,
  sku: string
): Promise<ResolvedPrice | null> {
  // Project-level price overrides stored in designProjects/{projectId}/priceOverrides
  const overridesRef = collection(db, 'designProjects', projectId, 'priceOverrides');
  const q = query(overridesRef, where('sku', '==', sku));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    return {
      costPerUnit: data.costPerUnit,
      currency: data.currency,
      unit: data.unit || 'sheet',
      source: 'project',
      itemId: snapshot.docs[0].id,
      itemName: data.itemName || sku,
    };
  }

  return null;
}

async function getCustomerPriceOverride(
  customerId: string,
  sku: string
): Promise<ResolvedPrice | null> {
  // Customer-level price overrides stored in customers/{customerId}/priceOverrides
  const overridesRef = collection(db, 'customers', customerId, 'priceOverrides');
  const q = query(overridesRef, where('sku', '==', sku));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const data = snapshot.docs[0].data();
    return {
      costPerUnit: data.costPerUnit,
      currency: data.currency,
      unit: data.unit || 'sheet',
      source: 'customer',
      itemId: snapshot.docs[0].id,
      itemName: data.itemName || sku,
    };
  }

  return null;
}

async function getProjectPriceOverrides(
  projectId: string
): Promise<Map<string, ResolvedPrice>> {
  const priceMap = new Map<string, ResolvedPrice>();
  const overridesRef = collection(db, 'designProjects', projectId, 'priceOverrides');
  const snapshot = await getDocs(overridesRef);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.sku && data.costPerUnit > 0) {
      priceMap.set(data.sku, {
        costPerUnit: data.costPerUnit,
        currency: data.currency,
        unit: data.unit || 'sheet',
        source: 'project',
        itemId: docSnap.id,
        itemName: data.itemName || data.sku,
      });
    }
  }

  return priceMap;
}

async function getCustomerPriceOverrides(
  customerId: string
): Promise<Map<string, ResolvedPrice>> {
  const priceMap = new Map<string, ResolvedPrice>();
  const overridesRef = collection(db, 'customers', customerId, 'priceOverrides');
  const snapshot = await getDocs(overridesRef);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.sku && data.costPerUnit > 0) {
      priceMap.set(data.sku, {
        costPerUnit: data.costPerUnit,
        currency: data.currency,
        unit: data.unit || 'sheet',
        source: 'customer',
        itemId: docSnap.id,
        itemName: data.itemName || data.sku,
      });
    }
  }

  return priceMap;
}

/**
 * Validate that all materials in a list have prices
 * Returns list of missing materials
 */
export async function validateMaterialPrices(
  materials: Array<{ sku?: string; name: string; thickness?: number }>,
  projectId?: string,
  customerId?: string
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  for (const material of materials) {
    let result: PriceResolutionResult;

    if (material.sku) {
      result = await getMaterialPrice(material.sku, projectId, customerId);
    } else {
      result = await getMaterialPriceByName(
        material.name,
        material.thickness,
        projectId,
        customerId
      );
    }

    if (!result.found) {
      missing.push(material.sku || material.name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
