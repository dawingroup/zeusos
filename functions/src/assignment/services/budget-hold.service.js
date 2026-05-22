/**
 * BudgetHold lifecycle service — spec §4.5 / §7.1 / §11.5.
 *
 *   HELD     ← on IWO `issue`   (same txn as headroom check + allocated++)
 *   LOCKED   ← on IWO `accept`
 *   SETTLED  ← on IWO `close`   (raises InterCompanyInvoice)
 *   RELEASED ← on IWO `reject` / `cancel` (allocated decrements)
 *
 * Every function takes the caller's transaction (Firestore mutations have
 * to be inside a transaction to be consistent with the headroom check),
 * which is why these functions are not `runTransaction`-wrappers.
 *
 * Partial settlement (spec §11.5): `settlePartial(tx, hold, settledMinor)`
 * splits a HELD/LOCKED hold into a SETTLED slice + a RELEASED remainder.
 * Used by `cancelWorkOrder` after partial mobilization.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { ulid } = require('../../platform/ulid');

const BUDGET_HOLDS = 'budget_holds';

/**
 * Place a new hold for `amountMinor` against `masterJobId`. Caller must
 * have already verified headroom inside `tx`. Returns the new hold's id.
 */
function hold(args) {
  const { tx, db, masterJobId, iwoId, amountMinor, currency } = args;
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error(`BudgetHold.hold: amountMinor must be a positive integer, got ${amountMinor}.`);
  }
  const holdId = `bh_${ulid()}`;
  const ref = db.collection(BUDGET_HOLDS).doc(holdId);
  tx.set(ref, {
    id: holdId,
    masterJobId,
    iwoId,
    amountMinor,
    currency,
    state: 'HELD',
    settledMinor: 0,
    releasedMinor: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return holdId;
}

/** HELD → LOCKED on IWO accept. */
function lock(args) {
  const { tx, db, holdId, holdSnap } = args;
  assertCurrentState(holdSnap, ['HELD']);
  const ref = db.collection(BUDGET_HOLDS).doc(holdId);
  tx.update(ref, {
    state: 'LOCKED',
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** LOCKED → SETTLED on IWO close (or HELD/LOCKED → SETTLED for full settle). */
function settle(args) {
  const { tx, db, holdId, holdSnap, settledMinor } = args;
  assertCurrentState(holdSnap, ['HELD', 'LOCKED']);
  const data = holdSnap.data();
  const fullAmount = settledMinor === undefined ? data.amountMinor : settledMinor;
  if (fullAmount > data.amountMinor) {
    throw new Error(`BudgetHold.settle: settledMinor ${fullAmount} > amountMinor ${data.amountMinor}.`);
  }
  const ref = db.collection(BUDGET_HOLDS).doc(holdId);
  tx.update(ref, {
    state: 'SETTLED',
    settledMinor: fullAmount,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** HELD/LOCKED → RELEASED on IWO reject / cancel (full release). */
function release(args) {
  const { tx, db, holdId, holdSnap } = args;
  assertCurrentState(holdSnap, ['HELD', 'LOCKED']);
  const data = holdSnap.data();
  const ref = db.collection(BUDGET_HOLDS).doc(holdId);
  tx.update(ref, {
    state: 'RELEASED',
    releasedMinor: data.amountMinor - (data.settledMinor || 0),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Spec §11.5 partial settle: `settledMinor` is IC-invoiced, the rest is
 * RELEASED. End state is SETTLED with `releasedMinor = amount - settled`.
 */
function settlePartial(args) {
  const { tx, db, holdId, holdSnap, settledMinor } = args;
  assertCurrentState(holdSnap, ['HELD', 'LOCKED']);
  const data = holdSnap.data();
  if (!Number.isInteger(settledMinor) || settledMinor < 0) {
    throw new Error(`BudgetHold.settlePartial: settledMinor must be a non-negative integer.`);
  }
  if (settledMinor > data.amountMinor) {
    throw new Error(`BudgetHold.settlePartial: settledMinor ${settledMinor} > amountMinor ${data.amountMinor}.`);
  }
  const releasedMinor = data.amountMinor - settledMinor;
  const ref = db.collection(BUDGET_HOLDS).doc(holdId);
  tx.update(ref, {
    state: 'SETTLED',
    settledMinor,
    releasedMinor,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { settledMinor, releasedMinor };
}

function assertCurrentState(snap, allowed) {
  if (!snap || !snap.exists) {
    throw new Error('BudgetHold: hold doc not found.');
  }
  const state = snap.data().state;
  if (allowed.indexOf(state) === -1) {
    const err = new Error(`BudgetHold: cannot transition from ${state} (allowed: ${allowed.join(',')}).`);
    err.code = 'BUDGET_HOLD_INVALID_STATE';
    throw err;
  }
}

module.exports = {
  hold,
  lock,
  settle,
  release,
  settlePartial,
  BUDGET_HOLDS,
};
