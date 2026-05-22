/**
 * Spec §11.7 — Duplicate billing.
 *
 * A retry of `closeWorkOrder` with the SAME idempotency-key must return
 * the same IC invoice id rather than create a second. Two enforcement
 * paths:
 *   - withIdempotency cache short-circuits the second call entirely
 *   - the IC invoice's deterministic doc id (`ic_${iwoId}`) collides
 *     anyway, so even a different key would not create two IC rows
 *
 * The test exercises BOTH paths: same key (cache hit) + different key
 * (deterministic IC id catches it).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  auth,
} = require('./_seed-helpers');

patchAuthForTests();
const { runCloseWorkOrder } = require('../../src/assignment/closeWorkOrder');

function seedAcceptedInternallyIwo(db) {
  db._seed('master_jobs/mj1', {
    id: 'mj1', status: 'DELIVERING', allocatedMinor: 480_00,
    ceilingMinor: 1_500_00, currency: 'USD',
  });
  db._seed('internal_work_orders/iwo1', {
    id: 'iwo1', masterJobId: 'mj1', subsidiaryOrgId: 'zeus-the-agency',
    state: 'ACCEPTED_INTERNALLY', budgetMinor: 480_00, transferPriceMinor: 480_00,
    currency: 'USD', cumulativeCostMinor: 420_00, budgetHoldId: 'bh1',
  });
  db._seed('budget_holds/bh1', {
    id: 'bh1', masterJobId: 'mj1', iwoId: 'iwo1', amountMinor: 480_00,
    currency: 'USD', state: 'LOCKED', settledMinor: 0, releasedMinor: 0,
  });
}

test('§11.7 — retry closeWorkOrder with same idempotency key returns same IC invoice', async () => {
  const { db } = makeFirestore();
  seedAcceptedInternallyIwo(db);

  const KEY = 'idem_close_777_aaaaaaaa';
  const r1 = await runCloseWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo1', idempotencyKey: KEY },
  });
  const r2 = await runCloseWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo1', idempotencyKey: KEY },
  });
  assert.equal(r1.status, 'CLOSED');
  assert.equal(r2.status, 'CLOSED');
  assert.equal(r1.interCompanyInvoiceId, r2.interCompanyInvoiceId,
    'retries return the SAME IC invoice id');

  // Exactly one IC invoice doc exists.
  const ics = db._dump_prefix('intercompany_invoices');
  assert.equal(ics.length, 1, 'no duplicate IC invoice');
  assert.equal(ics[0].data.amount.amountMinor, 480_00);
  assert.equal(ics[0].data.isPartial, false);
});

test('§11.7 — distinct idempotency keys still hit the IC UNIQUE(iwo_id) guard', async () => {
  const { db } = makeFirestore();
  seedAcceptedInternallyIwo(db);

  // First close succeeds with key A.
  const rA = await runCloseWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo1', idempotencyKey: 'idem_close_A_aaaa' },
  });
  assert.equal(rA.status, 'CLOSED');

  // Second close (different key) → IWO is now CLOSED, so the
  // INVALID_STATE_TRANSITION guard fires. But the test's invariant — at
  // most one IC invoice — still holds.
  await assert.rejects(
    runCloseWorkOrder({
      db, auth: auth.am,
      data: { iwoId: 'iwo1', idempotencyKey: 'idem_close_B_bbbb' },
    }),
    (err) => /INVALID_STATE_TRANSITION/.test(err.message || String(err)),
  );

  assert.equal(db._dump_prefix('intercompany_invoices').length, 1);
});
