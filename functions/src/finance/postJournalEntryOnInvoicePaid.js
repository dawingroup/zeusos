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
 * Status: Phase 4.1 SCAFFOLD → COMPLETE.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { appendDomainEvent, DOMAIN_EVENTS_COLLECTION } = require('../platform/outbox');
const { loadChartOfAccounts } = require('./chartOfAccounts');

const PROCESSOR_TAG = 'finance-je-poster';

// Chart of accounts now lives in `./chartOfAccounts.js` and is loaded per
// invocation from `finance_config/chart_of_accounts` (with hardcoded
// defaults). Letting finance amend account codes without a deploy was
// the §5 follow-up flagged in `docs/PHASE_4_1_HANDSHAKE.md`.

// The event types this consumer listens for. Add to this list
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

    // Resolve source doc kind and id from event type
    let sourceDocKind;
    let sourceDocId;
    let poKind; // The PO kind if this came from a PO

    if (data.eventType === 'PurchaseOrderRaised') {
      sourceDocKind = data.payload.kind; // TALENT_FREELANCER or MEDIA_SUPPLIER
      sourceDocId = data.payload.poId;
      poKind = data.payload.kind;
    } else if (data.eventType === 'ClientInvoicePaid') {
      sourceDocKind = 'CLIENT_REVENUE_RECOGNISED';
      sourceDocId = data.payload.clientInvoiceId;
    } else {
      // Should not happen (HANDLED_EVENT_TYPES guard above)
      return;
    }

    // Look up account codes from chart of accounts. The loader reads
    // `finance_config/chart_of_accounts` from Firestore and falls back
    // to compiled-in defaults if the doc is missing or any single
    // override is malformed (see chartOfAccounts.js for merge rules).
    const chartOfAccounts = await loadChartOfAccounts(db);
    const accountMapping = chartOfAccounts[sourceDocKind];
    if (!accountMapping) {
      // eslint-disable-next-line no-console
      console.error(
        `[finance-je-poster] Unknown source doc kind: ${sourceDocKind} ` +
        `for event ${data.eventType}. Check finance_config/chart_of_accounts.`,
      );
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:unknown-kind`),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const { amountMinor, currency, orgId } = data.payload;

    if (!amountMinor || !currency || !orgId) {
      // Malformed event — mark processed and bail
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:malformed`),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    // Build JE doc
    const jeId = `je_${sourceDocKind.toLowerCase()}_${sourceDocId}`;
    const je = {
      id: jeId,
      kind: sourceDocKind,
      sourceDocId,
      sourceDocKind: data.eventType,
      currency,
      debits: [
        {
          accountCode: accountMapping.debit.accountCode,
          accountName: accountMapping.debit.accountName,
          amountMinor,
          description: `${sourceDocKind}: ${sourceDocId}`,
        },
      ],
      credits: [
        {
          accountCode: accountMapping.credit.accountCode,
          accountName: accountMapping.credit.accountName,
          amountMinor,
          description: `${sourceDocKind}: ${sourceDocId}`,
        },
      ],
      postedAt: FieldValue.serverTimestamp(),
      idempotencyKey: data.idempotencyKey || null,
      orgId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Transactional write: create JE + emit JournalEntryPosted + update source doc +
    // mark event processed
    await db.runTransaction(async (tx) => {
      // 1. Check for idempotency: does this JE already exist?
      const jeRef = db.collection('journal_entries').doc(jeId);
      const jeDoc = await tx.get(jeRef);

      if (jeDoc.exists) {
        // Retry guard: JE already created, just mark event processed
        tx.update(eventRef, {
          processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:retry`),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 2. Validate that sum(debits) === sum(credits)
      const totalDebits = je.debits.reduce((sum, line) => sum + line.amountMinor, 0);
      const totalCredits = je.credits.reduce((sum, line) => sum + line.amountMinor, 0);

      if (totalDebits !== totalCredits) {
        // eslint-disable-next-line no-console
        console.error(
          `[finance-je-poster] JE ${jeId} validation failed: ` +
          `debits (${totalDebits}) !== credits (${totalCredits})`,
        );
        tx.update(eventRef, {
          processedBy: FieldValue.arrayUnion(`${PROCESSOR_TAG}:balance-check-failed`),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 3. Create the JE doc
      tx.set(jeRef, je);

      // 4. Emit JournalEntryPosted domain event for audit log + dashboards
      await appendDomainEvent({
        tx,
        db,
        eventType: 'JournalEntryPosted',
        aggregateType: 'JournalEntry',
        aggregateId: jeId,
        payload: {
          jeId,
          kind: sourceDocKind,
          sourceDocId,
          currency,
          amountMinor,
          orgId,
        },
        idempotencyKey: data.idempotencyKey || null,
      });

      // 5. If source is a PO, flip posted_to_gl to true
      if (data.eventType === 'PurchaseOrderRaised') {
        const poRef = db.collection('purchase_orders').doc(sourceDocId);
        tx.update(poRef, {
          postedToGL: true,
          status: 'POSTED',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 6. Mark original event as processed
      tx.update(eventRef, {
        processedBy: FieldValue.arrayUnion(PROCESSOR_TAG),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  },
);
