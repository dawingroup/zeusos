/**
 * rollupTiles — pure helpers backing the MasterJobRollupCard.
 *
 * Split out of the component so the burn / allocation / margin maths
 * are unit-testable without a React render and without Firestore.
 *
 * Tone bands (spec §9.4 burn meter):
 *   allocation ≥ 100% → red  (ceiling exceeded — change order required)
 *   allocation ≥  80% → amber (within the warning band)
 *   else               → green
 *
 *   margin ≥ MARGIN_FLOOR (25% default) → green
 *   else                                → amber
 */

import type { MasterJobRollup } from '@/modules/assignment/hooks/useMasterJobRollup';

export type Tone = 'green' | 'amber' | 'red';

export interface RollupTiles {
  /** Rounded allocation percentage (0–N). 0 when ceilingMinor ≤ 0. */
  allocPct: number;
  allocTone: Tone;
  marginTone: Tone;
  /** Map of IWO state → count, ordered by the rollup's workOrders array. */
  stateCounts: Record<string, number>;
  /** "issued: 2 · accepted: 1" style summary; empty string when no IWOs. */
  stateBreakdown: string;
}

export const ALLOCATION_RED_BAND_PCT = 100;
export const ALLOCATION_AMBER_BAND_PCT = 80;
export const MARGIN_GREEN_FLOOR_PCT = 25;

export function computeRollupTiles(rollup: MasterJobRollup): RollupTiles {
  const allocPct = rollup.ceilingMinor > 0
    ? Math.round((rollup.allocatedMinor / rollup.ceilingMinor) * 100)
    : 0;

  const allocTone: Tone =
    allocPct >= ALLOCATION_RED_BAND_PCT ? 'red' :
    allocPct >= ALLOCATION_AMBER_BAND_PCT ? 'amber' :
    'green';

  const marginTone: Tone =
    rollup.marginPct >= MARGIN_GREEN_FLOOR_PCT ? 'green' : 'amber';

  const stateCounts: Record<string, number> = {};
  for (const wo of rollup.workOrders) {
    stateCounts[wo.status] = (stateCounts[wo.status] || 0) + 1;
  }
  const stateBreakdown = Object.entries(stateCounts)
    .map(([s, n]) => `${s.toLowerCase()}: ${n}`)
    .join(' · ');

  return { allocPct, allocTone, marginTone, stateCounts, stateBreakdown };
}
