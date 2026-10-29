/**
 * Lockstep: the TypeScript routing engine (what the settings page validates
 * and previews with) must agree with the CommonJS engine the Cloud Functions
 * sign with. Both are loaded here and compared on the defaults, a grid of
 * decisions, every validation case, signature planning, and the
 * machine-actor list.
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import * as ts from '../engine';
import * as tsPolicy from '../policy';
import { DEFAULT_APPROVAL_ROUTING, kesMinor as KES, type ApprovalRoutingConfig, type RoutingInput } from '../types';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const js = require('../../../../../functions/src/approvals/routing.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsPolicy = require('../../../../../functions/src/approvals/policy.js');

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('routing v2 lockstep (TS mirror ↔ CFn engine)', () => {
  it('ships identical defaults', () => {
    expect(clone(DEFAULT_APPROVAL_ROUTING)).toEqual(clone(js.DEFAULT_APPROVAL_ROUTING));
    expect(ts.escalationChainFor('manager')).toEqual(js.escalationChainFor('manager'));
  });

  it('reaches the same decision on a grid of amounts × purposes × tiers × configs', () => {
    const custom: ApprovalRoutingConfig = clone(DEFAULT_APPROVAL_ROUTING);
    custom.modules.supplier_spend.purposeRules[0] = {
      id: 'media', purpose: 'media', label: 'Media',
      primary: { label: 'Media lead', approverRole: 'manager' },
      escalateAboveMinor: KES(50_000), requireAnyLink: true,
      escalateTo: { label: 'Brand MD', approverRole: 'admin' },
    };
    custom.modules.supplier_spend.aggregateRules = [
      { id: 'supplier30', kind: 'supplier_rolling', label: 'Supplier 30d', thresholdMinor: KES(1_000_000), windowDays: 30, adds: { level: 2, label: 'Group Finance', approverRole: 'admin', approverEmail: 'finance@zeus.test' } },
      { id: 'budget', kind: 'master_job_budget_pct', label: 'Budget', thresholdPct: 80, adds: { label: 'Zeus Group CEO', approverRole: 'owner' } },
    ];
    const relaxed: ApprovalRoutingConfig = clone(DEFAULT_APPROVAL_ROUTING);
    relaxed.modules.supplier_spend.requirePurpose = false;

    const amounts = [0, KES(1), KES(100_000), KES(100_000) + 1, KES(999_999), KES(1_000_000), KES(3_000_000), KES(5_000_000), KES(5_000_001), KES(80_000_000), Number.NaN];
    const purposes = ['media', 'production', 'talent', 'overhead', null, 'snacks'];
    const tiers = [undefined, 'TIER_1', 'TIER_2', 'TIER_3', 'MYSTERY'];
    const aggregates = [undefined, { supplierRollingMinor: KES(990_000), masterJobBudgetPct: 95 }, { masterJobBudgetPct: null }];
    const links = [undefined, { masterJobId: 'mj' }];
    let compared = 0;
    for (const config of [DEFAULT_APPROVAL_ROUTING, custom, relaxed]) {
      for (const amountMinor of amounts) for (const purpose of purposes) for (const tier of tiers) for (const agg of aggregates) for (const link of links) {
        const input: RoutingInput = { purpose, amountMinor, currency: 'KES', tier, aggregates: agg, links: link };
        expect(clone(ts.routingDecisionFor(input, config))).toEqual(clone(js.routingDecisionFor(input, config)));
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(1000);
  });

  it('flags currency mismatch identically', () => {
    const input: RoutingInput = { purpose: 'talent', amountMinor: KES(1), currency: 'UGX' };
    expect(ts.routingDecisionFor(input).currencyMismatch).toBe(true);
    expect(js.routingDecisionFor(input).currencyMismatch).toBe(true);
  });

  it('reports the same validation problems on the same broken configs', () => {
    const cases: Array<(c: ApprovalRoutingConfig) => void> = [
      (c) => { c.modules.supplier_spend.bands[1].signatures[0].approverRole = 'member'; },
      (c) => { c.modules.supplier_spend.bands[3].signatures = [c.modules.supplier_spend.bands[3].signatures[0]]; },
      (c) => { c.modules.supplier_spend.bands[2].signatures[1].level = 3; },
      (c) => { c.modules.supplier_spend.bands[3].maxAmountMinor = 1; },
      (c) => { c.modules.supplier_spend.bands[1].maxAmountMinor = 1; },
      (c) => { c.modules.supplier_spend.bands = []; },
      (c) => { c.modules.supplier_spend.purposeRules.push({ id: 'dup', purpose: 'media', label: 'Dup', primary: { label: 'x', approverRole: 'manager' } }); },
      (c) => { c.modules.supplier_spend.purposeRules[0].escalateAboveMinor = 5; },
      (c) => { c.modules.supplier_spend.purposeRules[0].escalateTo = { label: 'Junior', approverRole: 'member' }; },
      (c) => { c.modules.supplier_spend.aggregateRules = [{ id: 'x', kind: 'weekly_cash', label: 'x', thresholdMinor: -1, adds: { label: 'x', approverRole: 'owner' } }]; },
      (c) => { c.modules.supplier_spend.aggregateRules = [{ id: 'x', kind: 'supplier_rolling', label: 'x', thresholdMinor: 1, windowDays: 0, adds: { label: 'x', approverRole: 'owner' } }]; },
      (c) => { c.modules.supplier_spend.aggregateRules = [{ id: 'x', kind: 'master_job_budget_pct', label: 'x', thresholdPct: 150, adds: { label: 'x', approverRole: 'owner' } }]; },
      (c) => { c.modules.supplier_spend.tierBandRaise = { TIER_1: -1 }; },
    ];
    for (const mutate of cases) {
      const c = clone(DEFAULT_APPROVAL_ROUTING);
      mutate(c);
      const a = ts.validateApprovalRouting(c);
      const b = js.validateApprovalRouting(c);
      expect(a).toEqual(b);
      expect(Object.keys(a).length, 'each broken case must be reported').toBeGreaterThan(0);
    }
    expect(ts.validateApprovalRouting(DEFAULT_APPROVAL_ROUTING)).toEqual({});
    expect(js.validateApprovalRouting(DEFAULT_APPROVAL_ROUTING)).toEqual({});
  });

  it('plans and judges signatures identically', () => {
    const decision = ts.routingDecisionFor({ purpose: 'talent', amountMinor: KES(3_000_000), currency: 'KES' });
    const planTs = ts.planFromDecision(decision, '2026-10-25T00:00:00Z');
    const planJs = js.planFromDecision(js.routingDecisionFor({ purpose: 'talent', amountMinor: KES(3_000_000), currency: 'KES' }), '2026-10-25T00:00:00Z');
    expect(clone(planTs)).toEqual(clone(planJs));

    const callers = [
      { uid: 'raiser', role: 'owner' },
      { uid: 'mgr', role: 'manager' },
      { uid: 'md', role: 'admin' },
      { uid: 'ceo', role: 'owner' },
      { uid: 'pinned', role: 'member', email: 'CEO@zeus.test' },
    ];
    for (const caller of callers) {
      expect(ts.planSignature({ plan: planTs, caller, raiserUid: 'raiser' })).toEqual(js.planSignature({ plan: planJs, caller, raiserUid: 'raiser' }));
    }
    planTs.signatures[0].approvedBy = 'md';
    planJs.signatures[0].approvedBy = 'md';
    planTs.signatures[1].approverEmail = 'ceo@zeus.test';
    planJs.signatures[1].approverEmail = 'ceo@zeus.test';
    for (const caller of callers) {
      expect(ts.planSignature({ plan: planTs, caller, raiserUid: 'raiser', pinnedUids: ['mgr'] })).toEqual(
        js.planSignature({ plan: planJs, caller, raiserUid: 'raiser', pinnedUids: ['mgr'] }),
      );
    }
  });

  it('agrees on who is a machine actor', () => {
    expect(tsPolicy.MACHINE_ACTOR_PATTERNS.map((r) => [r.source, r.flags])).toEqual(
      (jsPolicy.MACHINE_ACTOR_PATTERNS as RegExp[]).map((r) => [r.source, r.flags]),
    );
    for (const v of ['current-user', 'agent:x', 'K3jd92nfA0sdf8sdf', '', null]) {
      expect(tsPolicy.isMachineActor(v)).toBe(jsPolicy.isMachineActor(v));
    }
  });
});
