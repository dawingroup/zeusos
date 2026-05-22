/**
 * Platform / shared services — Identity, RBAC, event bus, idempotency.
 *
 * This module currently re-exports the domain-event taxonomy used by the
 * transactional outbox. Cloud-Function consumers (Phase 3.B onwards)
 * subscribe to `domain_events/{eventId}` and consume these typed events.
 */

export type {
  DomainEvent,
  DomainEventType,
  DomainEventPayload,
  IdempotencyKeyRecord,
  SowActivatedPayload,
  QuoteAcceptedPayload,
  MasterJobOpenedPayload,
  IWOIssuedPayload,
  IWOAcceptedPayload,
  IWORejectedPayload,
  BudgetThresholdCrossedPayload,
  DeliverableSubmittedPayload,
  IWOClosedPayload,
  InterCompanyInvoiceRaisedPayload,
  ClientInvoiceIssuedPayload,
  DirectClientRequestRoutedPayload,
} from './types/domain-event.types';

export { DOMAIN_EVENT_TYPES } from './types/domain-event.types';
