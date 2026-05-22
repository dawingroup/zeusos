/**
 * Firestore collection identifiers used by the billing + intercompany
 * module. Single source of truth so a path rename is a one-file change.
 *
 * Top-level collections live at the platform root rather than nested
 * under `organizations/{orgId}/...` because intercompany settlement
 * spans entities (subsidiary → parent) and the parent organisation
 * (`zeus-group`) is the source of truth for billing.
 */

export const COLLECTIONS = {
  /** plan §14.13 — IC settlement docs. */
  INTERCOMPANY_INVOICES: 'intercompany_invoices',
  /** plan §14.13 — client-facing invoices. */
  CLIENT_INVOICES: 'client_invoices',
  /** Subcollection under each client_invoice. */
  CLIENT_INVOICE_LINES: 'client_invoice_lines',
  /** Audit trail of every GL post regardless of adapter. */
  GL_POSTINGS: 'gl_postings',
  /** Per-subsidiary GL adapter configuration. */
  GL_CONNECTIONS: 'gl_connections',
  /** Daily FX rate snapshots (Phase 5 wires a real feed). */
  FX_RATES: 'fx_rates',
  /** Per-spec idempotency-key store on Cloud-Function callables. */
  IDEMPOTENCY_KEYS: 'idempotency_keys',
  /** Transactional outbox (Phase 3.A.5 adds the writer; we already
   *  publish event names here so consumers can subscribe). */
  DOMAIN_EVENTS: 'domain_events',
} as const;

export type BillingCollectionName =
  (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/**
 * Domain event names emitted by billing flows. Mirrors the outbox event
 * names in plan §14.9. Cloud Functions in Phase 3.B will append these to
 * the `domain_events` collection — for now they're constants so
 * consumers in this module can subscribe without typos.
 */
export const BILLING_EVENTS = {
  INTERCOMPANY_INVOICE_RAISED: 'InterCompanyInvoiceRaised',
  CLIENT_INVOICE_ISSUED: 'ClientInvoiceIssued',
  CLIENT_PAYMENT_RECORDED: 'ClientPaymentRecorded',
} as const;

export type BillingEventName =
  (typeof BILLING_EVENTS)[keyof typeof BILLING_EVENTS];
