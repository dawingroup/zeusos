/**
 * The Tier System — Zeus's proprietary brief classification with SLA-enforced
 * turnaround windows (profile pp. 46–49). This is the single most
 * differentiating operational feature in ZeusOS: every brief is classified at
 * intake into Tier 1 / 2 / 3 and the system auto-computes the agency revert
 * SLA + client feedback SLA from `briefedAt`.
 */

export type BriefTier = 1 | 2 | 3;

export interface TierDefinition {
  tier: BriefTier;
  label: string;
  scope: string;
  briefingChannel: string;
  /** Days from `briefedAt` for the agency's insight-led revert. */
  agencyRevertDays: number;
  /** Days from `revertSubmittedAt` for the client's consolidated feedback. */
  clientFeedbackDays: number;
  badgeColor: string;
}

export const BRIEF_TIERS: Record<BriefTier, TierDefinition> = {
  1: {
    tier: 1,
    label: 'Tier 1',
    scope: 'Full multi-channel creative strategy (ATL, Digital, OOH, BTL, PR, Media)',
    briefingChannel: 'In-person / virtual meeting + email',
    agencyRevertDays: 14,
    clientFeedbackDays: 4, // profile says 4–5; use 4 as the alert threshold
    badgeColor: '#E63946',
  },
  2: {
    tier: 2,
    label: 'Tier 2',
    scope: 'Tactical / problem briefs on a few channels (digital, BTL POS, emailers)',
    briefingChannel: 'Phone / virtual + email',
    agencyRevertDays: 7,
    clientFeedbackDays: 2,
    badgeColor: '#F59E0B',
  },
  3: {
    tier: 3,
    label: 'Tier 3',
    scope: 'Small jobs (document layout, customer / staff notice)',
    briefingChannel: 'Phone + email',
    agencyRevertDays: 2, // profile says 1–2; use the upper bound for SLA timer
    clientFeedbackDays: 1, // "immediate"
    badgeColor: '#10B981',
  },
};

/**
 * Compute the `expectedRevertBy` timestamp for a brief.
 */
export function computeExpectedRevertBy(briefedAt: Date, tier: BriefTier): Date {
  const def = BRIEF_TIERS[tier];
  return new Date(briefedAt.getTime() + def.agencyRevertDays * 24 * 60 * 60 * 1000);
}

/**
 * Compute the `expectedFeedbackBy` timestamp after the agency reverts.
 */
export function computeExpectedFeedbackBy(revertedAt: Date, tier: BriefTier): Date {
  const def = BRIEF_TIERS[tier];
  return new Date(revertedAt.getTime() + def.clientFeedbackDays * 24 * 60 * 60 * 1000);
}

/**
 * Returns SLA-traffic-light status for a brief's revert deadline.
 *   green:  > 50% of SLA remaining
 *   amber:  10–50% remaining
 *   red:    < 10% remaining, or breached
 */
export function getSLAStatus(
  briefedAt: Date,
  tier: BriefTier,
  now: Date = new Date()
): 'green' | 'amber' | 'red' {
  const def = BRIEF_TIERS[tier];
  const slaMs = def.agencyRevertDays * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - briefedAt.getTime();
  const remainingRatio = 1 - elapsedMs / slaMs;
  if (remainingRatio < 0.1) return 'red';
  if (remainingRatio < 0.5) return 'amber';
  return 'green';
}
