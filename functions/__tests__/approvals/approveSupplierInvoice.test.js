/**
 * approveTalentInvoice / approveMediaSupplierInvoice — callable tests against
 * the in-memory Firestore stub.
 *   cd functions && node --test __tests__/approvals/approveSupplierInvoice.test.js
 *
 * What is pinned:
 *   • one-signature invoice → APPROVED, approvedBy = signer, plan frozen,
 *     TalentInvoiceApproved emitted with the consumer's payload
 *   • two-signature invoice → first signer leaves it SUBMITTED at level 2
 *     with no event; the same person cannot sign again; the owner completes it
 *   • the raiser is refused even as an admin (ADR-2026-10-25)
 *   • a machine / placeholder actor is refused
 *   • wrong status refused; already APPROVED is an idempotent no-op
 *   • a Tier-1 engagement raises the band (manager under tier)
 *   • a role-profile holder may sign a level pinned to that profile
 *   • the media variant emits no event
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('../assignment/_firestore-stub');

// Self-contained: every firebase-* module is stubbed, so this suite runs
// wherever node does — including a worktree whose functions/node_modules
// is the known self-referential symlink. The HttpsError stub keeps the real
// class's contract (`code` is the bare canonical code, e.g.
// 'permission-denied'; the CLIENT SDK is what prefixes 'functions/').
class HttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'HttpsError';
    this.code = code;
    this.details = details;
  }
}
const httpsStub = {
  HttpsError,
  onCall: (_opts, handler) => (requestEnvelope) => handler(requestEnvelope),
};

let _adminDb;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return { getFirestore: () => _adminDb, FieldValue: stub.FieldValueStub };
  }
  if (request === 'firebase-admin') {
    return { firestore: () => _adminDb };
  }
  if (request === 'firebase-functions/v2/https') return httpsStub;
  if (request === 'firebase-functions/v2/firestore') {
    return { onDocumentCreated: (_cfg, handler) => handler };
  }
  if (request === 'firebase-functions') {
    return { logger: { warn: () => {}, info: () => {}, error: () => {} } };
  }
  return origLoad.call(this, request, ...rest);
};

const { runApproveSupplierInvoice, TARGETS } = require('../../src/approvals/approveSupplierInvoice');
const { kesMinor: KES, DEFAULT_APPROVAL_ROUTING } = require('../../src/approvals/routing');

const USERS = {
  u_lead: { globalRole: 'manager', displayName: 'Lead', email: 'lead@zeus.test' },
  u_md: { globalRole: 'admin', displayName: 'Brand MD', email: 'md@zeus.test' },
  u_md2: { globalRole: 'admin', displayName: 'Other MD', email: 'md2@zeus.test' },
  u_ceo: { globalRole: 'owner', displayName: 'CEO', email: 'ceo@zeus.test' },
  u_raiser: { globalRole: 'admin', displayName: 'Raiser', email: 'raiser@zeus.test' },
  u_member: { globalRole: 'member', displayName: 'Member', email: 'member@zeus.test' },
};
const assertAuth = async (auth) => ({ uid: auth.uid, user: USERS[auth.uid] || { globalRole: 'member' } });
const NOW = '2026-10-25T12:00:00.000Z';

function freshDb() {
  const { db, FieldValue } = stub.makeFirestore();
  _adminDb = db;
  return { db, FieldValue };
}

function seedInvoice(db, id, over = {}) {
  db._seed(`talent_invoices/${id}`, {
    id,
    talentProfileId: 'tp_1',
    masterJobId: 'mj_1',
    orgId: 'zeus-group',
    amountMinor: KES(50_000),
    currency: 'KES',
    status: 'SUBMITTED',
    createdBy: 'u_raiser',
    createdAt: '2026-10-20T00:00:00.000Z',
    ...over,
  });
}

function run(db, FieldValue, uid, data, over = {}) {
  return runApproveSupplierInvoice({
    db,
    auth: { uid, token: { email: (USERS[uid] || {}).email } },
    data,
    target: TARGETS.talent,
    fieldValue: FieldValue,
    assertAuth,
    loadConfig: async () => over.config || DEFAULT_APPROVAL_ROUTING,
    now: () => NOW,
    ...over,
  });
}

const events = (db) => Object.values(db._dump()).filter((d) => d && d.eventType);

test('one signature: a manager who is not the raiser approves; plan frozen; event emitted for the PO consumer', async () => {
  const { db, FieldValue } = freshDb();
  seedInvoice(db, 'inv_1');
  const r = await run(db, FieldValue, 'u_lead', { invoiceId: 'inv_1', note: 'ok' });
  assert.deepEqual(r, { id: 'inv_1', status: 'APPROVED', level: 1, complete: true, pendingLevel: null, bandId: 'lead', signaturesRequired: 1 });

  const doc = db._dump()['talent_invoices/inv_1'];
  assert.equal(doc.status, 'APPROVED');
  assert.equal(doc.approvedBy, 'u_lead');
  assert.ok(doc.approvedAt, 'approvedAt stamped');
  assert.equal(doc.approval.bandId, 'lead');
  assert.equal(doc.approval.purpose, 'talent');
  assert.equal(doc.approval.completedAt, NOW);
  assert.deepEqual(
    doc.approval.signatures.map((s) => [s.level, s.label, s.approvedBy, s.via, s.note]),
    [[1, 'Talent lead', 'u_lead', 'role', 'ok']],
  );

  const evs = events(db);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].eventType, 'TalentInvoiceApproved');
  assert.equal(evs[0].aggregateType, 'TalentInvoice');
  assert.equal(evs[0].aggregateId, 'inv_1');
  assert.equal(evs[0].emittedByUserId, 'u_lead');
  assert.deepEqual(evs[0].payload, {
    talentInvoiceId: 'inv_1', talentProfileId: 'tp_1', masterJobId: 'mj_1', amountMinor: KES(50_000), currency: 'KES', orgId: 'zeus-group',
  });
});

test('two signatures: MD signs level 1 (still SUBMITTED, no event); same MD refused; CEO completes and the event fires', async () => {
  const { db, FieldValue } = freshDb();
  seedInvoice(db, 'inv_2', { amountMinor: KES(3_000_000) });

  const first = await run(db, FieldValue, 'u_md', { invoiceId: 'inv_2' });
  assert.deepEqual(first, { id: 'inv_2', status: 'SUBMITTED', level: 1, complete: false, pendingLevel: 2, bandId: 'group', signaturesRequired: 2 });
  let doc = db._dump()['talent_invoices/inv_2'];
  assert.equal(doc.status, 'SUBMITTED');
  assert.equal(doc.approvedBy, undefined);
  assert.equal(doc.approval.pendingLevel, 2);
  assert.equal(doc.approval.signatures[0].approvedBy, 'u_md');
  assert.equal(doc.approval.signatures[1].approvedBy, null);
  assert.equal(events(db).length, 0, 'no event until the last signature');

  await assert.rejects(run(db, FieldValue, 'u_md', { invoiceId: 'inv_2' }), (err) => {
    assert.equal(err.code, 'permission-denied');
    assert.match(err.message, /already signed/);
    return true;
  });
  // A second admin is under tier for the CEO level.
  await assert.rejects(run(db, FieldValue, 'u_md2', { invoiceId: 'inv_2' }), (err) => {
    assert.equal(err.code, 'permission-denied');
    assert.match(err.message, /needs owner approval/);
    return true;
  });

  const second = await run(db, FieldValue, 'u_ceo', { invoiceId: 'inv_2' });
  assert.equal(second.status, 'APPROVED');
  assert.equal(second.complete, true);
  doc = db._dump()['talent_invoices/inv_2'];
  assert.equal(doc.approvedBy, 'u_ceo', 'the final signer is the approver of record');
  assert.deepEqual(doc.approval.signatures.map((s) => s.approvedBy), ['u_md', 'u_ceo']);
  assert.equal(events(db).length, 1);
});

test('the raiser never approves — not even as an admin (ADR-2026-10-25)', async () => {
  const { db, FieldValue } = freshDb();
  seedInvoice(db, 'inv_3', { createdBy: 'u_md' });
  await assert.rejects(run(db, FieldValue, 'u_md', { invoiceId: 'inv_3' }), (err) => {
    assert.equal(err.code, 'permission-denied');
    assert.match(err.message, /You raised this/);
    return true;
  });
  assert.equal(db._dump()['talent_invoices/inv_3'].status, 'SUBMITTED');
});

test('a machine or placeholder actor cannot approve', async () => {
  const { db, FieldValue } = freshDb();
  seedInvoice(db, 'inv_4');
  for (const uid of ['current-user', 'agent:ZA-001', 'system']) {
    await assert.rejects(
      runApproveSupplierInvoice({
        db, auth: { uid }, data: { invoiceId: 'inv_4' }, target: TARGETS.talent, fieldValue: FieldValue,
        assertAuth: async (a) => ({ uid: a.uid, user: { globalRole: 'owner' } }),
        loadConfig: async () => DEFAULT_APPROVAL_ROUTING, now: () => NOW,
      }),
      (err) => {
        assert.equal(err.code, 'permission-denied');
        assert.match(err.message, /must name a person/);
        return true;
      },
    );
  }
});

test('wrong status is refused; an already-APPROVED invoice is an idempotent no-op; missing id / invoice', async () => {
  const { db, FieldValue } = freshDb();
  seedInvoice(db, 'inv_rej', { status: 'REJECTED' });
  await assert.rejects(run(db, FieldValue, 'u_lead', { invoiceId: 'inv_rej' }), (err) => {
    assert.equal(err.code, 'failed-precondition');
    return true;
  });
  seedInvoice(db, 'inv_done', { status: 'APPROVED', approvedBy: 'u_ceo' });
  const r = await run(db, FieldValue, 'u_lead', { invoiceId: 'inv_done' });
  assert.deepEqual(r, { id: 'inv_done', status: 'APPROVED', complete: true, skip: 'already_approved' });
  assert.equal(events(db).length, 0);

  await assert.rejects(run(db, FieldValue, 'u_lead', {}), (err) => err.code === 'invalid-argument');
  await assert.rejects(run(db, FieldValue, 'u_lead', { invoiceId: 'nope' }), (err) => err.code === 'not-found');
});

test('a Tier-1 engagement raises the band: a manager is under tier for KES 80k', async () => {
  const { db, FieldValue } = freshDb();
  db._seed('master_jobs/mj_t1', { id: 'mj_t1', tier: 'TIER_1', ceilingMinor: KES(50_000_000) });
  seedInvoice(db, 'inv_t1', { masterJobId: 'mj_t1', amountMinor: KES(80_000) });
  await assert.rejects(run(db, FieldValue, 'u_lead', { invoiceId: 'inv_t1' }), (err) => {
    assert.equal(err.code, 'permission-denied');
    assert.match(err.message, /needs admin approval/);
    return true;
  });
  const r = await run(db, FieldValue, 'u_md', { invoiceId: 'inv_t1' });
  assert.equal(r.bandId, 'brand_md');
  assert.equal(db._dump()['talent_invoices/inv_t1'].approval.raisedByTier, 1);
});

test('a role-profile holder may sign a level pinned to that profile, whatever their role tier', async () => {
  const { db, FieldValue } = freshDb();
  const config = structuredClone(DEFAULT_APPROVAL_ROUTING);
  config.modules.supplier_spend.bands[0].signatures = [{ level: 1, label: 'Zeus Group CFO', approverRole: 'owner', roleProfileId: 'ROLE-zeus-group-cfo' }];
  db._seed('role_assignments/ra_1', { roleProfileId: 'ROLE-zeus-group-cfo', employeeId: 'emp_cfo', status: 'active' });
  db._seed('employees/emp_cfo', { id: 'emp_cfo', userId: 'u_member' });
  seedInvoice(db, 'inv_pin');

  await assert.rejects(run(db, FieldValue, 'u_md', { invoiceId: 'inv_pin' }, { config }), (err) => err.code === 'permission-denied');
  const r = await run(db, FieldValue, 'u_member', { invoiceId: 'inv_pin' }, { config });
  assert.equal(r.status, 'APPROVED');
  assert.equal(db._dump()['talent_invoices/inv_pin'].approval.signatures[0].via, 'pinned');
});

test('aggregate oversight: rolling supplier spend adds Group Finance at level 2', async () => {
  const { db, FieldValue } = freshDb();
  const config = structuredClone(DEFAULT_APPROVAL_ROUTING);
  config.modules.supplier_spend.aggregateRules = [
    { id: 'supplier30', kind: 'supplier_rolling', thresholdMinor: KES(1_000_000), windowDays: 30, adds: { level: 2, label: 'Group Finance', approverRole: 'admin' } },
  ];
  db._seed('talent_invoices/old_1', { talentProfileId: 'tp_1', status: 'PAID', amountMinor: KES(980_000), approvedAt: '2026-10-10T00:00:00.000Z' });
  db._seed('talent_invoices/old_stale', { talentProfileId: 'tp_1', status: 'PAID', amountMinor: KES(5_000_000), approvedAt: '2026-01-01T00:00:00.000Z' });
  seedInvoice(db, 'inv_agg');
  const r = await run(db, FieldValue, 'u_lead', { invoiceId: 'inv_agg' }, { config });
  assert.deepEqual([r.status, r.pendingLevel, r.signaturesRequired], ['SUBMITTED', 2, 2]);
  const doc = db._dump()['talent_invoices/inv_agg'];
  assert.deepEqual(doc.approval.aggregateRuleIds, ['supplier30']);
  assert.equal(doc.approval.signatures[1].label, 'Group Finance');
});

test('media variant: approval completes without an outbox event', async () => {
  const { db, FieldValue } = freshDb();
  db._seed('media_supplier_invoices/mi_1', {
    id: 'mi_1', supplierOrgId: 'sup_1', mediaPlanId: 'mp_1', masterJobId: 'mj_1', orgId: 'zeus-group',
    amountMinor: KES(40_000), currency: 'KES', status: 'SUBMITTED', createdBy: 'u_raiser',
  });
  const r = await runApproveSupplierInvoice({
    db, auth: { uid: 'u_lead' }, data: { invoiceId: 'mi_1' }, target: TARGETS.media, fieldValue: FieldValue,
    assertAuth, loadConfig: async () => DEFAULT_APPROVAL_ROUTING, now: () => NOW,
  });
  assert.equal(r.status, 'APPROVED');
  const doc = db._dump()['media_supplier_invoices/mi_1'];
  assert.equal(doc.approval.purpose, 'media');
  assert.equal(doc.approval.signatures[0].label, 'Media lead');
  assert.equal(events(db).length, 0);
});

test('an idempotency key replays the cached response instead of signing twice', async () => {
  const { db, FieldValue } = freshDb();
  seedInvoice(db, 'inv_idem', { amountMinor: KES(3_000_000) });
  const a = await run(db, FieldValue, 'u_md', { invoiceId: 'inv_idem', idempotencyKey: 'idem-key-0001' });
  const b = await run(db, FieldValue, 'u_md', { invoiceId: 'inv_idem', idempotencyKey: 'idem-key-0001' });
  assert.deepEqual(b, a);
  assert.equal(db._dump()['talent_invoices/inv_idem'].approval.pendingLevel, 2);
});
