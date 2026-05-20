/**
 * DesignItem Cost Aggregator — P10
 *
 * Rolls every `SceneCabinet.computedBOM` + `estimatedPrice` under a given
 * DesignItem (potentially spanning multiple scenes) into a single
 * `ManufacturingRollupFromCabinets` written onto
 * `designProjects/{projectId}/designItems/{itemId}.manufacturingRollup`.
 *
 * Design notes:
 *
 *   • **Sibling of `manufacturing`, not replacement.** The existing
 *     `DesignItem.manufacturing` field can carry human-curated standard /
 *     special-part entries that the cabinet BOM has no way to reproduce.
 *     Writing to a separate field keeps both views alive.
 *
 *   • **Locked cabinets ARE included, from a frozen snapshot (P21.8).**
 *     Locking a cabinet means "this scope is committed to production"
 *     — it still contributes to the item's cost. The `lockCabinetForProduction`
 *     write now captures a `lockedSnapshot` of `computedBOM` +
 *     `estimatedPrice` at lock moment, and this aggregator reads the
 *     snapshot instead of the live fields when `isLocked=true`. That
 *     makes the handover authority explicit: the locked contribution is
 *     stable even if the live cabinet fields drift afterwards. Locking
 *     also triggers a rollup so `lockedCabinetCount` updates immediately.
 *
 *   • **Best-effort, fire-and-forget from scene writes.** The scene
 *     service wraps the trigger in a try/catch so a rollup failure
 *     never blocks the user's add/remove/reassign. We log and move on.
 *     This mirrors how `updateDesignItem` already treats its
 *     MO-sync hook.
 *
 *   • **Classification is substring-based.** `ComputedBOMLine.materialCategory`
 *     is a free-form lowercase string; the conventions used elsewhere in
 *     design-studio (`estimationBridge`, `constraintEngine`) match on
 *     substrings like 'sheet', 'timber', 'edge_banding', 'hardware'. We
 *     use the same pattern here so classification is consistent across
 *     pricing paths. Unknown categories go to `otherMaterialsCost`.
 *
 *   • **Mixed currencies surface rather than collapse.** If some cabinets
 *     price in UGX and others in USD, we pick the majority as the
 *     reported currency, still sum the raw numbers, and set
 *     `hasMixedCurrencies: true`. The UI is responsible for warning; the
 *     aggregate is labelled as suspect rather than silently wrong.
 */
import { Timestamp } from 'firebase/firestore';
import {
  getDesignItem,
  updateDesignItem,
} from '@/modules/design-manager/services';
import type {
  ManufacturingRollupFromCabinets,
} from '@/modules/design-manager/types';
import type { SceneCabinet } from '../types/scene.types';
import type { ComputedBOMLine, PricingBreakdown } from '../types/constraintEngine.types';
import { getCabinetsForDesignItem } from './scene.service';
import { getCabinetRequiredQuantity } from '../utils/cabinetQuantity';

const AGGREGATOR_USER_ID = 'system:design-studio-cost-aggregator';

type MaterialBucket =
  | 'sheet'
  | 'timber'
  | 'linear'
  | 'edging'
  | 'hardware'
  | 'other';

/**
 * Classify a BOM line's `materialCategory` into one of the six rollup
 * buckets. Kept in sync with the substring conventions in
 * `services/estimationBridge.service.ts` and
 * `services/constraintEngine.service.ts`. Exported for tests.
 */
export function classifyBOMCategory(category: string | undefined): MaterialBucket {
  const cat = (category ?? '').toLowerCase();
  if (!cat) return 'other';
  // Order matters: edge-banding contains 'edge' but must not fall through
  // to the plain 'edge' branch if any future rule adds one.
  if (cat.includes('edge_banding') || cat.includes('edgebanding') || cat.includes('edge-banding')) {
    return 'edging';
  }
  if (
    cat.includes('hardware') ||
    cat.includes('hinge') ||
    cat.includes('handle') ||
    cat.includes('slide') ||
    cat.includes('connector') ||
    cat.includes('knob') ||
    cat.includes('leg') ||
    cat.includes('screw') ||
    cat.includes('cam') ||
    cat.includes('dowel')
  ) {
    return 'hardware';
  }
  if (cat.includes('sheet') || cat.includes('board') || cat.includes('panel') || cat.includes('mdf') || cat.includes('plywood')) {
    return 'sheet';
  }
  if (cat.includes('timber') || cat.includes('wood') || cat.includes('solid')) {
    return 'timber';
  }
  if (cat.includes('linear') || cat.includes('metal') || cat.includes('aluminium') || cat.includes('aluminum') || cat.includes('tube') || cat.includes('bar')) {
    return 'linear';
  }
  return 'other';
}

/**
 * Pure reducer: turn a cabinet set into the scalar + per-cabinet rollup
 * body. Does not touch Firestore. Exported for tests.
 *
 * Returns `null` if the cabinet set is empty — the caller decides whether
 * to clear the DesignItem's rollup field or leave it alone.
 */
export function aggregateRollup(
  cabinets: SceneCabinet[],
): Omit<ManufacturingRollupFromCabinets, 'lastRolledUpAt'> | null {
  if (cabinets.length === 0) return null;

  // Per-cabinet records first — independent of bucket classification so we
  // preserve drill-down granularity even if category strings drift.
  const perCabinet: ManufacturingRollupFromCabinets['cabinets'] = [];
  const sceneIds = new Set<string>();
  const currencyCounts = new Map<'UGX' | 'USD', number>();
  let lockedCabinetCount = 0;

  // Bucketed material totals from ComputedBOMLine.
  const bucketTotals: Record<MaterialBucket, number> = {
    sheet: 0,
    timber: 0,
    linear: 0,
    edging: 0,
    hardware: 0,
    other: 0,
  };

  // Pricing scalars from estimatedPrice.
  let laborCost = 0;
  let overheadCost = 0;
  let subtotal = 0;
  let vatAmount = 0;
  let totalCost = 0;

  // Physical-unit count — sum of requiredQuantity across every cabinet,
  // NOT the count of SceneCabinet entries. Drives both the rollup total
  // and the per-unit denominator downstream.
  let unitCount = 0;

  for (const cabinet of cabinets) {
    sceneIds.add(cabinet.sceneId);
    if (cabinet.isLocked) lockedCabinetCount += 1;

    // requiredQuantity > 1 means one SceneCabinet represents N physical
    // units — every costed figure below must multiply by this.
    const multiplier = getCabinetRequiredQuantity(cabinet);
    unitCount += multiplier;

    // P21.8 — locked cabinets read from the frozen snapshot taken at lock
    // time, not the live fields. This makes the handover authority
    // explicit: a cabinet's contribution to the rollup cannot drift once
    // it's been committed to production. Unlocked cabinets (and legacy
    // locked ones missing a snapshot) still read live.
    const snapshot = cabinet.isLocked ? cabinet.lockedSnapshot : undefined;
    const price: PricingBreakdown | undefined = snapshot?.estimatedPrice ?? cabinet.estimatedPrice;
    const bom: ComputedBOMLine[] = snapshot?.computedBOM ?? cabinet.computedBOM ?? [];

    // BOM classification — line.totalCost is the per-unit cost so
    // multiply to get the cabinet's contribution.
    for (const line of bom) {
      const bucket = classifyBOMCategory(line.materialCategory);
      bucketTotals[bucket] += (line.totalCost || 0) * multiplier;
    }

    // Pricing rollup — same rationale.
    if (price) {
      laborCost += (price.laborCost || 0) * multiplier;
      overheadCost += (price.overheadCost || 0) * multiplier;
      subtotal += (price.subtotal || 0) * multiplier;
      vatAmount += (price.vatAmount || 0) * multiplier;
      totalCost += (price.total || 0) * multiplier;
      const c = price.currency;
      if (c === 'UGX' || c === 'USD') {
        currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1);
      }
    }

    // Per-cabinet row — show the MULTIPLIED totals so the cost panel
    // presents the cabinet's real contribution. `requiredQuantity`
    // surfaces alongside so the UI can render "× N" if > 1.
    perCabinet.push({
      cabinetId: cabinet.id,
      sceneId: cabinet.sceneId,
      cabinetCode: cabinet.cabinetCode,
      displayName: cabinet.displayName,
      isLocked: !!cabinet.isLocked,
      requiredQuantity: multiplier,
      materialsCost: (price?.materialsCost ?? 0) * multiplier,
      hardwareCost: (price?.hardwareCost ?? 0) * multiplier,
      laborCost: (price?.laborCost ?? 0) * multiplier,
      totalCost: (price?.total ?? 0) * multiplier,
      currency: (price?.currency === 'USD' ? 'USD' : 'UGX'),
    });
  }

  // Majority-currency with deterministic tiebreak: UGX wins ties since it
  // is the codebase default (see DesignScene.currency default).
  let currency: 'UGX' | 'USD' = 'UGX';
  let bestCount = -1;
  for (const [c, count] of currencyCounts) {
    if (count > bestCount) {
      bestCount = count;
      currency = c;
    }
  }
  const hasMixedCurrencies = currencyCounts.size > 1;

  const materialsCost =
    bucketTotals.sheet +
    bucketTotals.timber +
    bucketTotals.linear +
    bucketTotals.edging +
    bucketTotals.hardware +
    bucketTotals.other;

  // `cabinetCount` historically = number of SceneCabinet entries, but
  // with requiredQuantity > 1 that's no longer the physical count.
  // Report BOTH so downstream readers can pick the one they need:
  //   - cabinetCount = distinct SceneCabinet entries (roster size)
  //   - unitCount    = sum of requiredQuantity (physical units produced)
  // `costPerUnit` divides by physical units — what a procurement user
  // actually means when they ask "per cabinet".
  const cabinetCount = cabinets.length;

  return {
    cabinets: perCabinet,
    cabinetCount,
    unitCount,
    lockedCabinetCount,
    rolledUpFromScenes: Array.from(sceneIds).sort(),

    sheetMaterialsCost: bucketTotals.sheet,
    timberMaterialsCost: bucketTotals.timber,
    linearMaterialsCost: bucketTotals.linear,
    edgingMaterialsCost: bucketTotals.edging,
    hardwareCost: bucketTotals.hardware,
    otherMaterialsCost: bucketTotals.other,
    materialsCost,

    laborCost,
    overheadCost,
    subtotal,
    vatAmount,
    totalCost,
    costPerUnit: unitCount > 0 ? totalCost / unitCount : 0,

    currency,
    hasMixedCurrencies,
  };
}

/**
 * Recompute the rollup for a DesignItem and persist it.
 *
 *   - Looks up every cabinet that points at `designItemId` (across scenes)
 *     via the `cabinets` collection-group query.
 *   - Skips gracefully if the DesignItem doesn't exist (item deleted while
 *     a rollup was in flight) — logs and returns.
 *   - Writes the rollup under `manufacturingRollup`. If there are zero
 *     cabinets (e.g. the last cabinet was removed or reassigned away),
 *     CLEARS the rollup field explicitly so stale totals don't linger.
 *
 * Returns the rollup that was written, or `null` if no cabinets remained.
 */
export async function recomputeDesignItemRollup(
  projectId: string,
  designItemId: string,
): Promise<ManufacturingRollupFromCabinets | null> {
  if (!projectId || !designItemId) return null;

  // Confirm the target DesignItem still exists — avoid writing to a ghost.
  const item = await getDesignItem(projectId, designItemId);
  if (!item) {
    console.warn(
      `[designItemCostAggregator] DesignItem ${projectId}/${designItemId} not found; skipping rollup.`,
    );
    return null;
  }

  const cabinets = await getCabinetsForDesignItem(designItemId);
  const body = aggregateRollup(cabinets);

  if (!body) {
    // Zero cabinets — clear any stale rollup so the UI doesn't show totals
    // that no longer reflect reality.
    await updateDesignItem(
      projectId,
      designItemId,
      { manufacturingRollup: undefined } as Parameters<typeof updateDesignItem>[2],
      AGGREGATOR_USER_ID,
    );
    return null;
  }

  const rollup: ManufacturingRollupFromCabinets = {
    ...body,
    lastRolledUpAt: Timestamp.now(),
  };

  await updateDesignItem(
    projectId,
    designItemId,
    { manufacturingRollup: rollup },
    AGGREGATOR_USER_ID,
  );

  return rollup;
}

/**
 * Convenience: recompute multiple DesignItems in one call. Used by
 * `assignCabinetToDesignItem` which moves a cabinet between two items
 * and therefore invalidates both. Errors on individual items are logged
 * but don't abort the rest — the scene-level operation already succeeded
 * at this point.
 */
export async function recomputeDesignItemRollups(
  projectId: string,
  designItemIds: Array<string | undefined | null>,
): Promise<void> {
  const unique = Array.from(
    new Set(designItemIds.filter((id): id is string => !!id)),
  );
  await Promise.all(
    unique.map(async id => {
      try {
        await recomputeDesignItemRollup(projectId, id);
      } catch (err) {
        console.warn(
          `[designItemCostAggregator] Rollup failed for ${projectId}/${id}:`,
          err,
        );
      }
    }),
  );
}
