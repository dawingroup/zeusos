/**
 * Margin floor + amber band constants — task spec.
 *
 * Plan §14.15 question 2 ("Margin floor — single org-wide value, or
 * per-client / per-subsidiary?") is unresolved. Until 3.A.5 + spec-author
 * review lock the policy, this is the default value baked into every new
 * Quote at creation. `Quote.marginFloorPct` carries it per-quote so a
 * future per-client override can simply persist a different number.
 */

export const MARGIN_FLOOR_DEFAULT_PCT = 25;

/** Within this many percentage points of the floor → amber (warn);
 *  below the floor → red; at-or-above floor minus band → green. */
export const MARGIN_AMBER_BAND_PP = 5;

export type MarginBand = 'green' | 'amber' | 'red';

export function bandForMargin(marginPct: number, floorPct: number, amberBandPp = MARGIN_AMBER_BAND_PP): MarginBand {
  if (marginPct < floorPct) return 'red';
  if (marginPct < floorPct + amberBandPp) return 'amber';
  return 'green';
}
