/**
 * CES (Cost Estimate Sheet) — Phase 6.D (closes Addendum v1.1 §8 / C7).
 *
 * Per-master-job spreadsheet capturing internal production-cost line
 * items BEFORE the client-facing quote / change-order. The profile's
 * "CES / Production Costs & Timings" stage maps onto this object —
 * see Addendum v1.1 §4 mapping table.
 *
 * Flow:
 *   1. AM + Creative open the master job at the Strategy Presentation
 *      stage (master_job.status === 'OPEN').
 *   2. AM + Creative add CES line items as estimates land
 *      (postCesLineItem CFn — deferred to 6.D.2 UI).
 *   3. AM signs off the CES (signOffCes CFn — sets ces.signedOff +
 *      ces.totalMinor frozen at that moment).
 *   4. Quote builder runs (priceQuote) — when masterJobId is passed,
 *      it reads the signed-off CES and warns / emits
 *      QuoteSubFloorWarning if the client-facing quote total is
 *      below the CES floor (i.e. the agency would be selling at a loss).
 *
 * The CES is NOT a contractual artifact — it's an internal cost-modelling
 * artifact. The contractual artifacts (Quote, ChangeOrder, ClientInvoice)
 * carry the markup-included numbers. CES is the floor under them.
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * One row in the CES — typically a single producer's daily / hourly
 * cost or a vendor estimate.
 */
export interface CESLineItem {
  /** Stable id — ULID. */
  id: string;

  /**
   * What this cost covers. Free-text but conventional categories:
   *   'LABOR_INTERNAL'   internal staff time (e.g. designer × 8h)
   *   'LABOR_FREELANCE'  external freelancer (e.g. photographer × 1 day)
   *   'PRODUCTION'       physical production (e.g. printing, post-prod)
   *   'TALENT'           on-screen / on-stage talent fees
   *   'MEDIA_BUY'        ad placement spend (treated as a passthrough)
   *   'OTHER'            anything else (rentals, props, transport)
   */
  category: 'LABOR_INTERNAL' | 'LABOR_FREELANCE' | 'PRODUCTION' | 'TALENT' | 'MEDIA_BUY' | 'OTHER';

  /** 1-line description of the line. */
  description: string;

  /** Optional quantity for the unit-rate model. */
  quantity?: number;
  /** Optional unit label — 'hour', 'day', 'piece', 'campaign'. */
  unit?: string;

  /** Minor units (e.g. UGX or USD cents). The total per line. */
  amountMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';

  /** Optional foreign-keys for traceability when the cost has a source. */
  freelancerId?: string;
  supplierId?: string;

  notes?: string;

  // Audit
  addedBy: string;
  addedAt: Timestamp | string;
}

/**
 * Per-master-job cost-estimate sheet. Embedded on the MasterJob doc as
 * `master_jobs/{id}.ces` (not a separate collection — there's exactly
 * one CES per master job).
 *
 * The line items are stored inline as an array (typical CES has ≤ 30
 * items). If it grows beyond ~100, migrate to a subcollection in 6.D.2.
 */
export interface CES {
  lineItems: CESLineItem[];

  /**
   * Sum of all line-item amountMinor — denormalised so consumers
   * (priceQuote) don't have to reduce on every read. Updated when
   * postCesLineItem runs and FROZEN when signOffCes runs.
   */
  totalMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';

  /**
   * True once the AM has signed off the CES — locks the line items
   * and `totalMinor`. Required before priceQuote enforces the floor.
   * Unsigned CES = informational only.
   */
  signedOff: boolean;
  signedOffByUserId?: string;
  signedOffAt?: Timestamp | string;

  /**
   * Margin floor pct the quote builder should warn under. Defaults
   * to MasterJob/SOW defaults if unset. Per-CES override lets AMs
   * tighten the floor on a particularly competitive pitch.
   */
  marginFloorPct?: number;

  /** Last update — bumped whenever a line is added/removed/edited or sign-off flips. */
  updatedAt: Timestamp | string;
}

// ============================================
// Pure helpers
// ============================================

/**
 * Sum the line items. Useful for the optimistic UI update before the
 * postCesLineItem CFn round-trip completes.
 */
export function sumCesLineItems(items: CESLineItem[]): number {
  return items.reduce((acc, l) => acc + (Number(l.amountMinor) || 0), 0);
}

/**
 * Compute the floor the priceQuote integration enforces. Returns null
 * when the CES isn't signed off (floor only applies post-sign-off so
 * AMs can still iterate freely during scoping).
 *
 * The floor is `totalMinor × (1 + marginFloorPct / 100)`. If the
 * client-facing quote total is below this, priceQuote emits a
 * QuoteSubFloorWarning (added to outbox in 6.D.2).
 */
export function computeCesFloor(
  ces: CES | undefined | null,
  defaultMarginFloorPct = 25,
): number | null {
  if (!ces || !ces.signedOff) return null;
  if (typeof ces.totalMinor !== 'number') return null;
  const floorPct = typeof ces.marginFloorPct === 'number'
    ? ces.marginFloorPct
    : defaultMarginFloorPct;
  return Math.round(ces.totalMinor * (1 + floorPct / 100));
}

/**
 * True iff the proposed quote total is below the CES-derived floor.
 * Caller should issue a warning (not block) — AMs can override with
 * documented justification when the strategic value justifies a
 * thin-margin pitch.
 */
export function isQuoteBelowCesFloor(
  ces: CES | undefined | null,
  quoteTotalMinor: number,
  defaultMarginFloorPct = 25,
): boolean {
  const floor = computeCesFloor(ces, defaultMarginFloorPct);
  if (floor === null) return false;
  return quoteTotalMinor < floor;
}
