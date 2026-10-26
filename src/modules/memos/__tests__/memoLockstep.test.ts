/**
 * The TypeScript mirrors stay in lockstep with the Cloud Function copies the
 * memoAction callable runs: the route planner, the approval tier, the task
 * keys, the required sections per type and the brand codes. Change both or
 * neither.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { planMemoRoute, routeFieldsForSubmit, canDecideMemo, currentClearanceUid, isAwaitingPerson, describeRoute } from '../utils/memoRoute';
import { resolveMemoApproval, IMPACT_MINIMUM_ROLE, TYPE_MINIMUM_ROLE, isAtLeastAsSenior, describeMemoApproval, type MemoRoutingConfig } from '../utils/memoApproval';
import { memoAckDedupeKey, memoApprovalDedupeKey, memoClearanceDedupeKey, memoReturnedDedupeKey, memoTaskId } from '../utils/memoTasks';
import { MEMO_SUBSIDIARY_CODES, MEMO_TYPES, MEMO_CATEGORIES, MEMO_IMPACTS, requiredSectionKeys, missingRequiredSections, sectionsForType } from '../constants/memoTemplates';
import { MEMO_STATUS_TRANSITIONS } from '../constants/memoStatus';
import { memoNumberPrefix, parseMemoNumber } from '../utils/memoNumber';
import type { MemoHeader, MemoParty } from '../types/memo';

const require = createRequire(import.meta.url);
/* eslint-disable @typescript-eslint/no-require-imports */
const jsRoute = require('../../../../functions/src/memos/lib/memoRoute');
const jsApproval = require('../../../../functions/src/memos/lib/memoApprovalRouting');
const jsTasks = require('../../../../functions/src/memos/lib/memoTasks');
const jsModel = require('../../../../functions/src/memos/lib/memoModel');
const jsNumber = require('../../../../functions/src/memos/lib/memoNumber');
/* eslint-enable @typescript-eslint/no-require-imports */

const AUTHOR = 'author';
const p = (uid: string | undefined, name: string): MemoParty => (uid ? { uid, name, email: `${uid}@x` } : { name });
const header = (to: MemoParty[], through: MemoParty[] = []): Pick<MemoHeader, 'to' | 'through'> => ({ to, through });

describe('route planner', () => {
  const cases: Array<[Pick<MemoHeader, 'to' | 'through'>, boolean]> = [
    [header([p('gloria', 'Gloria')], [p('edmond', 'Edmond'), p('ritah', 'Ritah')]), true],
    [header([p(AUTHOR, 'Me'), p('gloria', 'Gloria')], [p(AUTHOR, 'Me')]), true],
    [header([p(undefined, 'The Board')], [p('edmond', 'Edmond')]), true],
    [header([p('gloria', 'Gloria')], [p('gloria', 'Gloria'), p('edmond', 'Edmond')]), false],
    [header([], []), true],
  ];
  it.each(cases)('agrees with the callable (%#)', (h, required) => {
    const ts = planMemoRoute(h, AUTHOR);
    expect(jsRoute.planMemoRoute(h, AUTHOR)).toEqual(ts);
    expect(jsRoute.routeFieldsForSubmit(ts.route, required)).toEqual(routeFieldsForSubmit(ts.route, required));
  });

  it('never routes to the author and reads in travel order', () => {
    const { route, skipped } = planMemoRoute(header([p(AUTHOR, 'Me'), p('gloria', 'Gloria')], [p(AUTHOR, 'Me'), p('edmond', 'Edmond')]), AUTHOR);
    expect(route.deciders.map((x) => x.uid)).toEqual(['gloria']);
    expect(route.clearance.map((x) => x.uid)).toEqual(['edmond']);
    expect(skipped.map((s) => s.reason)).toEqual(['author', 'author']);
    expect(describeRoute(route)).toBe('Through Edmond, then to Gloria for decision');
    expect(describeRoute(route, false)).toBe('Through Edmond, then issued to Gloria');
  });

  it('who may act matches the callable', () => {
    const atClearance = { status: 'submitted' as const, createdBy: AUTHOR, approval: { stage: 'clearance', clearanceIndex: 1, clearanceUids: ['edmond', 'ritah'], deciderUids: ['gloria'] } };
    const atDecision = { status: 'submitted' as const, createdBy: AUTHOR, approval: { stage: 'decision', deciderUids: ['gloria'] } };
    for (const m of [atClearance, atDecision]) {
      for (const uid of ['edmond', 'ritah', 'gloria', AUTHOR, 'x']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const memo = m as any;
        expect(canDecideMemo(memo, uid, false)).toBe(jsRoute.canDecideMemo(memo, uid, false));
        expect(canDecideMemo(memo, uid, true)).toBe(jsRoute.canDecideMemo(memo, uid, true));
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(currentClearanceUid(m as any)).toBe(jsRoute.currentClearanceUid(m));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isAwaitingPerson(atClearance as any, 'ritah')).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isAwaitingPerson(atClearance as any, 'gloria')).toBe(false);
  });
});

const V2: MemoRoutingConfig = {
  version: 2,
  modules: {
    memo_finance: {
      enabled: true,
      currency: 'KES',
      bands: [
        { id: 'lead', label: 'Lead', maxAmountMinor: 100000, signatures: [{ level: 1, approverRole: 'manager' }] },
        { id: 'brand_md', label: 'Brand MD', maxAmountMinor: 1000000, signatures: [{ level: 1, approverRole: 'admin' }] },
        { id: 'group', label: 'Group', maxAmountMinor: null, signatures: [{ level: 1, approverRole: 'admin' }, { level: 2, approverRole: 'owner' }] },
      ],
    },
  },
};
const AMOUNTS = [0, 50000, 500000, 5000000];

describe('approval tier', () => {
  it('floors agree on both sides', () => {
    expect(jsApproval.IMPACT_MINIMUM_ROLE).toEqual(IMPACT_MINIMUM_ROLE);
    expect(jsApproval.TYPE_MINIMUM_ROLE).toEqual(TYPE_MINIMUM_ROLE);
  });

  it('agrees on every type × category × impact × amount, with and without a ladder', () => {
    for (const cfg of [undefined, V2]) {
      for (const type of MEMO_TYPES) {
        for (const category of MEMO_CATEGORIES) {
          for (const impact of MEMO_IMPACTS) {
            for (const amountMinor of AMOUNTS) {
              const input = { type, category, impact, amountMinor, currency: 'KES' };
              const ts = resolveMemoApproval(input, cfg);
              expect(jsApproval.resolveMemoApproval(input, cfg), JSON.stringify(input)).toEqual(ts);
              if (ts.bandRole) expect(isAtLeastAsSenior(ts.effectiveRole, ts.bandRole)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('agrees on a missing amount, an unknown category, an unknown type and nothing at all', () => {
    for (const input of [
      { type: 'request', category: 'finance', impact: 'medium' },
      { type: 'request', category: 'nonsense', impact: 'medium', amountMinor: 5 },
      { type: 'weird', category: 'admin', impact: 'weird', amountMinor: 5 },
      {},
    ]) {
      expect(jsApproval.resolveMemoApproval(input)).toEqual(resolveMemoApproval(input));
    }
  });

  it('describeMemoApproval names the reason', () => {
    expect(describeMemoApproval(resolveMemoApproval({ type: 'information', category: 'admin', impact: 'low' }))).toMatch(/No approval required/);
    expect(describeMemoApproval(resolveMemoApproval({ type: 'decision', category: 'admin', impact: 'low' }))).toBe('Manager approval (set by memo type)');
    expect(describeMemoApproval(resolveMemoApproval({ type: 'request', category: 'finance', impact: 'low', amountMinor: 500000, currency: 'KES' }, V2))).toBe('Brand MD / director approval (amount band: Brand MD)');
  });
});

describe('task keys, templates, codes, transitions', () => {
  it('spells the task keys the way the callable does', () => {
    expect(memoClearanceDedupeKey('abc', 'u1')).toBe(jsTasks.clearDedupeKey('abc', 'u1'));
    expect(memoApprovalDedupeKey('abc', 'u1')).toBe(jsTasks.approvalDedupeKey('abc', 'u1'));
    expect(memoReturnedDedupeKey('abc', 2)).toBe(jsTasks.returnedDedupeKey('abc', 2));
    expect(memoAckDedupeKey('abc', 'u1')).toBe(jsTasks.ackDedupeKey('abc', 'u1'));
    expect(memoTaskId('memo_clear:abc:u1')).toBe(jsTasks.memoTaskId('memo_clear:abc:u1'));
  });

  it('requires the same sections per type as the callable refuses without', () => {
    for (const type of MEMO_TYPES) {
      expect(requiredSectionKeys(type)).toEqual(jsModel.REQUIRED_SECTION_KEYS[type]);
      const fresh = sectionsForType(type);
      expect(missingRequiredSections(type, fresh)).toEqual(jsModel.missingRequiredSections(type, fresh));
      const filled = fresh.map((s) => ({ ...s, content: 'x' }));
      expect(missingRequiredSections(type, filled)).toEqual([]);
    }
  });

  it('brand codes, number prefixes and transitions agree', () => {
    expect(MEMO_SUBSIDIARY_CODES).toEqual(jsModel.MEMO_SUBSIDIARY_CODES);
    expect(memoNumberPrefix('labyrinth', 2026)).toBe(jsNumber.memoNumberPrefix('labyrinth', 2026));
    expect(parseMemoNumber('MEMO-LAB-2026-012')).toEqual(jsNumber.parseMemoNumber('MEMO-LAB-2026-012'));
    expect(MEMO_STATUS_TRANSITIONS).toEqual(jsModel.MEMO_STATUS_TRANSITIONS);
  });
});
