/**
 * Domain-event transactional outbox — spec §10 / §14.9.
 *
 * Every commercial / financial state change writes its event to
 * `domain_events/{eventId}` inside the same Firestore transaction as
 * the state mutation. A downstream Firestore `onDocumentCreated`
 * trigger (`onDomainEventCreated` in this module) reads new rows
 * asynchronously and dispatches to consumers (billing, notifications,
 * reporting). For Phase 3.B the consumer just logs + marks `processed`.
 *
 * Event id is a ULID so events sort by emission time across shards.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ulid } = require('./ulid');

const DOMAIN_EVENTS_COLLECTION = 'domain_events';

/**
 * The 17 canonical event types (spec §10 + §11.9 + plan §15 Phase 4
 * procurement / finance handshake).
 *
 * `IntraEntityCostAllocated` is the §11.9 sibling of
 * `InterCompanyInvoiceRaised`: when the receiving subsidiary is NOT a
 * legal entity (`organizations/{subId}.is_legal_entity === false`),
 * closeWorkOrder records an intra-entity allocation instead of an IC
 * invoice. Both events keep the audit log complete regardless of which
 * settlement path the IWO took.
 *
 * The four new Phase 4.1 events close the §15 acceptance gate
 * "supplier invoice triggers PO + journal entry":
 *
 *   • `TalentInvoiceApproved`     — emitted by `approveTalentInvoiceFn`
 *                                    when a freelancer invoice moves
 *                                    SUBMITTED → APPROVED.
 *   • `MediaSupplierInvoicePaid`  — emitted by `markMediaSupplierInvoicePaidFn`
 *                                    when a media-buy supplier invoice
 *                                    transitions to PAID.
 *   • `PurchaseOrderRaised`       — emitted by the two new outbox
 *                                    consumers (talent + media) after
 *                                    they raise a PO doc in Procurement.
 *   • `JournalEntryPosted`        — emitted by the finance consumer
 *                                    after it posts a debit/credit JE
 *                                    against the chart of accounts.
 *
 * Validation happens here so a typo can't slip through.
 */
const DOMAIN_EVENT_TYPES = new Set([
  // Phase 3 — Commercial Gravity lifecycle (spec §10).
  'SowActivated',
  'QuoteAccepted',
  'MasterJobOpened',
  'IWOIssued',
  'IWOAccepted',
  'IWORejected',
  'BudgetThresholdCrossed',
  'DeliverableSubmitted',
  'IWOClosed',
  'InterCompanyInvoiceRaised',
  'IntraEntityCostAllocated',
  'ClientInvoiceIssued',
  'DirectClientRequestRouted',
  // Phase 4.1 — Procurement / Finance handshake (plan §15 acceptance).
  'TalentInvoiceApproved',
  'MediaSupplierInvoicePaid',
  'PurchaseOrderRaised',
  'JournalEntryPosted',
  // Phase 6.B — Brand routing (Addendum v1.1 §8 + v1.2 §6.1).
  // Traffic / the Routing Agent (ZA-001) proposes a serving brand;
  // a human in Traffic confirms or overrides before issueWorkOrder
  // runs. Payload carries the rejected candidates + reasons for audit.
  'RoutingBrandProposed',
  // Phase 6.C — Conflict firewall (Addendum v1.1 §6 / change C3).
  // Emitted by routeBrand's excludeConflicted() when at least one
  // candidate brand was excluded because it's already walled in for
  // the account's category. Consumed by reporting (cycle-time vs
  // routing rejections) + Conflict Sentinel (ZA-004, 6.F) which
  // surfaces the breach risk to Account Mgmt for review. Payload
  // carries (categoryId, requestedClientId, walledClientIds[],
  // excludedBrandIds[], masterJobId) — enough to reconstruct why
  // routing got tight without re-querying.
  'ConflictExclusivityRisk',
  // Phase 6.D — ECD approval ladder (Addendum v1.1 §7 / change C5).
  // The 6-rung internal-acceptance chain that gates DELIVERED →
  // ACCEPTED_INTERNALLY on every IWO. Each event carries the IWO id,
  // the rung being acted on, and (for reject) structured notes.
  // Consumed by reporting (cycle-time + rejection-loop hotspots) and
  // ECD Cycle-Time Watcher (ZA-003, 6.F). InternalApprovalGranted is
  // the terminal event — only after it fires can the IWO move to
  // ACCEPTED_INTERNALLY and unlock client presentation / IC invoice.
  'ApprovalRungAdvanced',
  'ApprovalRungRejected',
  'InternalApprovalGranted',
]);

/**
 * Append one event to the outbox inside an existing transaction.
 *
 * @param {{ tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore,
 *           eventType: string,
 *           aggregateType: 'MSA'|'SOW'|'Quote'|'MasterJob'|'IWO'|'ClientInvoice'|'InterCompanyInvoice'|'CostAllocation'|'TalentInvoice'|'MediaSupplierInvoice'|'PurchaseOrder'|'JournalEntry',
 *           aggregateId: string,
 *           payload: object,
 *           emittedByUserId?: string,
 *           idempotencyKey?: string }} args
 * @returns {{ id: string }}
 */
function appendDomainEvent(args) {
  const {
    tx, db,
    eventType, aggregateType, aggregateId, payload,
    emittedByUserId, idempotencyKey,
  } = args;

  if (!DOMAIN_EVENT_TYPES.has(eventType)) {
    throw new Error(`Unknown domain event type: ${eventType}`);
  }
  if (!aggregateType) throw new Error('appendDomainEvent: aggregateType required.');
  if (!aggregateId) throw new Error('appendDomainEvent: aggregateId required.');

  const eventId = ulid();
  const ref = db.collection(DOMAIN_EVENTS_COLLECTION).doc(eventId);
  tx.set(ref, {
    id: eventId,
    eventType,
    ulid: eventId,
    aggregateType,
    aggregateId,
    payload,
    emittedByUserId: emittedByUserId || 'system',
    emittedAt: FieldValue.serverTimestamp(),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    processed: false,
    processedBy: [],
  });
  return { id: eventId };
}

/**
 * Async consumer — for Phase 3.B we just log + mark processed.
 * Subsequent phases (3.D notifications, 3.F billing run) add their own
 * consumers that also tag `processedBy` to make at-least-once dispatch
 * deterministic.
 */
const onDomainEventCreated = onDocumentCreated(
  {
    document: `${DOMAIN_EVENTS_COLLECTION}/{eventId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;
    // eslint-disable-next-line no-console
    console.log(
      `[domain-events] ${data.eventType} aggregate=${data.aggregateType}:${data.aggregateId} id=${event.params.eventId}`,
    );
    const db = getFirestore();
    await db.collection(DOMAIN_EVENTS_COLLECTION).doc(event.params.eventId).update({
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
      processedBy: FieldValue.arrayUnion('phase-3b-stub'),
    });
  },
);

module.exports = {
  appendDomainEvent,
  onDomainEventCreated,
  DOMAIN_EVENTS_COLLECTION,
  DOMAIN_EVENT_TYPES,
};
