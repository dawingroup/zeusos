/**
 * Spec §11.8 — Rate card published mid-engagement.
 *
 *   "Subsidiary publishes v2 of its rate card → in-flight IWOs continue
 *    to use the v1 cost (pinned at quote-accept time); new IWOs raised
 *    after v2 goes ACTIVE use v2."
 *
 * Verified by driving the REAL `resolveTimeEntryCost` (no rate-pinning
 * monkey-patch), so the resolver actually walks the rate-card pinning
 * chain: iwo.pinnedRateCardId → quote.pinnedRateCardIdsBySubsidiary[sub]
 * → active rate card for sub → FAIL.
 *
 * The resolver fetches Firestore via `getFirestore()` from
 * `firebase-admin/firestore` — not the injected `db`. So this test uses
 * the Module._load pattern (mirroring engagement-flow.test.js) to point
 * that resolver at the same stub.
 *
 * Test plan:
 *   1. Seed rc_v1 (ARCHIVED) with STAFF @ 100_00 minor/hr.
 *   2. Seed rc_v2 (ACTIVE)   with STAFF @ 200_00 minor/hr.
 *   3. Seed Quote A pinned to rc_v1 + IWO_old (IN_PROGRESS).
 *   4. Post time on IWO_old → cost is 100_00/hr (rc_v1).
 *   5. Seed Quote B pinned to rc_v2 + IWO_new (IN_PROGRESS).
 *   6. Post time on IWO_new → cost is 200_00/hr (rc_v2).
 *
 * Run: cd functions && node --test __tests__/assignment/edge-11.8-rate-card-mid-engagement.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const stub = require('./_firestore-stub');

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

const {
  patchAuthForTests,
  auth,
  SUBSIDIARY,
  DELIVERY_USER,
} = require('./_seed-helpers');
patchAuthForTests();

const { runPostTimeEntry } = require('../../src/assignment/postTimeEntry');

function seedRateCard(db, { id, version, status, lineCostMinor, lineId }) {
  db._seed(`rate_cards/${id}`, {
    id,
    subsidiaryOrgId: SUBSIDIARY,
    version,
    status,
    effectiveDate: '2026-01-01',
  });
  db._seed(`rate_cards/${id}/rate_card_lines/${lineId}`, {
    id: lineId,
    roleCode: 'STAFF',
    unit: 'HOUR',
    costMinor: lineCostMinor,
    currency: 'USD',
  });
}

function seedEngagement(db, { iwoId, quoteId, masterJobId, sowId, pinnedRcId }) {
  db._seed(`sows/${sowId}`, {
    id: sowId, status: 'ACTIVE', ceilingMinor: 1_000_000_000,
    startDate: '2026-01-01', endDate: '2026-12-31', currency: 'USD',
  });
  db._seed(`quotes/${quoteId}`, {
    id: quoteId, sowId, status: 'ACCEPTED',
    clientTotalMinor: 1_000_000_000, currency: 'USD',
    pinnedRateCardIdsBySubsidiary: { [SUBSIDIARY]: pinnedRcId },
  });
  db._seed(`master_jobs/${masterJobId}`, {
    id: masterJobId, sowId, quoteId, code: `MJ-${masterJobId}`,
    status: 'DELIVERING', allocatedMinor: 0, ceilingMinor: 1_000_000_000,
    clientTotalMinor: 1_000_000_000, currency: 'USD',
  });
  db._seed(`internal_work_orders/${iwoId}`, {
    id: iwoId,
    masterJobId,
    quoteId,                       // ← needed for postTimeEntry → rate-pinning
    subsidiaryOrgId: SUBSIDIARY,
    state: 'IN_PROGRESS',
    budgetMinor: 500_000_000,
    transferPriceMinor: 500_000_000,
    currency: 'USD',
    cumulativeCostMinor: 0,
    budgetHoldId: `bh_${iwoId}`,
  });
  db._seed(`budget_holds/bh_${iwoId}`, {
    id: `bh_${iwoId}`, masterJobId, iwoId,
    amountMinor: 500_000_000, currency: 'USD', state: 'LOCKED',
    settledMinor: 0, releasedMinor: 0,
  });
}

function seedDeliveryUser(db) {
  db._seed(`users/${DELIVERY_USER}`, {
    uid: DELIVERY_USER, roleCode: 'STAFF', homeOrgId: SUBSIDIARY,
  });
}

test('§11.8 — IWO from a v1-pinned quote keeps using v1 cost even after v2 is ACTIVE', async () => {
  const { db } = stub.makeFirestore();
  _adminDb = db;
  seedRateCard(db, {
    id: 'rc_v1', version: 1, status: 'ARCHIVED',
    lineCostMinor: 100_00, lineId: 'rcl_v1_staff',
  });
  seedRateCard(db, {
    id: 'rc_v2', version: 2, status: 'ACTIVE',
    lineCostMinor: 200_00, lineId: 'rcl_v2_staff',
  });
  seedDeliveryUser(db);
  seedEngagement(db, {
    iwoId: 'iwo_old', quoteId: 'q_old',
    masterJobId: 'mj_old', sowId: 'sow_old',
    pinnedRcId: 'rc_v1',
  });

  await runPostTimeEntry({
    db,
    auth: auth.dl,
    data: {
      iwoId: 'iwo_old',
      userId: DELIVERY_USER,
      minutes: 60,
      entryDate: '2026-06-05',
      idempotencyKey: 'idem_11_8_old',
    },
  });
  const iwoOld = db._dump()['internal_work_orders/iwo_old'];
  assert.equal(iwoOld.cumulativeCostMinor, 100_00,
    'in-flight IWO must use v1 cost even though v2 is now ACTIVE');

  const teEntries = Object.entries(db._dump()).filter(([k]) =>
    k.startsWith('internal_work_orders/iwo_old/time_entries/'),
  );
  assert.equal(teEntries.length, 1);
  assert.equal(teEntries[0][1].rateCardId, 'rc_v1',
    'TimeEntry carries the PINNED rate card id, not the currently-active one');
});

test('§11.8 — new IWO from a v2-pinned quote uses v2 cost', async () => {
  const { db } = stub.makeFirestore();
  _adminDb = db;
  seedRateCard(db, {
    id: 'rc_v1', version: 1, status: 'ARCHIVED',
    lineCostMinor: 100_00, lineId: 'rcl_v1_staff',
  });
  seedRateCard(db, {
    id: 'rc_v2', version: 2, status: 'ACTIVE',
    lineCostMinor: 200_00, lineId: 'rcl_v2_staff',
  });
  seedDeliveryUser(db);
  seedEngagement(db, {
    iwoId: 'iwo_new', quoteId: 'q_new',
    masterJobId: 'mj_new', sowId: 'sow_new',
    pinnedRcId: 'rc_v2',
  });

  await runPostTimeEntry({
    db,
    auth: auth.dl,
    data: {
      iwoId: 'iwo_new',
      userId: DELIVERY_USER,
      minutes: 60,
      entryDate: '2026-06-05',
      idempotencyKey: 'idem_11_8_new',
    },
  });
  const iwoNew = db._dump()['internal_work_orders/iwo_new'];
  assert.equal(iwoNew.cumulativeCostMinor, 200_00,
    'NEW IWO uses v2 cost (the freshly-pinned rate card)');

  const teEntries = Object.entries(db._dump()).filter(([k]) =>
    k.startsWith('internal_work_orders/iwo_new/time_entries/'),
  );
  assert.equal(teEntries[0][1].rateCardId, 'rc_v2');
});
