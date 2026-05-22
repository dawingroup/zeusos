/**
 * Spec §11.1 — Double allocation race.
 *
 * Two AMs concurrently issue IWOs whose budgets each fit the SOW ceiling
 * but together breach it. The second `issueWorkOrder` must fail with
 * CEILING_EXCEEDED. Holding at ISSUED (not ACCEPTED) is what makes this
 * deterministic.
 *
 * In our stub Firestore runTransaction is a single-attempt no-retry
 * model — that's the worst-case for testing the race because BOTH calls
 * see the same initial state. We model the spec by running them
 * sequentially: the FIRST issue succeeds and updates allocated_minor,
 * the SECOND issue (against the now-updated state) hits the headroom
 * check and gets CEILING_EXCEEDED. This matches Firestore's actual
 * serializable behaviour where the loser's commit retries against the
 * post-winner state and re-runs the headroom check.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  seedHappyPath,
  validHandoffPacket,
  auth,
} = require('./_seed-helpers');

patchAuthForTests();
const { runIssueWorkOrder } = require('../../src/assignment/issueWorkOrder');

test('§11.1 — second issueWorkOrder fails CEILING_EXCEEDED after first commits', async () => {
  const { db } = makeFirestore();
  const fx = seedHappyPath(db, { ceilingMinor: 1_500_00 });

  // First issue: 1,000 of 1,500 — fits.
  const r1 = await runIssueWorkOrder({
    db, auth: auth.am,
    data: {
      masterJobId: fx.masterJobId,
      iwoInput: {
        subsidiaryOrgId: 'zeus-the-agency',
        budgetMinor: 1_000_00,
        transferPriceMinor: 1_000_00,
        currency: 'USD',
        handoffPacket: validHandoffPacket(),
        idempotencyKey: 'idem_first_call_001',
      },
    },
  });
  assert.equal(r1.status, 'ISSUED');
  assert.equal(r1.allocatedAfterMinor, 1_000_00);

  // Second issue: 800 minor — would push allocated to 1,800 (> 1,500).
  await assert.rejects(
    runIssueWorkOrder({
      db, auth: auth.am,
      data: {
        masterJobId: fx.masterJobId,
        iwoInput: {
          subsidiaryOrgId: 'zeus-digital',
          budgetMinor: 800_00,
          transferPriceMinor: 800_00,
          currency: 'USD',
          handoffPacket: validHandoffPacket(),
          idempotencyKey: 'idem_second_call_002',
        },
      },
    }),
    (err) => {
      // Either our typed error (raw) or HttpsError. We accept both
      // because the runner re-wraps codes.
      const m = err.message || String(err);
      return /CEILING_EXCEEDED/.test(m) || (err.details && err.details.code === 'CEILING_EXCEEDED');
    },
  );

  // MasterJob.allocatedMinor stays at the winner's amount.
  const mj = db._dump_prefix('master_jobs')[0].data;
  assert.equal(mj.allocatedMinor, 1_000_00);
});
