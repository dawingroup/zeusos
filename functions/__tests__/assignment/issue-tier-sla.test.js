/**
 * issueWorkOrder × Tier-derived SLA — Phase 6.B.
 *   cd functions && node --test __tests__/assignment/issue-tier-sla.test.js
 *
 * Verifies the additive Tier wiring on issueWorkOrder:
 *   - No tier on iwoInput AND no tier on MasterJob → back-compat
 *     (slaDueAt null; pre-6.B IWOs still issue cleanly).
 *   - tier on iwoInput → slaDueAt computed from engine_config.
 *   - tier on MasterJob inherited when not on iwoInput.
 *   - iwoInput.tier wins when both set.
 *   - Missing engine_config → graceful (slaDueAt null, IWO still issues).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  patchRatePinningForTests,
  seedHappyPath,
  validHandoffPacket,
  auth,
  SUBSIDIARY,
} = require('./_seed-helpers');

patchAuthForTests();
patchRatePinningForTests();
const { runIssueWorkOrder } = require('../../src/assignment/issueWorkOrder');

function baseIwoInput(overrides = {}) {
  return {
    subsidiaryOrgId: SUBSIDIARY,
    budgetMinor: 100_00,
    transferPriceMinor: 80_00,
    currency: 'USD',
    handoffPacket: validHandoffPacket(),
    ...overrides,
  };
}

function seedEngineConfig(db) {
  db._seed('engine_config/global', {
    id: 'global',
    slaHoursByTier: {
      TIER_1: { critical: 24, high: 48, medium: 96, low: 168 },
      TIER_2: { critical: 8,  high: 24, medium: 48, low: 96 },
      TIER_3: { critical: 4,  high: 8,  medium: 24, low: 72 },
    },
  });
}

async function readIwo(db, id) {
  const snap = await db.doc(`internal_work_orders/${id}`).get();
  return snap.data();
}

test('back-compat: no tier on iwoInput or MasterJob → slaDueAt null, IWO still issues', async () => {
  const { db } = makeFirestore();
  const { masterJobId } = seedHappyPath(db);

  const r = await runIssueWorkOrder({
    db,
    auth: auth.am,
    data: { masterJobId, iwoInput: baseIwoInput({ idempotencyKey: 'k-untiered' }) },
  });
  const iwo = await readIwo(db, r.id);

  assert.equal(iwo.tier, null);
  assert.equal(iwo.slaDueAt, null);
  assert.equal(r.status, 'ISSUED');
});

test('explicit tier on iwoInput + engine_config seeded → slaDueAt populated (TIER_1 medium = 96h)', async () => {
  const { db } = makeFirestore();
  const { masterJobId } = seedHappyPath(db);
  seedEngineConfig(db);

  const before = Date.now();
  const r = await runIssueWorkOrder({
    db,
    auth: auth.am,
    data: { masterJobId, iwoInput: baseIwoInput({ tier: 'TIER_1', idempotencyKey: 'k-t1' }) },
  });
  const after = Date.now();
  const iwo = await readIwo(db, r.id);

  assert.equal(iwo.tier, 'TIER_1');
  assert.ok(iwo.slaDueAt, 'slaDueAt should be set');
  const dueMs = new Date(iwo.slaDueAt).getTime();
  const expectedLow = before + 96 * 3600 * 1000;
  const expectedHigh = after + 96 * 3600 * 1000;
  assert.ok(dueMs >= expectedLow && dueMs <= expectedHigh,
    `slaDueAt ${iwo.slaDueAt} not in [${new Date(expectedLow).toISOString()}, ${new Date(expectedHigh).toISOString()}]`);
});

test('TIER_3 critical priority → 4h clock', async () => {
  const { db } = makeFirestore();
  const { masterJobId } = seedHappyPath(db);
  seedEngineConfig(db);

  const before = Date.now();
  const r = await runIssueWorkOrder({
    db,
    auth: auth.am,
    data: { masterJobId, iwoInput: baseIwoInput({ tier: 'TIER_3', priority: 'critical', idempotencyKey: 'k-t3c' }) },
  });
  const after = Date.now();
  const iwo = await readIwo(db, r.id);

  assert.equal(iwo.tier, 'TIER_3');
  const dueMs = new Date(iwo.slaDueAt).getTime();
  assert.ok(dueMs >= before + 4 * 3600 * 1000, 'slaDueAt should be ≥ 4h from before-call');
  assert.ok(dueMs <= after + 4 * 3600 * 1000, 'slaDueAt should be ≤ 4h from after-call');
});

test('tier inherited from MasterJob when not on iwoInput', async () => {
  const { db } = makeFirestore();
  const { masterJobId } = seedHappyPath(db);
  seedEngineConfig(db);

  const mj = db._dump_prefix('master_jobs')[0];
  db._seed(`master_jobs/${masterJobId}`, { ...mj.data, tier: 'TIER_2' });

  const r = await runIssueWorkOrder({
    db,
    auth: auth.am,
    data: { masterJobId, iwoInput: baseIwoInput({ idempotencyKey: 'k-inherited' }) },
  });
  const iwo = await readIwo(db, r.id);

  assert.equal(iwo.tier, 'TIER_2');
  assert.ok(iwo.slaDueAt, 'slaDueAt should be populated from inherited tier');
});

test('iwoInput.tier wins over MasterJob.tier', async () => {
  const { db } = makeFirestore();
  const { masterJobId } = seedHappyPath(db);
  seedEngineConfig(db);

  const mj = db._dump_prefix('master_jobs')[0];
  db._seed(`master_jobs/${masterJobId}`, { ...mj.data, tier: 'TIER_1' });

  const r = await runIssueWorkOrder({
    db,
    auth: auth.am,
    data: { masterJobId, iwoInput: baseIwoInput({ tier: 'TIER_3', idempotencyKey: 'k-override' }) },
  });
  const iwo = await readIwo(db, r.id);

  assert.equal(iwo.tier, 'TIER_3');
});

test('tier set on iwoInput but engine_config missing → slaDueAt null + still issues', async () => {
  const { db } = makeFirestore();
  const { masterJobId } = seedHappyPath(db);
  // Deliberately skip seedEngineConfig.

  const r = await runIssueWorkOrder({
    db,
    auth: auth.am,
    data: { masterJobId, iwoInput: baseIwoInput({ tier: 'TIER_1', idempotencyKey: 'k-noconfig' }) },
  });
  const iwo = await readIwo(db, r.id);

  assert.equal(iwo.tier, 'TIER_1');
  assert.equal(iwo.slaDueAt, null);
  assert.equal(r.status, 'ISSUED');
});
