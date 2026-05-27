/**
 * onTalentInvoiceApproved — Phase 4.1 procurement consumer test.
 *
 * Exercises the talent-side of the supplier-invoice → PO handshake
 * (plan §15 acceptance). The consumer reads a `TalentInvoiceApproved`
 * domain event, raises a deterministic `purchase_orders/po_talent_{id}`
 * doc, and emits a `PurchaseOrderRaised` event so the finance consumer
 * can post a JE.
 *
 * Scenarios:
 *   • happy path — PO raised, source invoice carries the marker, event
 *     tagged, downstream event emitted.
 *   • replay — second invocation with the same eventId leaves a single
 *     PO doc; event's processedBy carries the retry tag.
 *   • malformed payload — required keys missing, no PO created, event
 *     tagged `:malformed`.
 *   • source-deleted — the underlying talent_invoices doc has been
 *     deleted before the consumer fires; the consumer tags
 *     `:source-deleted` and returns without writing a PO.
 *
 * Stubbed Firestore at `../assignment/_firestore-stub` mirrors the doc
 * + txn API of `firebase-admin/firestore` minus distributed-txn
 * semantics. Same harness used by the Phase 3 outbox-consumer tests.
 *
 * Run:
 *   cd functions && node --test __tests__/talent/onTalentInvoiceApproved.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('../assignment/_firestore-stub');

let _adminDb;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return {
      getFirestore: () => _adminDb,
      FieldValue: stub.FieldValueStub,
    };
  }
  if (request === 'firebase-functions/v2/firestore') {
    return {
      onDocumentCreated: (_cfg, handler) => handler,
    };
  }
  return origLoad.call(this, request, ...rest);
};

function freshDb() {
  const { db } = stub.makeFirestore();
  _adminDb = db;
  return db;
}

function makeEvent(db, { eventId, payload, processedBy = [] }) {
  db._seed(`domain_events/${eventId}`, {
    id: eventId,
    eventType: 'TalentInvoiceApproved',
    aggregateType: 'TalentInvoice',
    aggregateId: payload.talentInvoiceId,
    payload,
    processedBy,
    processed: false,
  });
  return {
    params: { eventId },
    data: { data: () => db._dump()[`domain_events/${eventId}`] },
  };
}

function seedTalentInvoice(db, id, overrides = {}) {
  db._seed(`talent_invoices/${id}`, {
    id,
    status: 'APPROVED',
    amountMinor: 500_000,
    currency: 'USD',
    talentProfileId: 'tp_1',
    masterJobId: 'mj_1',
    orgId: 'zeus-the-agency',
    ...overrides,
  });
}

// Reload the module-under-test per test so each test sees a fresh
// Firestore stub and a clean module-level state.
function loadHandler() {
  delete require.cache[require.resolve('../../src/talent/onTalentInvoiceApproved')];
  delete require.cache[require.resolve('../../src/platform/outbox')];
  return require('../../src/talent/onTalentInvoiceApproved').onTalentInvoiceApproved;
}

test('happy path — raises a PO and emits PurchaseOrderRaised', async () => {
  const db = freshDb();
  seedTalentInvoice(db, 'ti_1');
  const handler = loadHandler();

  await handler(makeEvent(db, {
    eventId: 'ev_t1',
    payload: {
      talentInvoiceId: 'ti_1',
      talentProfileId: 'tp_1',
      masterJobId: 'mj_1',
      amountMinor: 500_000,
      currency: 'USD',
      orgId: 'zeus-the-agency',
    },
  }));

  const docs = db._dump();
  // PO doc id is deterministic.
  const po = docs['purchase_orders/po_talent_ti_1'];
  assert.ok(po, 'purchase_orders/po_talent_ti_1 must exist');
  assert.equal(po.kind, 'TALENT_FREELANCER');
  assert.equal(po.sourceInvoiceId, 'ti_1');
  assert.equal(po.supplierProfileId, 'tp_1');
  assert.equal(po.masterJobId, 'mj_1');
  assert.equal(po.amountMinor, 500_000);
  assert.equal(po.currency, 'USD');
  assert.equal(po.status, 'OPEN');
  assert.equal(po.orgId, 'zeus-the-agency');

  // Source event tagged processed.
  const ev = docs['domain_events/ev_t1'];
  assert.ok(Array.isArray(ev.processedBy), 'processedBy is an array');
  assert.ok(ev.processedBy.includes('talent-invoice-po-raiser'),
    `processedBy should include the PROCESSOR_TAG, got ${JSON.stringify(ev.processedBy)}`);

  // PurchaseOrderRaised emitted.
  const raised = Object.values(docs).filter(d => d.eventType === 'PurchaseOrderRaised');
  assert.equal(raised.length, 1, 'exactly one PurchaseOrderRaised event');
  assert.equal(raised[0].aggregateId, 'po_talent_ti_1');
  assert.equal(raised[0].payload.kind, 'TALENT_FREELANCER');
  assert.equal(raised[0].payload.sourceInvoiceId, 'ti_1');
});

test('replay — second invocation is idempotent', async () => {
  const db = freshDb();
  seedTalentInvoice(db, 'ti_idem');
  const handler = loadHandler();

  const ev = () => makeEvent(db, {
    eventId: 'ev_t_idem',
    payload: {
      talentInvoiceId: 'ti_idem',
      talentProfileId: 'tp_1',
      masterJobId: 'mj_1',
      amountMinor: 500_000,
      currency: 'USD',
      orgId: 'zeus-the-agency',
    },
  });

  await handler(ev());
  const firstPoCount = Object.keys(db._dump()).filter(k => k.startsWith('purchase_orders/')).length;
  const firstRaisedCount = Object.values(db._dump()).filter(d => d.eventType === 'PurchaseOrderRaised').length;

  // Replay.
  await handler(ev());
  const secondPoCount = Object.keys(db._dump()).filter(k => k.startsWith('purchase_orders/')).length;
  const secondRaisedCount = Object.values(db._dump()).filter(d => d.eventType === 'PurchaseOrderRaised').length;

  assert.equal(secondPoCount, firstPoCount, 'replay must not create a second PO');
  assert.equal(secondRaisedCount, firstRaisedCount,
    'replay must not emit a second PurchaseOrderRaised event');
});

test('malformed payload — no PO created, event tagged :malformed', async () => {
  const db = freshDb();
  seedTalentInvoice(db, 'ti_bad');
  const handler = loadHandler();

  // Missing required keys: talentProfileId + orgId.
  await handler(makeEvent(db, {
    eventId: 'ev_t_bad',
    payload: {
      talentInvoiceId: 'ti_bad',
      masterJobId: 'mj_1',
      amountMinor: 500_000,
      currency: 'USD',
    },
  }));

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'no PO doc must be created when payload is malformed',
  );
  const ev = docs['domain_events/ev_t_bad'];
  assert.ok(
    ev.processedBy.some(t => t.startsWith('talent-invoice-po-raiser:malformed')),
    `event must be tagged :malformed, got ${JSON.stringify(ev.processedBy)}`,
  );
});

test('source-deleted — talent_invoices doc removed, event tagged :source-deleted', async () => {
  const db = freshDb();
  // Note: do NOT seed talent_invoices/ti_missing.
  const handler = loadHandler();

  await handler(makeEvent(db, {
    eventId: 'ev_t_missing',
    payload: {
      talentInvoiceId: 'ti_missing',
      talentProfileId: 'tp_1',
      masterJobId: 'mj_1',
      amountMinor: 500_000,
      currency: 'USD',
      orgId: 'zeus-the-agency',
    },
  }));

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'no PO doc must be created when source invoice is missing',
  );
  const ev = docs['domain_events/ev_t_missing'];
  assert.ok(
    ev.processedBy.some(t => t.startsWith('talent-invoice-po-raiser:source-deleted')),
    `event must be tagged :source-deleted, got ${JSON.stringify(ev.processedBy)}`,
  );
});

test('wrong eventType — handler returns without side effects', async () => {
  const db = freshDb();
  seedTalentInvoice(db, 'ti_wrong');
  const handler = loadHandler();

  // Seed an event with a different eventType.
  db._seed('domain_events/ev_wrong', {
    id: 'ev_wrong',
    eventType: 'SomeOtherEvent',
    payload: { talentInvoiceId: 'ti_wrong' },
    processedBy: [],
  });

  await handler({
    params: { eventId: 'ev_wrong' },
    data: { data: () => db._dump()['domain_events/ev_wrong'] },
  });

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'wrong eventType must not raise a PO',
  );
});

test('already-tagged event — short-circuits without re-processing', async () => {
  const db = freshDb();
  seedTalentInvoice(db, 'ti_done');
  const handler = loadHandler();

  await handler(makeEvent(db, {
    eventId: 'ev_t_done',
    payload: {
      talentInvoiceId: 'ti_done',
      talentProfileId: 'tp_1',
      masterJobId: 'mj_1',
      amountMinor: 500_000,
      currency: 'USD',
      orgId: 'zeus-the-agency',
    },
    processedBy: ['talent-invoice-po-raiser'],
  }));

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'pre-tagged event must not raise a PO on this invocation',
  );
});
