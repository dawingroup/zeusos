/**
 * Spec §11.10 — Disputed deliverable.
 *
 * DELIVERED → IN_PROGRESS via `request_revision` (AM only). IWO cannot
 * reach CLOSED until required criteria are signed.
 *
 * Test flow:
 *   1. Seed DELIVERED IWO with one required, unsigned criterion.
 *   2. acceptInternal() → blocks (required-not-signed).
 *   3. requestRevision() → bounces back to IN_PROGRESS, unsigns flagged.
 *   4. acceptInternal() after re-signing succeeds → ACCEPTED_INTERNALLY.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  auth,
  AM_USER,
} = require('./_seed-helpers');

patchAuthForTests();
const { runAcceptInternal, runRequestRevision } = require('../../src/assignment/acceptInternalRequestRevision');

function seedDeliveredIwo(db, { signed = false } = {}) {
  db._seed('master_jobs/mj1', { id: 'mj1', status: 'DELIVERING', allocatedMinor: 0, ceilingMinor: 500_00, currency: 'USD' });
  db._seed('internal_work_orders/iwo1', {
    id: 'iwo1', masterJobId: 'mj1', subsidiaryOrgId: 'zeus-the-agency',
    state: 'DELIVERED', budgetMinor: 100_00, transferPriceMinor: 100_00,
    currency: 'USD', cumulativeCostMinor: 100_00, budgetHoldId: 'bh1',
  });
  db._seed('internal_work_orders/iwo1/handoff_packet/packet', {
    iwoId: 'iwo1',
    briefMd: 'Brief',
    milestones: [{ id: 'm1', name: 'X', dueDate: '2026-06-10' }],
    acceptanceCriteria: [
      { id: 'c1', description: 'must be required', required: true,
        ...(signed ? { signedByUserId: AM_USER, signedAt: '2026-06-15' } : {}) },
      { id: 'c2', description: 'optional', required: false },
    ],
    commsOwnerUserId: AM_USER,
  });
}

test('§11.10 — acceptInternal blocks while required criterion is unsigned', async () => {
  const { db } = makeFirestore();
  seedDeliveredIwo(db, { signed: false });

  await assert.rejects(
    runAcceptInternal({ db, auth: auth.am, data: { iwoId: 'iwo1', idempotencyKey: 'idem_ai_blk_001' } }),
    (err) => /acceptInternal blocked/.test(err.message || String(err)),
  );

  // State unchanged.
  assert.equal(db._dump_prefix('internal_work_orders')[0].data.state, 'DELIVERED');
});

test('§11.10 — requestRevision bounces DELIVERED back to IN_PROGRESS and unsigns flagged criteria', async () => {
  const { db } = makeFirestore();
  // Start with the criterion ALREADY signed — so we can verify
  // requestRevision unsigns it.
  seedDeliveredIwo(db, { signed: true });

  const r = await runRequestRevision({
    db, auth: auth.am,
    data: { iwoId: 'iwo1', criteriaFailures: ['c1'], idempotencyKey: 'idem_rr_001_xxxx' },
  });
  assert.equal(r.status, 'IN_PROGRESS');
  const iwo = db._dump_prefix('internal_work_orders')[0].data;
  assert.equal(iwo.state, 'IN_PROGRESS');
  assert.deepEqual(iwo.lastRevisionFailures, ['c1']);

  const packet = db.doc('internal_work_orders/iwo1/handoff_packet/packet')._store.get('internal_work_orders/iwo1/handoff_packet/packet');
  const c1 = packet.acceptanceCriteria.find((c) => c.id === 'c1');
  assert.ok(!c1.signedByUserId, 'c1 unsigned after requestRevision');
});

test('§11.10 — acceptInternal succeeds once all required criteria are signed', async () => {
  const { db } = makeFirestore();
  seedDeliveredIwo(db, { signed: true });

  const r = await runAcceptInternal({
    db, auth: auth.am, data: { iwoId: 'iwo1', idempotencyKey: 'idem_ai_ok_001' },
  });
  assert.equal(r.status, 'ACCEPTED_INTERNALLY');
  assert.equal(db._dump_prefix('internal_work_orders')[0].data.state, 'ACCEPTED_INTERNALLY');
});
