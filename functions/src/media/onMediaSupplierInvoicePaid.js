/**
 * onMediaSupplierInvoicePaid — Phase 4.1 procurement consumer.
 *
 * Firestore trigger on `domain_events/{eventId}` that fires when a
 * media-buy supplier invoice is marked PAID. The handler raises a
 * Procurement PO so the GL posting flow has a procurement-side anchor,
 * then emits `PurchaseOrderRaised` (which the finance consumer picks
 * up to post a journal entry).
 *
 * Difference vs. talent path:
 *   - Media supplier invoices are tied to a `media_plans/{planId}`
 *     entry + a specific `media_buys/{buyId}` row (vehicle × flight).
 *     The PO doc carries both so reconciliation queries can join.
 *   - Trigger fires on PAID, not APPROVED: media houses are paid up-
 *     front by AM, so the PO/JE flow runs against the actually-settled
 *     amount, not the plan amount.
 *
 * Task brief (plan §15 Phase 4 acceptance):
 *   "Media plan attached to campaign, buy logged, supplier invoice
 *    triggers PO + journal entry."
 *
 * Idempotency: deterministic PO id `po_media_${mediaSupplierInvoiceId}`
 * + PROCESSOR_TAG on the event's `processedBy` array.
 *
 * Status: Phase 4.1 SCAFFOLD → COMPLETE.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { appendDomainEvent, DOMAIN_EVENTS_COLLECTION } = require('../platform/outbox');

const PROCESSOR_TAG = 'media-supplier-invoice-po-raiser';

exports.onMediaSupplierInvoicePaid = onDocumentCreated(
  {
    document: `${DOMAIN_EVENTS_COLLECTION}/{eventId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    if (data.eventType !== 'MediaSupplierInvoicePaid') return;
    if (Array.isArray(data.processedBy) && data.processedBy.includes(PROCESSOR_TAG)) {
      return;
    }

    const db = getFirestore();
    const eventRef = db.collection(DOMAIN_EVENTS_COLLECTION).doc(event.params.eventId);

    const {
      mediaSupplierInvoiceId,
      supplierOrgId,
      mediaPlanId,
      mediaBuyId,
      masterJobId,
      vehicleType,
      amountMinor,
      currency,
      orgId,
    } = data.payload || {};

    if (!mediaSupplierInvoiceId || !supplierOrgId || !mediaPlanId || !masterJobId || !orgId) {
      // Malformed event — mark processed and bail
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:malformed`),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const mediaInvoiceRef = db.collection('media_supplier_invoices').doc(mediaSupplierInvoiceId);
    const mediaInvoiceDoc = await mediaInvoiceRef.get();

    if (!mediaInvoiceDoc.exists) {
      // Source invoice deleted (upstream rollback) — idempotent, mark and return
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:source-deleted`),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    // Build PO doc
    const poId = `po_media_${mediaSupplierInvoiceId}`;
    const po = {
      id: poId,
      kind: 'MEDIA_SUPPLIER',
      sourceInvoiceId: mediaSupplierInvoiceId,
      supplierOrgId,
      masterJobId,
      amountMinor,
      currency,
      mediaPlanId,
      mediaBuyId: mediaBuyId || null,
      vehicleType,
      status: 'OPEN',
      postedToGL: false,
      raisedAt: FieldValue.serverTimestamp(),
      idempotencyKey: data.idempotencyKey || null,
      orgId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Transactional write: create PO + emit PurchaseOrderRaised + mark event processed
    await db.runTransaction(async (tx) => {
      // Check for idempotency: does this PO already exist?
      const poRef = db.collection('purchase_orders').doc(poId);
      const poDoc = await tx.get(poRef);

      if (poDoc.exists) {
        // Retry guard: PO already created, just mark event processed
        tx.update(eventRef, {
          processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:retry`),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // Create the PO doc
      tx.set(poRef, po);

      // Emit PurchaseOrderRaised domain event for downstream finance consumer
      await appendDomainEvent({
        tx,
        db,
        eventType: 'PurchaseOrderRaised',
        aggregateType: 'PurchaseOrder',
        aggregateId: poId,
        payload: {
          poId,
          kind: po.kind,
          sourceInvoiceId: mediaSupplierInvoiceId,
          supplierOrgId,
          masterJobId,
          amountMinor,
          currency,
          mediaPlanId,
          mediaBuyId: mediaBuyId || null,
          vehicleType,
          orgId,
        },
        idempotencyKey: data.idempotencyKey || null,
      });

      // Mark original event as processed
      tx.update(eventRef, {
        processedBy: FieldValue.arrayUnion(PROCESSOR_TAG),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  },
);
