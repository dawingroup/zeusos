/**
 * postJournalEntryOnInvoicePaid — Phase 4.1 finance consumer.
 *
 * Firestore trigger on `domain_events/{eventId}` that fires after a
 * `PurchaseOrderRaised` event lands (emitted by the talent + media
 * upstream consumers) or when a client invoice transitions to PAID.
 * The handler posts a double-entry journal entry against the chart of
 * accounts so the GL stays in sync with the operational ledger.
 *
 * Why one consumer for three sources:
 *   - Every PO and every paid invoice produces exactly ONE journal
 *     entry of the same {debit, credit} shape. The account codes
 *     differ per source but the writer is identical, so a single
 *     consumer with a switch on source-kind keeps the logic in one
 *     auditable place.
 *
 * Task brief (plan §15 Phase 4 acceptance):
 *   "supplier invoice triggers PO + journal entry."
 *
 * Idempotency: deterministic JE id `je_${sourceDocKind}_${sourceDocId}`
 * + PROCESSOR_TAG on `processedBy`. The existing
 * `src/modules/finance/types/journal.types.ts` defines the JE shape;
 * this consumer writes to the same `journal_entries/{id}` collection.
 *
 * Status: Phase 4.1 SCAFFOLD. The implementation needs:
 *   (a) the chart-of-accounts mapping (which a/c codes for talent vs.
 *       media vs. client revenue). Lives in finance config — TBD.
 *   (b) currency-conversion when the JE base currency differs from
 *       the source (see spec §11.6 multi-currency rules).
 *   (c) GL-posting effect on `posted_to_gl` flags upstream.
 *
 * Trigger + processedBy hook are wired so events aren't silently
 * dropped while the body is empty.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { appendDomainEvent, DOMAIN_EVENTS_COLLECTION } = require('../platform/outbox');

const PROCESSOR_TAG = 'finance-je-poster';

// The three event types this consumer listens for. Add to this list
// when new source documents need GL posting.
const HANDLED_EVENT_TYPES = new Set([
  'PurchaseOrderRaised',
  // ClientInvoicePaid is emitted by Phase 3.F billing — wire it in
  // here for the consolidated paid-side JE.
  'ClientInvoicePaid',
]);

exports.postJournalEntryOnInvoicePaid = onDocumentCreated(
  {
    document: `${DOMAIN_EVENTS_COLLECTION}/{eventId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    if (!HANDLED_EVENT_TYPES.has(data.eventType)) return;
    if (Array.isArray(data.processedBy) && data.processedBy.includes(PROCESSOR_TAG)) {
      return;
    }

    const db = getFirestore();
    const eventRef = db.collection(DOMAIN_EVENTS_COLLECTION).doc(event.params.eventId);

    // ── TODO Phase 4.1 implementation ────────────────────────────────
    // 1. Resolve source doc kind from the event:
    //      - PurchaseOrderRaised → source = purchase_orders/{poId},
    //                              je kind = 'PO_RAISED'.
    //      - ClientInvoicePaid   → source = client_invoices/{ciId},
    //                              je kind = 'CLIENT_REVENUE_RECOGNISED'.
    // 2. Look up the matching account codes from finance config
    //    (TBD — likely a small Firestore doc or a checked-in JSON
    //    chart of accounts). Decide debit vs. credit per kind.
    // 3. Build the JE shape (see
    //    `src/modules/finance/types/journal.types.ts`):
    //      {
    //        id: `je_${kind.toLowerCase()}_${sourceDocId}`,
    //        kind, sourceDocId, sourceDocKind,
    //        currency,
    //        debits:  [{ accountCode, amountMinor, description }],
    //        credits: [{ accountCode, amountMinor, description }],
    //        postedAt: FieldValue.serverTimestamp(),
    //        idempotencyKey: data.idempotencyKey || null,
    //      }
    // 4. Inside a transaction:
    //      a. tx.get(je) — if exists, processedBy-tag the event + return.
    //      b. Validate sum(debits) === sum(credits). Throw if not.
    //      c. tx.set(je).
    //      d. appendDomainEvent({ eventType:'JournalEntryPosted',
    //         aggregateType:'JournalEntry', aggregateId: je.id, … }).
    //      e. If source is a PO or invoice, also flip `posted_to_gl`
    //         to true on the source doc so reads know the JE landed.
    //      f. tx.update(eventRef, processedBy ← arrayUnion(PROCESSOR_TAG)).
    // 5. Multi-currency (spec §11.6): if the JE base currency differs
    //    from the source's, fetch the consolidation-date FX rate and
    //    record it on the JE for traceability. Out of scope for the
    //    single-currency MVP.
    // ─────────────────────────────────────────────────────────────────

    // Phase 4.1 SCAFFOLD short-circuit.
    // eslint-disable-next-line no-console
    console.warn(
      `[finance-je-poster] SCAFFOLD — ${data.eventType} ${event.params.eventId} ` +
      `received but NOT posted to GL (Phase 4.1 implementation pending).`,
    );
    await eventRef.update({
      processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:scaffold`),
      updatedAt: FieldValue.serverTimestamp(),
    });
  },
);
