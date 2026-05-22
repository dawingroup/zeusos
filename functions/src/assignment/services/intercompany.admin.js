/**
 * IC-invoice raiser — admin-SDK helper for `closeWorkOrder` and
 * `cancelWorkOrder` (partial-settle path, spec §11.5).
 *
 * Mirrors the client-side `src/modules/billing/services/intercompany-invoice.service.ts`
 * `raiseFromIWOClosed()` but runs inside the caller's Firestore
 * transaction so the IC invoice and the IWO state change commit
 * together. The GL posting (`postedToGL: true`) is left to the Phase
 * 3.F billing-run consumer — we mark `posted_to_gl: false` here.
 *
 * Idempotency: every IC invoice carries an `idempotencyKey` derived from
 * the calling endpoint + IWO id, plus the original mutation's key when
 * present. Retries of `closeWorkOrder` find the existing invoice via
 * `iwoId` (UNIQUE in §4.5) and short-circuit.
 */

const { FieldValue } = require('firebase-admin/firestore');
const { ulid } = require('../../platform/ulid');

const IC_INVOICES = 'intercompany_invoices';
const PARENT_ORG_ID = 'zeus-group';

/**
 * Raise an IC invoice for an IWO, fully inside the caller's tx. Idempotent
 * on `iwoId` per spec §4.5 (UNIQUE iwo_id).
 *
 * Args:
 *   tx, db                  — Firestore txn + Firestore instance
 *   iwo                     — the IWO doc data (must include subsidiaryOrgId,
 *                             transferPriceMinor, currency, masterJobId)
 *   iwoId                   — the IWO doc id
 *   amountMinor             — invoice total (defaults to iwo.transferPriceMinor;
 *                             partial-settle on cancel passes a smaller amount)
 *   idempotencyKey          — mutation-level key for the retried client
 *   isPartial               — true on §11.5 partial cancellation; tags the
 *                             invoice description for auditability
 *
 * Returns the invoice id. Caller is expected to read the IWO's existing
 * IC invoice before this call (look up `intercompany_invoices`
 * `iwoId == iwoId`) to detect retries — admin-SDK transactions in
 * Firestore JS don't expose `INSERT … ON CONFLICT`, so we settle for
 * "check then write" inside the txn.
 */
async function raiseIcInvoice(args) {
  const {
    tx, db,
    iwo, iwoId,
    amountMinor,
    isPartial,
    idempotencyKey,
  } = args;

  if (!iwo) throw new Error('raiseIcInvoice: iwo data required.');
  if (!iwoId) throw new Error('raiseIcInvoice: iwoId required.');
  const amount = amountMinor === undefined ? iwo.transferPriceMinor : amountMinor;
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`raiseIcInvoice: invalid amountMinor ${amount}.`);
  }

  // Idempotency check — UNIQUE (iwo_id). The IC invoice doc id is
  // deterministic on iwoId so concurrent txns collide on the same key.
  const id = `ic_${iwoId}`;
  const ref = db.collection(IC_INVOICES).doc(id);
  const existing = await tx.get(ref);
  if (existing.exists) {
    return { id, existed: true };
  }

  const fromOrgId = iwo.subsidiaryOrgId;
  const toOrgId = PARENT_ORG_ID;
  const description = isPartial
    ? `IC settlement (PARTIAL — IWO cancelled after mobilization) — ${iwoId}`
    : `IC settlement — IWO ${iwoId}`;

  tx.set(ref, {
    id,
    iwoId,
    masterJobId: iwo.masterJobId,
    fromOrgId,
    toOrgId,
    amount: {
      amountMinor: amount,
      currency: iwo.currency,
    },
    lines: [
      {
        id: `icl_${ulid()}`,
        description,
        amountMinor: amount,
        currency: iwo.currency,
      },
    ],
    taxTreatment: { kind: 'PENDING', source: 'phase-3b-deferred' },
    status: 'RAISED',
    postedToGL: false,
    isPartial: !!isPartial,
    idempotencyKey: idempotencyKey || null,
    raisedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id, existed: false };
}

module.exports = { raiseIcInvoice, IC_INVOICES };
