import { describe, expect, it } from 'vitest';

import { bandForAmount, describeRange, planFromDecision, planSignature, routingDecisionFor, validateBands } from '../engine';
import { DEFAULT_APPROVAL_ROUTING, DEFAULT_SUPPLIER_SPEND_BANDS, kesMinor as KES } from '../types';

describe('routing engine (TS)', () => {
  it('routes the Zeus ladder: 1 / 1 / 2 / 3 signatures', () => {
    const sigs = (amount: number) => routingDecisionFor({ purpose: 'talent', amountMinor: amount, currency: 'KES' }).signatures!.map((s) => s.approverRole);
    expect(sigs(KES(80_000))).toEqual(['manager']);
    expect(sigs(KES(800_000))).toEqual(['admin']);
    expect(sigs(KES(3_000_000))).toEqual(['admin', 'owner']);
    expect(sigs(KES(9_000_000))).toEqual(['admin', 'owner', 'owner']);
  });

  it('purpose picks the lead; overheads start at the brand MD; Tier-1 climbs a band', () => {
    expect(routingDecisionFor({ purpose: 'media', amountMinor: KES(10_000) }).signatures![0].label).toBe('Media lead');
    expect(routingDecisionFor({ purpose: 'overhead', amountMinor: KES(10_000) }).signatures![0].approverRole).toBe('admin');
    expect(routingDecisionFor({ purpose: 'talent', amountMinor: KES(10_000), tier: 'TIER_1' }).band!.id).toBe('brand_md');
    expect(routingDecisionFor({ purpose: null, amountMinor: 1 }).refusal).toBe('purpose_required');
  });

  it('bandForAmount is inclusive and describeRange prints whole units', () => {
    expect(bandForAmount(DEFAULT_SUPPLIER_SPEND_BANDS, KES(100_000)).id).toBe('lead');
    expect(describeRange(DEFAULT_SUPPLIER_SPEND_BANDS, 0, 'KES')).toBe('0 – 100,000 KES');
    expect(describeRange(DEFAULT_SUPPLIER_SPEND_BANDS, 2, 'KES')).toBe('1,000,000 – 5,000,000 KES');
    expect(describeRange(DEFAULT_SUPPLIER_SPEND_BANDS, 3, 'KES')).toBe('Above 5,000,000 KES');
  });

  it('validateBands refuses a ladder whose authority falls as value rises', () => {
    const bands = JSON.parse(JSON.stringify(DEFAULT_SUPPLIER_SPEND_BANDS));
    bands[2].signatures[0].approverRole = 'manager';
    expect(validateBands(bands).join(' ')).toMatch(/more junior/);
    expect(validateBands(DEFAULT_SUPPLIER_SPEND_BANDS)).toEqual([]);
  });

  it('planSignature: raiser refused, seniority gates, distinct signers, completion', () => {
    const plan = planFromDecision(routingDecisionFor({ purpose: 'talent', amountMinor: KES(3_000_000) }, DEFAULT_APPROVAL_ROUTING), 'now');
    expect(planSignature({ plan, caller: { uid: 'r', role: 'owner' }, raiserUid: 'r' })).toMatchObject({ ok: false, code: 'self_approval' });
    expect(planSignature({ plan, caller: { uid: 'm', role: 'manager' }, raiserUid: 'r' })).toMatchObject({ ok: false, code: 'under_tier', requiredRole: 'admin' });
    expect(planSignature({ plan, caller: { uid: 'a', role: 'admin' }, raiserUid: 'r' })).toEqual({ ok: true, level: 1, complete: false, via: 'role' });
    plan.signatures[0].approvedBy = 'a';
    expect(planSignature({ plan, caller: { uid: 'a', role: 'owner' }, raiserUid: 'r' })).toMatchObject({ ok: false, code: 'already_signed' });
    expect(planSignature({ plan, caller: { uid: 'o', role: 'owner' }, raiserUid: 'r' })).toEqual({ ok: true, level: 2, complete: true, via: 'role' });
  });
});
