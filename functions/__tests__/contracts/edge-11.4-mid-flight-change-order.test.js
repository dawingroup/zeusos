/**
 * Spec §11.4 — Mid-flight scope change.
 *
 *   "Change order raises the SOW ceiling. The original IWO continues
 *    against its original budget; a new IWO is issuable for the delta
 *    once the change order is approved."
 *
 * Two-stage assertion:
 *
 *   (a) BEFORE the change order is approved, an IWO whose budget would
 *       breach the existing ceiling is denied with CEILING_EXCEEDED.
 *
 *   (b) AFTER `approveChangeOrder` applies the delta atomically to the
 *       SOW *and* the in-flight MasterJob (per
 *       functions/src/contracts/changeOrderAdmin.js), the same IWO call
 *       now fits the freshly-raised ceiling and is ISSUED.
 *
 *   (c) The previously-issued IWO is untouched — its budget and state
 *       are not retroactively altered by the change order.
 *
 *   Run: cd functions && node --test __tests__/contracts/edge-11.4-mid-flight-change-order.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('../assignment/_firestore-stub');
const {
  patchAuthForTests,
  AM_USER,
  SUBSIDIARY,
} = require('../assignment/_seed-helpers');

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

const { db } = stub.makeFirestore();
_adminDb = db;
patchAuthForTests();

// Seed a PARENT-org admin user for the contracts CFns' real
// `assertParentOrgPrincipal` (used by approveChangeOrder).
db._seed('organizations/zeus-group', { id: 'zeus-group', kind: 'PARENT' });
db._seed('organizations/zeus-the-agency', { id: 'zeus-the-agency', kind: 'SUBSIDIARY' });
db._seed(`users/${AM_USER}`, {
  uid: AM_USER, homeOrgId: 'zeus-group', globalRole: 'admin',
});

const issueWO = require('../../src/assignment/issueWorkOrder');
const coAdmin = require('../../src/contracts/changeOrderAdmin');

const authAM = { uid: AM_USER, token: { email: 'am@zeus.test' } };

function validHandoff(role = AM_USER) {
  return {
    briefMd: '§11.4 — mid-flight scope change scenario.',
    milestones: [{ id: 'm1', name: 'Round 1', dueDate: '2026-06-10' }],
    acceptanceCriteria: [{ id: 'c1', description: 'crit', required: true }],
    clientContextMd: 'Confident tone.',
    commsOwnerUserId: role,
  };
}

test('§11.4 — change order raises ceiling, new IWO becomes issuable', async () => {
  // ── Seed: ACTIVE SOW with ceiling 1_000_000; ACCEPTED quote; OPEN MJ
  //         with 950_000 already allocated (50_000 headroom).
  db._seed('sows/sow_11_4', {
    id: 'sow_11_4', status: 'ACTIVE', ceilingMinor: 1_000_000,
    startDate: '2026-01-01', endDate: '2026-12-31', currency: 'USD',
    msaId: 'msa_11_4',
  });
  db._seed('quotes/q_11_4', {
    id: 'q_11_4', sowId: 'sow_11_4', status: 'ACCEPTED',
    clientTotalMinor: 1_000_000, currency: 'USD',
    pinnedRateCardIdsBySubsidiary: { [SUBSIDIARY]: 'rc_11_4_v1' },
  });
  db._seed('master_jobs/mj_11_4', {
    id: 'mj_11_4', sowId: 'sow_11_4', quoteId: 'q_11_4',
    code: 'MJ-11-4', status: 'DELIVERING',
    allocatedMinor: 950_000, ceilingMinor: 1_000_000,
    clientTotalMinor: 1_000_000, currency: 'USD',
  });

  // (a) BEFORE CO — 100_000 budget would breach. Expect CEILING_EXCEEDED.
  await assert.rejects(
    issueWO.runIssueWorkOrder({
      db, auth: authAM,
      data: {
        masterJobId: 'mj_11_4',
        iwoInput: {
          subsidiaryOrgId: SUBSIDIARY,
          budgetMinor: 100_000, transferPriceMinor: 100_000,
          currency: 'USD',
          handoffPacket: validHandoff(),
          idempotencyKey: 'idem_11_4_pre',
        },
      },
    }),
    (err) => /CEILING_EXCEEDED/.test(err && err.message),
    'pre-CO issue must fail with CEILING_EXCEEDED',
  );

  // Pre-state for the previously-allocated 950_000: snapshot for (c).
  const mjPreCO = db._dump()['master_jobs/mj_11_4'];
  assert.equal(mjPreCO.allocatedMinor, 950_000);
  assert.equal(mjPreCO.ceilingMinor, 1_000_000);

  // ── Create + approve a +500_000 change order ───────────────────────
  db._seed('change_orders/co_11_4', {
    id: 'co_11_4', sowId: 'sow_11_4',
    deltaMinor: 500_000, reason: 'Stage-2 revisions added.',
    status: 'DRAFT', createdAt: '2026-05-22T00:00:00Z',
  });

  // approveChangeOrder uses request.auth shape; build it explicitly.
  // Our onCall stub above passes the request straight through to the
  // handler, so we call it as a plain function.
  await coAdmin.approveChangeOrder({
    auth: authAM,
    data: { changeOrderId: 'co_11_4' },
  });

  // ── Assert: SOW ceiling raised, MJ ceiling propagated ──────────────
  const sowAfter = db._dump()['sows/sow_11_4'];
  assert.equal(sowAfter.ceilingMinor, 1_500_000, 'SOW ceiling raised by delta');
  const mjAfterCO = db._dump()['master_jobs/mj_11_4'];
  assert.equal(mjAfterCO.ceilingMinor, 1_500_000,
    'master_job.ceilingMinor propagated atomically with SOW (per approveChangeOrder)');

  // (c) The pre-existing allocation is untouched.
  assert.equal(mjAfterCO.allocatedMinor, 950_000,
    'in-flight allocation NOT mutated by change-order approval');

  // (b) POST CO — same IWO call now fits (950 + 100 = 1050 ≤ 1500).
  const iwoResp = await issueWO.runIssueWorkOrder({
    db, auth: authAM,
    data: {
      masterJobId: 'mj_11_4',
      iwoInput: {
        subsidiaryOrgId: SUBSIDIARY,
        budgetMinor: 100_000, transferPriceMinor: 100_000,
        currency: 'USD',
        handoffPacket: validHandoff(),
        idempotencyKey: 'idem_11_4_post',
      },
    },
  });
  assert.equal(iwoResp.status, 'ISSUED', 'post-CO issue succeeds');
  assert.equal(iwoResp.allocatedAfterMinor, 1_050_000,
    'allocation incremented to 1.05M (still ≤ new 1.5M ceiling)');

  // Change order doc is APPROVED.
  const coAfter = db._dump()['change_orders/co_11_4'];
  assert.equal(coAfter.status, 'APPROVED');
  assert.equal(coAfter.appliedCeilingMinorAfter, 1_500_000);
});
