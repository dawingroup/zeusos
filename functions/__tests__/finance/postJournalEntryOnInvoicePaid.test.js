/**
 * postJournalEntryOnInvoicePaid — Phase 4.1 finance consumer test.
 *
 * Exercises the bottom of the supplier-invoice → PO → JE chain
 * (plan §15 acceptance). The consumer listens for `PurchaseOrderRaised`
 * (emitted by the two upstream consumers) and `ClientInvoicePaid`
 * (emitted by Phase 3.F billing), then writes a balanced double-entry
 * journal against the chart of accounts.
 *
 * Scenarios:
 *   • talent PO → debits 5010, credits 2050.
 *   • media PO  → debits 5020, credits 2051; PO flipped to POSTED + postedToGL.
 *   • client invoice paid → debits 1200, credits 4000.
 *   • idempotency by deterministic JE id.
 *   • unknown source kind → event tagged :unknown-kind, no JE.
 *   • malformed payload (missing amount/orgId) → event tagged :malformed.
 *   • CoA override via `finance_config/chart_of_accounts` — Firestore
 *     value beats the compiled default.
 *
 * Run:
 *   cd functions && node --test __tests__/finance/postJournalEntryOnInvoicePaid.test.js
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

function seedPo(db, poId, overrides = {}) {
  db._seed(`purchase_orders/${poId}`, {
    id: poId,
    kind: 'TALENT_FREELANCER',
    status: 'OPEN',
    postedToGL: false,
    ...overrides,
  });
}

function makePoRaisedEvent(db, { eventId, kind, poId, amountMinor, currency = 'USD', orgId = 'zeus-the-agency', processedBy = [] }) {
  db._seed(`domain_events/${eventId}`, {
    id: eventId,
    eventType: 'PurchaseOrderRaised',
    aggregateType: 'PurchaseOrder',
    aggregateId: poId,
    payload: {
      kind,
      poId,
      amountMinor,
      currency,
      orgId,
      sourceInvoiceId: `src_${poId}`,
    },
    processedBy,
  });
  return {
    params: { eventId },
    data: { data: () => db._dump()[`domain_events/${eventId}`] },
  };
}

function makeClientInvoicePaidEvent(db, { eventId, clientInvoiceId, amountMinor, currency = 'USD', orgId = 'zeus-the-agency' }) {
  db._seed(`domain_events/${eventId}`, {
    id: eventId,
    eventType: 'ClientInvoicePaid',
    aggregateType: 'ClientInvoice',
    aggregateId: clientInvoiceId,
    payload: { clientInvoiceId, amountMinor, currency, orgId },
    processedBy: [],
  });
  return {
    params: { eventId },
    data: { data: () => db._dump()[`domain_events/${eventId}`] },
  };
}

function loadHandler() {
  delete require.cache[require.resolve('../../src/finance/postJournalEntryOnInvoicePaid')];
  delete require.cache[require.resolve('../../src/finance/chartOfAccounts')];
  delete require.cache[require.resolve('../../src/platform/outbox')];
  return require('../../src/finance/postJournalEntryOnInvoicePaid').postJournalEntryOnInvoicePaid;
}

test('talent PO → debits Contractor Fees 5010, credits Accounts Payable 2050', async () => {
  const db = freshDb();
  seedPo(db, 'po_talent_ti_1', { kind: 'TALENT_FREELANCER' });
  const handler = loadHandler();

  await handler(makePoRaisedEvent(db, {
    eventId: 'ev_t',
    kind: 'TALENT_FREELANCER',
    poId: 'po_talent_ti_1',
    amountMinor: 500_000,
  }));

  const docs = db._dump();
  const je = docs['journal_entries/je_talent_freelancer_po_talent_ti_1'];
  assert.ok(je, 'JE doc must exist at deterministic id');
  assert.equal(je.kind, 'TALENT_FREELANCER');
  assert.equal(je.sourceDocId, 'po_talent_ti_1');
  assert.equal(je.currency, 'USD');
  assert.equal(je.debits.length, 1);
  assert.equal(je.debits[0].accountCode, '5010');
  assert.equal(je.debits[0].accountName, 'Contractor Fees - Talent & Freelancers');
  assert.equal(je.debits[0].amountMinor, 500_000);
  assert.equal(je.credits.length, 1);
  assert.equal(je.credits[0].accountCode, '2050');
  assert.equal(je.credits[0].accountName, 'Accounts Payable - Contractors');
  assert.equal(je.credits[0].amountMinor, 500_000);

  // Balance check passes.
  const totalDebits = je.debits.reduce((s, l) => s + l.amountMinor, 0);
  const totalCredits = je.credits.reduce((s, l) => s + l.amountMinor, 0);
  assert.equal(totalDebits, totalCredits);

  // Source PO flipped.
  const po = docs['purchase_orders/po_talent_ti_1'];
  assert.equal(po.postedToGL, true, 'PO must be flipped to postedToGL=true');
  assert.equal(po.status, 'POSTED', 'PO status must advance to POSTED');

  // JournalEntryPosted emitted.
  const posted = Object.values(docs).filter(d => d.eventType === 'JournalEntryPosted');
  assert.equal(posted.length, 1);
  assert.equal(posted[0].payload.jeId, 'je_talent_freelancer_po_talent_ti_1');

  // Source event tagged.
  const ev = docs['domain_events/ev_t'];
  assert.ok(ev.processedBy.includes('finance-je-poster'));
});

test('media PO → debits Media Spend 5020, credits Accounts Payable 2051', async () => {
  const db = freshDb();
  seedPo(db, 'po_media_msi_1', { kind: 'MEDIA_SUPPLIER' });
  const handler = loadHandler();

  await handler(makePoRaisedEvent(db, {
    eventId: 'ev_m',
    kind: 'MEDIA_SUPPLIER',
    poId: 'po_media_msi_1',
    amountMinor: 2_500_000,
  }));

  const docs = db._dump();
  const je = docs['journal_entries/je_media_supplier_po_media_msi_1'];
  assert.ok(je, 'media JE must exist');
  assert.equal(je.debits[0].accountCode, '5020');
  assert.equal(je.credits[0].accountCode, '2051');
  assert.equal(je.debits[0].amountMinor, 2_500_000);
  assert.equal(je.credits[0].amountMinor, 2_500_000);

  const po = docs['purchase_orders/po_media_msi_1'];
  assert.equal(po.postedToGL, true);
  assert.equal(po.status, 'POSTED');
});

test('ClientInvoicePaid → debits AR 1200, credits Service Revenue 4000', async () => {
  const db = freshDb();
  const handler = loadHandler();

  await handler(makeClientInvoicePaidEvent(db, {
    eventId: 'ev_ci',
    clientInvoiceId: 'ci_abc',
    amountMinor: 12_000_000,
  }));

  const docs = db._dump();
  const je = docs['journal_entries/je_client_revenue_recognised_ci_abc'];
  assert.ok(je, 'client-revenue JE must exist');
  assert.equal(je.kind, 'CLIENT_REVENUE_RECOGNISED');
  assert.equal(je.debits[0].accountCode, '1200');
  assert.equal(je.debits[0].accountName, 'Accounts Receivable - Clients');
  assert.equal(je.credits[0].accountCode, '4000');
  assert.equal(je.credits[0].accountName, 'Service Revenue - Agencies');
});

test('replay — second invocation is idempotent', async () => {
  const db = freshDb();
  seedPo(db, 'po_talent_idem', { kind: 'TALENT_FREELANCER' });
  const handler = loadHandler();

  const ev = () => makePoRaisedEvent(db, {
    eventId: 'ev_je_idem',
    kind: 'TALENT_FREELANCER',
    poId: 'po_talent_idem',
    amountMinor: 500_000,
  });

  await handler(ev());
  const firstJeCount = Object.keys(db._dump()).filter(k => k.startsWith('journal_entries/')).length;
  const firstPostedCount = Object.values(db._dump()).filter(d => d.eventType === 'JournalEntryPosted').length;

  await handler(ev());
  const secondJeCount = Object.keys(db._dump()).filter(k => k.startsWith('journal_entries/')).length;
  const secondPostedCount = Object.values(db._dump()).filter(d => d.eventType === 'JournalEntryPosted').length;

  assert.equal(secondJeCount, firstJeCount, 'replay must not create a second JE');
  assert.equal(secondPostedCount, firstPostedCount,
    'replay must not emit a second JournalEntryPosted event');
});

test('unknown source kind — event tagged :unknown-kind, no JE', async () => {
  const db = freshDb();
  seedPo(db, 'po_weird_kind', { kind: 'UNRECOGNISED' });
  const handler = loadHandler();

  await handler(makePoRaisedEvent(db, {
    eventId: 'ev_weird',
    kind: 'UNRECOGNISED',
    poId: 'po_weird_kind',
    amountMinor: 100_000,
  }));

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('journal_entries/')).length,
    0,
    'no JE must be created for unknown kind',
  );
  const ev = docs['domain_events/ev_weird'];
  assert.ok(
    ev.processedBy.some(t => t.startsWith('finance-je-poster:unknown-kind')),
    `event must be tagged :unknown-kind, got ${JSON.stringify(ev.processedBy)}`,
  );
  // PO must remain OPEN — never advance an un-postable PO.
  const po = docs['purchase_orders/po_weird_kind'];
  assert.equal(po.postedToGL, false);
});

test('malformed payload — missing amountMinor → event tagged :malformed', async () => {
  const db = freshDb();
  const handler = loadHandler();

  db._seed('domain_events/ev_malformed', {
    id: 'ev_malformed',
    eventType: 'PurchaseOrderRaised',
    aggregateType: 'PurchaseOrder',
    payload: {
      kind: 'TALENT_FREELANCER',
      poId: 'po_no_amount',
      currency: 'USD',
      orgId: 'zeus-the-agency',
      // amountMinor omitted!
    },
    processedBy: [],
  });

  await handler({
    params: { eventId: 'ev_malformed' },
    data: { data: () => db._dump()['domain_events/ev_malformed'] },
  });

  const docs = db._dump();
  assert.equal(
    Object.keys(docs).filter(k => k.startsWith('journal_entries/')).length,
    0,
    'malformed payload must not create a JE',
  );
  const ev = docs['domain_events/ev_malformed'];
  assert.ok(
    ev.processedBy.some(t => t.startsWith('finance-je-poster:malformed')),
    `event must be tagged :malformed, got ${JSON.stringify(ev.processedBy)}`,
  );
});

test('CoA override via finance_config/chart_of_accounts beats the default', async () => {
  const db = freshDb();
  // Seed the override. Use different codes than the defaults so we can
  // assert they came from Firestore, not the compiled-in mapping.
  db._seed('finance_config/chart_of_accounts', {
    version: 2,
    entries: {
      TALENT_FREELANCER: {
        debit: { accountCode: '5099', accountName: 'Custom Talent Spend (Zeus KE)' },
        credit: { accountCode: '2099', accountName: 'Custom Talent Payable (Zeus KE)' },
      },
      // MEDIA_SUPPLIER intentionally omitted to verify partial override
      // falls back to defaults for that kind.
    },
  });
  seedPo(db, 'po_talent_custom', { kind: 'TALENT_FREELANCER' });
  seedPo(db, 'po_media_default', { kind: 'MEDIA_SUPPLIER' });
  const handler = loadHandler();

  await handler(makePoRaisedEvent(db, {
    eventId: 'ev_custom',
    kind: 'TALENT_FREELANCER',
    poId: 'po_talent_custom',
    amountMinor: 1_000_000,
  }));
  await handler(makePoRaisedEvent(db, {
    eventId: 'ev_default',
    kind: 'MEDIA_SUPPLIER',
    poId: 'po_media_default',
    amountMinor: 2_000_000,
  }));

  const docs = db._dump();
  const talentJe = docs['journal_entries/je_talent_freelancer_po_talent_custom'];
  assert.equal(talentJe.debits[0].accountCode, '5099',
    'TALENT override must come from Firestore CoA, not default 5010');
  assert.equal(talentJe.credits[0].accountCode, '2099');

  const mediaJe = docs['journal_entries/je_media_supplier_po_media_default'];
  assert.equal(mediaJe.debits[0].accountCode, '5020',
    'MEDIA kind must fall back to default 5020 when not overridden');
  assert.equal(mediaJe.credits[0].accountCode, '2051');
});

test('CoA override with malformed entry — falls back to default for that kind', async () => {
  const db = freshDb();
  db._seed('finance_config/chart_of_accounts', {
    version: 3,
    entries: {
      TALENT_FREELANCER: {
        debit: { accountCode: '9999' },  // accountName missing
        credit: { accountCode: '2050', accountName: 'AP - Contractors' },
      },
    },
  });
  seedPo(db, 'po_talent_malformed_override', { kind: 'TALENT_FREELANCER' });
  const handler = loadHandler();

  await handler(makePoRaisedEvent(db, {
    eventId: 'ev_malf_co',
    kind: 'TALENT_FREELANCER',
    poId: 'po_talent_malformed_override',
    amountMinor: 750_000,
  }));

  const docs = db._dump();
  const je = docs['journal_entries/je_talent_freelancer_po_talent_malformed_override'];
  assert.ok(je, 'JE must still be created (override falls back to default)');
  assert.equal(je.debits[0].accountCode, '5010',
    'malformed override entry must fall back to the compiled default');
});

test('non-handled event type — returns without side effects', async () => {
  const db = freshDb();
  const handler = loadHandler();

  db._seed('domain_events/ev_nope', {
    id: 'ev_nope',
    eventType: 'QuoteAccepted',
    payload: {},
    processedBy: [],
  });

  await handler({
    params: { eventId: 'ev_nope' },
    data: { data: () => db._dump()['domain_events/ev_nope'] },
  });

  assert.equal(
    Object.keys(db._dump()).filter(k => k.startsWith('journal_entries/')).length,
    0,
    'unhandled event type must not write a JE',
  );
});
