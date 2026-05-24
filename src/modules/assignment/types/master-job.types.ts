/**
 * MasterJob — the single roll-up anchor for one client engagement
 * increment. Plays the role our Phase-3.A `Campaign` financial skeleton
 * was playing; the marketing-domain primitives (Brief, IMCTeam, 14-stage
 * workflow, ARAAM, Tier, PerformanceReview) continue to live on the
 * Campaign type and compose onto MasterJob via `MasterJob.campaign`.
 *
 * Spec §3.1 / §4.4 / §7.1.
 *
 * Lives at `organizations/{orgId}/master_jobs/{masterJobId}` — renamed
 * from the Phase 2.D `campaigns` collection (currently empty, so the
 * rename is a code-only change).
 *
 * Invariants enforced in Phase 3.B (Cloud Functions):
 * - `ceilingMinor` is copied from the linked SOW + ACCEPTED Quote at open.
 * - `allocatedMinor` is the sum of issued (non-rejected, non-cancelled)
 *   IWO budgets. Updated atomically with each IWO state transition.
 * - `allocatedMinor + new_iwo.budget ≤ ceilingMinor` is checked inside the
 *   same serializable transaction as the IWO insert (spec §11.1 — double
 *   allocation race).
 */

import type { Timestamp } from 'firebase/firestore';
import type { Campaign } from '@/modules/campaigns/types/campaign.types';
import type { BriefTier } from '@/modules/hr-central/role-profiles/types';

export type MasterJobStatus = 'OPEN' | 'DELIVERING' | 'CLOSED' | 'CANCELLED';

export interface MasterJob {
  id: string;
  sowId: string;
  quoteId: string;
  clientId: string;
  /** Short human-friendly reference: e.g. `ZTA-DIAGEO-2026-014`. */
  code: string;
  status: MasterJobStatus;
  /** Sum of issued IWO budgets that are not REJECTED / CANCELLED. */
  allocatedMinor: number;
  /** Hard cap copied from `sow.ceilingMinor` at master-job open, adjusted
   *  on approved ChangeOrders. No IWO can be issued that would push
   *  `allocatedMinor` past this number. */
  ceilingMinor: number;
  /** Client-facing total copied from the linked ACCEPTED Quote. The
   *  ClientInvoice references this number, not allocatedMinor. */
  clientTotalMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';

  /**
   * Brief tier carried through to every IWO issued under this MasterJob.
   * Set at intake (Account-Management classifies the brief per v1.1 §5).
   * Optional during the rollout window — pre-6.B MasterJobs default to
   * Tier 2 behaviour at issue time when unset.
   */
  tier?: BriefTier;

  /** Embedded marketing-domain detail — Brief / IMCTeam / 14-stage
   *  workflow / Tier System / ARAAM / PerformanceReview. The fields that
   *  describe how Account-Management runs the engagement live here.
   *  Optional so a finance-only MasterJob (e.g. retainer billing) can
   *  exist without the full marketing wrapper. */
  campaign?: Pick<
    Campaign,
    | 'name'
    | 'subsidiaryId'
    | 'brandId'
    | 'brandName'
    | 'clientName'
    | 'serviceLines'
    | 'bigIdea'
    | 'stage'
    | 'stageHistory'
    | 'brief'
    | 'imcTeam'
    | 'progressPct'
    | 'launchDate'
    | 'endDate'
    | 'performanceReview'
    | 'araam'
  >;

  /** Account-Management user owning this master job day-to-day. */
  accountManagerUserId?: string;

  /**
   * Cost Estimate Sheet — internal per-master-job cost-modelling
   * artifact. When signed off, drives the floor priceQuote warns
   * under (priceQuote ≥ ces.totalMinor × (1 + marginFloorPct/100)).
   * Added in Phase 6.D per Addendum v1.1 §8 / change C7. Optional —
   * legacy master jobs created pre-6.D have no CES (no floor check).
   * Type imported separately to avoid circular type dependencies.
   */
  ces?: import('../../contracts/types/ces.types').CES;

  openedAt?: Timestamp | string;
  closedAt?: Timestamp | string;
  cancelledAt?: Timestamp | string;
  cancelReason?: string;

  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
