/**
 * CES lifecycle — Phase 6.D unit tests (C7).
 *   cd functions && node --test __tests__/pricing/ces-lifecycle.test.js
 *
 * Covers:
 *   - postCesLineItem appends + bumps totalMinor
 *   - postCesLineItem rejects when CES already signed off
 *   - postCesLineItem rejects currency mix
 *   - postCesLineItem validates required fields
 *   - signOffCes flips signedOff + freezes
 *   - signOffCes rejects empty CES
 *   - signOffCes idempotent (cache hit returns ok)
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore, patchAuthForTests, auth } = require('../assignment/_seed-helpers');
patchAuthForTests();

const {
  runPostCesLineItem,
  runSignOffCes,
} = require('../../src/pricing/cesLifecycle');

function seedMasterJob(db, mjId = 'mj-1') {
  db._seed(`master_jobs/${mjId}`, {
    id: mjId,
    sowId: 'sow-1',
    quoteId: 'q-1',
    clientId: 'client-1',
    code: 'MJ-TEST-001',
    status: 'OPEN',
    allocatedMinor: 0,
    ceilingMinor: 1_000_000_00,
    clientTotalMinor: 500_000_00,
    currency: 'USD',
    createdBy: 'user-1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  });
}

// ----- postCesLineItem ------------------------------------------------

test('postCesLineItem: appends + bumps totalMinor', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  const r = await runPostCesLineItem({
    db, auth: auth.am,
    data: {
      masterJobId: 'mj-1',
      lineItem: {
        category: 'LABOR_INTERNAL',
        description: 'Senior designer × 8h',
        amountMinor: 800_00,
        currency: 'USD',
      },
    },
  });

  assert.equal(r.newTotalMinor, 800_00);
  assert.equal(r.currency, 'USD');
  assert.ok(r.lineItemId.startsWith('cesli_'));

  const fresh = db._dump_prefix('master_jobs')[0].data;
  assert.equal(fresh.ces.lineItems.length, 1);
  assert.equal(fresh.ces.totalMinor, 800_00);
  assert.equal(fresh.ces.signedOff, false);
  assert.equal(fresh.ces.lineItems[0].description, 'Senior designer × 8h');
});

test('postCesLineItem: second item accumulates totalMinor', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  await runPostCesLineItem({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', lineItem: {
      category: 'LABOR_INTERNAL', description: 'A', amountMinor: 100_00, currency: 'USD',
    } },
  });
  await runPostCesLineItem({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', lineItem: {
      category: 'PRODUCTION', description: 'B', amountMinor: 250_00, currency: 'USD',
    } },
  });

  const fresh = db._dump_prefix('master_jobs')[0].data;
  assert.equal(fresh.ces.lineItems.length, 2);
  assert.equal(fresh.ces.totalMinor, 350_00);
});

test('postCesLineItem: rejects after signOff', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  await runPostCesLineItem({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', lineItem: {
      category: 'LABOR_INTERNAL', description: 'A', amountMinor: 100_00, currency: 'USD',
    } },
  });
  await runSignOffCes({ db, auth: auth.am, data: { masterJobId: 'mj-1' } });

  await assert.rejects(
    () => runPostCesLineItem({
      db, auth: auth.am,
      data: { masterJobId: 'mj-1', lineItem: {
        category: 'PRODUCTION', description: 'late add', amountMinor: 1, currency: 'USD',
      } },
    }),
    /CES is signed off/,
  );
});

test('postCesLineItem: rejects currency mix', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  await runPostCesLineItem({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', lineItem: {
      category: 'LABOR_INTERNAL', description: 'A', amountMinor: 100_00, currency: 'USD',
    } },
  });
  await assert.rejects(
    () => runPostCesLineItem({
      db, auth: auth.am,
      data: { masterJobId: 'mj-1', lineItem: {
        category: 'PRODUCTION', description: 'B', amountMinor: 50_000_00, currency: 'UGX',
      } },
    }),
    /Currency mismatch/,
  );
});

test('postCesLineItem: validates required fields', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  await assert.rejects(
    () => runPostCesLineItem({
      db, auth: auth.am,
      data: { masterJobId: 'mj-1', lineItem: { description: 'no category' } },
    }),
    /category is required/,
  );

  await assert.rejects(
    () => runPostCesLineItem({
      db, auth: auth.am,
      data: { masterJobId: 'mj-1', lineItem: {
        category: 'LABOR_INTERNAL', description: 'X', amountMinor: -50, currency: 'USD',
      } },
    }),
    /amountMinor must be a non-negative number/,
  );
});

test('postCesLineItem: rejects missing masterJob', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => runPostCesLineItem({
      db, auth: auth.am,
      data: { masterJobId: 'mj-missing', lineItem: {
        category: 'LABOR_INTERNAL', description: 'A', amountMinor: 100, currency: 'USD',
      } },
    }),
    /MasterJob mj-missing not found/,
  );
});

// ----- signOffCes -----------------------------------------------------

test('signOffCes: flips signedOff + records actor + freezes', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  await runPostCesLineItem({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', lineItem: {
      category: 'LABOR_INTERNAL', description: 'A', amountMinor: 100_00, currency: 'USD',
    } },
  });
  const r = await runSignOffCes({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', marginFloorPct: 30 },
  });

  assert.equal(r.signedOff, true);
  assert.equal(r.totalMinor, 100_00);
  assert.equal(r.marginFloorPct, 30);

  const fresh = db._dump_prefix('master_jobs')[0].data;
  assert.equal(fresh.ces.signedOff, true);
  assert.equal(fresh.ces.marginFloorPct, 30);
  assert.ok(fresh.ces.signedOffByUserId);
  assert.ok(fresh.ces.signedOffAt);
});

test('signOffCes: rejects when no CES', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);
  await assert.rejects(
    () => runSignOffCes({ db, auth: auth.am, data: { masterJobId: 'mj-1' } }),
    /No CES on this master job/,
  );
});

test('signOffCes: rejects when CES has no line items', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);
  // Manually set an empty ces (shouldn't happen via postCesLineItem,
  // but legacy paths might).
  const mj = db._dump_prefix('master_jobs')[0].data;
  db._seed('master_jobs/mj-1', {
    ...mj,
    ces: { lineItems: [], totalMinor: 0, currency: 'USD', signedOff: false, updatedAt: '2026-05-01T00:00:00Z' },
  });
  await assert.rejects(
    () => runSignOffCes({ db, auth: auth.am, data: { masterJobId: 'mj-1' } }),
    /add ≥ 1 before signing off/,
  );
});

test('signOffCes: already-signed returns idempotent-ok', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);

  await runPostCesLineItem({
    db, auth: auth.am,
    data: { masterJobId: 'mj-1', lineItem: {
      category: 'LABOR_INTERNAL', description: 'A', amountMinor: 100_00, currency: 'USD',
    } },
  });
  await runSignOffCes({ db, auth: auth.am, data: { masterJobId: 'mj-1' } });

  const r = await runSignOffCes({ db, auth: auth.am, data: { masterJobId: 'mj-1' } });
  assert.equal(r.signedOff, true);
  assert.equal(r.alreadySignedOff, true);
});
