/**
 * Timber inventory ↔ palette sync.
 *
 * Builds TimberStockDefinition[] for a project's material palette by reading
 * the variants of a timber inventory family. The optimizer already picks the
 * "most ideal" stock size from whatever it's given (waste-ratio scoring); this
 * closes the data-flow gap by ensuring "whatever it's given" reflects what
 * the workshop actually has on hand instead of hand-curated defaults.
 *
 * Inventory model (verified in production):
 *   - Family parent:   isFamily=true,   sku="TIM-MAH",   displayName="Mahogany"
 *   - Variants:        familyId=<parent.id>, dimensions={length,width,thickness} mm,
 *                      pricing.costPerUnit (per-piece UGX), status='active' | …
 *   - Variant SKU encodes the dimensions (e.g. TIM-MAH-12x2x9), but we read
 *     them from `dimensions` rather than parsing the SKU.
 *
 * Output model: one TimberStockDefinition per (thickness, width) cross-section.
 * Each definition collects all available lengths for that cross-section + a
 * costPerPiece array keyed by length. The optimizer then picks the lowest-
 * waste stock per part.
 */

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { TimberStockDefinition } from '@/shared/types';

const INVENTORY_COLLECTION = 'inventoryItems';

export interface TimberInventorySyncResult {
  /** Synced stock definitions, one per cross-section. */
  stocks: TimberStockDefinition[];
  /** Family parent the stocks were derived from. */
  familyId: string;
  /** Variant count actually used (post-filtering). */
  variantCount: number;
  /** Non-fatal observations (e.g. unpriced variants, missing dimensions). */
  warnings: string[];
}

interface VariantRow {
  id: string;
  sku: string;
  thickness: number;  // mm
  width: number;      // mm
  length: number;     // mm
  costPerPiece: number; // UGX (0 means unpriced)
}

/**
 * Resolve valuation cost on the stock UoM from a raw inventory variant row.
 * Prefers functional-currency valuation cost and applies purchase→stock UoM
 * conversion when configured.
 */
function resolveVariantValuationCostPerStockUnit(
  row: Record<string, unknown>,
): number {
  const pricing = row.pricing as {
    costPerUnit?: number;
    functionalCurrencyCost?: number;
    unit?: string;
  } | undefined;
  const purchaseCost = pricing?.costPerUnit ?? 0;
  if (purchaseCost <= 0) return 0;

  const functionalCost = pricing?.functionalCurrencyCost ?? purchaseCost;
  if (functionalCost <= 0) return 0;

  const purchaseUom = (row.purchaseUom as string | undefined) ?? pricing?.unit;
  const stockUom = (row.stockUom as string | undefined) ?? purchaseUom ?? pricing?.unit;

  if (purchaseUom && stockUom && purchaseUom !== stockUom) {
    const conversion = typeof row.uomConversion === 'number' ? row.uomConversion : 0;
    if (conversion <= 0) return 0;
    return functionalCost / conversion;
  }

  return functionalCost;
}

/**
 * Build TimberStockDefinition[] for a timber inventory family by inspecting
 * its active variants. Returns one definition per cross-section.
 */
export async function fetchTimberStockFromInventory(
  familyId: string,
  options?: { materialName?: string },
): Promise<TimberInventorySyncResult> {
  if (!familyId) {
    throw new Error('fetchTimberStockFromInventory: familyId is required');
  }

  const warnings: string[] = [];

  const variantsSnap = await getDocs(
    query(
      collection(db, INVENTORY_COLLECTION),
      where('familyId', '==', familyId),
    ),
  );

  if (variantsSnap.empty) {
    warnings.push(
      `No inventory variants found for family ${familyId}. Add variants under this timber family in inventory before syncing.`,
    );
    return { stocks: [], familyId, variantCount: 0, warnings };
  }

  const rows: VariantRow[] = [];
  let skippedNoDims = 0;
  let skippedDiscontinued = 0;
  let unpricedCount = 0;

  for (const doc of variantsSnap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const status = (d.status as string | undefined) ?? 'active';
    if (status === 'discontinued' || status === 'archived' || status === 'out-of-stock') {
      skippedDiscontinued++;
      continue;
    }
    const dims = d.dimensions as { length?: number; width?: number; thickness?: number } | undefined;
    if (!dims || !dims.length || !dims.width || !dims.thickness) {
      skippedNoDims++;
      continue;
    }
    const costPerPiece = resolveVariantValuationCostPerStockUnit(d);
    if (costPerPiece <= 0) unpricedCount++;
    rows.push({
      id: doc.id,
      sku: (d.sku as string | undefined) ?? doc.id,
      thickness: dims.thickness,
      width: dims.width,
      length: dims.length,
      costPerPiece,
    });
  }

  if (skippedDiscontinued > 0) {
    // Informational — discontinued variants shouldn't drive nesting decisions.
    // No warning emitted; just visible in console for debug.
    console.info(`[timberInventorySync] Skipped ${skippedDiscontinued} discontinued variants for family ${familyId}.`);
  }
  if (skippedNoDims > 0) {
    warnings.push(
      `${skippedNoDims} timber inventory variant(s) skipped — missing dimensions field. Set length / width / thickness on those items.`,
    );
  }
  if (unpricedCount > 0) {
    warnings.push(
      `${unpricedCount} timber variant(s) have no cost set (pricing.costPerUnit = 0). They'll appear in stock options ` +
      `but contribute zero cost in estimation — set per-piece prices on those inventory items.`,
    );
  }

  // Group by cross-section. Round thickness/width to 0.1mm so floating-point
  // imperial conversions (25.4mm, 50.8mm) bucket cleanly.
  const groups = new Map<string, VariantRow[]>();
  const r = (n: number) => Math.round(n * 10) / 10;
  for (const row of rows) {
    const key = `${r(row.thickness)}x${r(row.width)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const materialName = options?.materialName || 'Timber';

  const stocks: TimberStockDefinition[] = [];
  for (const [csKey, variants] of groups) {
    // Lengths sorted ascending; cost-per-piece array aligned with lengths.
    const sorted = [...variants].sort((a, b) => a.length - b.length);
    const availableLengths = sorted.map(v => v.length);
    const costPerPiece = sorted
      .filter(v => v.costPerPiece > 0)
      .map(v => ({ length: v.length, cost: v.costPerPiece }));

    const thickness = sorted[0].thickness;
    const width = sorted[0].width;

    stocks.push({
      id: `${familyId}-${csKey}`,
      materialId: familyId,
      materialName,
      thickness,
      width,
      availableLengths,
      // Use per-piece pricing — that's how timber is sold and stored. The
      // optimizer falls through cubic → linear → per-piece, so per-piece
      // is the most precise and the one we have direct data for.
      costPerPiece: costPerPiece.length > 0 ? costPerPiece : undefined,
      // Sensible defaults — most stocked timber is PAR (planed all round)
      // and rippable. The user can flip these per row in the Stock Config
      // UI if the family is rough-sawn or non-rippable.
      isDressed: true,
      canBeRipped: true,
    });
  }

  // Sort by cross-section size (largest first) for stable, predictable display.
  stocks.sort((a, b) => (b.thickness * b.width) - (a.thickness * a.width));

  return {
    stocks,
    familyId,
    variantCount: rows.length,
    warnings,
  };
}
