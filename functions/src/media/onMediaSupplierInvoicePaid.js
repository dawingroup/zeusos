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
 * Status: Phase 4.1 SCAFFOLD. See the TODO block below for the real
 * implementation steps; the trigger + processedBy hook are wired so
 * events aren't silently dropped.
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

    // ── TODO Phase 4.1 implementation ────────────────────────────────
    // 1. Read media_supplier_invoices/{mediaSupplierInvoiceId} from
    //    data.payload.mediaSupplierInvoiceId. Bail if missing.
    // 2. Build PO doc (deterministic id `po_media_${id}`):
    //      {
    //        id: `po_media_${mediaSupplierInvoiceId}`,
    //        kind: 'MEDIA_SUPPLIER',
    //        sourceInvoiceId: mediaSupplierInvoiceId,
    //        supplierOrgId: data.payload.supplierOrgId,
    //        amountMinor, currency,
    //        mediaPlanId: data.payload.mediaPlanId,
    //        mediaBuyId : data.payload.mediaBuyId,    // optional
    //        masterJobId: data.payload.masterJobId,
    //        vehicleType: data.payload.vehicleType,   // OOH/Digital/Radio/…
    //        status: 'OPEN',
    //        raisedAt: FieldValue.serverTimestamp(),
    //        idempotencyKey: data.idempotencyKey || null,
    //      }
    // 3. tx.get(po) → if exists, processedBy-tag the event and return.
    // 4. tx.set(po) + appendDomainEvent({ eventType:'PurchaseOrderRaised',
    //    aggregateType:'PurchaseOrder', aggregateId: po.id, … }).
    // 5. tx.update(eventRef, processedBy ← arrayUnion(PROCESSOR_TAG)).
    // 6. firestore.rules: parent-org-only on purchase_orders/* (same as
    //    talent path — POs leak supplier costs that subs must not see).
    // ─────────────────────────────────────────────────────────────────

    // Phase 4.1 SCAFFOLD short-circuit.
    // eslint-disable-next-line no-console
    console.warn(
      `[media-supplier-invoice-po-raiser] SCAFFOLD — MediaSupplierInvoicePaid ` +
      `${event.params.eventId} received but NOT processed (Phase 4.1 pending).`,
    );
    await eventRef.update({
      processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:scaffold`),
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);
