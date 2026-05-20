/**
 * finishScheduleAggregator — collapse a scene's scattered finish
 * selections into a single project-wide finish schedule table.
 *
 * Two sources of truth feed in:
 *   1. `SceneCabinet.finishSelections` — record of
 *      `{ componentKey: finishLibraryId }`. Keys describe WHERE the
 *      finish is applied (e.g. "carcass", "doors", "edge_banding").
 *   2. `ScenePart.finishLibraryId` — per-part override. Captures edge
 *      cases where one drawer in a cabinet has a different finish
 *      from the rest.
 *
 * Output: one row per unique `finishLibraryId`, with the list of
 * cabinet labels + application roles aggregated. The PDF renderer
 * (`drawFinishScheduleSheet`) paints one row per entry with a colour
 * swatch + code + description.
 *
 * Library resolution is injected — this module stays pure so it
 * unit-tests without Firestore. Callers pass a `resolveFinish(id)`
 * lookup that returns the Finish Library doc (name, code, colorHex,
 * description).
 */
import type { SceneCabinet, FinishScheduleEntry } from '../types/scene.types';
import { getCabinetRequiredQuantity } from '../utils/cabinetQuantity';

export interface ResolvedFinish {
  id: string;
  name: string;
  code?: string;
  colorHex?: string;
  description?: string;
}

export type FinishResolver = (id: string) => ResolvedFinish | undefined;

/**
 * Build the schedule rows.
 *
 * `requiredQuantity` on each cabinet multiplies the partCount so the
 * schedule shows the physical units of each finish needed, not the
 * template count.
 */
export function aggregateFinishSchedule(
  cabinets: ReadonlyArray<Pick<SceneCabinet,
    'id' | 'cabinetCode' | 'displayName' | 'finishSelections' | 'assemblies' | 'requiredQuantity'
  >>,
  resolve: FinishResolver = () => undefined,
): FinishScheduleEntry[] {
  // Map<finishLibraryId, accumulating row>.
  const byId = new Map<string, {
    cabinetLabels: Set<string>;
    appliedTo: Set<string>;
    partCount: number;
  }>();

  const touch = (finishId: string, cabinetLabel: string, appliedTo: string | undefined, partQty: number) => {
    if (!finishId) return;
    const row = byId.get(finishId) ?? {
      cabinetLabels: new Set<string>(),
      appliedTo: new Set<string>(),
      partCount: 0,
    };
    row.cabinetLabels.add(cabinetLabel);
    if (appliedTo) row.appliedTo.add(appliedTo);
    row.partCount += partQty;
    byId.set(finishId, row);
  };

  for (const cab of cabinets) {
    const label = cab.cabinetCode || cab.displayName || cab.id;
    const multiplier = getCabinetRequiredQuantity(cab);

    // (1) Cabinet-level finishSelections — treat each entry as 1 part
    // slot per cabinet unit (multiplied by requiredQuantity).
    for (const [componentKey, finishId] of Object.entries(cab.finishSelections ?? {})) {
      touch(finishId, label, componentKey, multiplier);
    }

    // (2) Per-part overrides — each ScenePart with finishLibraryId
    // contributes its own `quantity * requiredQuantity` to the partCount.
    for (const asm of cab.assemblies ?? []) {
      for (const part of asm.parts ?? []) {
        const finishId = part.finishLibraryId;
        if (!finishId) continue;
        const appliedTo = asm.assemblyType ?? 'part';
        touch(finishId, label, appliedTo, (part.quantity ?? 1) * multiplier);
      }
    }
  }

  const out: FinishScheduleEntry[] = [];
  for (const [finishId, row] of byId) {
    const resolved = resolve(finishId);
    out.push({
      finishLibraryId: finishId,
      name: resolved?.name ?? finishId,
      code: resolved?.code,
      colorHex: resolved?.colorHex,
      description: resolved?.description,
      cabinetCount: row.cabinetLabels.size,
      cabinetLabels: Array.from(row.cabinetLabels).sort(),
      partCount: row.partCount,
      appliedTo: Array.from(row.appliedTo).sort(),
    });
  }

  // Sort deterministically: rows with a resolved name first (alphabetical),
  // unresolved (raw id) last so missing-library-entry schedule rows
  // surface as a cluster the user can fix.
  out.sort((a, b) => {
    const aResolved = a.name !== a.finishLibraryId;
    const bResolved = b.name !== b.finishLibraryId;
    if (aResolved !== bResolved) return aResolved ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}
