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

    // 1. Read the source talent_invoices/{talentInvoiceId} doc
    const { talentInvoiceId, talentProfileId, masterJobId, amountMinor, currency, orgId } = data.payload || {};

    if (!talentInvoiceId || !talentProfileId || !masterJobId || !orgId) {
      // Malformed event — mark processed and bail
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:malformed`),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const talentInvoiceRef = db.collection('talent_invoices').doc(talentInvoiceId);
    const talentInvoiceDoc = await talentInvoiceRef.get();

    if (!talentInvoiceDoc.exists) {
      // Source invoice deleted (upstream rollback) — idempotent, mark and return
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:source-deleted`),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    // 2. Build PO doc
    const poId = `po_talent_${talentInvoiceId}`;
    const po = {
      id: poId,
      kind: 'TALENT_FREELANCER',
      sourceInvoiceId: talentInvoiceId,
      supplierProfileId: talentProfileId,
      masterJobId,
      amountMinor,
      currency,
      status: 'OPEN',
      raisedAt: FieldValue.serverTimestamp(),
      idempotencyKey: data.idempotencyKey || null,
      orgId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 3. Transactional write: create PO + emit PurchaseOrderRaised + mark event processed
    await db.runTransaction(async (tx) => {
      // 3a. Check for idempotency: does this PO already exist?
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

      // 3b. Create the PO doc
      tx.set(poRef, po);

      // 3c. Emit PurchaseOrderRaised domain event for downstream finance consumer
      await appendDomainEvent({
        tx,
        db,
        eventType: 'PurchaseOrderRaised',
        aggregateType: 'PurchaseOrder',
        aggregateId: poId,
        payload: {
          poId,
          kind: po.kind,
          sourceInvoiceId: talentInvoiceId,
          supplierProfileId: talentProfileId,
          masterJobId,
          amountMinor,
          currency,
          orgId,
        },
        idempotencyKey: data.idempotencyKey || null,
      });

      // 3d. Mark original event as processed
      tx.update(eventRef, {
        processedBy: FieldValue.arrayUnion(PROCESSOR_TAG),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  },
);
