/**
 * Phase 3.D — Contracts mutations smoke tests.
 *
 * Exercises the upsert / approve / cancel path for MSA → SOW → CO using
 * the in-memory Firestore stub. Validates:
 *   - DRAFT → ACTIVE state machine for MSA
 *   - SOW PENDING_APPROVAL gate (parent MSA must be ACTIVE)
 *   - SowActivated outbox event emitted on approveSow
 *   - approveChangeOrder atomically adjusts SOW.ceilingMinor AND
 *     ripples to OPEN master jobs (§11.4)
 *
 * Run:
 *   cd functions && node --test __tests__/contracts/contract-mutations.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('../assignment/_firestore-stub');
const { patchAuthForTests, AM_USER } = require('../assignment/_seed-helpers');

// ─── firebase-admin + firebase-functions stubbing ──────────────────────
// We intercept BOTH firebase-admin/firestore (to swap in the in-memory
// stub) AND firebase-functions/v2/https (to make `onCall` return the
// raw handler so we can call it like a normal async function in tests).
// Has to happen BEFORE requiring the modules under test.

let _adminDb;
let _stubbedHttpsError;
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
    _stubbedHttpsError = real.HttpsError;
    return {
      HttpsError: real.HttpsError,
      // onCall(opts, handler) → return a plain async fn that accepts
      // the request envelope { auth, data } and calls the handler.
      onCall: (_optsOrHandler, maybeHandler) => {
        const handler = typeof _optsOrHandler === 'function' ? _optsOrHandler : maybeHandler;
        return (request) => handler(request);
      },
    };
  }
  return origLoad.call(this, request, ...rest);
};

const { db: stubDb } = stub.makeFirestore();
_adminDb = stubDb;
patchAuthForTests();

const msaAdmin = require('../../src/contracts/msaAdmin');
const sowAdmin = require('../../src/contracts/sowAdmin');
const coAdmin = require('../../src/contracts/changeOrderAdmin');

async function callOnCall(callable, { auth, data }) {
  return callable({ auth, data });
}

test('upsertMsa → activateMsa flips DRAFT → ACTIVE', async () => {
  // Seed a client.
  stubDb._seed('clients/c1', { id: 'c1', name: 'Diageo', parentOrgId: 'zeus-group' });

  const upsertResp = await callOnCall(msaAdmin.upsertMsa, {
    auth: { uid: AM_USER, token: { email: 'am@zeus.test' } },
    data: { clientId: 'c1', title: 'Master agreement 2026', effectiveFrom: '2026-01-01' },
  });
  assert.equal(upsertResp.status, 'DRAFT');
  assert.ok(upsertResp.id);

  const activateResp = await callOnCall(msaAdmin.activateMsa, {
    auth: { uid: AM_USER, token: { email: 'am@zeus.test' } },
    data: { msaId: upsertResp.id },
  });
  assert.equal(activateResp.status, 'ACTIVE');

  const after = stubDb._dump()[`msas/${upsertResp.id}`];
  assert.equal(after.status, 'ACTIVE');
  assert.equal(after.activatedByUserId, AM_USER);
});

test('upsertSow requires positive ceilingMinor + valid type', async () => {
  await assert.rejects(
    callOnCall(sowAdmin.upsertSow, {
      auth: { uid: AM_USER, token: {} },
      data: { msaId: 'msa_x', title: 't', type: 'BAD', ceilingMinor: 1000, currency: 'USD' },
    }),
    /type must be one of/,
  );
  await assert.rejects(
    callOnCall(sowAdmin.upsertSow, {
      auth: { uid: AM_USER, token: {} },
      data: { msaId: 'msa_x', title: 't', type: 'PROJECT', ceilingMinor: -5, currency: 'USD' },
    }),
    /ceilingMinor must be a positive integer/,
  );
});

test('submitSowForApproval blocked when parent MSA is DRAFT', async () => {
  stubDb._seed('clients/c2', { id: 'c2', name: 'KCB', parentOrgId: 'zeus-group' });
  stubDb._seed('msas/msa_draft', { id: 'msa_draft', clientId: 'c2', status: 'DRAFT' });

  const sowResp = await callOnCall(sowAdmin.upsertSow, {
    auth: { uid: AM_USER, token: {} },
    data: {
      msaId: 'msa_draft', title: 'Q2', type: 'PROJECT',
      ceilingMinor: 500_000, currency: 'USD',
    },
  });
  await assert.rejects(
    callOnCall(sowAdmin.submitSowForApproval, {
      auth: { uid: AM_USER, token: {} },
      data: { sowId: sowResp.id },
    }),
    /Parent MSA .* must be ACTIVE/,
  );
});

test('approveSow emits SowActivated outbox event', async () => {
  stubDb._seed('clients/c3', { id: 'c3', name: 'Roke', parentOrgId: 'zeus-group' });
  stubDb._seed('msas/msa_active', { id: 'msa_active', clientId: 'c3', status: 'ACTIVE' });

  const sowResp = await callOnCall(sowAdmin.upsertSow, {
    auth: { uid: AM_USER, token: {} },
    data: { msaId: 'msa_active', title: 'Brand refresh', type: 'PROJECT', ceilingMinor: 800_000, currency: 'USD' },
  });
  await callOnCall(sowAdmin.submitSowForApproval, {
    auth: { uid: AM_USER, token: {} },
    data: { sowId: sowResp.id },
  });
  await callOnCall(sowAdmin.approveSow, {
    auth: { uid: AM_USER, token: {} },
    data: { sowId: sowResp.id },
  });
  const sow = stubDb._dump()[`sows/${sowResp.id}`];
  assert.equal(sow.status, 'ACTIVE');
  // SowActivated event written.
  const events = stubDb._dump_prefix('domain_events').filter(e => e.data.eventType === 'SowActivated');
  assert.ok(events.length >= 1, 'SowActivated event should be emitted');
  assert.equal(events[0].data.aggregateId, sowResp.id);
});

test('approveChangeOrder atomically adjusts SOW ceiling + ripples to OPEN master jobs', async () => {
  stubDb._seed('sows/sow_co1', {
    id: 'sow_co1', clientId: 'c1', msaId: 'msa_active', status: 'ACTIVE',
    ceilingMinor: 1_000_000, currency: 'USD',
  });
  stubDb._seed('master_jobs/mj_co1', {
    id: 'mj_co1', sowId: 'sow_co1', status: 'OPEN',
    ceilingMinor: 1_000_000, allocatedMinor: 200_000, clientTotalMinor: 1_000_000,
    currency: 'USD',
  });
  // Closed master job — should NOT be touched.
  stubDb._seed('master_jobs/mj_co_closed', {
    id: 'mj_co_closed', sowId: 'sow_co1', status: 'CLOSED',
    ceilingMinor: 500_000, allocatedMinor: 500_000, clientTotalMinor: 500_000,
    currency: 'USD',
  });

  const coResp = await callOnCall(coAdmin.upsertChangeOrder, {
    auth: { uid: AM_USER, token: {} },
    data: { sowId: 'sow_co1', deltaMinor: 250_000, reason: 'Client extra deliverable' },
  });
  await callOnCall(coAdmin.approveChangeOrder, {
    auth: { uid: AM_USER, token: {} },
    data: { changeOrderId: coResp.id },
  });

  const sow = stubDb._dump()['sows/sow_co1'];
  assert.equal(sow.ceilingMinor, 1_250_000, 'SOW ceiling raised by deltaMinor');
  const mj = stubDb._dump()['master_jobs/mj_co1'];
  assert.equal(mj.ceilingMinor, 1_250_000, 'OPEN master job ceiling lifted by deltaMinor');
  const mjClosed = stubDb._dump()['master_jobs/mj_co_closed'];
  assert.equal(mjClosed.ceilingMinor, 500_000, 'CLOSED master job ceiling untouched');
  const co = stubDb._dump()[`change_orders/${coResp.id}`];
  assert.equal(co.status, 'APPROVED');
  assert.equal(co.appliedCeilingMinorAfter, 1_250_000);
});
