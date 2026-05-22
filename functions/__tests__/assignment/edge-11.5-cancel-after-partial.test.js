/**
 * Spec §11.5 — Work order cancelled after partial mobilization.
 *
 * On CANCELLED, incurred cost is settled via a PARTIAL inter-company
 * invoice; remaining hold is RELEASED; MasterJob.allocatedMinor decrements.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  auth,
} = require('./_seed-helpers');

patchAuthForTests();
const { runCancelWorkOrder } = require('../../src/assignment/cancelWorkOrder');

test('§11.5 — cancel an IN_PROGRESS IWO with incurred cost → partial IC invoice + remaining released', async () => {
  const { db } = makeFirestore();

  // budget 480_00; transfer price 480_00; already 120_00 spent (25%).
  db._seed('master_jobs/mj_test_1', {
    id: 'mj_test_1', status: 'DELIVERING',
    allocatedMinor: 480_00, ceilingMinor: 1_500_00, currency: 'USD',
  });
  db._seed('internal_work_orders/iwo_test', {
    id: 'iwo_test',
    masterJobId: 'mj_test_1',
    subsidiaryOrgId: 'zeus-the-agency',
    state: 'IN_PROGRESS',
    budgetMinor: 480_00,
    transferPriceMinor: 480_00,
    currency: 'USD',
    cumulativeCostMinor: 120_00,
    budgetHoldId: 'bh_test',
  });
  db._seed('budget_holds/bh_test', {
    id: 'bh_test', masterJobId: 'mj_test_1', iwoId: 'iwo_test',
    amountMinor: 480_00, currency: 'USD', state: 'LOCKED',
    settledMinor: 0, releasedMinor: 0,
  });

  const r = await runCancelWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo_test', reason: 'client paused brief', idempotencyKey: 'idem_cancel_111' },
  });

  // IWO ends in CANCELLED with IC invoice id set.
  assert.equal(r.status, 'CANCELLED');
  assert.ok(r.interCompanyInvoiceId, 'IC invoice id present');
  assert.equal(r.settledMinor, 120_00);
  assert.equal(r.releasedMinor, 360_00);

  // BudgetHold: state SETTLED, settled=incurred, released=remainder.
  const hold = db.doc('budget_holds/bh_test')._store.get('budget_holds/bh_test');
  assert.equal(hold.state, 'SETTLED');
  assert.equal(hold.settledMinor, 120_00);
  assert.equal(hold.releasedMinor, 360_00);

  // MasterJob.allocatedMinor decremented by released portion (360_00).
  const mj = db._dump_prefix('master_jobs')[0].data;
  assert.equal(mj.allocatedMinor, 480_00 - 360_00); // = 120_00

  // IC invoice exists, RAISED status, posted_to_gl false.
  const ics = db._dump_prefix('intercompany_invoices');
  assert.equal(ics.length, 1);
  assert.equal(ics[0].data.status, 'RAISED');
  assert.equal(ics[0].data.postedToGL, false);
  // Partial IC amount = transferPrice * (cumulative/budget) = 120_00.
  assert.equal(ics[0].data.amount.amountMinor, 120_00);
  assert.equal(ics[0].data.isPartial, true);
});

test('§11.5 — cancel with zero incurred cost → full release, no IC invoice', async () => {
  const { db } = makeFirestore();
  db._seed('master_jobs/mj2', {
    id: 'mj2', status: 'DELIVERING', allocatedMinor: 200_00, ceilingMinor: 500_00, currency: 'USD',
  });
  db._seed('internal_work_orders/iwo_clean', {
    id: 'iwo_clean', masterJobId: 'mj2', subsidiaryOrgId: 'zeus-the-agency',
    state: 'ACCEPTED', budgetMinor: 200_00, transferPriceMinor: 200_00, currency: 'USD',
    cumulativeCostMinor: 0, budgetHoldId: 'bh_clean',
  });
  db._seed('budget_holds/bh_clean', {
    id: 'bh_clean', masterJobId: 'mj2', iwoId: 'iwo_clean',
    amountMinor: 200_00, currency: 'USD', state: 'LOCKED',
    settledMinor: 0, releasedMinor: 0,
  });

  const r = await runCancelWorkOrder({
    db, auth: auth.am,
    data: { iwoId: 'iwo_clean', reason: 'misallocated', idempotencyKey: 'idem_cancel_clean_222' },
  });
  assert.equal(r.status, 'CANCELLED');
  assert.equal(r.interCompanyInvoiceId, null);
  assert.equal(r.releasedMinor, 200_00);

  // No IC invoice raised.
  assert.equal(db._dump_prefix('intercompany_invoices').length, 0);
  // MJ allocated dropped by the full budget.
  assert.equal(db._dump_prefix('master_jobs')[0].data.allocatedMinor, 0);
});
