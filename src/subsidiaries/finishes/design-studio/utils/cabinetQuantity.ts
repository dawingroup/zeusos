/**
 * cabinetQuantity — single source of truth for reading a SceneCabinet's
 * required-quantity multiplier.
 *
 * Why a helper and not `cabinet.requiredQuantity ?? 1` sprinkled at
 * call sites: every rollup (BOM, cut list, cost, DM parts sync) must
 * apply the same default + sanitisation, or we get subtle drift where
 * one rollup treats undefined as 1 and another as 0. This function
 * encodes the rule and makes it greppable.
 *
 * Rules:
 *   - `undefined` or missing → 1 (the original "this SceneCabinet is
 *     exactly one physical unit" semantics).
 *   - non-finite / NaN / negative → 1 (defensive — bad data shouldn't
 *     zero out a cabinet's contribution).
 *   - fractional values are rounded DOWN to the nearest integer
 *     (you can't build 2.5 cabinets).
 */
import type { SceneCabinet } from '../types/scene.types';

/**
 * Return the integer count of physical units this SceneCabinet
 * represents. Always ≥ 1.
 */
export function getCabinetRequiredQuantity(
  cabinet: Pick<SceneCabinet, 'requiredQuantity'> | null | undefined,
): number {
  if (!cabinet) return 1;
  const raw = cabinet.requiredQuantity;
  if (raw === undefined || raw === null) return 1;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  const floored = Math.floor(raw);
  return floored < 1 ? 1 : floored;
}

/** Sum `requiredQuantity` across a group of cabinets (for scene-wide counts). */
export function sumRequiredQuantity(
  cabinets: ReadonlyArray<Pick<SceneCabinet, 'requiredQuantity'>>,
): number {
  let total = 0;
  for (const c of cabinets) total += getCabinetRequiredQuantity(c);
  return total;
}
