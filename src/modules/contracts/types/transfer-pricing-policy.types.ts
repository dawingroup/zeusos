/**
 * Transfer Pricing Policy — Q3 (ADR-0001).
 *
 * Per-pair, effective-dated cost-plus markup for intra-group IWOs.
 * Stored at `transfer_pricing_policy/{fromOrgId}__{toOrgId}/versions/{ulid}`
 * with a denormalized "current" pointer at the parent doc.
 *
 * The decision: "Cost-plus (Recommended)" — receiving brand bills the
 * master-job-owning brand at `cumulativeCostMinor × (1 + markupPct / 100)`
 * at close time. Per-pair markup configurable.
 *
 * Lifecycle:
 *   1. Seed via seedTransferPricingPolicy (defaults to 10% for all
 *      directed pairs of {parent, 5 brands}).
 *   2. Admin updates a pair → writes a new versions/{ulid} doc with
 *      its own effectiveFrom; parent's `currentVersionId` points to
 *      the latest.
 *   3. closeWorkOrder reads via lookupMarkupPct(db, fromOrgId,
 *      toOrgId, atDate) — picks the active version at atDate; falls
 *      back to `iwo.transferPriceMinor` (set at issue) when no policy
 *      exists for the pair (back-compat for pre-Q3 IWOs).
 *
 * Versioning vs. "just update the doc": effective-dated history lets
 * audit reconstruct what markup applied at any past close. Tax-side
 * defensibility for cost-plus regimes typically requires this.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '../../../core/settings/types';

/**
 * Composite key format: `${fromOrgId}__${toOrgId}` (double-underscore
 * delimiter; both halves are kebab-case SubsidiaryId values).
 *
 * Direction matters: a ZTA→Zeus-Group markup is independent of
 * Zeus-Group→ZTA. The receiving direction (sub→parent) is the common
 * case — that's what closeWorkOrder consults.
 */
export type TransferPricingPolicyId = string;

/**
 * One historical version of the policy for a (from, to) pair. The
 * parent doc at `transfer_pricing_policy/{pairId}` carries:
 *   { fromOrgId, toOrgId, currentVersionId, defaultMarkupPct }
 *
 * Versions live under `transfer_pricing_policy/{pairId}/versions/{ulid}`.
 */
export interface TransferPricingPolicyVersion {
  /** ULID — sorts by emission time. */
  id: string;

  /** Markup percentage. 10 = +10% cost-plus. */
  markupPct: number;

  /**
   * Start of effectivity (inclusive). Versions are non-overlapping —
   * setting a new version with `effectiveFrom = X` implicitly closes
   * the prior version's `effectiveUntil = X - 1ms` at write time.
   */
  effectiveFrom: Timestamp | string;

  /** Closed when superseded; null/undefined while current. */
  effectiveUntil?: Timestamp | string | null;

  /** Free-text justification — required for audit (e.g.
   *  "Tax-side review, raised from 10% → 12% per CFO 2026-Q3"). */
  reason?: string;

  // Audit
  setBy: string;
  setAt: Timestamp | string;
}

/**
 * Parent doc — pair-level metadata + pointer to the active version.
 */
export interface TransferPricingPolicy {
  id: TransferPricingPolicyId;
  fromOrgId: SubsidiaryId;
  toOrgId: SubsidiaryId;

  /** Pointer to the currently-active version in `/versions`. */
  currentVersionId?: string;

  /** Default markup used when no version exists yet (seed fallback). */
  defaultMarkupPct: number;

  /** Snapshot of the current version's markupPct — denormalized so
   *  consumers don't need two reads. Updated whenever
   *  currentVersionId changes. */
  currentMarkupPct?: number;

  createdBy: string;
  createdAt: Timestamp | string;
  updatedBy: string;
  updatedAt: Timestamp | string;
}

// ============================================
// Pure helpers (FE-shareable)
// ============================================

/**
 * Compute composite id from a (from, to) pair. Same format as the
 * helper in functions/src/pricing/transferPricingPolicy.js.
 */
export function transferPricingPolicyId(
  fromOrgId: SubsidiaryId,
  toOrgId: SubsidiaryId,
): TransferPricingPolicyId {
  return `${fromOrgId}__${toOrgId}`;
}

/**
 * Compute the cost-plus transfer price.
 *   transferPriceMinor = round(cumulativeCostMinor × (1 + markupPct / 100))
 *
 * Returns 0 for zero cost. Negative cost is clamped to 0 (defensive).
 */
export function applyMarkup(cumulativeCostMinor: number, markupPct: number): number {
  if (!Number.isFinite(cumulativeCostMinor) || cumulativeCostMinor <= 0) return 0;
  const safeMarkup = Number.isFinite(markupPct) ? markupPct : 0;
  return Math.round(cumulativeCostMinor * (1 + safeMarkup / 100));
}
