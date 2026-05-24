/**
 * Tier System — Addendum v1.1 §5.
 *
 * Three brief tiers classify every job at intake. The tier sets the
 * minimum lead time (SLA), the feedback window, and the briefing mode
 * (meeting / call / email). Tier flows from engagement → master_job →
 * IWO so a subsidiary always sees the SLA it must meet.
 *
 *   TIER_1 — Creative strategy across all channels.
 *            Min lead: 14 days. Feedback window: 4–5 days. Meeting brief.
 *   TIER_2 — Tactical / problem briefs on a few channels.
 *            Min lead: 7 days. Call + brief on mail.
 *   TIER_3 — Small jobs (document layout, customer/staff notices).
 *            Min lead: 1–2 days. Call, then email.
 */

import type { Timestamp } from 'firebase/firestore';

export type BriefTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type BriefingMode = 'MEETING' | 'CALL' | 'EMAIL';

/**
 * One policy row per tier. Stored at `tier_sla_policy/{tier}` in
 * Firestore — three docs total, seeded by a migration.
 */
export interface TierSlaPolicy {
  tier: BriefTier;
  /** Minimum lead time the assigner will allow, in calendar days. */
  minLeadDays: number;
  /** Days reserved for the feedback / revision window inside lead time. */
  feedbackDays?: number;
  /** How the brief is captured — drives the intake UI affordance. */
  briefingMode: BriefingMode;
  /** Display label used in pickers / RAG dashboards. */
  label: string;
  updatedBy: string;
  updatedAt: Timestamp;
}

/**
 * Tier-driven SLA hours by task priority. Per v1.2 §2.4: the engine
 * couples SLA values to the Tier System so a TIER_1 brief inherits a
 * longer clock than a TIER_3 quick-turn.
 */
export interface TierSlaHoursByPriority {
  critical: number;
  high: number;
  medium: number;
  low: number;
}
