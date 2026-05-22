/**
 * Phase 3.D — openMasterJobOnQuoteAccepted listener test.
 *
 * Simulates the QuoteAccepted outbox event and verifies the listener:
 *   - Creates a master_job with ceilingMinor = quote.clientTotalMinor
 *   - Stamps the quote with the new masterJobId
 *   - Emits a MasterJobOpened event into the outbox
 *   - Is idempotent (replay produces no second master job)
 *
 * Run:
 *   cd functions && node --test __tests__/assignment/open-master-job-on-quote-accepted.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('./_firestore-stub');

// Stub firebase-admin BEFORE requiring the module under test.
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
    // The CF uses `onDocumentCreated` for wiring. For unit tests we
    // build a stand-in that just returns the user handler.
    return {
      onDocumentCreated: (_cfg, handler) => handler,
    };
  }
  return origLoad.call(this, request, ...rest);
};

const { db: stubDb } = stub.makeFirestore();
_adminDb = stubDb;
const { openMasterJobOnQuoteAccepted: handler } = require('../../src/assignment/openMasterJobOnQuoteAccepted');

// Event factory — mimics the onDocumentCreated v2 event shape.
function makeEvent({ eventId, payload }) {
  // The handler reads event.data.data() to get the row, and
  // event.params.eventId for the doc id.
  stubDb._seed(`domain_events/${eventId}`, {
    id: eventId,
    eventType: 'QuoteAccepted',
    aggregateType: 'Quote',
    aggregateId: payload.quoteId,
    payload,
    processed: false,
    processedBy: [],
  });
  return {
    params: { eventId },
    data: {
      data: () => stubDb._dump()[`domain_events/${eventId}`],
    },
  };
}

test('opens MasterJob with ceilingMinor from quote.clientTotalMinor', async () => {
  // Seed prerequisites.
  stubDb._seed('quotes/q_open1', {
    id: 'q_open1',
    sowId: 'sow_open1',
    clientId: 'c_open1',
    status: 'ACCEPTED',
    clientTotalMinor: 1_500_000,
    currency: 'USD',
  });
  stubDb._seed('sows/sow_open1', {
    id: 'sow_open1',
    clientId: 'c_open1',
    status: 'ACTIVE',
    ceilingMinor: 1_500_000,
    currency: 'USD',
  });

  await handler(makeEvent({
    eventId: 'ev_open1',
    payload: { sowId: 'sow_open1', quoteId: 'q_open1', clientTotalMinor: 1_500_000, acceptedBy: 'u1' },
  }));

  // Master job exists.
  const allDocs = stubDb._dump();
  const mjEntries = Object.entries(allDocs).filter(([k]) => k.startsWith('master_jobs/'));
  assert.equal(mjEntries.length, 1, 'exactly one master_job opened');
  const [, mj] = mjEntries[0];
  assert.equal(mj.sowId, 'sow_open1');
  assert.equal(mj.quoteId, 'q_open1');
  assert.equal(mj.clientId, 'c_open1');
  assert.equal(mj.status, 'OPEN');
  assert.equal(mj.allocatedMinor, 0);
  assert.equal(mj.ceilingMinor, 1_500_000, 'ceiling copied from quote.clientTotalMinor');
  assert.equal(mj.clientTotalMinor, 1_500_000);
  assert.equal(mj.currency, 'USD');

  // Quote stamped with masterJobId.
  const quote = allDocs['quotes/q_open1'];
  assert.equal(quote.masterJobId, mj.id);

  // Event tagged processed.
  const ev = allDocs['domain_events/ev_open1'];
  assert.ok(Array.isArray(ev.processedBy) && ev.processedBy.includes('master-job-opener'));

  // MasterJobOpened event emitted.
  const opened = Object.values(allDocs).filter(d => d.eventType === 'MasterJobOpened');
  assert.equal(opened.length, 1);
  assert.equal(opened[0].aggregateId, mj.id);
});

test('replay is idempotent (no second master job)', async () => {
  stubDb._seed('quotes/q_idem', {
    id: 'q_idem', sowId: 'sow_idem', clientId: 'c_idem',
    status: 'ACCEPTED', clientTotalMinor: 600_000, currency: 'USD',
  });
  stubDb._seed('sows/sow_idem', {
    id: 'sow_idem', clientId: 'c_idem', status: 'ACTIVE',
    ceilingMinor: 600_000, currency: 'USD',
  });

  await handler(makeEvent({
    eventId: 'ev_idem1',
    payload: { sowId: 'sow_idem', quoteId: 'q_idem', acceptedBy: 'u1' },
  }));
  const firstMjCount = Object.keys(stubDb._dump()).filter(k => k.startsWith('master_jobs/')).length;

  // Replay the same event.
  await handler(makeEvent({
    eventId: 'ev_idem1',
    payload: { sowId: 'sow_idem', quoteId: 'q_idem', acceptedBy: 'u1' },
  }));
  const secondMjCount = Object.keys(stubDb._dump()).filter(k => k.startsWith('master_jobs/')).length;
  assert.equal(secondMjCount, firstMjCount, 'replay should not create a duplicate master job');
});

test('skips when quote already has a masterJobId', async () => {
  stubDb._seed('quotes/q_already', {
    id: 'q_already', sowId: 'sow_already', clientId: 'c_already',
    status: 'ACCEPTED', clientTotalMinor: 700_000, currency: 'USD',
    masterJobId: 'mj_pre_existing',
  });
  stubDb._seed('sows/sow_already', {
    id: 'sow_already', clientId: 'c_already', status: 'ACTIVE',
    ceilingMinor: 700_000, currency: 'USD',
  });

  const before = Object.keys(stubDb._dump()).filter(k => k.startsWith('master_jobs/')).length;
  await handler(makeEvent({
    eventId: 'ev_already',
    payload: { sowId: 'sow_already', quoteId: 'q_already' },
  }));
  const after = Object.keys(stubDb._dump()).filter(k => k.startsWith('master_jobs/')).length;
  assert.equal(after, before, 'no new master job when quote already names one');
  const ev = stubDb._dump()['domain_events/ev_already'];
  assert.ok(ev.processedBy.includes('master-job-opener'));
});
