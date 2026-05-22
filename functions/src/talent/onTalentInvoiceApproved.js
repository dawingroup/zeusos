/**
 * onTalentInvoiceApproved — Phase 4.1 procurement consumer.
 *
 * Firestore trigger on `domain_events/{eventId}` that fires when an AM
 * approves a freelancer / talent invoice. The handler raises a matching
 * Procurement Purchase Order (`purchase_orders/{poId}`) so the
 * downstream payment + GL posting flow has a procurement-side anchor,
 * then emits `PurchaseOrderRaised` so the finance consumer can post a
 * journal entry.
 *
 * Task brief (plan §15 Phase 4 acceptance):
 *   "Media plan attached to campaign, buy logged, supplier invoice
 *    triggers PO + journal entry."
 *
 * Spec §5 ledger linkage — talent costs are external 3rd-party spend.
 * They MUST flow through Procurement (not Inter-Company invoicing).
 *
 * Idempotency:
 *   - PROCESSOR_TAG marks the event as consumed by this handler; a
 *     replay with the tag present short-circuits.
 *   - PO doc id is deterministic on the source invoice id
 *     (`po_talent_${talentInvoiceId}`) so concurrent retries collide
 *     on the same key. Mirrors the §4.5 UNIQUE pattern used for IC
 *     invoices.
 *
 * Status: Phase 4.1 SCAFFOLD. The handler is registered with the
 * runtime but its body is a documented TODO — see the implementation
 * checklist below. The trigger + processedBy hook are wired so the
 * `TalentInvoiceApproved` event will not be silently dropped: the
 * harness short-circuits on the tag once a real implementation lands.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { appendDomainEvent, DOMAIN_EVENTS_COLLECTION } = require('../platform/outbox');

const PROCESSOR_TAG = 'talent-invoice-po-raiser';

exports.onTalentInvoiceApproved = onDocumentCreated(
  {
    document: `${DOMAIN_EVENTS_COLLECTION}/{eventId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    if (data.eventType !== 'TalentInvoiceApproved') return;
    if (Array.isArray(data.processedBy) && data.processedBy.includes(PROCESSOR_TAG)) {
      return;
    }

    const db = getFirestore();
    const eventRef = db.collection(DOMAIN_EVENTS_COLLECTION).doc(event.params.eventId);

    // ── TODO Phase 4.1 implementation ────────────────────────────────
    // 1. Read the source talent_invoices/{talentInvoiceId} doc from
    //    data.payload.talentInvoiceId. Bail if not found (idempotent —
    //    a deleted invoice means the upstream txn rolled back).
    // 2. Build the PO doc shape (deterministic id `po_talent_${id}`):
    //      {
    //        id: `po_talent_${talentInvoiceId}`,
    //        kind: 'TALENT_FREELANCER',
    //        sourceInvoiceId: talentInvoiceId,
    //        supplierProfileId: data.payload.talentProfileId,
    //        amountMinor, currency,
    //        masterJobId: data.payload.masterJobId,
    //        status: 'OPEN',                 // ready for payment run
    //        raisedAt: FieldValue.serverTimestamp(),
    //        idempotencyKey: data.idempotencyKey || null,
    //      }
    // 3. Inside a transaction:
    //      a. Read purchase_orders/po_talent_${id} — if it already
    //         exists, set processedBy tag and return (retry guard).
    //      b. tx.set the PO doc.
    //      c. appendDomainEvent({ tx, db, eventType:'PurchaseOrderRaised',
    //         aggregateType:'PurchaseOrder', aggregateId: po.id, payload: {...} })
    //      d. tx.update(eventRef, { processedBy: arrayUnion(PROCESSOR_TAG) })
    // 4. Spec §7.4 — subsidiary principals MUST NOT read this PO.
    //    firestore.rules: parent-org-only on purchase_orders/*.
    // ─────────────────────────────────────────────────────────────────

    // Phase 4.1 SCAFFOLD short-circuit. Mark the event as seen so a
    // production deploy with this stub deployed doesn't silently
    // accumulate unprocessed events. The TODO body above replaces this
    // when the real implementation lands.
    // eslint-disable-next-line no-console
    console.warn(
      `[talent-invoice-po-raiser] SCAFFOLD — TalentInvoiceApproved ${event.params.eventId} ` +
      `received but NOT processed (Phase 4.1 implementation pending).`,
    );
    await eventRef.update({
      processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:scaffold`),
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);
