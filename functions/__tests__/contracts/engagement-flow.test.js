/**
 * Phase 3.D — full engagement flow integration test.
 *
 * This is the headline acceptance criterion of the task brief:
 *
 *   "AM creates Client → MSA → SOW → accepts quote (3.C) → MasterJob
 *    auto-opens → issues IWO → subsidiary accepts (3.E flow) → AM sees
 *    burn updates live"
 *
 * We stitch every Phase 3.A.5 / 3.B / 3.C / 3.D moving part together using
 * the in-memory Firestore stub. Subsidiary-acceptance is exercised by
 * patching `assertDeliveryLead` to pass; the rest of the flow runs the
 * canonical Cloud Functions.
 *
 * Run:
 *   cd functions && node --test __tests__/contracts/engagement-flow.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('../assignment/_firestore-stub');
const { patchAuthForTests, patchRatePinningForTests, AM_USER, DELIVERY_USER, SUBSIDIARY } = require('../assignment/_seed-helpers');

let _adminDb;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return {
      getFirestore: () => _adminDb,
      FieldValue: stub.FieldValueStub,
    };
  }
  if (request === 'firebase-functions/v2/https') {
    const real = origLoad.call(this, request, ...rest);
    return {
      HttpsError: real.HttpsError,
      onCall: (_opts, maybeHandler) => {
        const handler = typeof _opts === 'function' ? _opts : maybeHandler;
        return (req) => handler(req);
      },
    };
  }
  if (request === 'firebase-functions/v2/firestore') {
    return { onDocumentCreated: (_cfg, handler) => handler };
  }
  return origLoad.call(this, request, ...rest);
};

const { db: stubDb } = stub.makeFirestore();
_adminDb = stubDb;
patchAuthForTests();
patchRatePinningForTests();

const msaAdmin = require('../../src/contracts/msaAdmin');
const sowAdmin = require('../../src/contracts/sowAdmin');
const issueWO = require('../../src/assignment/issueWorkOrder');
const acceptReject = require('../../src/assignment/acceptRejectWorkOrder');
const startWO = require('../../src/assignment/startWorkOrder');
const postTime = require('../../src/assignment/postTimeEntry');
const { openMasterJobOnQuoteAccepted } = require('../../src/assignment/openMasterJobOnQuoteAccepted');

const authAM = { uid: AM_USER, token: { email: 'am@zeus.test' } };
const authDL = { uid: DELIVERY_USER, token: { email: 'dl@zeus.test' } };

function findOne(prefix) {
  const entries = Object.entries(stubDb._dump()).filter(([k]) => k.startsWith(`${prefix}/`));
  if (entries.length !== 1) throw new Error(`expected 1 doc under ${prefix}, found ${entries.length}`);
  return entries[0];
}

test('end-to-end: Client → MSA → SOW → Quote(ACCEPTED) → MasterJob → IWO → accept → start → post → burn', async () => {
  // ── 1. Client seeded directly (upsertClient takes the same path) ──
  stubDb._seed('clients/c_e2e', {
    id: 'c_e2e', name: 'Diageo', parentOrgId: 'zeus-group', billingCurrency: 'USD', status: 'ACTIVE',
  });

  // ── 2. MSA: DRAFT → ACTIVE ──────────────────────────────────────────
  const msa = await msaAdmin.upsertMsa({
    auth: authAM,
    data: { clientId: 'c_e2e', title: 'Diageo Master Agreement', effectiveFrom: '2026-01-01' },
  });
  assert.equal(msa.status, 'DRAFT');
  await msaAdmin.activateMsa({ auth: authAM, data: { msaId: msa.id } });
  assert.equal(stubDb._dump()[`msas/${msa.id}`].status, 'ACTIVE');

  // ── 3. SOW: DRAFT → PENDING_APPROVAL → ACTIVE ───────────────────────
  const sow = await sowAdmin.upsertSow({
    auth: authAM,
    data: {
      msaId: msa.id, title: 'Smirnoff Mango Q2', type: 'PROJECT',
      ceilingMinor: 2_000_000, currency: 'USD',
      startDate: '2026-04-01', endDate: '2026-09-30',
    },
  });
  await sowAdmin.submitSowForApproval({ auth: authAM, data: { sowId: sow.id } });
  await sowAdmin.approveSow({ auth: authAM, data: { sowId: sow.id } });
  assert.equal(stubDb._dump()[`sows/${sow.id}`].status, 'ACTIVE');

  // ── 4. Quote: seed ACCEPTED + fire the QuoteAccepted event handler ──
  // (We bypass the 3.C priceQuote pipeline here — that's exercised in
  // pricing/computePricing.test.js. Our concern is the 3.D consumer.)
  const quoteId = 'q_e2e';
  stubDb._seed(`quotes/${quoteId}`, {
    id: quoteId, sowId: sow.id, clientId: 'c_e2e',
    status: 'ACCEPTED', clientTotalMinor: 1_800_000, currency: 'USD',
    pinnedRateCardIdsBySubsidiary: { [SUBSIDIARY]: 'rc_e2e_v1' },
  });
  const eventId = 'ev_qa_e2e';
  stubDb._seed(`domain_events/${eventId}`, {
    id: eventId, eventType: 'QuoteAccepted', aggregateType: 'Quote',
    aggregateId: quoteId,
    payload: { sowId: sow.id, quoteId, clientTotalMinor: 1_800_000, acceptedBy: AM_USER },
    processed: false, processedBy: [],
  });
  await openMasterJobOnQuoteAccepted({
    params: { eventId },
    data: { data: () => stubDb._dump()[`domain_events/${eventId}`] },
  });
  const [mjPath, mj] = findOne('master_jobs');
  assert.equal(mj.status, 'OPEN');
  assert.equal(mj.ceilingMinor, 1_800_000, 'master job ceiling copied from quote.clientTotalMinor');
  assert.equal(mj.allocatedMinor, 0);
  const masterJobId = mjPath.split('/')[1];

  // ── 5. Issue IWO ────────────────────────────────────────────────────
  const iwoResp = await issueWO.runIssueWorkOrder({
    db: stubDb, auth: authAM,
    data: {
      masterJobId,
      iwoInput: {
        subsidiaryOrgId: SUBSIDIARY,
        budgetMinor: 480_000,
        transferPriceMinor: 480_000,
        currency: 'USD',
        handoffPacket: {
          briefMd: 'Six launch KVs for Smirnoff Mango activation.',
          milestones: [{ id: 'm1', name: 'First round', dueDate: '2026-06-10' }],
          acceptanceCriteria: [{ id: 'c1', description: '6 KVs delivered, print + digital', required: true }],
          clientContextMd: 'Confident, warm tone.',
          commsOwnerUserId: AM_USER,
        },
      },
    },
  });
  assert.equal(iwoResp.status, 'ISSUED');
  assert.equal(iwoResp.allocatedAfterMinor, 480_000, 'master_job.allocatedMinor incremented inside same txn');

  // Verify the master_job.allocatedMinor and status are updated.
  const mjAfterIssue = stubDb._dump()[mjPath];
  assert.equal(mjAfterIssue.allocatedMinor, 480_000);
  assert.equal(mjAfterIssue.status, 'DELIVERING');

  // ── 6. Subsidiary accepts the IWO (3.E flow) ─────────────────────────
  await acceptReject.runAcceptWorkOrder({
    db: stubDb, auth: authDL, data: { iwoId: iwoResp.id },
  });
  const iwoAccepted = stubDb._dump()[`internal_work_orders/${iwoResp.id}`];
  assert.equal(iwoAccepted.state, 'ACCEPTED');

  // ── 7. Subsidiary starts work + posts a time entry ──────────────────
  await startWO.runStartWorkOrder({
    db: stubDb, auth: authDL, data: { iwoId: iwoResp.id },
  });
  assert.equal(stubDb._dump()[`internal_work_orders/${iwoResp.id}`].state, 'IN_PROGRESS');

  // 60 minutes at 100_00 minor/hour = 100_00 cumulative cost.
  await postTime.runPostTimeEntry({
    db: stubDb, auth: authDL,
    data: { iwoId: iwoResp.id, minutes: 60, entryDate: '2026-06-05', userId: DELIVERY_USER },
  });
  const iwoAfterPost = stubDb._dump()[`internal_work_orders/${iwoResp.id}`];
  assert.equal(iwoAfterPost.cumulativeCostMinor, 100_00,
    'cumulative cost reflects the posted time entry');

  // ── 8. AM sees the burn update via the rollup-shaped read ───────────
  // The MasterJobRollup hook reads the same docs we just wrote, so we
  // assert on the underlying values that drive it.
  const burn = (iwoAfterPost.cumulativeCostMinor / iwoAfterPost.budgetMinor) * 100;
  assert.ok(burn > 0 && burn < 100, 'burn% within (0, 100) after first post');
});

test('CEILING_EXCEEDED surfaces with structured error from issueWorkOrder', async () => {
  // Seed a master job with no headroom.
  stubDb._seed('sows/sow_full', {
    id: 'sow_full', status: 'ACTIVE', ceilingMinor: 100_000,
    startDate: '2026-01-01', endDate: '2026-12-31',
    currency: 'USD',
  });
  stubDb._seed('quotes/q_full', {
    id: 'q_full', sowId: 'sow_full', status: 'ACCEPTED', clientTotalMinor: 100_000,
  });
  stubDb._seed('master_jobs/mj_full', {
    id: 'mj_full', sowId: 'sow_full', quoteId: 'q_full', code: 'MJ-FULL',
    status: 'OPEN', allocatedMinor: 99_000, ceilingMinor: 100_000,
    clientTotalMinor: 100_000, currency: 'USD',
  });

  await assert.rejects(
    issueWO.runIssueWorkOrder({
      db: stubDb, auth: authAM,
      data: {
        masterJobId: 'mj_full',
        iwoInput: {
          subsidiaryOrgId: SUBSIDIARY,
          budgetMinor: 50_000, transferPriceMinor: 50_000, currency: 'USD',
          handoffPacket: {
            briefMd: 'Test brief',
            milestones: [{ id: 'm1', name: 'Done', dueDate: '2026-06-10' }],
            acceptanceCriteria: [{ id: 'c1', description: 'crit', required: true }],
            commsOwnerUserId: AM_USER,
          },
        },
      },
    }),
    (err) => {
      // The HttpsError's details carry the CEILING_EXCEEDED code — that's
      // what the UI's IssueIWODialog matches on to render the "Request
      // change order" CTA.
      const detailsCode = err && err.details && err.details.code;
      const messageHasCode = err && /CEILING_EXCEEDED/.test(err.message || '');
      return detailsCode === 'CEILING_EXCEEDED' || messageHasCode;
    },
  );
});
