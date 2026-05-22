/**
 * Cost-allocation raiser — admin-SDK helper for `closeWorkOrder` and
 * `cancelWorkOrder` when the receiving subsidiary is NOT a separate
 * legal entity (`organizations/{subId}.is_legal_entity === false`).
 *
 * Spec §11.9. The Commercial Gravity model normally settles every IWO
 * with an Inter-Company invoice between the receiving subsidiary's
 * legal entity and Zeus Group. When a "subsidiary" is merely an
 * operating division of the parent (e.g. a temporary brand spun up
 * without its own books, or a permanent SUBSIDIARY whose legal status
 * was flipped to false), inter-company settlement is meaningless —
 * cost belongs to one set of books.
 *
 * In that case we still need to:
 *   • Record the allocation for management-reporting purposes (which
 *     "subsidiary" earned the work).
 *   • Settle the BudgetHold (same as the IC-invoice path).
 *   • Emit an `IntraEntityCostAllocated` event so the audit log shows
 *     the IWO did close — just not via inter-company invoicing.
 *
 * Storage: `cost_allocations/{ca_<iwoId>}`. Doc id is deterministic on
 * iwoId so concurrent retries collide on the same key (mirrors the
 * §4.5 UNIQUE iwo_id constraint that protects IC invoices).
 *
 * NB: this is intentionally a sibling helper rather than a flag inside
 * `raiseIcInvoice` — the two flows write to DIFFERENT collections and
 * emit DIFFERENT event types; bundling them under one function
 * obscures the audit trail.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { ulid } = require('../../platform/ulid');

const COST_ALLOCATIONS = 'cost_allocations';

/**
 * Record an intra-entity cost allocation for an IWO, inside the
 * caller's transaction.
 *
 * Args mirror `raiseIcInvoice` so the call-site can swap between
 * them based on the sub org's `is_legal_entity` flag:
 *
 *   tx, db                  — Firestore txn + Firestore instance
 *   iwo                     — IWO doc data (must include subsidiaryOrgId,
 *                             transferPriceMinor, currency, masterJobId)
 *   iwoId                   — the IWO doc id
 *   amountMinor             — allocation amount (defaults to
 *                             iwo.transferPriceMinor; partial-settle
 *                             on cancel passes a smaller amount)
 *   idempotencyKey          — mutation-level key for retried clients
 *   isPartial               — true on §11.5 partial cancellation;
 *                             tags the allocation description
 *
 * Returns `{ id, existed }`. `existed=true` on a retry that found the
 * same allocation already present.
 */
async function recordCostAllocation(args) {
  const {
    tx, db,
    iwo, iwoId,
    amountMinor,
    isPartial,
    idempotencyKey,
  } = args;

  if (!iwo) throw new Error('recordCostAllocation: iwo data required.');
  if (!iwoId) throw new Error('recordCostAllocation: iwoId required.');
  const amount = amountMinor === undefined ? iwo.transferPriceMinor : amountMinor;
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`recordCostAllocation: invalid amountMinor ${amount}.`);
  }

  // Deterministic id → idempotent on iwoId.
  const id = `ca_${iwoId}`;
  const ref = db.collection(COST_ALLOCATIONS).doc(id);
  const existing = await tx.get(ref);
  if (existing.exists) {
    return { id, existed: true };
  }

  const description = isPartial
    ? `Intra-entity allocation (PARTIAL — IWO cancelled after mobilization) — ${iwoId}`
    : `Intra-entity allocation — IWO ${iwoId}`;

  tx.set(ref, {
    id,
    iwoId,
    masterJobId: iwo.masterJobId,
    subsidiaryOrgId: iwo.subsidiaryOrgId,
    amount: {
      amountMinor: amount,
      currency: iwo.currency,
    },
    description,
    isPartial: !!isPartial,
    idempotencyKey: idempotencyKey || null,
    status: 'RECORDED',
    allocatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id, existed: false };
}

module.exports = { recordCostAllocation, COST_ALLOCATIONS };
