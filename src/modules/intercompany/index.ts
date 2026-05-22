/**
 * Inter-Company Finance bounded context.
 *
 * Owns: I/C invoices, transfer pricing, GL sync.
 * Must never: net across entities silently.
 *
 * Per spec §1.3 / §8.3 — every cross-entity movement of money is an
 * inter-company invoice at a governed transfer price; each invoice is
 * posted to BOTH the subsidiary's GL (as revenue) and the parent's GL
 * (as cost). The Phase 3.F GL adapter (QBO) handles the posting.
 */

export type {
  InterCompanyInvoice,
  InterCompanyInvoiceStatus,
} from './types/intercompany-invoice.types';
