/**
 * memoAction — RUN against the in-memory Firestore: a submitted memo is
 * numbered, versioned and routed; the Through party clears it; an addressee
 * (never the author) decides; issue freezes the snapshot and tells the
 * distribution list; every step is ONE task in generated_tasks, completed by
 * the same key when the memo moves on.
 *
 *    cd functions && node --test __tests__/memos/memoAction.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { handleMemoAction } = require('../../src/memos/callables/memoAction');
const { memoTaskId } = require('../../src/memos/lib/memoTasks');

const quiet = { info() {}, warn() {}, error() {} };
const NOW = '2026-10-26T09:00:00.000Z';
const auth = (uid, email) => ({ uid, token: { email: email || `${uid}@zeus.co.ke`, name: uid } });
const party = (uid, name) => ({ uid, name, email: `${uid}@zeus.co.ke` });

const PEOPLE = {
  'u-author': { displayName: 'Amina Author', globalRole: 'member' },
  'u-ben': { displayName: 'Ben Through', globalRole: 'manager' },
  'u-grace': { displayName: 'Grace Admin', globalRole: 'admin' },
  'u-zuri': { displayName: 'Zuri Owner', globalRole: 'owner' },
  'u-cc': { displayName: 'Carol Copy', globalRole: 'member' },
};

function seed(db, people = PEOPLE) {
  for (const [uid, u] of Object.entries(people)) {
    db._seed(`users/${uid}`, { uid, email: `${uid}@zeus.co.ke`, isActive: true, ...u });
  }
}

const SECTIONS = {
  request: [
    { key: 'purpose', heading: 'Purpose', content: 'Hire a generator for six weeks.', enabled: true },
    { key: 'recommendation', heading: 'Request', content: 'Approve KES 180,000.', enabled: true },
  ],
  information: [
    { key: 'purpose', heading: 'Purpose', content: 'Office closed on Friday.', enabled: true },
    { key: 'details', heading: 'Details', content: 'Deep clean.', enabled: true },
  ],
  decision: [
    { key: 'purpose', heading: 'Purpose', content: 'Decide the venue.', enabled: true },
    { key: 'recommendation', heading: 'Recommendation', content: 'Option B.', enabled: true },
  ],
};

function draft(db, id, over = {}) {
  const type = over.type || 'request';
  const memo = {
    subsidiaryId: 'zeus-the-agency',
    type,
    category: 'finance',
    impact: 'medium',
    confidential: false,
    subject: 'Generator hire for the Diageo shoot',
    header: { to: [party('u-grace', 'Grace Admin')], from: party('u-author', 'Amina Author'), through: [party('u-ben', 'Ben Through')], cc: [party('u-cc', 'Carol Copy')], date: '2026-10-26' },
    amountMinor: 180000,
    currency: 'KES',
    sections: SECTIONS[type],
    attachments: [],
    links: [],
    distribution: [{ uid: 'u-cc', name: 'Carol Copy', role: 'ack', requiresAck: true }],
    distributionUids: ['u-cc'],
    acknowledgements: {},
    status: 'draft',
    statusHistory: [{ from: null, to: 'draft', by: 'u-author', byName: 'Amina Author', at: NOW }],
    version: 0,
    createdBy: 'u-author',
    createdByName: 'Amina Author',
    createdAt: NOW,
    updatedAt: NOW,
    updatedBy: 'u-author',
    ...over,
  };
  db._seed(`memos/${id}`, memo);
  return memo;
}

const act = (db, uid, data, deps = {}) => handleMemoAction(db, auth(uid), data, { nowIso: NOW, logger: quiet, ...deps });
const memo = (db, id) => db._store.get(`memos/${id}`);
const task = (db, key) => db._store.get(`generated_tasks/${memoTaskId(key)}`);
const openTasks = (db) => db._dump_prefix('generated_tasks').map((t) => t.data).filter((t) => t.status !== 'completed' && t.status !== 'cancelled');

test('submit is the author\'s, and refuses an unaddressed or unfinished memo', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'm0');
  await assert.rejects(act(db, 'u-ben', { action: 'submit', memoId: 'm0' }), (e) => e.code === 'permission-denied');
  draft(db, 'm1', { header: { to: [], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-26' } });
  await assert.rejects(act(db, 'u-author', { action: 'submit', memoId: 'm1' }), (e) => e.code === 'failed-precondition' && /Address/.test(e.message));
  draft(db, 'm2', { sections: [SECTIONS.request[0]] });
  await assert.rejects(act(db, 'u-author', { action: 'submit', memoId: 'm2' }), (e) => /required sections/.test(e.message));
  await assert.rejects(act(db, 'u-author', { action: 'submit', memoId: 'nope' }), (e) => e.code === 'not-found');
  await assert.rejects(act(db, 'u-author', { action: 'dance', memoId: 'm0' }), (e) => e.code === 'invalid-argument');
  assert.equal(db._dump_prefix('generated_tasks').length, 0);
});

test('the whole route: submit → clear → decide → issue → acknowledge, one task per step, never one for the author', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'm1');

  // ── submit
  const s = await act(db, 'u-author', { action: 'submit', memoId: 'm1' });
  assert.equal(s.status, 'submitted');
  assert.equal(s.memoNumber, 'MEMO-ZTA-2026-001');
  assert.equal(s.version, 1);
  let m = memo(db, 'm1');
  assert.equal(m.status, 'submitted');
  assert.equal(m.approval.required, true);
  assert.equal(m.approval.effectiveRole, 'manager', 'request + medium impact, no band → manager');
  assert.equal(m.approval.stage, 'clearance');
  assert.deepEqual(m.approval.clearanceUids, ['u-ben']);
  assert.deepEqual(m.approval.deciderUids, ['u-grace']);
  assert.deepEqual(m.routeUids, ['u-ben', 'u-grace']);
  assert.equal(m.statusHistory.at(-1).to, 'submitted');
  assert.ok(db._store.get('memos/m1/versions/v1'), 'what was submitted is kept');
  assert.equal(db._store.get('memos/m1/versions/v1').submittedBy, 'u-author');
  assert.equal(db._store.get('memo_counters/memos_zeus-the-agency_2026').next, 2);

  let open = openTasks(db);
  assert.equal(open.length, 1);
  assert.equal(open[0].id, memoTaskId('memo_clear:m1:u-ben'));
  assert.equal(open[0].assignedToUserId, 'u-ben');
  assert.equal(open[0].kind, 'review');
  assert.equal(open[0].status, 'assigned');
  assert.equal(open[0].entityType, 'memo');
  assert.equal(open[0].entityId, 'm1');
  assert.equal(open[0].sourceModule, 'memos');
  assert.equal(open[0].priority, 'P2');
  assert.match(open[0].description, /then to the people it is addressed to/);
  assert.equal(open[0].idempotencyKey, 'memo_clear:m1:u-ben');

  // Nobody else may clear; the author may not decide; it is not yet decidable.
  await assert.rejects(act(db, 'u-grace', { action: 'clear', memoId: 'm1', outcome: 'cleared' }), (e) => e.code === 'permission-denied');
  await assert.rejects(act(db, 'u-grace', { action: 'decide', memoId: 'm1', outcome: 'approved', signedName: 'Grace' }), (e) => /not been cleared/.test(e.message));
  await assert.rejects(act(db, 'u-author', { action: 'decide', memoId: 'm1', outcome: 'approved', signedName: 'Amina' }), (e) => e.code === 'permission-denied');
  await assert.rejects(act(db, 'u-author', { action: 'issue', memoId: 'm1' }), (e) => /still on its route/.test(e.message));

  // ── Ben clears
  const c = await act(db, 'u-ben', { action: 'clear', memoId: 'm1', outcome: 'cleared', note: 'Quotes attached' });
  assert.equal(c.stage, 'decision');
  m = memo(db, 'm1');
  assert.equal(m.approval.stage, 'decision');
  assert.equal(m.approval.clearanceIndex, 1);
  assert.deepEqual(m.approval.clearances.map((x) => [x.uid, x.outcome, x.note]), [['u-ben', 'cleared', 'Quotes attached']]);
  assert.equal(task(db, 'memo_clear:m1:u-ben').status, 'completed');
  assert.equal(task(db, 'memo_clear:m1:u-ben').autoClosedReason, 'Cleared');
  open = openTasks(db);
  assert.deepEqual(open.map((t) => [t.assignedToUserId, t.kind]), [['u-grace', 'approval']]);
  assert.match(open[0].description, /Cleared by Ben Through/);
  assert.equal(m.approval.tierMet, true, 'Grace (admin) holds the manager tier');
  assert.deepEqual(m.approval.deciderRoles, { 'u-grace': 'admin' });

  // Ben is on the route but not an addressee.
  await assert.rejects(act(db, 'u-ben', { action: 'decide', memoId: 'm1', outcome: 'approved', signedName: 'Ben' }), (e) => e.code === 'permission-denied');
  await assert.rejects(act(db, 'u-grace', { action: 'decide', memoId: 'm1', outcome: 'modified', signedName: 'Grace' }), (e) => /conditions/.test(e.message));
  await assert.rejects(act(db, 'u-grace', { action: 'decide', memoId: 'm1', outcome: 'approved' }), (e) => /Type your name/.test(e.message));

  // ── Grace decides with conditions
  const d = await act(db, 'u-grace', { action: 'decide', memoId: 'm1', outcome: 'modified', conditions: 'Four weeks only.', signedName: 'Grace Admin' });
  assert.equal(d.status, 'modified');
  m = memo(db, 'm1');
  assert.equal(m.decision.outcome, 'modified');
  assert.equal(m.decision.conditions, 'Four weeks only.');
  assert.equal(m.decision.signedBy, 'u-grace');
  assert.equal(m.decision.signatureMethod, 'typed');
  assert.equal(m.decision.signedNameTyped, 'Grace Admin');
  assert.equal(m.decision.coveredAsAdmin, undefined);
  assert.equal(task(db, 'memo_approval:m1:u-grace').status, 'completed');
  assert.match(task(db, 'memo_approval:m1:u-grace').autoClosedReason, /approved with conditions by Grace Admin/);
  assert.equal(m.approval.seniorityCheck, 'ok');
  assert.equal(openTasks(db).length, 0, 'nothing open between decision and issue');

  // ── issue (by the author)
  const i = await act(db, 'u-author', { action: 'issue', memoId: 'm1' });
  assert.equal(i.status, 'issued');
  assert.match(i.contentHash, /^[0-9a-f]{64}$/);
  m = memo(db, 'm1');
  assert.equal(m.status, 'issued');
  assert.equal(m.issuedSnapshot.memoNumber, 'MEMO-ZTA-2026-001');
  assert.equal(m.issuedSnapshot.version, 1);
  assert.equal(m.issuedSnapshot.issuedBy, 'u-author');
  assert.equal(m.issuedSnapshot.amountMinor, 180000);
  await assert.rejects(act(db, 'u-author', { action: 'issue', memoId: 'm1' }), (e) => /already been issued/.test(e.message));

  const notified = openTasks(db).filter((t) => t.kind === 'notify').sort((a, b) => a.assignedToUserId.localeCompare(b.assignedToUserId));
  assert.deepEqual(notified.map((t) => [t.assignedToUserId, t.title.startsWith('Acknowledge'), t.priority]), [
    ['u-ben', false, 'P3'], ['u-cc', true, 'P3'], ['u-grace', false, 'P3'],
  ]);
  assert.ok(!db._dump_prefix('generated_tasks').some((t) => t.data.assignedToUserId === 'u-author'), 'nothing is ever assigned to the author');
  assert.match(task(db, 'memo_ack:m1:u-grace').description, /addressed to you/);
  assert.match(task(db, 'memo_ack:m1:u-ben').description, /copied you/);

  // ── acknowledge
  await assert.rejects(act(db, 'u-zuri', { action: 'acknowledge', memoId: 'm1' }), (e) => e.code === 'permission-denied');
  const a = await act(db, 'u-cc', { action: 'acknowledge', memoId: 'm1' });
  assert.equal(a.acknowledgedAt, NOW);
  m = memo(db, 'm1');
  assert.equal(m.acknowledgements['u-cc'].name, 'Carol Copy');
  assert.equal(task(db, 'memo_ack:m1:u-cc').status, 'completed');
  const again = await act(db, 'u-cc', { action: 'acknowledge', memoId: 'm1' });
  assert.equal(again.acknowledgedAt, NOW, 'idempotent');

  // ── file the PDF (additive, once)
  const f = await act(db, 'u-author', { action: 'filePdf', memoId: 'm1', storagePath: 'memos/zeus-the-agency/m1/MEMO-ZTA-2026-001-v1.pdf', url: 'https://x/pdf' });
  assert.equal(f.pdfUrl, 'https://x/pdf');
  m = memo(db, 'm1');
  assert.equal(m.issuedSnapshot.pdfStoragePath, 'memos/zeus-the-agency/m1/MEMO-ZTA-2026-001-v1.pdf');
  assert.equal(m.issuedSnapshot.contentHash, i.contentHash, 'filing the PDF does not touch the content');
  await assert.rejects(act(db, 'u-author', { action: 'filePdf', memoId: 'm1', storagePath: 'p2', url: 'u2' }), (e) => /already filed/.test(e.message));
  await assert.rejects(act(db, 'u-author', { action: 'submit', memoId: 'm1' }), (e) => /Only a draft/.test(e.message));
});

test('numbers run per brand per year and survive a return: the resubmit keeps the number and bumps the version', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'a');
  draft(db, 'b');
  draft(db, 'c', { subsidiaryId: 'labyrinth' });
  assert.equal((await act(db, 'u-author', { action: 'submit', memoId: 'a' })).memoNumber, 'MEMO-ZTA-2026-001');
  assert.equal((await act(db, 'u-author', { action: 'submit', memoId: 'b' })).memoNumber, 'MEMO-ZTA-2026-002');
  assert.equal((await act(db, 'u-author', { action: 'submit', memoId: 'c' })).memoNumber, 'MEMO-LAB-2026-001');

  // Ben sends `a` back.
  await assert.rejects(act(db, 'u-ben', { action: 'clear', memoId: 'a', outcome: 'returned' }), (e) => /why/.test(e.message));
  const r = await act(db, 'u-ben', { action: 'clear', memoId: 'a', outcome: 'returned', note: 'Attach the three quotes' });
  assert.equal(r.stage, 'returned');
  let m = memo(db, 'a');
  assert.equal(m.status, 'rejected');
  assert.equal(m.returned.note, 'Attach the three quotes');
  assert.equal(task(db, 'memo_clear:a:u-ben').status, 'completed');
  assert.equal(task(db, 'memo_clear:a:u-ben').autoClosedReason, 'Sent back by Ben Through');
  const back = task(db, 'memo_returned:a:1');
  assert.equal(back.assignedToUserId, 'u-author');
  assert.equal(back.kind, 'notify');
  assert.match(back.description, /Attach the three quotes/);
  assert.equal(m.approval.seniorityCheck, undefined, 'a return is not a decision to audit');

  // Only the author reopens; then resubmits.
  await assert.rejects(act(db, 'u-ben', { action: 'reopen', memoId: 'a' }), (e) => e.code === 'permission-denied');
  await act(db, 'u-author', { action: 'reopen', memoId: 'a' });
  assert.equal(memo(db, 'a').status, 'draft');
  const s2 = await act(db, 'u-author', { action: 'submit', memoId: 'a' });
  assert.equal(s2.memoNumber, 'MEMO-ZTA-2026-001', 'the number is minted once');
  assert.equal(s2.version, 2);
  m = memo(db, 'a');
  assert.equal(m.returned, null);
  assert.deepEqual(m.approval.clearances, [], 'a fresh route');
  assert.ok(db._store.get('memos/a/versions/v2'));
  const t = task(db, 'memo_clear:a:u-ben');
  assert.equal(t.status, 'assigned', 'the same clearer gets the same task back');
  assert.equal(t.reopenedAt, NOW);
  assert.equal(t.history.at(-1).notes, 'memo came round again');
  assert.equal(db._store.get('memo_counters/memos_zeus-the-agency_2026').next, 3);
});

test('a memo that needs no decision and goes through nobody is numbered and issued on submit', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'i1', {
    type: 'information', impact: 'low', amountMinor: null, currency: null, category: 'admin',
    header: { to: [party('u-grace', 'Grace Admin'), party('u-author', 'Amina Author')], from: party('u-author', 'Amina Author'), through: [], cc: [party('u-ben', 'Ben Through')], date: '2026-10-26' },
    distribution: [], distributionUids: [],
  });
  const s = await act(db, 'u-author', { action: 'submit', memoId: 'i1' });
  assert.equal(s.status, 'issued');
  assert.equal(s.memoNumber, 'MEMO-ZTA-2026-001');
  const m = memo(db, 'i1');
  assert.equal(m.status, 'issued');
  assert.equal(m.approval.required, false);
  assert.deepEqual(m.approval.skipped, [{ name: 'Amina Author', list: 'to', reason: 'author' }]);
  assert.ok(m.issuedSnapshot.contentHash);
  assert.deepEqual(m.statusHistory.map((e) => e.to), ['draft', 'issued']);
  assert.deepEqual(openTasks(db).map((t) => [t.assignedToUserId, t.kind]).sort(), [['u-ben', 'notify'], ['u-grace', 'notify']]);
});

test('a no-decision memo with Through parties is cleared, then issued to everyone in the header', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'i2', { type: 'information', impact: 'low', amountMinor: null, currency: null, distribution: [], distributionUids: [] });
  const s = await act(db, 'u-author', { action: 'submit', memoId: 'i2' });
  assert.equal(s.status, 'submitted');
  let m = memo(db, 'i2');
  assert.deepEqual(m.approval.deciderUids, [], 'addressees receive it; nobody decides');
  assert.deepEqual(openTasks(db).map((t) => t.id), [memoTaskId('memo_clear:i2:u-ben')]);
  const c = await act(db, 'u-ben', { action: 'clear', memoId: 'i2', outcome: 'cleared' });
  assert.equal(c.stage, 'cleared');
  m = memo(db, 'i2');
  assert.equal(m.approval.stage, 'cleared');
  assert.equal(openTasks(db).length, 0, 'nobody decides a no-decision memo');
  await assert.rejects(act(db, 'u-grace', { action: 'decide', memoId: 'i2', outcome: 'approved', signedName: 'G' }), (e) => e.code === 'permission-denied');
  // Ben (on the route) may issue it; so may the author.
  await act(db, 'u-ben', { action: 'issue', memoId: 'i2' });
  assert.equal(memo(db, 'i2').status, 'issued');
  assert.deepEqual(openTasks(db).map((t) => t.assignedToUserId).sort(), ['u-ben', 'u-cc', 'u-grace']);
});

test('typed names only under To: a decider is picked by role, never the author; nobody eligible → unroutable', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'r1', { type: 'decision', impact: 'low', amountMinor: null, currency: null, header: { to: [{ name: 'The Board' }], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-26' } });
  await act(db, 'u-author', { action: 'submit', memoId: 'r1' });
  let m = memo(db, 'r1');
  assert.equal(m.approval.route.source, 'role');
  assert.deepEqual(m.approval.deciderUids, ['u-ben'], 'the manager tier: first manager by email');
  assert.equal(m.approval.routedTo.matchedRole, 'manager');
  assert.ok(m.routeUids.includes('u-ben'));
  assert.equal(m.approval.tierMet, true);
  assert.deepEqual(openTasks(db).map((t) => [t.assignedToUserId, t.kind]), [['u-ben', 'approval']]);

  // High impact asks for admin → owner; the author is the only owner, so the
  // search widens to the most senior below and the tier flags it.
  const { db: db2 } = makeFirestore();
  seed(db2, { 'u-author': { displayName: 'Sole Owner', globalRole: 'owner' }, 'u-ben': { displayName: 'Ben', globalRole: 'manager' } });
  draft(db2, 'r2', { type: 'decision', impact: 'high', amountMinor: null, currency: null, header: { to: [party('u-author', 'Sole Owner')], from: party('u-author', 'Sole Owner'), through: [], cc: [], date: '2026-10-26' } });
  await act(db2, 'u-author', { action: 'submit', memoId: 'r2' });
  m = memo(db2, 'r2');
  assert.deepEqual(m.approval.deciderUids, ['u-ben']);
  assert.equal(m.approval.tierMet, false);
  assert.deepEqual(openTasks(db2).map((t) => t.assignedToUserId), ['u-ben']);

  // Nobody but the author holds a role at all.
  const { db: db3 } = makeFirestore();
  seed(db3, { 'u-author': { displayName: 'Sole Owner', globalRole: 'owner' } });
  draft(db3, 'r3', { type: 'decision', impact: 'low', amountMinor: null, currency: null, header: { to: [party('u-author', 'Sole Owner')], from: party('u-author', 'Sole Owner'), through: [], cc: [], date: '2026-10-26' } });
  await act(db3, 'u-author', { action: 'submit', memoId: 'r3' });
  m = memo(db3, 'r3');
  assert.match(m.approval.unroutable, /nobody other than the author/);
  assert.equal(db3._dump_prefix('generated_tasks').length, 0);
});

test('an admin may decide in an addressee\'s place after clearance; a junior signer is flagged, not blocked', async () => {
  const { db } = makeFirestore();
  seed(db, { ...PEOPLE, 'u-junior': { displayName: 'Jo Junior', globalRole: 'member' } });
  draft(db, 'd1', { impact: 'high', header: { to: [party('u-junior', 'Jo Junior')], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-26' } });
  await act(db, 'u-author', { action: 'submit', memoId: 'd1' });
  let m = memo(db, 'd1');
  assert.equal(m.approval.effectiveRole, 'admin');
  assert.equal(m.approval.tierMet, false, 'addressed below the tier — warned, not blocked');
  // Grace (admin, not addressed) covers.
  await act(db, 'u-grace', { action: 'decide', memoId: 'd1', outcome: 'approved', signedName: 'Grace Admin' });
  m = memo(db, 'd1');
  assert.equal(m.status, 'approved');
  assert.equal(m.decision.coveredAsAdmin, true);
  assert.equal(m.approval.seniorityCheck, 'ok');
  assert.equal(task(db, 'memo_approval:d1:u-junior').status, 'completed');

  const { db: db2 } = makeFirestore();
  seed(db2, { ...PEOPLE, 'u-junior': { displayName: 'Jo Junior', globalRole: 'member' } });
  draft(db2, 'd2', { impact: 'high', header: { to: [party('u-junior', 'Jo Junior')], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-26' } });
  await act(db2, 'u-author', { action: 'submit', memoId: 'd2' });
  await act(db2, 'u-junior', { action: 'decide', memoId: 'd2', outcome: 'rejected', notes: 'Not now', signedName: 'Jo Junior' });
  m = memo(db2, 'd2');
  assert.equal(m.status, 'rejected');
  assert.equal(m.approval.seniorityCheck, 'junior');
  assert.equal(m.approval.signerRole, 'member');
  await assert.rejects(act(db2, 'u-author', { action: 'issue', memoId: 'd2' }), (e) => /rejected memo cannot be issued/.test(e.message));
  // The author reopens and the number survives.
  await act(db2, 'u-author', { action: 'reopen', memoId: 'd2' });
  assert.equal(memo(db2, 'd2').memoNumber, 'MEMO-ZTA-2026-001');
});

test('withdraw: the author while on route (tasks close), only an admin once issued, never an unsubmitted draft', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'w0');
  await assert.rejects(act(db, 'u-author', { action: 'withdraw', memoId: 'w0' }), (e) => /deleted, not withdrawn/.test(e.message));
  draft(db, 'w1');
  await act(db, 'u-author', { action: 'submit', memoId: 'w1' });
  await assert.rejects(act(db, 'u-cc', { action: 'withdraw', memoId: 'w1' }), (e) => e.code === 'permission-denied');
  await act(db, 'u-author', { action: 'withdraw', memoId: 'w1', note: 'No longer needed' });
  assert.equal(memo(db, 'w1').status, 'withdrawn');
  assert.equal(memo(db, 'w1').statusHistory.at(-1).note, 'No longer needed');
  assert.equal(task(db, 'memo_clear:w1:u-ben').status, 'completed');
  assert.equal(task(db, 'memo_clear:w1:u-ben').autoClosedReason, 'Memo withdrawn');

  draft(db, 'w2', { type: 'information', impact: 'low', amountMinor: null, currency: null, header: { to: [party('u-grace', 'G')], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-26' } });
  await act(db, 'u-author', { action: 'submit', memoId: 'w2' });
  assert.equal(memo(db, 'w2').status, 'issued');
  await assert.rejects(act(db, 'u-author', { action: 'withdraw', memoId: 'w2' }), (e) => /Only an admin/.test(e.message));
  await act(db, 'u-grace', { action: 'withdraw', memoId: 'w2' });
  assert.equal(memo(db, 'w2').status, 'withdrawn');
});

test('the band on systemSettings/approvalRouting raises the tier; issuing a replacement retires the memo it supersedes', async () => {
  const { db } = makeFirestore();
  seed(db);
  db._seed('systemSettings/approvalRouting', {
    version: 2,
    modules: {
      memo_finance: {
        entityType: 'memo_finance', currency: 'KES', enabled: true,
        bands: [
          { id: 'lead', label: 'Lead', maxAmountMinor: 100000, signatures: [{ level: 1, approverRole: 'manager' }] },
          { id: 'group', label: 'Group', maxAmountMinor: null, signatures: [{ level: 1, approverRole: 'admin' }, { level: 2, approverRole: 'owner' }] },
        ],
      },
    },
  });
  draft(db, 'b1', { impact: 'low', amountMinor: 5000000, header: { to: [party('u-zuri', 'Zuri Owner')], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-26' } });
  await act(db, 'u-author', { action: 'submit', memoId: 'b1' });
  let m = memo(db, 'b1');
  assert.equal(m.approval.effectiveRole, 'owner');
  assert.equal(m.approval.raisedBy, 'band');
  assert.equal(m.approval.bandId, 'group');
  assert.equal(m.approval.configVersion, 2);
  await act(db, 'u-zuri', { action: 'decide', memoId: 'b1', outcome: 'approved', signedName: 'Zuri Owner' });
  await act(db, 'u-author', { action: 'issue', memoId: 'b1' });
  assert.equal(memo(db, 'b1').status, 'issued');

  // A replacement draft linked back with `supersedes`.
  draft(db, 'b2', { impact: 'low', amountMinor: null, currency: null, type: 'information', category: 'admin', supersedes: 'b1', header: { to: [party('u-grace', 'G')], from: party('u-author', 'A'), through: [], cc: [], date: '2026-10-27' } });
  const s = await act(db, 'u-author', { action: 'submit', memoId: 'b2' });
  assert.equal(s.status, 'issued');
  assert.equal(s.superseded, 'b1');
  m = memo(db, 'b1');
  assert.equal(m.status, 'superseded');
  assert.equal(m.supersededBy, 'b2');
  assert.match(m.statusHistory.at(-1).note, /Superseded by MEMO-ZTA-2026-002/);
});

test('a task-sync failure never fails the memo write', async () => {
  const { db } = makeFirestore();
  seed(db);
  draft(db, 'f1');
  const logs = [];
  const original = db.collection.bind(db);
  db.collection = (path) => {
    if (path === 'generated_tasks') return { doc: () => ({ get: async () => { throw new Error('boom'); } }) };
    return original(path);
  };
  const s = await act(db, 'u-author', { action: 'submit', memoId: 'f1' }, { logger: { info() {}, warn() {}, error: (m) => logs.push(m) } });
  assert.equal(s.status, 'submitted');
  assert.equal(memo(db, 'f1').status, 'submitted');
  assert.ok(logs.some((l) => /task sync failed: boom/.test(l)));
});
