/**
 * openMasterJobOnQuoteAccepted — Phase 3.D pricing consumer.
 *
 * Firestore trigger on `domain_events/{eventId}` that fires when 3.C's
 * `acceptQuote` callable writes a `QuoteAccepted` event into the outbox.
 * It opens a `master_jobs/{masterJobId}` doc for the SOW increment with
 * the ceiling copied from the quote's client total.
 *
 * Task brief (Phase 3.D):
 *   "On QuoteAccepted find the SOW, create MasterJob with
 *    ceiling_minor = quote.client_total_minor."
 *
 * Spec §5 phase 2 — "open master job; allocate budgets; issue IWOs."
 * Spec §10 — MasterJobOpened is emitted after the master_job exists.
 *
 * Idempotency:
 *   - The event document is the idempotency anchor — we tag `processedBy`
 *     with `master-job-opener` and skip if the tag is present.
 *   - We also guard on `quote.masterJobId`. If the quote already points at
 *     a master job (replay, manual seed, etc.) we set processed and exit.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ulid } = require('../platform/ulid');
const { appendDomainEvent, DOMAIN_EVENTS_COLLECTION } = require('../platform/outbox');
const { generateCode } = require('../contracts/lib/codes');

const PROCESSOR_TAG = 'master-job-opener';

exports.openMasterJobOnQuoteAccepted = onDocumentCreated(
  {
    document: `${DOMAIN_EVENTS_COLLECTION}/{eventId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    if (data.eventType !== 'QuoteAccepted') return;

    const db = getFirestore();
    const eventRef = db.collection(DOMAIN_EVENTS_COLLECTION).doc(event.params.eventId);

    // Pre-check the processedBy tag outside the txn to avoid contention on
    // every event. The txn re-checks atomically.
    const fresh = await eventRef.get();
    const freshData = fresh.exists ? fresh.data() : {};
    if (Array.isArray(freshData.processedBy) && freshData.processedBy.includes(PROCESSOR_TAG)) {
      return;
    }

    const payload = data.payload || {};
    const quoteId = data.aggregateId;
    const sowId = payload.sowId;
    if (!quoteId || !sowId) {
      // Mal-shaped event; tag processed so we don't loop.
      await eventRef.update({
        processedBy: FieldValue.arrayUnion(PROCESSOR_TAG),
      });
      // eslint-disable-next-line no-console
      console.warn(`[master-job-opener] event ${event.params.eventId} missing quoteId/sowId; skipping.`);
      return;
    }

    try {
      await db.runTransaction(async (tx) => {
        // Re-check processed tag inside the txn.
        const evSnap = await tx.get(eventRef);
        if (evSnap.exists) {
          const ev = evSnap.data();
          if (Array.isArray(ev.processedBy) && ev.processedBy.includes(PROCESSOR_TAG)) {
            return; // already done
          }
        }

        const quoteRef = db.doc(`quotes/${quoteId}`);
        const quoteSnap = await tx.get(quoteRef);
        if (!quoteSnap.exists) {
          throw new Error(`Quote ${quoteId} not found.`);
        }
        const quote = quoteSnap.data();
        if (quote.status !== 'ACCEPTED') {
          // Possible because acceptQuote's tx writes both the quote and
          // the outbox row, but a malformed seed could violate this.
          throw new Error(`Quote ${quoteId} is ${quote.status}; expected ACCEPTED.`);
        }

        // Skip if the quote already names a master job (manual seed,
        // earlier replay).
        if (quote.masterJobId) {
          tx.update(eventRef, {
            processedBy: FieldValue.arrayUnion(PROCESSOR_TAG),
            processed: true,
            processedAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        const sowRef = db.doc(`sows/${sowId}`);
        const sowSnap = await tx.get(sowRef);
        if (!sowSnap.exists) {
          throw new Error(`SOW ${sowId} not found.`);
        }
        const sow = sowSnap.data();

        // §11.1 headroom is tracked per master job, so existing master
        // jobs for the same SOW don't block opening a new one — they each
        // get their own slice of the SOW ceiling, summed via the
        // `allocated_minor + new IWO budget ≤ ceiling_minor` check on
        // issueWorkOrder. We DO copy the ceiling from the QUOTE per the
        // task brief.
        const masterJobId = `mj_${ulid()}`;
        const code = generateCode('MJ', sow.code || sowId);
        const ceilingMinor = quote.clientTotalMinor;
        if (!Number.isInteger(ceilingMinor) || ceilingMinor <= 0) {
          throw new Error(`Quote ${quoteId} has invalid clientTotalMinor=${ceilingMinor}; cannot open master job.`);
        }

        const mjRef = db.doc(`master_jobs/${masterJobId}`);
        tx.set(mjRef, {
          id: masterJobId,
          sowId,
          quoteId,
          clientId: quote.clientId || sow.clientId || null,
          code,
          status: 'OPEN',
          allocatedMinor: 0,
          ceilingMinor,
          clientTotalMinor: ceilingMinor,
          currency: quote.currency || sow.currency,
          createdBy: payload.acceptedBy || quote.acceptedBy || 'system',
          openedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(quoteRef, {
          masterJobId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(eventRef, {
          processedBy: FieldValue.arrayUnion(PROCESSOR_TAG),
          processed: true,
          processedAt: FieldValue.serverTimestamp(),
        });

        // Emit MasterJobOpened.
        appendDomainEvent({
          tx, db,
          eventType: 'MasterJobOpened',
          aggregateType: 'MasterJob',
          aggregateId: masterJobId,
          payload: {
            masterJobId,
            sowId,
            quoteId,
            clientId: quote.clientId || sow.clientId || null,
            ceilingMinor,
            currency: quote.currency || sow.currency,
          },
          emittedByUserId: payload.acceptedBy || quote.acceptedBy || 'system',
        });
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[master-job-opener] event ${event.params.eventId} failed:`,
        err && err.message ? err.message : err,
      );
      // Leave processed tag unset so a retry (manual or via re-trigger)
      // can fix it.
    }
  },
);
