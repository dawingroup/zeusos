/**
 * Domain Events — the transactional outbox.
 *
 * Spec §10 / §14.9: every commercial and financial state change emits an
 * immutable event into `domain_events/{eventId}`. Consumers (billing,
 * notifications, reporting, GL sync) read from this collection rather than
 * subscribing to the command path, which gives us a full audit trail and
 * decouples downstream services from the write path.
 *
 * Append-only. No update, no delete — enforced in firestore.rules.
 *
 * This file defines the 11 canonical event names from spec §10 plus a
 * discriminated-union payload type per event. State-machine + Cloud
 * Function work that emits these lives in Phase 3.B (not this session).
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

// ─────────────────────────────────────────────────────────────────
// Event taxonomy
// ─────────────────────────────────────────────────────────────────

export const DOMAIN_EVENT_TYPES = [
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
  'ClientInvoiceIssued',
  'DirectClientRequestRouted',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

// ─────────────────────────────────────────────────────────────────
// Discriminated payloads (one shape per event)
// ─────────────────────────────────────────────────────────────────

export interface SowActivatedPayload {
  sowId: string;
  msaId: string;
  clientId: string;
  ceilingMinor: number;
  currency: string;
  approvedByUserId: string;
}

export interface QuoteAcceptedPayload {
  quoteId: string;
  sowId: string;
  clientTotalMinor: number;
  currency: string;
  acceptedByUserId: string;
}

export interface MasterJobOpenedPayload {
  masterJobId: string;
  sowId: string;
  quoteId: string;
  ceilingMinor: number;
  currency: string;
}

export interface IWOIssuedPayload {
  iwoId: string;
  masterJobId: string;
  subsidiaryOrgId: SubsidiaryId;
  budgetMinor: number;
  transferPriceMinor: number;
  currency: string;
  issuedByUserId: string;
  allocatedAfterMinor: number;
}

export interface IWOAcceptedPayload {
  iwoId: string;
  acceptedByUserId: string;
}

export interface IWORejectedPayload {
  iwoId: string;
  reason: string;
  rejectedByUserId: string;
}

export interface BudgetThresholdCrossedPayload {
  iwoId: string;
  thresholdPct: 80 | 100;
  cumulativeMinor: number;
  budgetMinor: number;
}

export interface DeliverableSubmittedPayload {
  iwoId: string;
  deliverableId: string;
  submittedByUserId: string;
}

export interface IWOClosedPayload {
  iwoId: string;
  closedByUserId: string;
  finalCostMinor: number;
}

export interface InterCompanyInvoiceRaisedPayload {
  intercompanyInvoiceId: string;
  iwoId: string;
  fromOrgId: SubsidiaryId;
  toOrgId: SubsidiaryId;
  amountMinor: number;
  currency: string;
}

export interface ClientInvoiceIssuedPayload {
  clientInvoiceId: string;
  masterJobId: string;
  clientId: string;
  amountMinor: number;
  currency: string;
  issuedByUserId: string;
}

export interface DirectClientRequestRoutedPayload {
  /** Subsidiary that received the direct ask. */
  receivingSubsidiaryOrgId: SubsidiaryId;
  /** Account-Management user the request was routed to. */
  routedToUserId: string;
  /** Master job intake item created (if any). */
  masterJobId?: string;
  clientId: string;
  note: string;
}

export type DomainEventPayload =
  | { type: 'SowActivated'; data: SowActivatedPayload }
  | { type: 'QuoteAccepted'; data: QuoteAcceptedPayload }
  | { type: 'MasterJobOpened'; data: MasterJobOpenedPayload }
  | { type: 'IWOIssued'; data: IWOIssuedPayload }
  | { type: 'IWOAccepted'; data: IWOAcceptedPayload }
  | { type: 'IWORejected'; data: IWORejectedPayload }
  | { type: 'BudgetThresholdCrossed'; data: BudgetThresholdCrossedPayload }
  | { type: 'DeliverableSubmitted'; data: DeliverableSubmittedPayload }
  | { type: 'IWOClosed'; data: IWOClosedPayload }
  | { type: 'InterCompanyInvoiceRaised'; data: InterCompanyInvoiceRaisedPayload }
  | { type: 'ClientInvoiceIssued'; data: ClientInvoiceIssuedPayload }
  | { type: 'DirectClientRequestRouted'; data: DirectClientRequestRoutedPayload };

// ─────────────────────────────────────────────────────────────────
// The envelope
// ─────────────────────────────────────────────────────────────────

/**
 * The outbox row written transactionally with the state change that
 * produced it. Lives at `organizations/{orgId}/domain_events/{eventId}`.
 *
 * `eventId` is a ULID (sortable by emission time, collision-resistant
 * under high concurrency). The combination of `idempotencyKey` and
 * `eventType` lets retried mutations short-circuit at the consumer.
 */
export interface DomainEvent {
  id: string;
  eventType: DomainEventType;
  /** ULID — same as id, denormalised for downstream consumers. */
  ulid: string;
  /** Server timestamp when the event was committed. */
  emittedAt: Timestamp | string;
  /** User id of the actor that triggered the state change. May be `'system'`
   *  for cron / Cloud-Function-originated transitions. */
  emittedByUserId: string;
  /** Idempotency key from the originating mutation (when applicable). */
  idempotencyKey?: string;
  /** Aggregate this event mutates — used by consumers for filtering. */
  aggregateType: 'MSA' | 'SOW' | 'Quote' | 'MasterJob' | 'IWO' | 'ClientInvoice' | 'InterCompanyInvoice';
  aggregateId: string;
  /** Discriminated union payload — see `DomainEventPayload`. */
  payload: DomainEventPayload;
  /** Consumers that have processed this event. Drives at-least-once dispatch. */
  processedBy?: string[];
}

// ─────────────────────────────────────────────────────────────────
// Idempotency-key table
// ─────────────────────────────────────────────────────────────────

/**
 * `organizations/{orgId}/idempotency_keys/{key}` — every mutation accepts a
 * client-supplied key (spec §2.2 + §9.1). The Cloud Function checks for an
 * existing record before doing work; if found, it returns the cached
 * response. Retention: 24h via TTL Cloud Function.
 */
export interface IdempotencyKeyRecord {
  key: string;
  /** Which endpoint stored this key. Lets the same key be reused across
   *  unrelated mutations without colliding. */
  endpoint: string;
  /** Cached response body for the original successful call. */
  responseJson: string;
  responseStatus: number;
  createdAt: Timestamp | string;
  /** TTL — Firestore deletes the doc automatically once this passes. */
  expiresAt: Timestamp | string;
}
