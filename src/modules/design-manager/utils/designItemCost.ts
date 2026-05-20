/**
 * getDesignItemTotalCost — P9c-2
 *
 * Resolves a DesignItem to a single "headline" cost that can be
 * compared against a linked advisory BOQ amount. The DesignItem type
 * carries four parallel pricing unions (one per sourcing type); callers
 * should NOT read `.manufacturing.totalCost` directly and guess at
 * currency — the helper picks the right union and reports the source
 * so the UI can label it.
 *
 * Returns `null` when the item is missing or its sourcing-specific
 * pricing block is absent / empty. Reconciliation UI renders the null
 * case as "no cost set" rather than "zero" so operators can distinguish
 * "unpriced" from "priced at 0".
 *
 * Currency handling:
 *   - Procurement stores `targetCurrency` (project currency after FX).
 *   - Architectural and construction store their own `currency` field.
 *   - Manufacturing (legacy + the cabinet rollup) has no top-level
 *     currency field in the current schema; we default to `UGX`,
 *     matching existing surfaces (ProductionTab, DesignItemsTable).
 *     A future schema change should denormalise project currency onto
 *     ManufacturingCost and the rollup — until then callers that render
 *     mixed-currency summaries should check `currency` and warn.
 *
 * Manufacturing precedence:
 *   - `manufacturingRollup` (scene-derived) takes precedence over
 *     `manufacturing` (manual) when both exist AND the rollup has a
 *     nonzero total. This matches the P10 contract that scenes are the
 *     source of truth while a DesignItem has cabinets linked. If the
 *     rollup is present-but-zero (no cabinets contributed yet), fall
 *     through to the manual `manufacturing` breakdown.
 */

import type { DesignItem } from '../types';
import { normalizeSourcingType } from '../types/deliverables';

export type DesignItemCostSource =
  | 'manufacturing'
  | 'manufacturing_rollup'
  | 'procurement'
  | 'architectural'
  | 'construction';

export interface DesignItemCost {
  /** Total in `currency`, ready to render. */
  total: number;
  /** ISO-ish currency code (UGX/USD/EUR/…). */
  currency: string;
  /** Which pricing block the number came from — the UI labels it. */
  source: DesignItemCostSource;
}

const MANUFACTURING_DEFAULT_CURRENCY = 'UGX';

export function getDesignItemTotalCost(
  item: DesignItem | null | undefined,
): DesignItemCost | null {
  if (!item) return null;

  const sourcing = normalizeSourcingType(item.sourcingType);

  switch (sourcing) {
    case 'CUSTOM_FURNITURE_MILLWORK': {
      // Prefer the scene-derived rollup when it has contributed cost;
      // fall through to the manual breakdown when rollup is absent or
      // empty (no cabinets linked yet).
      const rollup = item.manufacturingRollup;
      if (rollup && rollup.totalCost > 0) {
        return {
          total: rollup.totalCost,
          currency: rollup.currency,
          source: 'manufacturing_rollup',
        };
      }
      if (item.manufacturing && item.manufacturing.totalCost > 0) {
        return {
          total: item.manufacturing.totalCost,
          currency: MANUFACTURING_DEFAULT_CURRENCY,
          source: 'manufacturing',
        };
      }
      return null;
    }

    case 'PROCURED': {
      const p = item.procurement;
      if (p && p.totalLandedCost > 0) {
        return {
          total: p.totalLandedCost,
          // targetCurrency is the project-facing currency after FX;
          // BOQ rows also store a project currency, so this is the
          // right axis to compare on.
          currency: p.targetCurrency || MANUFACTURING_DEFAULT_CURRENCY,
          source: 'procurement',
        };
      }
      return null;
    }

    case 'DESIGN_DOCUMENT': {
      const a = item.architectural;
      if (a && a.totalCost > 0) {
        return {
          total: a.totalCost,
          currency: a.currency || MANUFACTURING_DEFAULT_CURRENCY,
          source: 'architectural',
        };
      }
      return null;
    }

    case 'CONSTRUCTION': {
      const c = item.construction;
      if (c && c.totalCost > 0) {
        return {
          total: c.totalCost,
          currency: c.currency || MANUFACTURING_DEFAULT_CURRENCY,
          source: 'construction',
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Short label for each cost source — the reconciliation UI uses this
 * to tell the operator which pricing block the number came from.
 * Kept as a plain map rather than a switch so callers can render
 * all five in a legend if they want.
 */
export const DESIGN_ITEM_COST_SOURCE_LABELS: Record<DesignItemCostSource, string> = {
  manufacturing: 'Manufacturing',
  manufacturing_rollup: 'Scene rollup',
  procurement: 'Procurement (landed)',
  architectural: 'Architectural',
  construction: 'Construction',
};

/**
 * Divergence between a DesignItem's headline cost and the sum of its
 * linked BOQ rows. Returned as a signed delta (design − boq) plus a
 * percentage for the UI to colour-code. `null` when either side lacks
 * numbers to compare OR the currencies don't match — we refuse to do
 * cross-currency subtraction silently.
 *
 * This is reconciliation-only: the helper doesn't write anywhere, it
 * just gives the UI a consistent view of drift so an operator can
 * decide which side to correct. See F9 in the data-model audit.
 */
export interface CostDivergence {
  designCost: number;
  boqTotal: number;
  delta: number; // designCost - boqTotal
  percent: number | null; // null when boqTotal is 0
  currency: string;
}

export function computeCostDivergence(
  designCost: DesignItemCost | null,
  boqAmounts: Array<{ amount: number; currency: string }>,
): CostDivergence | { mismatch: 'currency' | 'no-data' } {
  if (!designCost || boqAmounts.length === 0) {
    return { mismatch: 'no-data' };
  }
  // BOQ rows should all be in the project currency, but defend against
  // mixed-currency inputs — silent coercion here would mislead.
  const currencies = new Set(boqAmounts.map(b => b.currency || MANUFACTURING_DEFAULT_CURRENCY));
  if (currencies.size > 1) return { mismatch: 'currency' };
  const boqCurrency = [...currencies][0];
  if (boqCurrency !== designCost.currency) return { mismatch: 'currency' };

  const boqTotal = boqAmounts.reduce((sum, b) => sum + (b.amount || 0), 0);
  const delta = designCost.total - boqTotal;
  const percent = boqTotal === 0 ? null : (delta / boqTotal) * 100;

  return {
    designCost: designCost.total,
    boqTotal,
    delta,
    percent,
    currency: designCost.currency,
  };
}
