/**
 * issueClientInvoice — DRAFT → ISSUED, emits ClientInvoiceIssued.
 *
 * Mirrors src/modules/billing/services/client-invoice.service.ts
 * #issueClientInvoice with the Admin SDK (which bypasses firestore
 * rules — so this is the only path that can flip the status field).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertBillingAdmin } = require('./lib/auth');
const { readIdempotentResponse, storeIdempotentResponse } = require('./lib/idempotency');

exports.issueClientInvoice = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertBillingAdmin(request.auth);

    const { invoiceId, idempotencyKey } = request.data || {};
    if (!invoiceId || typeof invoiceId !== 'string') {
      throw new HttpsError('invalid-argument', 'invoiceId is required.');
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
      if (invoice.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `Cannot issue invoice in status ${invoice.status} — must be DRAFT.`,
        );
      }

      tx.update(invoiceRef, {
        status: 'ISSUED',
        issuedAt: FieldValue.serverTimestamp(),
        issuedByUserId: request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Outbox — Phase 3.B will move to the canonical dispatcher.
      tx.set(db.collection('domain_events').doc(), {
        type: 'ClientInvoiceIssued',
        aggregateId: invoiceId,
        payload: {
          masterJobId: invoice.masterJobId,
          clientId: invoice.clientId,
          totalMinor: invoice.total?.amountMinor ?? null,
          currency: invoice.total?.currency ?? null,
        },
        emittedBy: request.auth.uid,
        occurredAt: FieldValue.serverTimestamp(),
      });

      return { invoiceId, status: 'ISSUED' };
    });

    await storeIdempotentResponse(idempotencyKey, 'issueClientInvoice', response);
    return response;
  },
);
