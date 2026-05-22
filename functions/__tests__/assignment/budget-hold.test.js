/**
 * BudgetHold service — HELD → LOCKED → SETTLED transitions, and the
 * partial-settle path used by cancelWorkOrder (spec §11.5).
 *   cd functions && node --test __tests__/assignment/budget-hold.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const budgetHold = require('../../src/assignment/services/budget-hold.service');
const { makeFirestore } = require('./_firestore-stub');

function setupHold({ amount = 480_00, state = 'HELD' } = {}) {
  const { db, FieldValue } = makeFirestore();
  db._seed('budget_holds/bh_test', {
    id: 'bh_test',
    masterJobId: 'mj1',
    iwoId: 'iwo1',
    amountMinor: amount,
    currency: 'USD',
    state,
    settledMinor: 0,
    releasedMinor: 0,
  });
  return { db, FieldValue };
}

test('hold() creates a HELD doc with positive amount', async () => {
  const { db } = makeFirestore();
  await db.runTransaction(async (tx) => {
    const id = budgetHold.hold({ tx, db, masterJobId: 'mj1', iwoId: 'iwo1', amountMinor: 100_00, currency: 'USD' });
    assert.ok(id.startsWith('bh_'));
  });
  const docs = db._dump_prefix('budget_holds');
  assert.equal(docs.length, 1);
  assert.equal(docs[0].data.state, 'HELD');
  assert.equal(docs[0].data.amountMinor, 100_00);
});

test('hold() rejects non-positive amounts', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    db.runTransaction(async (tx) => {
      budgetHold.hold({ tx, db, masterJobId: 'mj1', iwoId: 'iwo1', amountMinor: 0, currency: 'USD' });
    }),
    /must be a positive integer/,
  );
});

test('lock(): HELD → LOCKED', async () => {
  const { db } = setupHold();
  await db.runTransaction(async (tx) => {
    const holdSnap = await tx.get(db.doc('budget_holds/bh_test'));
    budgetHold.lock({ tx, db, holdId: 'bh_test', holdSnap });
  });
  assert.equal(db._dump_prefix('budget_holds')[0].data.state, 'LOCKED');
});

test('lock(): from LOCKED throws (idempotent path on duplicate-accept handled elsewhere)', async () => {
  const { db } = setupHold({ state: 'LOCKED' });
  await assert.rejects(
    db.runTransaction(async (tx) => {
      const holdSnap = await tx.get(db.doc('budget_holds/bh_test'));
      budgetHold.lock({ tx, db, holdId: 'bh_test', holdSnap });
    }),
    /cannot transition from LOCKED/,
  );
});

test('settle(): LOCKED → SETTLED with full amount', async () => {
  const { db } = setupHold({ state: 'LOCKED' });
  await db.runTransaction(async (tx) => {
    const holdSnap = await tx.get(db.doc('budget_holds/bh_test'));
    budgetHold.settle({ tx, db, holdId: 'bh_test', holdSnap });
  });
  const d = db._dump_prefix('budget_holds')[0].data;
  assert.equal(d.state, 'SETTLED');
  assert.equal(d.settledMinor, 480_00);
});

test('release(): HELD → RELEASED on reject', async () => {
  const { db } = setupHold();
  await db.runTransaction(async (tx) => {
    const holdSnap = await tx.get(db.doc('budget_holds/bh_test'));
    budgetHold.release({ tx, db, holdId: 'bh_test', holdSnap });
  });
  const d = db._dump_prefix('budget_holds')[0].data;
  assert.equal(d.state, 'RELEASED');
  assert.equal(d.releasedMinor, 480_00);
});

test('settlePartial(): splits hold into SETTLED + RELEASED on §11.5 cancel after partial', async () => {
  const { db } = setupHold({ amount: 480_00, state: 'LOCKED' });
  await db.runTransaction(async (tx) => {
    const holdSnap = await tx.get(db.doc('budget_holds/bh_test'));
    budgetHold.settlePartial({ tx, db, holdId: 'bh_test', holdSnap, settledMinor: 120_00 });
  });
  const d = db._dump_prefix('budget_holds')[0].data;
  assert.equal(d.state, 'SETTLED');
  assert.equal(d.settledMinor, 120_00);
  assert.equal(d.releasedMinor, 360_00);
});

test('settlePartial(): rejects settled > amount', async () => {
  const { db } = setupHold({ amount: 100_00, state: 'LOCKED' });
  await assert.rejects(
    db.runTransaction(async (tx) => {
      const holdSnap = await tx.get(db.doc('budget_holds/bh_test'));
      budgetHold.settlePartial({ tx, db, holdId: 'bh_test', holdSnap, settledMinor: 200_00 });
    }),
    /settledMinor 20000 > amountMinor 10000/,
  );
});
