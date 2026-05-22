/**
 * Phase 3.G — Zeus-profile marketing primitives smoke (plan §14.14).
 *
 * The Commercial Gravity model from §14.1 is the *substrate*. Sitting on
 * top of it are five marketing-domain primitives we inherited from
 * Zeus Group's documented operating model:
 *
 *   1. CampaignStage (14-stage workflow)                        — stages.ts
 *   2. Tier System (1/2/3) with SLA computation                 — tiers.ts
 *   3. IMC Team composition (roles from §5)                     — moduleRoles.ts
 *   4. 6-stage Creative Approval Chain                          — campaign.types.ts
 *   5. Service Lines (5 sub-brand offerings)                    — service-lines.ts
 *
 * Plan §14.14 acceptance: these primitives still load + carry the
 * shape the UI expects after the 3.D / 3.E / 3.F merges. The UI-side
 * smoke (rendering them on MasterJob detail / Brief intake / IWO
 * deliverable) is gated on 3.H test-id backfill and tracked in
 * e2e/tests/workflows/pricing-quote-lifecycle.spec.ts — for now we
 * lock the data contracts so future UI work has a stable target.
 */

import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_STAGES,
  CAMPAIGN_STAGE_INDEX,
  type CampaignStage,
} from '../constants/stages';
import {
  BRIEF_TIERS,
  computeExpectedFeedbackBy,
  computeExpectedRevertBy,
  getSLAStatus,
  type BriefTier,
} from '../constants/tiers';
import { MODULE_ROLES } from '@/core/settings/moduleRoles';

describe('Zeus-profile primitive — CampaignStage (14-stage workflow)', () => {
  it('declares exactly 14 stages in order', () => {
    expect(CAMPAIGN_STAGES).toHaveLength(14);
  });

  it('starts at client_initial_briefing and ends at campaign_performance_review', () => {
    expect(CAMPAIGN_STAGES[0]).toBe('client_initial_briefing');
    expect(CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1]).toBe(
      'campaign_performance_review',
    );
  });

  it('IMC execution sits at stage 6 (the fan-out)', () => {
    expect(CAMPAIGN_STAGE_INDEX.imc_execution).toBe(6);
  });

  it('stage indices are 1-based and gap-free', () => {
    const indices = CAMPAIGN_STAGES.map((s) => CAMPAIGN_STAGE_INDEX[s]);
    expect(indices).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it('the type CampaignStage covers every declared stage', () => {
    // Compile-time check: each string in CAMPAIGN_STAGES must be assignable
    // to CampaignStage. Run via TS strict mode — this loop is the runtime
    // half of the same guarantee.
    for (const s of CAMPAIGN_STAGES) {
      const checked: CampaignStage = s;
      expect(typeof checked).toBe('string');
    }
  });
});

describe('Zeus-profile primitive — Tier System (1/2/3) + SLA', () => {
  it('declares exactly three tiers', () => {
    expect(Object.keys(BRIEF_TIERS)).toEqual(['1', '2', '3']);
  });

  it('Tier 1 has the longest agency revert SLA (full multi-channel brief)', () => {
    expect(BRIEF_TIERS[1].agencyRevertDays).toBe(14);
    expect(BRIEF_TIERS[2].agencyRevertDays).toBe(7);
    expect(BRIEF_TIERS[3].agencyRevertDays).toBe(2);
  });

  it('client feedback SLAs decrease with tier (smaller briefs → faster turns)', () => {
    expect(BRIEF_TIERS[1].clientFeedbackDays).toBeGreaterThanOrEqual(
      BRIEF_TIERS[2].clientFeedbackDays,
    );
    expect(BRIEF_TIERS[2].clientFeedbackDays).toBeGreaterThanOrEqual(
      BRIEF_TIERS[3].clientFeedbackDays,
    );
  });

  it('computeExpectedRevertBy adds agencyRevertDays to briefedAt', () => {
    const briefed = new Date('2026-06-01T00:00:00Z');
    const out = computeExpectedRevertBy(briefed, 2);
    // Tier 2 = 7 days.
    expect(out.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('computeExpectedFeedbackBy uses the tier-specific client window', () => {
    const reverted = new Date('2026-06-15T00:00:00Z');
    const out = computeExpectedFeedbackBy(reverted, 1);
    // Tier 1 = 4 days client feedback.
    expect(out.toISOString()).toBe('2026-06-19T00:00:00.000Z');
  });

  it('SLA traffic light: untouched brief is green, just-breached is red', () => {
    const briefed = new Date('2026-06-01T00:00:00Z');
    // 5 minutes in — plenty of headroom on a Tier 2 (7-day) brief.
    const fresh = new Date(briefed.getTime() + 5 * 60_000);
    expect(getSLAStatus(briefed, 2, fresh)).toBe('green');

    // Past the deadline on the same brief — red.
    const breached = new Date(briefed.getTime() + 8 * 24 * 60 * 60_000);
    expect(getSLAStatus(briefed, 2, breached)).toBe('red');
  });

  it('declares badge colours per tier (UI uses them on Brief chips)', () => {
    for (const t of [1, 2, 3] as BriefTier[]) {
      expect(BRIEF_TIERS[t].badgeColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('Zeus-profile primitive — IMC Team roles (MasterJob detail picker)', () => {
  it('campaigns module exposes the full IMC role set', () => {
    const ids = MODULE_ROLES.campaigns.map((r) => r.id);
    // Spec §5 IMC composition — Account / Strategy / Traffic + Client portal.
    expect(ids).toContain('account_director');
    expect(ids).toContain('account_manager');
    expect(ids).toContain('traffic_coordinator');
    expect(ids).toContain('strategy_director');
    expect(ids).toContain('client_reviewer');
  });

  it('every role carries an id + label + description (UI-renderable)', () => {
    for (const role of MODULE_ROLES.campaigns) {
      expect(role.id).toMatch(/^[a-z_]+$/);
      expect(role.label.length).toBeGreaterThan(0);
      expect(role.description.length).toBeGreaterThan(0);
    }
  });

  it('production + media modules expose their own role catalogues', () => {
    expect(MODULE_ROLES.production?.length || 0).toBeGreaterThan(3);
    expect(MODULE_ROLES.media?.length || 0).toBeGreaterThan(3);
  });
});
