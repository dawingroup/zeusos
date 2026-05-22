/**
 * recordClientPayment — ISSUED/PART_PAID → PAID or PART_PAID.
 *
 * Mirrors src/modules/billing/services/client-invoice.service.ts
 * #recordClientPayment, plus the AR-receipt GL posting on the parent's
 * books:
 *
 *   On payment received:
 *     parent GL:
 *       debit  1000 Cash (amount)
 *       credit 1200 AR — client (amount)
 *
 * Posted via the audit-trail adapter (gl_postings/). QBO/Xero relay
 * is Phase 5. Idempotent on paymentRef so a re-submitted bank
 * reconciliation entry never double-posts.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertBillingAdmin } = require('./lib/auth');
const { readIdempotentResponse, storeIdempotentResponse } = require('./lib/idempotency');

const PARENT_ORG_ID = 'zeus-group';
const GL_POSTINGS = 'gl_postings';

/** Post the parent's AR receipt entry. Idempotent via paymentRef so
 *  the same external reference can never double-post.  */
async function postARReceipt(db, { invoiceId, paymentRef, amountMinor, currency }) {
  const idempotencyKey = `CLIENT_PAYMENT:${invoiceId}:${paymentRef}`;
  const dup = await db.collection(GL_POSTINGS)
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();
  if (!dup.empty) return dup.docs[0].id;

  const ref = await db.collection(GL_POSTINGS).add({
    entityOrgId: PARENT_ORG_ID,
    sourceDocType: 'CLIENT_PAYMENT',
    sourceDocId: invoiceId,
    adapter: 'firestore-audit',
    status: 'POSTED',
    currency,
    memo: `Client payment received — invoice ${invoiceId} ref ${paymentRef}`,
    idempotencyKey,
    lines: [
      { accountCode: '1000', debitMinor:  amountMinor, memo: 'Cash — client payment received' },
      { accountCode: '1200', creditMinor: amountMinor, memo: `AR settled — invoice ${invoiceId}` },
    ],
    postedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

exports.recordClientPayment = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertBillingAdmin(request.auth);

    const { invoiceId, amountMinor, paymentRef, idempotencyKey } = request.data || {};
    if (!invoiceId || typeof invoiceId !== 'string') {
      throw new HttpsError('invalid-argument', 'invoiceId is required.');
    }
    if (typeof amountMinor !== 'number' || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      throw new HttpsError('invalid-argument', 'amountMinor must be a positive integer (minor units).');
    }
    if (!paymentRef || typeof paymentRef !== 'string') {
      throw new HttpsError('invalid-argument', 'paymentRef is required.');
    }

    const cached = await readIdempotentResponse(idempotencyKey);
    if (cached) return cached;

    const db = getFirestore();
    const invoiceRef = db.doc(`client_invoices/${invoiceId}`);

    const response = await db.runTransaction(async (tx) => {
      const snap = await tx.get(invoiceRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', `Client invoice ${invoiceId} not found.`);
      }
      const invoice = snap.data();
      if (invoice.status === 'DRAFT' || invoice.status === 'VOID') {
        throw new HttpsError(
          'failed-precondition',
          `Cannot record payment on status ${invoice.status}.`,
        );
      }
      const totalMinor = invoice.total?.amountMinor ?? 0;
      const newPaid = (invoice.paidMinor || 0) + amountMinor;
      if (newPaid > totalMinor) {
        throw new HttpsError(
          'failed-precondition',
          `Payment ${amountMinor} exceeds outstanding balance (paid ${invoice.paidMinor || 0} of ${totalMinor}).`,
        );
      }
      const nextStatus = newPaid >= totalMinor ? 'PAID' : 'PART_PAID';

      tx.update(invoiceRef, {
        paidMinor: newPaid,
        status: nextStatus,
        paidAt: nextStatus === 'PAID' ? FieldValue.serverTimestamp() : invoice.paidAt ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(db.collection('domain_events').doc(), {
        type: 'ClientPaymentRecorded',
        aggregateId: invoiceId,
        payload: {
          masterJobId: invoice.masterJobId,
          clientId: invoice.clientId,
          amountMinor,
          paymentRef,
          paidStatus: nextStatus,
        },
        emittedBy: request.auth.uid,
        occurredAt: FieldValue.serverTimestamp(),
      });

      return {
        invoiceId,
        status: nextStatus,
        paidMinor: newPaid,
        // Currency captured from the invoice for the GL post below.
        _currency: invoice.total?.currency,
      };
    });

    // Post AR receipt outside the txn — the GL audit adapter writes
    // its own doc and we don't want to fail the payment record if the
    // GL post hits a transient issue. Idempotent on paymentRef so a
    // safe retry doesn't double-post.
    let glPostingId = null;
    try {
      glPostingId = await postARReceipt(db, {
        invoiceId,
        paymentRef,
        amountMinor,
        currency: response._currency,
      });
    } catch (err) {
      console.error('[recordClientPayment] AR-receipt GL post failed', {
        invoiceId,
        paymentRef,
        error: err?.message ?? String(err),
      });
      // Surface but do not fail the invoice update — payment is recorded,
      // GL can be reconciled manually. A scheduled job (Phase 5) will
      // sweep missing postings.
    }

    const final = {
      invoiceId,
      status: response.status,
      paidMinor: response.paidMinor,
      glPostingId,
    };

    await storeIdempotentResponse(idempotencyKey, 'recordClientPayment', final);
    return final;
  },
);
