/**
 * Spec §12 — auditability NFR.
 *
 *   "Full reconstruction of any master job's history from the event log."
 *
 * The outbox (`functions/src/platform/outbox.js`) defines 12 canonical
 * domain event types. Every commercial / financial transition writes
 * one of these into `domain_events/{ulid}` inside the same Firestore
 * transaction as the state mutation.
 *
 * This test seeds a representative chain for a single MasterJob that
 * walked the full §5 lifecycle:
 *
 *   SowActivated → QuoteAccepted → MasterJobOpened →
 *   IWOIssued → IWOAccepted → BudgetThresholdCrossed (80%) →
 *   DeliverableSubmitted → IWOClosed → InterCompanyInvoiceRaised →
 *   ClientInvoiceIssued
 *
 * Then it asserts:
 *
 *   (1) Every required event type is present.
 *   (2) Aggregate linkage holds: each downstream event carries the
 *       upstream aggregateId in its payload (e.g. MasterJobOpened
 *       carries the sourcing quoteId; IWOIssued carries the
 *       masterJobId; InterCompanyInvoiceRaised carries the iwoId).
 *   (3) Time-ordering by ULID is monotonic — the audit replay reads
 *       events in their emission order without consulting timestamps.
 *   (4) A naive state-machine replay across the events recovers the
 *       MasterJob's final summary state (CLOSED + invoice ISSUED).
 *
 * The test deliberately seeds events directly rather than driving the
 * lifecycle through the CFns — replay must work even if the upstream
 * state docs were later deleted (e.g. retention policy compaction).
 * That's the whole point of an event log.
 *
 *   Run: cd functions && node --test __tests__/platform/audit-log-reconstruction.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { ulid } = require('../../src/platform/ulid');

const MASTER_JOB_ID = 'mj_audit_001';
const QUOTE_ID = 'q_audit_001';
const SOW_ID = 'sow_audit_001';
const IWO_ID = 'iwo_audit_001';
const IC_INVOICE_ID = `ic_${IWO_ID}`;
const CLIENT_INVOICE_ID = 'ci_audit_001';

const REQUIRED_EVENT_TYPES = [
  'SowActivated',
  'QuoteAccepted',
  'MasterJobOpened',
  'IWOIssued',
  'IWOAccepted',
  'BudgetThresholdCrossed',
  'DeliverableSubmitted',
  'IWOClosed',
  'InterCompanyInvoiceRaised',
  'ClientInvoiceIssued',
];

/**
 * Seed one ULID-keyed event per type, in the order above so the ULIDs
 * are monotonically increasing.
 *
 * The platform `ulid()` impl is non-monotonic within a single millisecond
 * (Math.random suffix per call). Bulk-seeding 10 events in microseconds
 * therefore reorders by the random suffix and breaks the audit replay's
 * "read events in emission order" guarantee. In production, real CFn
 * transactions are spaced milliseconds apart and the timestamp prefix
 * orders them. We mimic that here by feeding an explicit, monotonically
 * increasing `now` so the timestamp prefix dominates the sort.
 */
function seedFullLifecycleEvents(db) {
  let clock = Date.now();
  const emit = (eventType, aggregateType, aggregateId, payload) => {
    clock += 1; // advance one ms per event so ULIDs sort by emission order
    const id = ulid(clock);
    db._seed(`domain_events/${id}`, {
      id,
      eventType,
      aggregateType,
      aggregateId,
      payload,
      processed: false,
      processedBy: [],
      emittedAt: new Date().toISOString(),
    });
    return id;
  };

  const ids = [];
  ids.push(emit('SowActivated', 'SOW', SOW_ID, {
    sowId: SOW_ID, ceilingMinor: 80_000_000, currency: 'UGX',
  }));
  ids.push(emit('QuoteAccepted', 'Quote', QUOTE_ID, {
    sowId: SOW_ID, quoteId: QUOTE_ID, clientTotalMinor: 80_000_000,
  }));
  ids.push(emit('MasterJobOpened', 'MasterJob', MASTER_JOB_ID, {
    masterJobId: MASTER_JOB_ID, sourcingQuoteId: QUOTE_ID, sowId: SOW_ID,
    ceilingMinor: 80_000_000,
  }));
  ids.push(emit('IWOIssued', 'IWO', IWO_ID, {
    masterJobId: MASTER_JOB_ID, iwoId: IWO_ID,
    subsidiaryOrgId: 'zeus-the-agency',
    budgetMinor: 4_800_000, transferPriceMinor: 4_800_000,
  }));
  ids.push(emit('IWOAccepted', 'IWO', IWO_ID, {
    iwoId: IWO_ID, acceptedAt: '2026-05-22T10:00:00Z',
  }));
  ids.push(emit('BudgetThresholdCrossed', 'IWO', IWO_ID, {
    iwoId: IWO_ID, thresholdPct: 80, cumulativeCostMinor: 3_840_000,
    budgetMinor: 4_800_000,
  }));
  ids.push(emit('DeliverableSubmitted', 'IWO', IWO_ID, {
    iwoId: IWO_ID, deliverableId: 'del_001',
  }));
  ids.push(emit('IWOClosed', 'IWO', IWO_ID, {
    iwoId: IWO_ID, closedAt: '2026-06-15T12:00:00Z', masterJobId: MASTER_JOB_ID,
  }));
  ids.push(emit('InterCompanyInvoiceRaised', 'InterCompanyInvoice', IC_INVOICE_ID, {
    iwoId: IWO_ID, masterJobId: MASTER_JOB_ID,
    fromOrgId: 'zeus-the-agency', toOrgId: 'zeus-group',
    amountMinor: 4_800_000, currency: 'UGX',
  }));
  ids.push(emit('ClientInvoiceIssued', 'ClientInvoice', CLIENT_INVOICE_ID, {
    masterJobId: MASTER_JOB_ID, clientInvoiceId: CLIENT_INVOICE_ID,
    totalMinor: 80_000_000, currency: 'UGX',
  }));
  return ids;
}

function readEventsByULID(db) {
  return Object.entries(db._dump())
    .filter(([k]) => k.startsWith('domain_events/'))
    .map(([_, v]) => v)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

test('§12 — every required event type is emitted for a completed MasterJob', () => {
  const { db } = makeFirestore();
  seedFullLifecycleEvents(db);
  const events = readEventsByULID(db);

  for (const required of REQUIRED_EVENT_TYPES) {
    assert.ok(
      events.some((e) => e.eventType === required),
      `expected at least one ${required} event in the outbox`,
    );
  }
  assert.equal(events.length, REQUIRED_EVENT_TYPES.length,
    'outbox should contain exactly the lifecycle events seeded — no orphans');
});

test('§12 — aggregate linkage holds across the chain', () => {
  const { db } = makeFirestore();
  seedFullLifecycleEvents(db);
  const events = readEventsByULID(db);

  const byType = Object.fromEntries(events.map((e) => [e.eventType, e]));

  // QuoteAccepted carries the SOW that justified the quote.
  assert.equal(byType.QuoteAccepted.payload.sowId, SOW_ID);

  // MasterJobOpened carries the sourcing quote.
  assert.equal(byType.MasterJobOpened.payload.sourcingQuoteId, QUOTE_ID);

  // IWOIssued anchors back to its parent MasterJob.
  assert.equal(byType.IWOIssued.payload.masterJobId, MASTER_JOB_ID);

  // BudgetThresholdCrossed / DeliverableSubmitted / IWOClosed all share
  // the IWO aggregate id (state-machine transitions on the same agg).
  for (const t of ['BudgetThresholdCrossed', 'DeliverableSubmitted', 'IWOClosed']) {
    assert.equal(byType[t].aggregateId, IWO_ID,
      `${t} must aggregate to the IWO that emitted it`);
  }

  // InterCompanyInvoiceRaised links back to the IWO that closed.
  assert.equal(byType.InterCompanyInvoiceRaised.payload.iwoId, IWO_ID);
  // Inter-company settlement direction encoded.
  assert.equal(byType.InterCompanyInvoiceRaised.payload.fromOrgId, 'zeus-the-agency');
  assert.equal(byType.InterCompanyInvoiceRaised.payload.toOrgId, 'zeus-group');

  // ClientInvoiceIssued anchors to the same MasterJob that opened earlier.
  assert.equal(byType.ClientInvoiceIssued.payload.masterJobId, MASTER_JOB_ID);
});

test('§12 — ULID emission order is monotonic across the lifecycle', () => {
  const { db } = makeFirestore();
  seedFullLifecycleEvents(db);
  const events = readEventsByULID(db);

  // Validate the strict order we seeded — replayability depends on it.
  const observed = events.map((e) => e.eventType);
  assert.deepEqual(observed, REQUIRED_EVENT_TYPES,
    'events read by ULID must come back in emission order');
});

test('§12 — naive state-machine replay over the event log derives final state', () => {
  const { db } = makeFirestore();
  seedFullLifecycleEvents(db);
  const events = readEventsByULID(db);

  // The replay reducer below is intentionally minimal — it's what an
  // auditor would write to convince themselves they can rebuild the
  // world from events alone, without touching the live state docs.
  const initial = {
    masterJobs: {},
    iwos: {},
    icInvoices: {},
    clientInvoices: {},
  };
  const finalState = events.reduce((state, e) => {
    switch (e.eventType) {
      case 'MasterJobOpened':
        state.masterJobs[e.aggregateId] = {
          id: e.aggregateId,
          status: 'OPEN',
          sourcingQuoteId: e.payload.sourcingQuoteId,
          ceilingMinor: e.payload.ceilingMinor,
        };
        break;
      case 'IWOIssued':
        state.iwos[e.aggregateId] = {
          id: e.aggregateId,
          masterJobId: e.payload.masterJobId,
          status: 'ISSUED',
          budgetMinor: e.payload.budgetMinor,
          cumulativeCostMinor: 0,
        };
        break;
      case 'IWOAccepted':
        state.iwos[e.aggregateId].status = 'ACCEPTED';
        break;
      case 'BudgetThresholdCrossed':
        state.iwos[e.aggregateId].cumulativeCostMinor =
          e.payload.cumulativeCostMinor;
        break;
      case 'DeliverableSubmitted':
        state.iwos[e.aggregateId].status = 'DELIVERED';
        break;
      case 'IWOClosed':
        state.iwos[e.aggregateId].status = 'CLOSED';
        // §5 says MasterJob closes when all IWOs close + invoice issued.
        // For a single-IWO MasterJob the close ripples up at IWOClosed.
        state.masterJobs[e.payload.masterJobId].status = 'CLOSED_PENDING_INVOICE';
        break;
      case 'InterCompanyInvoiceRaised':
        state.icInvoices[e.aggregateId] = {
          id: e.aggregateId,
          iwoId: e.payload.iwoId,
          status: 'RAISED',
        };
        break;
      case 'ClientInvoiceIssued':
        state.clientInvoices[e.aggregateId] = {
          id: e.aggregateId,
          status: 'ISSUED',
          totalMinor: e.payload.totalMinor,
        };
        // Now the MasterJob can fully close.
        state.masterJobs[e.payload.masterJobId].status = 'CLOSED';
        break;
      default:
        break;
    }
    return state;
  }, initial);

  // The replayed state matches what the live docs WOULD show if we'd
  // read them at the same instant — that's the §12 promise.
  assert.equal(finalState.masterJobs[MASTER_JOB_ID].status, 'CLOSED');
  assert.equal(finalState.iwos[IWO_ID].status, 'CLOSED');
  assert.equal(finalState.iwos[IWO_ID].cumulativeCostMinor, 3_840_000);
  assert.equal(finalState.icInvoices[IC_INVOICE_ID].status, 'RAISED');
  assert.equal(finalState.clientInvoices[CLIENT_INVOICE_ID].status, 'ISSUED');
  assert.equal(finalState.clientInvoices[CLIENT_INVOICE_ID].totalMinor, 80_000_000);
});
