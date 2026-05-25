/**
 * Phase 6.UI.B — Traffic surface types.
 *
 * `RoutingProposal` mirrors the response shape from the `routeBrand`
 * callable in `functions/src/assignment/routeBrand.js`. The two are
 * kept in lock-step by hand — the callable returns plain JSON, so the
 * type lives here in the frontend for now. If the backend adopts
 * codegen later, replace this with the generated type.
 */

import type { Capability, DeliverySubsidiaryId } from '@/core/settings/brand-capabilities';
// MasterJob.tier uses the Phase-6.A string-enum BriefTier
// ('TIER_1' | 'TIER_2' | 'TIER_3'); align with that here. The
// numeric-tier helpers in `src/modules/campaigns/constants/tiers.ts`
// are unrelated (legacy intake helpers) and are converted via
// `numericTierFromBriefTier` where needed.
import type { BriefTier } from '@/modules/hr-central/role-profiles/types';

/** Why a brand was excluded from the routing decision. */
export type CandidateRejectionReason =
  | 'NO_CAPABILITY'
  | 'CONFLICTED'
  | 'AT_CAPACITY'
  | null;

export interface BrandCandidate {
  brandId: DeliverySubsidiaryId;
  hasCapability: boolean;
  conflicted: boolean;
  openIwoCount: number;
  /** Soft slack signal — `threshold - openIwoCount`, clamped at 0. */
  availability: number;
  rejectionReason: CandidateRejectionReason;
}

export interface RoutingProposal {
  /** The brand the engine recommends. `null` when no candidate cleared
   *  capability + conflict + capacity. */
  proposedBrandId: DeliverySubsidiaryId | null;
  /** Set when `proposedBrandId` is `null` — `'NO_ELIGIBLE_BRAND'` is
   *  the only value the callable emits today. */
  reasonNoCandidate: 'NO_ELIGIBLE_BRAND' | null;
  candidates: BrandCandidate[];
  /** `'house-of-zeus'` when the KE-geography preference fired. */
  geographyPreferenceApplied: DeliverySubsidiaryId | null;
  tierApplied: BriefTier | null;
  /** ISO timestamp the engine ran at — useful for SLA countdowns. */
  nowIso: string;
  /** Opaque id appended to the `RoutingBrandProposed` outbox event. */
  proposalId: string;
}

/** Input the Traffic UI sends to `routeBrand`. */
export interface RoutingRequest {
  masterJobId: string;
  requiredCapability: Capability;
  tier?: BriefTier;
  accountRegion?: 'UG' | 'KE' | string;
  accountCategory?: string;
  accountId?: string;
}

/** Override is captured client-side; the actual write lands when
 *  `issueWorkOrder` is invoked with a different `subsidiaryOrgId`. */
export interface RoutingOverride {
  proposalId: string;
  originalBrandId: DeliverySubsidiaryId | null;
  overriddenBrandId: DeliverySubsidiaryId;
  reason?: string;
  decidedAt: string;
}

export const HUMAN_REJECTION_REASON: Record<NonNullable<CandidateRejectionReason>, string> = {
  NO_CAPABILITY: 'Capability not declared',
  CONFLICTED: 'Conflict-firewall block',
  AT_CAPACITY: 'At capacity',
};
