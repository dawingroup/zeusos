/**
 * Spec §11.9 — Subsidiary legal-entity flip.
 *
 *   "Toggle `organizations/{subId}.is_legal_entity` true → false:
 *      • In-flight IWOs continue against their original transfer-price
 *        and IC-invoice path.
 *      • New IWOs raised after the flip use intra-entity cost
 *        allocation only (no Inter-Company invoice on close).
 *    Flip back to true → IC invoicing resumes for new IWOs."
 *
 * Current state of the codebase:
 *   • `is_legal_entity` lives on the `Org` type (src/core/settings/types.ts)
 *     and on the seed scripts, but NO Cloud Function reads it. Today
 *     `closeWorkOrder` ALWAYS raises an IC invoice on the ACCEPTED →
 *     CLOSED transition (functions/src/assignment/closeWorkOrder.js:6).
 *
 *   This test therefore:
 *     1. Pins the CURRENT contract (IC invoice raised regardless of the
 *        flag — locks in today's behaviour so a future implementer
 *        notices the §11.9 work as a deliberate change).
 *     2. Carries `test.todo` placeholders for each branch of the §11.9
 *        invariant so the gap stays visible in test output.
 *
 *   Run: cd functions && node --test __tests__/assignment/edge-11.9-legal-entity-flip.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  patchRatePinningForTests,
  auth,
  AM_USER,
  SUBSIDIARY,
} = require('./_seed-helpers');

patchAuthForTests();
patchRatePinningForTests();

const { runCloseWorkOrder } = require('../../src/assignment/closeWorkOrder');

function seedAcceptedInternally(db, { is_legal_entity }) {
  db._seed(`organizations/${SUBSIDIARY}`, {
    id: SUBSIDIARY, kind: 'SUBSIDIARY', name: 'Zeus The Agency',
    is_legal_entity,
  });
  db._seed('master_jobs/mj_11_9', {
    id: 'mj_11_9', status: 'DELIVERING',
    allocatedMinor: 500_00, ceilingMinor: 2_000_00, currency: 'USD',
  });
  db._seed('internal_work_orders/iwo_11_9', {
    id: 'iwo_11_9', masterJobId: 'mj_11_9',
    subsidiaryOrgId: SUBSIDIARY,
    state: 'ACCEPTED_INTERNALLY',
    budgetMinor: 500_00, transferPriceMinor: 500_00, currency: 'USD',
    cumulativeCostMinor: 500_00,
    budgetHoldId: 'bh_11_9',
    acceptanceCriteria: [],
  });
  db._seed('budget_holds/bh_11_9', {
    id: 'bh_11_9', masterJobId: 'mj_11_9', iwoId: 'iwo_11_9',
    amountMinor: 500_00, currency: 'USD', state: 'LOCKED',
    settledMinor: 0, releasedMinor: 0,
  });
}

test('§11.9 (current contract) — closeWorkOrder raises IC invoice when sub IS a legal entity', async () => {
  const { db } = makeFirestore();
  seedAcceptedInternally(db, { is_legal_entity: true });

  const r = await runCloseWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo_11_9', idempotencyKey: 'idem_11_9_legal' },
  });
  assert.equal(r.status, 'CLOSED');

  const ics = db._dump_prefix('intercompany_invoices');
  assert.equal(ics.length, 1, 'IC invoice raised when sub is a legal entity');
  assert.equal(ics[0].data.status, 'RAISED');
  assert.equal(ics[0].data.fromOrgId, SUBSIDIARY);
});

test('§11.9 (gap-pin) — closeWorkOrder TODAY still raises IC invoice when sub is_legal_entity=false', async () => {
  // Locks in today's behaviour so a future §11.9 implementer sees this
  // assertion fail (intentionally) and updates the test to assert the
  // flag-aware contract.
  const { db } = makeFirestore();
  seedAcceptedInternally(db, { is_legal_entity: false });

  const r = await runCloseWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo_11_9', idempotencyKey: 'idem_11_9_nonlegal' },
  });
  assert.equal(r.status, 'CLOSED');

  const ics = db._dump_prefix('intercompany_invoices');
  assert.equal(ics.length, 1,
    'TODAY: IC invoice STILL raised — §11.9 flag-aware path is not yet wired into closeWorkOrder.');
});

// ── Pending §11.9 contract — locks expected behaviour for the future
//    implementer (the `node:test` runner reports these as TODOs without
//    failing the suite).

test('§11.9 — when sub.is_legal_entity=false, new IWOs close WITHOUT raising IC invoice', { todo: 'Requires closeWorkOrder + IWO state machine to consult organizations/{sub}.is_legal_entity before raising IC invoice. Spec §11.9.' }, () => {});

test('§11.9 — when sub.is_legal_entity=false, intra-entity cost allocation is recorded instead', { todo: 'Requires a sibling "cost_allocations" collection (or equivalent ledger record) populated by closeWorkOrder when the flag is false. Spec §11.9 + §8.3.' }, () => {});

test('§11.9 — flipping is_legal_entity back to true reactivates IC invoicing for subsequent IWOs', { todo: 'Once the flag-aware path lands, verify a round-trip flip false→true→false→true keeps in-flight IWOs on their original path AND switches the new-IWO path correctly each time. Spec §11.9.' }, () => {});
