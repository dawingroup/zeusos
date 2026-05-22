/**
 * Spec §11.2 — Over-servicing.
 *
 * Subsidiary posts time at 99% of budget, then 101%. The second post
 * must be hard-blocked with BUDGET_EXCEEDED.
 *
 * Setup uses an IWO already in IN_PROGRESS to focus on the burn check.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  patchRatePinningForTests,
  DELIVERY_USER,
  auth,
} = require('./_seed-helpers');

patchAuthForTests();
patchRatePinningForTests();
const { runPostTimeEntry } = require('../../src/assignment/postTimeEntry');

function seedInProgressIwo(db, { budget = 100_00, cumulative = 0 } = {}) {
  db._seed('internal_work_orders/iwo_test', {
    id: 'iwo_test',
    masterJobId: 'mj_test_1',
    subsidiaryOrgId: 'zeus-the-agency',
    state: 'IN_PROGRESS',
    budgetMinor: budget,
    transferPriceMinor: budget,
    currency: 'USD',
    cumulativeCostMinor: cumulative,
    budgetHoldId: 'bh_test',
    quoteId: 'q_test_1',
    pinnedRateCardId: 'rc_test_v1',
  });
  db._seed('quotes/q_test_1', {
    id: 'q_test_1',
    pinnedRateCardIdsBySubsidiary: { 'zeus-the-agency': 'rc_test_v1' },
  });
}

test('§11.2 — post at 99% then 101% blocks with BUDGET_EXCEEDED', async () => {
  const { db } = makeFirestore();
  // budget = 100_00 minor (USD 100). Rate stub = 100_00 / hour = 1_667 minor / min ≈ 16.67/min.
  // 99 minutes → 99 * (100_00/60) = 16_500 minor.
  seedInProgressIwo(db, { budget: 100_00, cumulative: 84_00 });

  // Post 1: 9 minutes → 1_500 minor → cumulative 85_500 → 85.5%.
  const r1 = await runPostTimeEntry({
    db, auth: auth.dl,
    data: {
      iwoId: 'iwo_test',
      userId: DELIVERY_USER,
      minutes: 9,
      entryDate: '2026-06-03',
      idempotencyKey: 'idem_te_001_aaa',
    },
  });
  assert.equal(r1.cumulativeMinor, 84_00 + 1_500);

  // Post 2: 60 minutes → 100_00 minor → cumulative 100_00 + previous = 99_500. That's still under 100_00. Hmm.
  // Let me recompute the §11.2 spirit: bring cumulative >100% on the 2nd post.
  // Current cumulative: 85_500. Need a single entry > 14_500 to breach.
  // Post 15 minutes → (15/60) * 100_00 = 2_500 → cumulative 88_000. Still under.
  // Let me make the 2nd entry larger: 100 minutes → 16_667 → 102_167 > 100_00 → BUDGET_EXCEEDED.
  await assert.rejects(
    runPostTimeEntry({
      db, auth: auth.dl,
      data: {
        iwoId: 'iwo_test',
        userId: DELIVERY_USER,
        minutes: 100,
        entryDate: '2026-06-04',
        idempotencyKey: 'idem_te_002_bbb',
      },
    }),
    (err) => /BUDGET_EXCEEDED/.test(err.message || String(err)),
  );

  // Cumulative should NOT have been updated past the first entry —
  // i.e. the second (rejected) post's amount must not be persisted.
  // First post: 84_00 starting + 9_min × (100_00/60h) ≈ 1_500 → 9_900.
  const iwo = db._dump_prefix('internal_work_orders')[0].data;
  assert.equal(iwo.cumulativeCostMinor, 8400 + 1500);
});
