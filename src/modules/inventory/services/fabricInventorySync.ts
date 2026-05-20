/**
 * Fabric / upholstery inventory ↔ palette sync.
 *
 * Builds FabricRollDefinition[] for a project's material palette by reading
 * upholstery inventory items. Mirrors timberInventorySync but with the
 * roll/bay model: each upholstery item carries a `fabricSpec.rollWidth`
 * (the across-roll dimension) and an optional `defaultBayLength` (the
 * along-roll cut section). The optimizer packs parts into bays of those
 * dimensions and consumes linear meters from the roll.
 *
 * Two entry points:
 *   - fetchFabricRollFromInventory(itemId) — single upholstery item
 *   - fetchFabricRollsFromInventoryFamily(familyId) — all variants of a family
 *
 * Cost: prefers per-linear-meter pricing (`m` / `lft` units). When the item
 * is priced per-roll or per-yard, we convert to UGX/m using the standard
 * UoM conversion fields when set; otherwise we fall back to costPerUnit and
 * surface a warning.
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { FabricRollDefinition } from '@/shared/types';
import type { InventoryItem, InventoryUnit } from '../types';

const INVENTORY_COLLECTION = 'inventoryItems';
const DEFAULT_BAY_LENGTH = 3000; // mm — manageable cut section default

export interface FabricInventorySyncResult {
  /** Synced roll definitions, one per inventory item with a fabricSpec. */
  rolls: FabricRollDefinition[];
  /** Non-fatal observations (missing spec, unpriced items, UoM gaps). */
  warnings: string[];
}

/**
 * Resolve cost per linear meter of roll consumed (UGX/m).
 *
 * Pricing model in the data:
 *   - Linear units (m, lft): functionalCurrencyCost is already UGX/m.
 *   - Yard (yd):              convert to meters (1 yd = 0.9144 m).
 *   - Roll (roll):            divide by uomConversion (= meters per roll).
 *   - Anything else:          best-effort fall through to costPerUnit and
 *                             warn — the caller will surface this.
 */
function resolveCostPerLinearMeter(item: Partial<InventoryItem>): { cost: number; warning?: string } {
  const pricing = item.pricing;
  const purchaseCost = pricing?.costPerUnit ?? 0;
  if (purchaseCost <= 0) {
    return { cost: 0, warning: 'no costPerUnit set' };
  }
  const functionalCost = pricing?.functionalCurrencyCost ?? purchaseCost;
  if (functionalCost <= 0) {
    return { cost: 0, warning: 'no functionalCurrencyCost set' };
  }

  const unit = (pricing?.unit ?? item.stockUom ?? item.purchaseUom) as InventoryUnit | undefined;

  switch (unit) {
    case 'm':
    case 'lft':
      return { cost: functionalCost };
    case 'yd':
      return { cost: functionalCost / 0.9144 };
    case 'roll': {
      const conv = typeof item.uomConversion === 'number' ? item.uomConversion : 0;
      if (conv <= 0) {
        return {
          cost: functionalCost,
          warning: 'priced per-roll but no uomConversion (meters per roll); using cost-per-roll as cost-per-meter',
        };
      }
      return { cost: functionalCost / conv };
    }
    default:
      return {
        cost: functionalCost,
        warning: `unit "${unit ?? 'unknown'}" — assumed per-meter; set unit to 'm' or supply uomConversion to silence this`,
      };
  }
}

function toRollDefinition(item: InventoryItem, warnings: string[]): FabricRollDefinition | null {
  const spec = item.fabricSpec;
  if (!spec || !spec.rollWidth || spec.rollWidth <= 0) return null;

  const { cost, warning } = resolveCostPerLinearMeter(item);
  if (cost <= 0) {
    warnings.push(`${item.displayName ?? item.name ?? item.sku}: ${warning ?? 'no cost'}`);
  } else if (warning) {
    warnings.push(`${item.displayName ?? item.name ?? item.sku}: ${warning}`);
  }

  return {
    id: item.id,
    materialId: item.id,
    materialName: item.displayName || item.name || item.sku,
    rollWidth: spec.rollWidth,
    defaultBayLength: spec.defaultBayLength && spec.defaultBayLength > 0
      ? spec.defaultBayLength
      : DEFAULT_BAY_LENGTH,
    costPerLinearMeter: cost,
    ...(spec.allowRotation ? { allowRotation: true } : {}),
    ...(spec.patternRepeat ? { patternRepeat: spec.patternRepeat } : {}),
  };
}

/**
 * Read a single upholstery inventory item and return its FabricRollDefinition.
 * Returns null when the item has no fabricSpec or doesn't exist.
 */
export async function fetchFabricRollFromInventory(
  itemId: string,
): Promise<{ roll: FabricRollDefinition | null; warnings: string[] }> {
  if (!itemId) throw new Error('fetchFabricRollFromInventory: itemId is required');

  const warnings: string[] = [];
  const snap = await getDoc(doc(db, INVENTORY_COLLECTION, itemId));
  if (!snap.exists()) return { roll: null, warnings };

  const item = { id: snap.id, ...(snap.data() as Omit<InventoryItem, 'id'>) };
  const roll = toRollDefinition(item, warnings);
  return { roll, warnings };
}

/**
 * Read all variants of a fabric family and return a FabricRollDefinition for
 * each variant that has a `fabricSpec`. Variants without a spec are skipped
 * with a warning. Discontinued / archived variants are excluded.
 */
export async function fetchFabricRollsFromInventoryFamily(
  familyId: string,
): Promise<FabricInventorySyncResult> {
  if (!familyId) throw new Error('fetchFabricRollsFromInventoryFamily: familyId is required');

  const warnings: string[] = [];

  const variantsSnap = await getDocs(
    query(collection(db, INVENTORY_COLLECTION), where('familyId', '==', familyId)),
  );

  if (variantsSnap.empty) {
    warnings.push(
      `No inventory variants found for fabric family ${familyId}. Add variants under this family before syncing.`,
    );
    return { rolls: [], warnings };
  }

  const rolls: FabricRollDefinition[] = [];
  let skippedNoSpec = 0;
  let skippedDiscontinued = 0;

  for (const variantDoc of variantsSnap.docs) {
    const data = variantDoc.data() as Omit<InventoryItem, 'id'>;
    const status = data.status ?? 'active';
    if (status === 'discontinued' || status === 'archived' || status === 'out-of-stock') {
      skippedDiscontinued++;
      continue;
    }
    const item = { id: variantDoc.id, ...data } as InventoryItem;
    const roll = toRollDefinition(item, warnings);
    if (!roll) {
      skippedNoSpec++;
      continue;
    }
    rolls.push(roll);
  }

  if (skippedDiscontinued > 0) {
    console.info(
      `[fabricInventorySync] Skipped ${skippedDiscontinued} discontinued variants for family ${familyId}.`,
    );
  }
  if (skippedNoSpec > 0) {
    warnings.push(
      `${skippedNoSpec} fabric variant(s) skipped — missing fabricSpec.rollWidth. Set the roll specification on those inventory items.`,
    );
  }

  // Largest rolls first — wider rolls absorb more part variety, so they make
  // sense as the default option in the palette.
  rolls.sort((a, b) => b.rollWidth - a.rollWidth);

  return { rolls, warnings };
}
