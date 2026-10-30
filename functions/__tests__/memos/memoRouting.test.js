/**
 * The pure memo libraries: the route follows the header and never the author;
 * the tier is the most senior of band × impact × type; numbers and hashes are
 * stable.
 *
 *    cd functions && node --test __tests__/memos/memoRouting.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { planMemoRoute, routeFieldsForSubmit, currentClearanceUid, canDecideMemo, isClearedForIssue, holderKey } = require('../../src/memos/lib/memoRoute');
const { resolveMemoApproval, memoBandFor, isAtLeastAsSenior, escalationChainFor, mostSeniorRole, IMPACT_MINIMUM_ROLE, TYPE_MINIMUM_ROLE } = require('../../src/memos/lib/memoApprovalRouting');
const { memoNumberPrefix, memoCounterId, parseMemoNumber, memoSubsidiaryCode } = require('../../src/memos/lib/memoNumber');
const { memoContentHash, buildIssuedSnapshot, canonicalJson } = require('../../src/memos/lib/memoSnapshot');
const { missingRequiredSections, issueRecipients, canTransition, isUnsubmittedDraft, memoLabel } = require('../../src/memos/lib/memoModel');
const { memoTaskId, clearDedupeKey, approvalDedupeKey, returnedDedupeKey, ackDedupeKey } = require('../../src/memos/lib/memoTasks');

const AUTHOR = 'author';
const p = (uid, name) => (uid ? { uid, name, email: `${uid}@x` } : { name });

test('planMemoRoute: Through clears in order, then To decides; the author is never routed to', () => {
  const { route, skipped } = planMemoRoute({ to: [p('gloria', 'Gloria'), p(AUTHOR, 'Me')], through: [p('edmond', 'Edmond'), p(AUTHOR, 'Me'), p('ritah', 'Ritah')] }, AUTHOR);
  assert.equal(route.source, 'addressed');
  assert.deepEqual(route.clearance.map((x) => x.uid), ['edmond', 'ritah']);
  assert.deepEqual(route.deciders.map((x) => x.uid), ['gloria']);
  assert.deepEqual(skipped, [{ name: 'Me', list: 'to', reason: 'author' }, { name: 'Me', list: 'through', reason: 'author' }]);
});

test('planMemoRoute: a typed name cannot receive a task; nobody addressable under To → role', () => {
  const { route, skipped } = planMemoRoute({ to: [p(undefined, 'The Board')], through: [p('edmond', 'Edmond')] }, AUTHOR);
  assert.equal(route.source, 'role');
  assert.deepEqual(route.deciders, []);
  assert.deepEqual(route.clearance.map((x) => x.uid), ['edmond']);
  assert.deepEqual(skipped, [{ name: 'The Board', list: 'to', reason: 'not-a-user' }]);
  // Someone under both To and Through decides and does not also clear.
  const both = planMemoRoute({ to: [p('gloria', 'Gloria')], through: [p('gloria', 'Gloria'), p('edmond', 'Edmond')] }, AUTHOR).route;
  assert.deepEqual(both.clearance.map((x) => x.uid), ['edmond']);
});

test('routeFieldsForSubmit starts at the first Through party; a no-decision memo has no deciders', () => {
  const { route } = planMemoRoute({ to: [p('gloria', 'Gloria')], through: [p('edmond', 'Edmond')] }, AUTHOR);
  const f = routeFieldsForSubmit(route);
  assert.deepEqual(f.approval, { route, stage: 'clearance', clearanceIndex: 0, clearanceUids: ['edmond'], deciderUids: ['gloria'], clearances: [] });
  assert.deepEqual(f.routeUids, ['edmond', 'gloria']);
  assert.equal(routeFieldsForSubmit(planMemoRoute({ to: [p('gloria', 'Gloria')] }, AUTHOR).route).approval.stage, 'decision');
  const none = routeFieldsForSubmit(route, false);
  assert.deepEqual(none.approval.deciderUids, []);
  assert.equal(none.approval.stage, 'clearance');
});

test('who may act: the Through party whose turn it is; an addressee once cleared; an admin may cover; never the author', () => {
  const atClearance = { status: 'submitted', createdBy: AUTHOR, approval: { stage: 'clearance', clearanceIndex: 1, clearanceUids: ['edmond', 'ritah'], deciderUids: ['gloria'] } };
  const atDecision = { status: 'submitted', createdBy: AUTHOR, approval: { stage: 'decision', clearanceUids: ['edmond'], deciderUids: ['gloria'] } };
  assert.equal(currentClearanceUid(atClearance), 'ritah');
  assert.equal(currentClearanceUid(atDecision), null);
  assert.equal(canDecideMemo(atDecision, 'gloria', false), true);
  assert.equal(canDecideMemo(atDecision, 'edmond', false), false);
  assert.equal(canDecideMemo(atClearance, 'gloria', false), false);
  assert.equal(canDecideMemo(atDecision, 'someone', true), true);
  assert.equal(canDecideMemo({ status: 'submitted', createdBy: AUTHOR, approval: { stage: 'decision', deciderUids: [AUTHOR] } }, AUTHOR, true), false);
  assert.equal(isClearedForIssue({ status: 'submitted', approval: { stage: 'cleared' } }), true);
  assert.equal(holderKey(atClearance), 'clearance:1:ritah');
  assert.equal(holderKey(atDecision), 'decision:gloria');
  assert.equal(holderKey({ status: 'issued' }), '');
});

test('tier: information / record with low impact and no amount need nobody; decision always needs a manager; directive and high impact need an admin', () => {
  for (const type of ['information', 'record']) {
    const r = resolveMemoApproval({ type, category: 'admin', impact: 'low' });
    assert.equal(r.required, false);
    assert.equal(r.effectiveRole, null);
    assert.equal(r.roleChain, null);
  }
  const d = resolveMemoApproval({ type: 'decision', category: 'finance', impact: 'low', amountMinor: 0 });
  assert.equal(d.required, true);
  assert.equal(d.effectiveRole, 'manager');
  assert.equal(d.raisedBy, 'type');
  assert.equal(d.bandEnabled, false);
  assert.deepEqual(d.roleChain, ['manager', 'admin', 'owner']);
  assert.equal(resolveMemoApproval({ type: 'directive', category: 'admin', impact: 'low' }).effectiveRole, 'admin');
  const hi = resolveMemoApproval({ type: 'information', category: 'admin', impact: 'high' });
  assert.equal(hi.effectiveRole, 'admin');
  assert.equal(hi.raisedBy, 'impact');
  assert.deepEqual(IMPACT_MINIMUM_ROLE, { low: null, medium: 'manager', high: 'admin' });
  assert.deepEqual(TYPE_MINIMUM_ROLE, { decision: 'manager', request: 'manager', information: null, directive: 'admin', record: null });
});

const V2 = {
  version: 2,
  modules: {
    memo_finance: {
      entityType: 'memo_finance', label: 'Finance memos', currency: 'KES', enabled: true,
      bands: [
        { id: 'lead', label: 'Lead', maxAmountMinor: 100000, signatures: [{ level: 1, label: 'Lead', approverRole: 'manager' }] },
        { id: 'brand_md', label: 'Brand MD', maxAmountMinor: 1000000, signatures: [{ level: 1, label: 'MD', approverRole: 'admin' }] },
        { id: 'group', label: 'Group', maxAmountMinor: null, signatures: [{ level: 1, label: 'MD', approverRole: 'admin' }, { level: 2, label: 'CEO', approverRole: 'owner' }] },
      ],
    },
  },
};

test('tier: the amount band comes from a v2 module on systemSettings/approvalRouting; a memo stating no amount is not banded', () => {
  const none = resolveMemoApproval({ type: 'information', category: 'finance', impact: 'low' }, V2);
  assert.equal(none.required, false);
  assert.equal(none.bandEnabled, true);
  assert.equal(none.bandId, null);
  const lead = resolveMemoApproval({ type: 'request', category: 'finance', impact: 'low', amountMinor: 50000, currency: 'KES' }, V2);
  assert.equal(lead.bandId, 'lead');
  assert.equal(lead.effectiveRole, 'manager');
  assert.equal(lead.raisedBy, 'band', 'band and type tie at manager — the band is credited first, as in DawinOS');
  const md = resolveMemoApproval({ type: 'request', category: 'finance', impact: 'low', amountMinor: 500000, currency: 'KES' }, V2);
  assert.equal(md.bandId, 'brand_md');
  assert.equal(md.effectiveRole, 'admin');
  assert.equal(md.raisedBy, 'band');
  const group = resolveMemoApproval({ type: 'request', category: 'finance', impact: 'low', amountMinor: 40000000, currency: 'UGX' }, V2);
  assert.equal(group.effectiveRole, 'owner', 'the top band asks for the most senior of its signatures');
  assert.equal(group.currencyMismatch, true);
  assert.equal(memoBandFor('memo_admin', 5, V2).enabled, false, 'a category with no module is unbanded');
});

test('tier: impact can only RAISE the band result, never lower it — for every combination', () => {
  const high = resolveMemoApproval({ type: 'request', category: 'finance', impact: 'high', amountMinor: 50000, currency: 'KES' }, V2);
  assert.equal(high.bandRole, 'manager');
  assert.equal(high.effectiveRole, 'admin');
  assert.equal(high.raisedBy, 'impact');
  for (const cfg of [undefined, V2]) {
    for (const type of ['decision', 'request', 'information', 'directive', 'record']) {
      for (const category of ['finance', 'admin', 'operations']) {
        for (const impact of ['low', 'medium', 'high']) {
          for (const amountMinor of [0, 50000, 500000, 5000000]) {
            const r = resolveMemoApproval({ type, category, impact, amountMinor, currency: 'KES' }, cfg);
            if (r.bandRole) assert.ok(isAtLeastAsSenior(r.effectiveRole, r.bandRole), JSON.stringify({ type, category, impact, amountMinor }));
            if (r.required) assert.equal(r.roleChain[0], r.effectiveRole);
            else assert.equal(r.bandRole, null);
          }
        }
      }
    }
  }
  assert.deepEqual(escalationChainFor('admin'), ['admin', 'owner']);
  assert.equal(mostSeniorRole([null, 'member', 'admin', 'manager']), 'admin');
  assert.equal(mostSeniorRole([null, undefined]), null);
});

test('numbers: MEMO-<SUB>-<YYYY>-<NNN> per brand per year', () => {
  assert.equal(memoNumberPrefix('zeus-the-agency', 2026), 'MEMO-ZTA-2026');
  assert.equal(memoNumberPrefix('zeus-group', 2026), 'MEMO-GRP-2026');
  assert.equal(memoSubsidiaryCode('unknown-brand'), 'UNK');
  assert.equal(memoCounterId('labyrinth', 2026), 'memos_labyrinth_2026');
  assert.deepEqual(parseMemoNumber('MEMO-ZTA-2026-004'), { code: 'ZTA', year: 2026, sequence: 4 });
  assert.equal(parseMemoNumber('nope'), null);
});

test('snapshot: the content hash is stable across key order and ignores disabled sections and undefineds', () => {
  const base = {
    memoNumber: 'MEMO-ZTA-2026-001', version: 1,
    header: { to: [p('g', 'G')], from: p('a', 'A'), through: [], cc: [], date: '2026-10-26' },
    sections: [{ key: 'purpose', heading: 'Purpose', content: 'x', enabled: true }, { key: 'risks', heading: 'Risks', content: 'off', enabled: false }],
    links: [], attachments: [{ id: 'a1', name: 'q.pdf', url: 'u', storagePath: 's' }], distribution: [], amountMinor: 5, currency: 'KES',
  };
  const reordered = { ...base, header: { date: '2026-10-26', cc: [], through: [], from: p('a', 'A'), to: [p('g', 'G')] }, extra: undefined };
  assert.equal(memoContentHash(base), memoContentHash(reordered));
  assert.notEqual(memoContentHash(base), memoContentHash({ ...base, sections: [{ ...base.sections[0], content: 'y' }] }));
  assert.match(memoContentHash(base), /^[0-9a-f]{64}$/);
  const snap = buildIssuedSnapshot(base, { issuedAt: '2026-10-26T10:00:00.000Z', issuedBy: 'a' });
  assert.equal(snap.contentHash, memoContentHash(base));
  assert.equal(snap.amountMinor, 5);
  assert.throws(() => buildIssuedSnapshot({ ...base, memoNumber: undefined }, { issuedAt: 'x', issuedBy: 'a' }), /memo number/);
  assert.equal(canonicalJson({ b: 1, a: [undefined, null, 2] }), '{"a":[null,null,2],"b":1}');
});

test('model: required sections per type, recipients never include the author, transitions, labels', () => {
  assert.deepEqual(missingRequiredSections('decision', [{ key: 'purpose', heading: 'Purpose', content: 'x', enabled: true }]), ['recommendation']);
  assert.deepEqual(missingRequiredSections('directive', [
    { key: 'purpose', heading: 'Purpose', content: 'x', enabled: true },
    { key: 'policy', heading: 'Policy / instruction', content: 'y', enabled: true },
    { key: 'effective_date', heading: 'Effective date & scope', content: '', enabled: true },
  ]), ['Effective date & scope']);
  const memo = {
    createdBy: 'a',
    header: { to: [p('t', 'T'), p('a', 'A')], through: [p('th', 'Th')], cc: [p('c', 'C'), { name: 'Typed' }], from: p('a', 'A') },
    distribution: [{ uid: 'd', name: 'D', role: 'ack', requiresAck: true }, { uid: 't', name: 'T', role: 'to', requiresAck: false }],
  };
  assert.deepEqual(issueRecipients(memo).map((r) => [r.uid, r.role, r.requiresAck]), [['d', 'ack', true], ['t', 'to', false], ['th', 'through', false], ['c', 'cc', false]]);
  assert.equal(canTransition('draft', 'issued'), true);
  assert.equal(canTransition('issued', 'draft'), false);
  assert.equal(isUnsubmittedDraft({ status: 'draft', version: 0 }), true);
  assert.equal(isUnsubmittedDraft({ status: 'draft', version: 1, memoNumber: 'x' }), false);
  assert.equal(memoLabel({ memoNumber: 'MEMO-ZTA-2026-001', subject: 'Hire  a   generator' }), 'MEMO-ZTA-2026-001: Hire a generator');
  assert.equal(memoLabel({ subject: 'Draft' }), 'Draft');
});

test('task keys: one task per PERSON on the route, spelled the same way the client does', () => {
  assert.equal(clearDedupeKey('abc', 'u1'), 'memo_clear:abc:u1');
  assert.equal(approvalDedupeKey('abc', 'u1'), 'memo_approval:abc:u1');
  assert.equal(returnedDedupeKey('abc', 2), 'memo_returned:abc:2');
  assert.equal(ackDedupeKey('abc', 'u1'), 'memo_ack:abc:u1');
  assert.equal(memoTaskId('memo_clear:abc:u1'), 'memo__memo_clear__abc__u1');
});
