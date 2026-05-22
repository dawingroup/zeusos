/**
 * recordClientPayment — ISSUED/PART_PAID → PAID or PART_PAID.
 *
 * Mirrors src/modules/billing/services/client-invoice.service.ts
 * #recordClientPayment. Posts AR receipt to the parent's GL via the
 * adapter once the QBO/Xero connectors land (Phase 5); today only
 * records on the invoice doc + outbox.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertBillingAdmin } = require('./lib/auth');
const { readIdempotentResponse, storeIdempotentResponse } = require('./lib/idempotency');

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

      return { invoiceId, status: nextStatus, paidMinor: newPaid };
    });

    await storeIdempotentResponse(idempotencyKey, 'recordClientPayment', response);
    return response;
  },
);
