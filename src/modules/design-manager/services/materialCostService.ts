/**
 * materialCostService — P12-2 (F11).
 *
 * Single reader entry point for "what does this material cost?" that
 * hydrates the linked InventoryItem and delegates to the pure
 * `resolveMaterialUnitCost` resolver from P12-1. Before P12-2, callers
 * reached into `material.pricing.unitCost` OR `inventory.pricing.costPerUnit`
 * depending on which module they lived in — the audit flagged this as
 * the F11 drift surface.
 *
 * This slice is deliberately narrow: single-material resolve + drift
 * detection. Batched variants land in P12-4 when list views actually
 * migrate, so we don't build API surface ahead of consumers.
 *
 * The service wraps `getInventoryItem` from the inventory module so
 * tests can mock it. The real inventory fetch is hit exactly once per
 * `resolveMaterialCost` call, and ONLY when the material carries an
 * `inventoryItemId` — materials without a link skip the roundtrip.
 */
import { getInventoryItem } from '@/modules/inventory/services/inventoryService';
import type { Material } from '../types/materials';
import {
  resolveMaterialUnitCost,
  type InventoryCostLike,
  type ResolvedMaterialCost,
} from '../types/materialCost';

// ---------------------------------------------------------------------------
// Hydrator
// ---------------------------------------------------------------------------

/**
 * Resolve a material's canonical unit cost, hitting the inventory
 * collection when the material is linked.
 *
 * Returns:
 *   - `ResolvedMaterialCost` with `source: 'inventory'` when the link
 *     exists and the inventory item is found (happy path for P12).
 *   - `ResolvedMaterialCost` with `source: 'override'` when the
 *     material pins an explicit override (inventory lookup is still
 *     performed so drift detection has the value, but the returned
 *     cost is the override).
 *   - `ResolvedMaterialCost` with `source: 'material'` when there's
 *     no inventory link OR the linked item has no usable pricing.
 *   - `null` when nothing resolves — caller should render "unknown",
 *     NOT zero. The pure resolver has the same contract.
 *
 * Single-fetch design: we DO NOT batch across multiple materials here.
 * List-view consumers (material table, BOQ aggregator) will get a
 * `batchResolveMaterialCosts` helper in P12-4 that pipes through
 * `batchResolveInventory` from the inventory module.
 */
export async function resolveMaterialCost(
  material: Material,
): Promise<ResolvedMaterialCost | null> {
  const inventoryCost = await fetchInventoryCostForMaterial(material);
  return resolveMaterialUnitCost(material, inventoryCost);
}

/**
 * Drift detection result. `hasDrift: true` means the Material's pinned
 * unit cost diverges from the linked InventoryItem's cost AND the
 * material has NOT been flagged as an explicit override — i.e. the
 * drift is accidental and should surface a badge.
 *
 * Populated even when `hasDrift: false` so UI code can render the
 * reconciliation tooltip ("Material: 50 UGX, Inventory: 50 UGX —
 * matched").
 */
export interface MaterialCostDrift {
  hasDrift: boolean;
  materialUnitCost: number;
  materialCurrency: string;
  inventoryUnitCost: number;
  inventoryCurrency: string;
  /** Absolute difference in the shared currency. `null` on currency mismatch. */
  delta: number | null;
  /**
   * True when the two sides disagree on currency — the UI should
   * surface this distinctly since "drift" implies the same unit,
   * and a currency mismatch is a data-entry bug not a price move.
   */
  currencyMismatch: boolean;
}

/**
 * Compute drift between a material's pinned pricing and its linked
 * inventory's cost. Returns null when drift is meaningless:
 *   - Material isn't linked to inventory
 *   - Material.pricing is incomplete
 *   - Caller didn't supply an inventoryCost
 *   - Material IS flagged as an override (drift is intentional)
 *
 * Pure — no fetch. Callers that want the "fetch + detect" combo can
 * call `resolveMaterialCost` and then compare, but pulling drift into
 * its own helper lets list views that already have the inventory map
 * hydrated in bulk reuse it without another roundtrip.
 */
export function detectMaterialCostDrift(
  material: Material,
  inventoryCost: InventoryCostLike | null | undefined,
): MaterialCostDrift | null {
  if (!material.inventoryItemId || !inventoryCost) return null;
  if (material.pricing?.isOverride) return null;
  if (
    typeof material.pricing?.unitCost !== 'number' ||
    typeof material.pricing?.currency !== 'string' ||
    material.pricing.currency.length === 0
  ) {
    return null;
  }
  if (
    typeof inventoryCost.costPerUnit !== 'number' ||
    typeof inventoryCost.currency !== 'string' ||
    inventoryCost.currency.length === 0
  ) {
    return null;
  }

  const materialUnitCost = material.pricing.unitCost;
  const materialCurrency = material.pricing.currency;
  const inventoryUnitCost = inventoryCost.costPerUnit;
  const inventoryCurrency = inventoryCost.currency;

  const currencyMismatch = materialCurrency !== inventoryCurrency;
  const delta = currencyMismatch
    ? null
    : Math.abs(materialUnitCost - inventoryUnitCost);

  // Drift threshold: any positive delta is drift. FX noise isn't our
  // problem — the inventory layer owns functional-currency conversion
  // and the delta here is in the SAME currency (guarded above).
  const hasDrift = currencyMismatch || (delta !== null && delta > 0);

  return {
    hasDrift,
    materialUnitCost,
    materialCurrency,
    inventoryUnitCost,
    inventoryCurrency,
    delta,
    currencyMismatch,
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Pull the pricing shape the resolver expects from a full InventoryItem.
 * Returns null when the material has no inventory link OR the inventory
 * item is missing OR its pricing is incomplete. Failing closed here
 * means the resolver's precedence rules get a clean undefined and the
 * "material-source fallback" kicks in as intended.
 */
async function fetchInventoryCostForMaterial(
  material: Material,
): Promise<InventoryCostLike | null> {
  if (!material.inventoryItemId) return null;
  const inventory = await getInventoryItem(material.inventoryItemId);
  if (!inventory) return null;
  const pricing = inventory.pricing;
  if (!pricing || typeof pricing.costPerUnit !== 'number' || pricing.costPerUnit <= 0) {
    return null;
  }
  const functionalCost = pricing.functionalCurrencyCost ?? pricing.costPerUnit;
  if (typeof functionalCost !== 'number' || functionalCost <= 0) return null;

  const purchaseUom = inventory.purchaseUom || pricing.unit;
  const stockUom = inventory.stockUom || purchaseUom || pricing.unit;
  if (!stockUom) return null;

  let costPerUnit = functionalCost;
  if (purchaseUom && purchaseUom !== stockUom) {
    const conversion = inventory.uomConversion || 0;
    if (conversion <= 0) return null;
    costPerUnit = functionalCost / conversion;
  }

  return {
    costPerUnit,
    // Keep resolver aligned with valuation/rollup currency.
    currency: 'UGX',
  };
}
