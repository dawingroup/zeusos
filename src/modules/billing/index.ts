/**
 * Billing & Revenue bounded context — Phase 3.F (standalone slice).
 *
 * Owns: client invoices, AR, inter-company settlement, GL adapter.
 * Must never: emit more than one non-void client invoice per master
 * job (UNIQUE invariant enforced via the
 * `client_invoices/{masterJobId}:active` doc-ID lock).
 *
 * Per spec §1.3 / §8.3 — the parent issues exactly one consolidated
 * invoice to the client at the quoted price. Subsidiaries never appear
 * on a client invoice line.
 *
 * Scope: types, constants, services, RBAC primitives, and placeholder UI
 * for client invoices + inter-company settlement + GL adapter status.
 * Cloud Functions (onIWOClosed trigger, generateClientInvoice callable,
 * recordClientPayment callable) are intentionally deferred until Phase
 * 3.B's IWO state machine and Phase 3.C's Quote builder land.
 */

export * from './types';
export * from './constants';
export * from './services';

export { default as BillingLayout } from './components/BillingLayout';
export { default as BillingAccessGuard } from './guards/BillingAccessGuard';
export { default as ClientInvoicesPage } from './pages/ClientInvoicesPage';
export { default as ClientInvoiceDetailPage } from './pages/ClientInvoiceDetailPage';
export { default as InterCompanyInvoicesPage } from './pages/InterCompanyInvoicesPage';
export { default as GLAdapterStatusPage } from './pages/GLAdapterStatusPage';
export {
  InvoicePDFPreview,
  ClientInvoiceDocument,
} from './components/InvoicePDFPreview';
