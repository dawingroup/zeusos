/**
 * Campaign data model — the marketing-facing view that wraps a `MasterJob`.
 *
 * Phase 3.A.5 renamed the Firestore collection `campaigns` → `master_jobs`
 * (spec §4.4) so the canonical legal-entity / commercial-gravity name lives
 * at the data layer. The `Campaign` TypeScript type continues to describe
 * the marketing-domain view drawn from the Zeus profile (14-stage workflow,
 * ARAAM, IMC Team, Tier, BIG IDEA, PerformanceReview) — these fields hang
 * off a MasterJob via `MasterJob.campaign` (see plan §14.4 / §14.14).
 *
 * In other words:
 *   - Wire-format / persistence:   `MasterJob` at `organizations/{orgId}/master_jobs/{id}`
 *   - Marketing-UI label / detail: `Campaign` (composed onto `MasterJob.campaign`)
 *
 * The structure layered on top:
 *
 *   Client → Brand → Campaign → Job → Deliverable
 *                       ├ Brief
 *                       ├ IMCTeam[]
 *                       ├ bigIdea + tier (proprietary)
 *                       ├ 14-stage workflow
 *                       └ performanceReview
 *
 * Stage progression, IMC roles, and the Tier System SLA model are all
 * defined in `src/modules/campaigns/constants/*` — the literal unions
 * imported here reference those constant arrays so a stage rename only
 * needs to happen in one place.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';
import type { CampaignStage } from '../constants/stages';
import type { BriefTier } from '../constants/tiers';
import type { ServiceLine } from '../constants/service-lines';

// ─────────────────────────────────────────────────────────────────
// IMC Team (per-Campaign team composition)
// ─────────────────────────────────────────────────────────────────

/**
 * IMC = Integrated Marketing Communications. Each Campaign assembles a team
 * drawn from staff across the 5 Zeus sub-brands. The Traffic Coordinator
 * (added in Phase 2.C to the Campaigns module-roles registry) orchestrates
 * the 5 parallel execution streams during stage 6.
 */
export interface IMCTeamMember {
  userId: string;
  /** Module-role ID — e.g. 'account_director', 'traffic_coordinator', 'executive_creative_director'.
   *  Must be valid against `MODULE_ROLES.campaigns` in `src/core/settings/moduleRoles.ts`. */
  role: string;
  /** Marks the lead of one of the 5 parallel IMC streams in stage 6 (Media,
   *  PR, Digital, Creative, BTL). The Traffic Coordinator works across all
   *  streams without being a streamLead. */
  streamLead?: boolean;
  /** Which sub-brand the team member is contributing from. Used for
   *  per-subsidiary P&L allocation. */
  subsidiaryId: SubsidiaryId;
}

// ─────────────────────────────────────────────────────────────────
// Brief
// ─────────────────────────────────────────────────────────────────

/**
 * Brief — the single source of truth for what the client is asking for.
 * Carries the proprietary Tier classification that drives SLA enforcement.
 */
export interface Brief {
  /** Required tier (1 | 2 | 3) — drives `expectedRevertBy` and
   *  `expectedFeedbackBy` auto-computation. */
  tier: BriefTier;

  objectives: string;
  targetAudience: string;
  kpis: BriefKPI[];
  /** Free-text deliverable summary — the structured `Deliverable[]` array
   *  on each Job is the source of truth for what gets produced. */
  deliverablesSummary?: string;
  budgetUGX?: number;
  deadline?: Timestamp | string;

  /** When the brief document was received from the client. */
  briefedAt?: Timestamp | string;
  /** Auto-computed: briefedAt + tier SLA (Tier 1=14d, Tier 2=7d, Tier 3=1-2d). */
  expectedRevertBy?: Timestamp | string;
  /** When the agency sent its insight-led revert. */
  revertSubmittedAt?: Timestamp | string;
  /** Auto-computed: revertSubmittedAt + per-tier feedback SLA (4-5d / 2d / immediate). */
  expectedFeedbackBy?: Timestamp | string;

  signOffByUserId?: string;
  signedOffAt?: Timestamp | string;

  // ──────────────────────────────────────────────────────────────────
  // Phase 6.D — Co-authored brief (Addendum v1.1 §7.3 / refinement C6)
  //
  // "The profile's Campaign Proposal Stage has the client and agency
  // co-author the brief, with agency input and references."
  //
  // The handoff packet's brief field records authorship/contribution
  // and the 24h-document-before-verbal rule.
  // ──────────────────────────────────────────────────────────────────

  /**
   * When the documented brief was delivered (the 24h-doc-before-verbal
   * anchor). Set by the AM the moment the brief doc lands in the file
   * share / Drive / asset library.
   */
  documentDeliveredAt?: Timestamp | string;

  /**
   * When the verbal briefing happened (the agency-call after the doc).
   * Per profile §2.3 Tier 1 / 2 expects a meeting / call; Tier 3 may
   * skip. Validated against `documentDeliveredAt` to enforce
   * "≥ 24h gap" — see `validateBriefingCadence()` below.
   */
  verbalBriefingAt?: Timestamp | string;

  /**
   * Append-only list of who contributed what to the brief. Client +
   * agency both appear here in the Campaign Proposal Stage. Empty
   * array means single-author (legacy pre-6.D briefs).
   */
  authorContributions?: BriefAuthorContribution[];
}

/**
 * One contribution to a co-authored brief. Both `client` and `agency`
 * principals are typed so reporting can answer "what proportion of our
 * briefs are genuinely co-authored vs client-only?".
 */
export interface BriefAuthorContribution {
  /** Stable id for the contribution row — ULID. */
  id: string;

  /** Who's contributing. `principalKind` distinguishes the side. */
  principalKind: 'client' | 'agency';

  /** Free-text identifier — userId for staff, contactId or name for client side. */
  principalRef: string;

  /** What role the contributor played at the brief table. Free-text but
   *  conventional values: 'creative_lead', 'strategy_lead', 'account_lead',
   *  'client_lead', 'subject_matter_expert'. */
  role: string;

  /** 1-2 sentence summary of the contribution itself. */
  contributionSummary: string;

  /** Optional references — URLs to inspiration, brand assets, prior work. */
  references?: string[];

  contributedAt: Timestamp | string;
}

export interface BriefKPI {
  name: string;
  target?: string;
  source?: string;
}

// ─────────────────────────────────────────────────────────────────
// Performance Review (Challenge → Strategy → Results)
// ─────────────────────────────────────────────────────────────────

/**
 * Zeus reports completed Campaigns in a fixed shape — captured per the
 * profile case studies (KFC "Leave Eat to KFC", Pilsner "Reach for More",
 * Vivo "Genda Okikube", Uganda Waragi Comedy, etc.).
 */
export interface PerformanceReview {
  challenge?: string;
  strategy?: string;
  results?: string;
  metrics?: PerformanceMetric[];
  /** Asset Library IDs of the public case-study tile / hero shots. */
  caseStudyAssetIds?: string[];
}

export type PerformanceMetricUnit =
  | 'percent'
  | 'count'
  | 'UGX'
  | 'KES'
  | 'USD'
  | 'liters'
  | 'multiplier'
  | 'other';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: PerformanceMetricUnit;
  /** Where the metric came from — GA4, Meta Business Suite, Client BI, AC Nielsen, etc. */
  source?: string;
  /** For delta metrics (e.g. brand_salience_delta), the pre-campaign baseline. */
  deltaBaseline?: number;
}

// ─────────────────────────────────────────────────────────────────
// Status & financial summary (kept compatible with AdvisoryProject)
// ─────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'pitching'      // new-business pipeline
  | 'planning'      // brief received, strategy in flight
  | 'active'        // execution in progress (stages 6–12)
  | 'reporting'     // launched, monitoring (stages 13–14)
  | 'completed'     // performance review signed off
  | 'on_hold'
  | 'cancelled';

export interface CampaignBudget {
  currency: 'UGX' | 'USD' | 'KES';
  totalBudget: number;
  spent: number;
  committed: number;
  remaining: number;
  variance?: number;
}

// ─────────────────────────────────────────────────────────────────
// Campaign — the top-level entity
// ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  /** Short human-friendly code: ZTA-2026-Q2-001, ZD-2026-Q2-014 — used in URLs, exports. */
  code: string;
  name: string;

  /** Which sub-brand owns this campaign (used for P&L allocation + theming). */
  subsidiaryId: SubsidiaryId;

  /** Client → Brand foreign keys. */
  clientId: string;
  brandId: string;
  /** Denormalised for fast list rendering — refreshed by Cloud Function on parent rename. */
  clientName?: string;
  brandName?: string;

  /** Stage 6 of the workflow fans out into one Job per service line on this
   *  array. UI uses this to show which streams are active before any Job
   *  documents exist. */
  serviceLines: ServiceLine[];

  /** The BIG IDEA — single-sentence campaign theme that drives all creative.
   *  Stage 3 (Strategy Buildup & BIG IDEA Approach) populates this. */
  bigIdea?: string;

  status: CampaignStatus;
  stage: CampaignStage;
  /** Audit log of stage transitions — written by `advanceStage()` service. */
  stageHistory?: StageTransition[];

  brief?: Brief;
  imcTeam: IMCTeamMember[];

  budget?: CampaignBudget;
  /** Campaign-level progress (0–100) — separate from the 14-stage workflow
   *  because some stages overlap in time. */
  progressPct?: number;

  /** Campaign launch & end window. */
  launchDate?: Timestamp | string;
  endDate?: Timestamp | string;

  /** Post-launch report — populated during stage 14 (Performance Review). */
  performanceReview?: PerformanceReview;

  /** ARAAM phase ticks (Analyze, Research, Approach, Action, Measure) — UI
   *  banner across the top of CampaignDetailPage. Each becomes true as the
   *  corresponding workflow stage(s) complete. */
  araam?: {
    analyze?: boolean;
    research?: boolean;
    approach?: boolean;
    action?: boolean;
    measure?: boolean;
  };

  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface StageTransition {
  fromStage: CampaignStage;
  toStage: CampaignStage;
  transitionedAt: Timestamp | string;
  transitionedBy: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// Backwards-compat with AdvisoryProject reads
// ─────────────────────────────────────────────────────────────────

/**
 * A document in `organizations/{orgId}/master_jobs` may be a brand-new
 * Campaign-view (all the agency fields populated) OR a legacy
 * AdvisoryProject that hasn't been migrated yet. This union lets readers
 * handle both during the transition.
 */
export type CampaignOrLegacyProject = Campaign & {
  /** Legacy fields that may exist on AdvisoryProject-shape docs. */
  projectCode?: string;
  customerName?: string;
  programId?: string;
};
