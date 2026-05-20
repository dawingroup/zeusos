/**
 * DesignItem → ManufacturingOrder creation service — P3
 *
 * The final piece of the scene-to-production pipeline. Takes the cabinets
 * belonging to a DesignItem (optionally filtered to a subset of scenes or
 * cabinets for phased production runs), aggregates their `computedBOM`
 * into an MO-shaped BOM, creates the MO via the canonical
 * `createManufacturingOrder()`, and locks each included SceneCabinet
 * against that MO.
 *
 * Design decisions (pinned by the audit plan):
 *
 *   • **MO granularity = DesignItem.** One DesignItem → one MO, typically.
 *     Cabinets are flattened into `MO.bom`, not modeled as separate orders.
 *     This matches the handover flow already in place for non-scene
 *     DesignItems (see `handoverService.createManufacturingOrderFromDesignItem`).
 *
 *   • **Multiple MOs per DesignItem are allowed** for phased production.
 *     Callers filter with `sceneIds` / `cabinetIds`; each invocation
 *     locks only the cabinets in that slice. The DesignItem's own
 *     `manufacturingOrderId` field is only stamped on the FIRST MO
 *     (so the DesignItem surface still points at the original order),
 *     with subsequent MOs discoverable via the per-cabinet
 *     `manufacturingOrderId`.
 *
 *   • **Lock invariant preserved.** We only flip `isLocked=true` via
 *     the existing `lockCabinetForProduction(sceneId, cabinetId, mdpId, moId)`
 *     which now requires a non-empty `moId`. Pre-locked cabinets in the
 *     selected slice are rejected — the caller must explicitly release
 *     or filter them out.
 *
 *   • **BOM aggregation groups by inventoryItemId.** Same SKU across
 *     multiple cabinets collapses into one line with summed quantity
 *     and totalCost. unitCost is weighted-average (sum(totalCost)/sum(qty))
 *     so the line's arithmetic is self-consistent.
 *
 *   • **Currency discipline.** Mixed-currency slices fail loud — an MO
 *     has a single `costSummary.currency`, we won't silently pick one.
 *     This mirrors the aggregator's `hasMixedCurrencies` flag but goes
 *     further because the MO is a production commitment, not a reporting
 *     artifact.
 */
import { getDesignItem, getProject, updateDesignItem } from '@/modules/design-manager/services';
import type { DesignItem } from '@/modules/design-manager/types';
import type { BOMEntry } from '@/modules/manufacturing/types';
import { createManufacturingOrder } from '@/modules/manufacturing/services/manufacturingOrderService';
import type { SceneCabinet } from '../types/scene.types';
import type { ComputedBOMLine } from '../types/constraintEngine.types';
import {
  getCabinetsForDesignItem,
  lockCabinetForProduction,
} from './scene.service';

const SYSTEM_USER_SUFFIX = 'system:design-studio-mo-creator';
const DEFAULT_SUBSIDIARY_ID = 'finishes';

// ── Types ──────────────────────────────────────────────────────────────

export interface CreateMOFromDesignItemOptions {
  /** Restrict to cabinets in these scenes (union with cabinetIds). */
  sceneIds?: string[];
  /** Restrict to these specific cabinets (union with sceneIds). */
  cabinetIds?: string[];
  /** Priority inherited from DesignItem by default. */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Subsidiary scope — defaults to 'finishes'. */
  subsidiaryId?: string;
  /** Free-text build instructions stamped on the MO. */
  instructions?: string;
  /** Free-text handover notes stamped on the MO. */
  handoverNotes?: string;
}

export interface CreateMOFromDesignItemResult {
  moId: string;
  lockedCabinets: Array<{ sceneId: string; cabinetId: string }>;
  bomLineCount: number;
  currency: 'UGX' | 'USD';
}

// ── Pure reducer: flatten ComputedBOMLine[] across cabinets ────────────

/**
 * Group BOM lines from all supplied cabinets by `inventoryItemId`, summing
 * quantities and total cost. Lines that lack an `inventoryItemId` are
 * grouped under `__unresolved__:{description}` so they still show up on
 * the MO rather than disappearing silently — the caller / UI can surface
 * them as a pre-release exception.
 *
 * Returns a single BOMEntry per distinct inventory item, deterministically
 * ordered by inventoryItemId for stable Firestore writes + snapshot tests.
 *
 * **Pure** — no Firestore, no network. Exported for unit tests.
 */
export function flattenCabinetsToBOM(
  cabinets: SceneCabinet[],
): {
  bom: BOMEntry[];
  currency: 'UGX' | 'USD';
  hasMixedCurrencies: boolean;
  unresolvedCount: number;
} {
  type Bucket = {
    inventoryItemId: string;
    inventoryItemName: string;
    materialCategory: string;
    unit: string;
    currency: 'UGX' | 'USD';
    quantity: number;
    totalCost: number;
  };
  const buckets = new Map<string, Bucket>();
  const currencies = new Map<'UGX' | 'USD', number>();
  let unresolvedCount = 0;

  for (const cabinet of cabinets) {
    const lines: ComputedBOMLine[] = cabinet.computedBOM ?? [];
    for (const line of lines) {
      const invId = line.inventoryItemId?.trim() ?? '';
      const key = invId
        ? invId
        : `__unresolved__:${line.description || 'unknown'}`;
      if (!invId) unresolvedCount += 1;

      const existing = buckets.get(key);
      if (existing) {
        existing.quantity += line.quantity || 0;
        existing.totalCost += line.totalCost || 0;
      } else {
        buckets.set(key, {
          inventoryItemId: invId,
          inventoryItemName:
            line.inventoryItemName || line.description || 'Unresolved item',
          materialCategory: line.materialCategory || 'other',
          unit: line.unit || 'ea',
          currency:
            line.currency === 'USD' || line.currency === 'UGX'
              ? line.currency
              : 'UGX',
          quantity: line.quantity || 0,
          totalCost: line.totalCost || 0,
        });
      }

      const cur =
        line.currency === 'USD' || line.currency === 'UGX'
          ? line.currency
          : 'UGX';
      currencies.set(cur, (currencies.get(cur) ?? 0) + 1);
    }
  }

  // Deterministic order: by key (inventoryItemId fallback to synthetic).
  const sortedKeys = Array.from(buckets.keys()).sort();
  const bom: BOMEntry[] = sortedKeys.map((key, idx) => {
    const b = buckets.get(key)!;
    const qty = b.quantity || 0;
    const unitCost = qty > 0 ? b.totalCost / qty : 0;
    return {
      id: `bom-${idx.toString().padStart(3, '0')}-${key}`,
      inventoryItemId: b.inventoryItemId,
      sku: b.inventoryItemId || '—',
      itemName: b.inventoryItemName,
      category: b.materialCategory,
      quantityRequired: qty,
      unit: b.unit,
      unitCost,
      totalCost: b.totalCost,
    };
  });

  // Majority currency with UGX tiebreak.
  let currency: 'UGX' | 'USD' = 'UGX';
  let best = -1;
  for (const [c, n] of currencies) {
    if (n > best) {
      best = n;
      currency = c;
    }
  }
  const hasMixedCurrencies = currencies.size > 1;

  return { bom, currency, hasMixedCurrencies, unresolvedCount };
}

// ── Filter helper (pure) ───────────────────────────────────────────────

/**
 * Filter a cabinet set by optional scene-id / cabinet-id lists. If neither
 * filter is provided, returns the full set. If both are provided, a
 * cabinet matches when it's in EITHER list (union semantics — useful for
 * "all of scene A + this one cabinet from scene B").
 *
 * Exported for tests.
 */
export function filterCabinets(
  cabinets: SceneCabinet[],
  sceneIds?: string[],
  cabinetIds?: string[],
): SceneCabinet[] {
  const hasScene = sceneIds && sceneIds.length > 0;
  const hasCabinet = cabinetIds && cabinetIds.length > 0;
  if (!hasScene && !hasCabinet) return cabinets.slice();

  const sceneSet = new Set(sceneIds ?? []);
  const cabSet = new Set(cabinetIds ?? []);
  return cabinets.filter(
    c => (hasScene && sceneSet.has(c.sceneId)) || (hasCabinet && cabSet.has(c.id)),
  );
}

// ── Orchestrator ───────────────────────────────────────────────────────

/**
 * Create a ManufacturingOrder for a DesignItem by flattening its cabinet
 * BOMs and locking each included cabinet against the new MO.
 *
 * Fails fast if:
 *   - the DesignItem doesn't exist
 *   - no cabinets match the filter
 *   - any filtered cabinet is already locked to a different MO
 *   - BOM currency is mixed (ambiguous MO cost)
 *
 * Returns the created `moId`, the list of locked cabinet refs, the bom
 * line count, and the chosen currency.
 */
export async function createMOFromDesignItem(
  projectId: string,
  designItemId: string,
  options: CreateMOFromDesignItemOptions,
  userId: string,
): Promise<CreateMOFromDesignItemResult> {
  if (!projectId || !designItemId) {
    throw new Error('createMOFromDesignItem: projectId and designItemId are required');
  }

  // ── 1. Resolve DesignItem + project context ──────────────────────────
  const item = await getDesignItem(projectId, designItemId);
  if (!item) {
    throw new Error(`DesignItem ${projectId}/${designItemId} not found`);
  }

  const project = await getProject(projectId);
  const projectCode = project?.code ?? projectId;

  // ── 2. Resolve cabinets ──────────────────────────────────────────────
  const allCabinets = await getCabinetsForDesignItem(designItemId);
  if (allCabinets.length === 0) {
    throw new Error(
      `DesignItem ${designItemId} has no cabinets — nothing to manufacture.`,
    );
  }

  const slice = filterCabinets(allCabinets, options.sceneIds, options.cabinetIds);
  if (slice.length === 0) {
    throw new Error(
      'No cabinets match the provided sceneIds / cabinetIds filter.',
    );
  }

  // ── 3. Guard against pre-locked cabinets in the slice ────────────────
  const preLocked = slice.filter(c => c.isLocked);
  if (preLocked.length > 0) {
    const ids = preLocked.map(c => `${c.sceneId}/${c.id}`).join(', ');
    throw new Error(
      `Cannot create MO — ${preLocked.length} cabinet(s) already locked: ${ids}. ` +
        `Unlock or filter them out before releasing to production.`,
    );
  }

  // ── 4. Flatten BOM ───────────────────────────────────────────────────
  const { bom, currency, hasMixedCurrencies } = flattenCabinetsToBOM(slice);
  if (hasMixedCurrencies) {
    throw new Error(
      'Mixed currencies across selected cabinets — an MO must have a single ' +
        'currency. Split the release by currency and try again.',
    );
  }

  // ── 5. Compose MO payload ────────────────────────────────────────────
  const designItemName = buildMOItemName(item, slice.length, allCabinets.length);
  const priority = options.priority ?? item.priority ?? 'medium';
  const subsidiaryId = options.subsidiaryId ?? DEFAULT_SUBSIDIARY_ID;

  const effectiveUserId = userId || SYSTEM_USER_SUFFIX;

  const moId = await createManufacturingOrder(
    {
      designItemId,
      projectId,
      projectCode,
      designItemName,
      // `quantity` on an MO is "units of this item" — each SceneCabinet is
      // a single physical unit, so the slice size is the quantity.
      quantity: slice.length,
      priority,
      productionRank: item.sortOrder ?? 0,
      bom,
      parts: [], // cabinet parts roll up via Workshop Viewer / handover flow, not here
      instructions: options.instructions ?? item.notes ?? '',
      handoverNotes:
        options.handoverNotes ??
        buildDefaultHandoverNotes(item, slice, allCabinets.length),
      subsidiaryId,
    },
    effectiveUserId,
  );

  // ── 6. Lock every cabinet in the slice against the new MO ────────────
  const locked: Array<{ sceneId: string; cabinetId: string }> = [];
  for (const cab of slice) {
    try {
      await lockCabinetForProduction(cab.sceneId, cab.id, cab.mdpId ?? '', moId);
      locked.push({ sceneId: cab.sceneId, cabinetId: cab.id });
    } catch (err) {
      // A lock failure mid-loop is unusual (pre-lock guard already ran)
      // but if it happens we log and continue — the MO is already real,
      // a partial lock is still useful, and the operator can remediate.
      console.warn(
        `[designItemToManufacturingOrderService] Failed to lock ${cab.sceneId}/${cab.id} against MO ${moId}:`,
        err,
      );
    }
  }

  // ── 7. Stamp MO on DesignItem if it's the first one ──────────────────
  // Don't stomp an existing MO reference — multiple MOs per DesignItem
  // are supported (phased production), and we want the FIRST MO to remain
  // the canonical entry point from design-manager's perspective.
  if (!item.manufacturingOrderId) {
    try {
      // P7 phase 3 — `manufacturingOrderId` is the canonical handover
      // signal; `deriveHandoverStatus` returns 'handed-over' whenever
      // it's set. The previous conditional `handoverStatus` mirror has
      // been removed (cabinet-driven MO release is still an implicit
      // handover; it's just expressed by the FK alone).
      await updateDesignItem(
        projectId,
        designItemId,
        {
          manufacturingOrderId: moId,
        },
        effectiveUserId,
      );
    } catch (err) {
      console.warn(
        `[designItemToManufacturingOrderService] Failed to stamp MO ${moId} back onto DesignItem ${designItemId}:`,
        err,
      );
    }
  }

  return {
    moId,
    lockedCabinets: locked,
    bomLineCount: bom.length,
    currency,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildMOItemName(
  item: Pick<DesignItem, 'name' | 'itemCode'>,
  sliceSize: number,
  totalSize: number,
): string {
  const base = item.name || item.itemCode || 'Design Item';
  if (sliceSize === totalSize) return base;
  return `${base} (${sliceSize}/${totalSize} cabinets)`;
}

function buildDefaultHandoverNotes(
  item: Pick<DesignItem, 'name' | 'itemCode'>,
  slice: SceneCabinet[],
  totalSize: number,
): string {
  const byScene = new Map<string, SceneCabinet[]>();
  for (const c of slice) {
    const list = byScene.get(c.sceneId) ?? [];
    list.push(c);
    byScene.set(c.sceneId, list);
  }
  const sceneSummary = Array.from(byScene.entries())
    .map(([sceneId, cabs]) => `scene ${sceneId}: ${cabs.length} cabinet(s)`)
    .join('; ');
  const scope =
    slice.length === totalSize
      ? `all ${totalSize} cabinet(s)`
      : `${slice.length} of ${totalSize} cabinet(s)`;
  return (
    `Cabinet-driven release for DesignItem "${item.name || item.itemCode}". ` +
    `Scope: ${scope} — ${sceneSummary}.`
  );
}
