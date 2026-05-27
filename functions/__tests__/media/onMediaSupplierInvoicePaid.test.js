/**
 * onMediaSupplierInvoicePaid — Phase 4.1 procurement consumer test.
 *
 * Mirror of `__tests__/talent/onTalentInvoiceApproved.test.js`, but for
 * the media-supplier path. The difference vs. the talent path:
 *   • Media invoices fire on PAID, not APPROVED (media houses are
 *     paid up-front).
 *   • PO carries `mediaPlanId`, optional `mediaBuyId`, and
 *     `vehicleType` so reconciliation queries can join back to the
 *     plan/buy that triggered the spend.
 *
 * Scenarios:
 *   • happy path — PO raised, all media-context fields propagate.
 *   • optional `mediaBuyId` — null preserved when not provided.
 *   • replay — idempotency by deterministic doc id.
 *   • malformed payload — event tagged `:malformed`, no PO.
 *   • source-deleted — event tagged `:source-deleted`, no PO.
 *
 * Run:
 *   cd functions && node --test __tests__/media/onMediaSupplierInvoicePaid.test.js
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
    eventType: 'MediaSupplierInvoicePaid',
    aggregateType: 'MediaSupplierInvoice',
    aggregateId: payload.mediaSupplierInvoiceId,
    payload,
    processedBy,
    processed: false,
  });
  return {
    params: { eventId },
    data: { data: () => db._dump()[`domain_events/${eventId}`] },
  };
}

function seedMediaInvoice(db, id, overrides = {}) {
  db._seed(`media_supplier_invoices/${id}`, {
    id,
    status: 'PAID',
    amountMinor: 2_500_000,
    currency: 'USD',
    supplierOrgId: 'supplier_xyz',
    mediaPlanId: 'mp_1',
    mediaBuyId: 'mb_1',
    masterJobId: 'mj_1',
    vehicleType: 'TV',
    orgId: 'zeus-digital',
    ...overrides,
  });
}

function loadHandler() {
  delete require.cache[require.resolve('../../src/media/onMediaSupplierInvoicePaid')];
  delete require.cache[require.resolve('../../src/platform/outbox')];
  return require('../../src/media/onMediaSupplierInvoicePaid').onMediaSupplierInvoicePaid;
}

test('happy path — raises a PO with full media context and emits PurchaseOrderRaised', async () => {
  const db = freshDb();
  seedMediaInvoice(db, 'msi_1');
  const handler = loadHandler();

  await handler(makeEvent(db, {
    eventId: 'ev_m1',
    payload: {
      mediaSupplierInvoiceId: 'msi_1',
      supplierOrgId: 'supplier_xyz',
      mediaPlanId: 'mp_1',
      mediaBuyId: 'mb_1',
      masterJobId: 'mj_1',
      vehicleType: 'TV',
      amountMinor: 2_500_000,
      currency: 'USD',
      orgId: 'zeus-digital',
    },
  }));

  const docs = db._dump();
  const po = docs['purchase_orders/po_media_msi_1'];
  assert.ok(po, 'purchase_orders/po_media_msi_1 must exist');
  assert.equal(po.kind, 'MEDIA_SUPPLIER');
  assert.equal(po.sourceInvoiceId, 'msi_1');
  assert.equal(po.supplierOrgId, 'supplier_xyz');
  assert.equal(po.mediaPlanId, 'mp_1');
  assert.equal(po.mediaBuyId, 'mb_1');
  assert.equal(po.vehicleType, 'TV');
  assert.equal(po.masterJobId, 'mj_1');
  assert.equal(po.amountMinor, 2_500_000);
  assert.equal(po.status, 'OPEN');
  assert.equal(po.postedToGL, false);

  // PurchaseOrderRaised emitted with media context for finance consumer
  // joins back to mediaPlanId / mediaBuyId / vehicleType.
  const raised = Object.values(docs).filter(d => d.eventType === 'PurchaseOrderRaised');
  assert.equal(raised.length, 1, 'exactly one PurchaseOrderRaised event');
  assert.equal(raised[0].payload.kind, 'MEDIA_SUPPLIER');
  assert.equal(raised[0].payload.mediaPlanId, 'mp_1');
  assert.equal(raised[0].payload.mediaBuyId, 'mb_1');
  assert.equal(raised[0].payload.vehicleType, 'TV');

  const ev = docs['domain_events/ev_m1'];
  assert.ok(ev.processedBy.includes('media-supplier-invoice-po-raiser'),
    `processedBy should include the media tag, got ${JSON.stringify(ev.processedBy)}`);
});

test('optional mediaBuyId — null preserved when payload omits it', async () => {
  const db = freshDb();
  seedMediaInvoice(db, 'msi_nobuy', { mediaBuyId: null });
  const handler = loadHandler();

  await handler(makeEvent(db, {
    eventId: 'ev_m_nobuy',
    payload: {
      mediaSupplierInvoiceId: 'msi_nobuy',
      supplierOrgId: 'supplier_xyz',
      mediaPlanId: 'mp_2',
      // mediaBuyId omitted intentionally — plan-level invoice
      masterJobId: 'mj_2',
      vehicleType: 'OOH',
      amountMinor: 1_000_000,
      currency: 'USD',
      orgId: 'zeus-digital',
    },
  }));

  const docs = db._dump();
  const po = docs['purchase_orders/po_media_msi_nobuy'];
  assert.ok(po, 'PO must be created even without mediaBuyId');
  assert.equal(po.mediaBuyId, null, 'mediaBuyId must default to null');
  assert.equal(po.vehicleType, 'OOH');

  const raised = Object.values(docs).filter(d => d.eventType === 'PurchaseOrderRaised');
  assert.equal(raised[0].payload.mediaBuyId, null,
    'PurchaseOrderRaised payload propagates mediaBuyId=null');
});

test('replay — second invocation is idempotent', async () => {
  const db = freshDb();
  seedMediaInvoice(db, 'msi_idem');
  const handler = loadHandler();

  const ev = () => makeEvent(db, {
    eventId: 'ev_m_idem',
    payload: {
      mediaSupplierInvoiceId: 'msi_idem',
      supplierOrgId: 'supplier_xyz',
      mediaPlanId: 'mp_1',
      mediaBuyId: 'mb_1',
      masterJobId: 'mj_1',
      vehicleType: 'TV',
      amountMinor: 2_500_000,
      currency: 'USD',
      orgId: 'zeus-digital',
    },
  });

  await handler(ev());
  const firstPoCount = Object.keys(db._dump()).filter(k => k.startsWith('purchase_orders/')).length;
  const firstRaisedCount = Object.values(db._dump()).filter(d => d.eventType === 'PurchaseOrderRaised').length;

  await handler(ev());
  const secondPoCount = Object.keys(db._dump()).filter(k => k.startsWith('purchase_orders/')).length;
  const secondRaisedCount = Object.values(db._dump()).filter(d => d.eventType === 'PurchaseOrderRaised').length;

  assert.equal(secondPoCount, firstPoCount, 'replay must not create a second PO');
  assert.equal(secondRaisedCount, firstRaisedCount,
    'replay must not emit a second PurchaseOrderRaised event');
});

test('malformed payload — no PO created, event tagged :malformed', async () => {
  const db = freshDb();
  seedMediaInvoice(db, 'msi_bad');
  const handler = loadHandler();

  // Missing supplierOrgId — required.
  await handler(makeEvent(db, {
    eventId: 'ev_m_bad',
    payload: {
      mediaSupplierInvoiceId: 'msi_bad',
      mediaPlanId: 'mp_1',
      masterJobId: 'mj_1',
      vehicleType: 'TV',
      amountMinor: 2_500_000,
      currency: 'USD',
      orgId: 'zeus-digital',
    },
  }));

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'no PO doc must be created when payload is malformed',
  );
  const ev = docs['domain_events/ev_m_bad'];
  assert.ok(
    ev.processedBy.some(t => t.startsWith('media-supplier-invoice-po-raiser:malformed')),
    `event must be tagged :malformed, got ${JSON.stringify(ev.processedBy)}`,
  );
});

test('source-deleted — media_supplier_invoices doc removed, event tagged :source-deleted', async () => {
  const db = freshDb();
  // Do NOT seed media_supplier_invoices/msi_missing.
  const handler = loadHandler();

  await handler(makeEvent(db, {
    eventId: 'ev_m_missing',
    payload: {
      mediaSupplierInvoiceId: 'msi_missing',
      supplierOrgId: 'supplier_xyz',
      mediaPlanId: 'mp_1',
      mediaBuyId: 'mb_1',
      masterJobId: 'mj_1',
      vehicleType: 'TV',
      amountMinor: 2_500_000,
      currency: 'USD',
      orgId: 'zeus-digital',
    },
  }));

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'no PO doc must be created when source invoice is missing',
  );
  const ev = docs['domain_events/ev_m_missing'];
  assert.ok(
    ev.processedBy.some(t => t.startsWith('media-supplier-invoice-po-raiser:source-deleted')),
    `event must be tagged :source-deleted, got ${JSON.stringify(ev.processedBy)}`,
  );
});

test('wrong eventType — handler returns without side effects', async () => {
  const db = freshDb();
  seedMediaInvoice(db, 'msi_wrong');
  const handler = loadHandler();

  db._seed('domain_events/ev_wrong_m', {
    id: 'ev_wrong_m',
    eventType: 'TalentInvoiceApproved', // close-but-wrong
    payload: { mediaSupplierInvoiceId: 'msi_wrong' },
    processedBy: [],
  });

  await handler({
    params: { eventId: 'ev_wrong_m' },
    data: { data: () => db._dump()['domain_events/ev_wrong_m'] },
  });

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('purchase_orders/')).length,
    0,
    'wrong eventType must not raise a media PO',
  );
});
