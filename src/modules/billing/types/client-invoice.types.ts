/**
 * Client Invoice — the parent-issued bill that goes to the external client.
 *
 * SCHEMA INVARIANT (Tech Spec §4.5):
 *   `cost_minor` and `transfer_price_minor` must NEVER appear in any
 *   client-facing surface. The TypeScript types below enforce this at
 *   compile time by giving the internal and client-facing shapes
 *   different keys — the client shape does not even declare those fields.
 *
 * See plan §14.8 (single-invoice UNIQUE invariant) + §14.11 (edge cases).
 */

import type { Timestamp } from 'firebase/firestore';
import type { Money, CurrencyCode } from './money.types';
import type { TaxTreatment } from './tax.types';

export type ClientInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PART_PAID'
  | 'PAID'
  | 'VOID';

// ─────────────────────────────────────────────────────────────────
// Internal shape — used by AM + Finance UI. Contains cost_minor.
// ─────────────────────────────────────────────────────────────────

export interface ClientInvoiceLineInternal {
  id: string;
  /** Stable reference back to the Quote line this rolled up from. */
  quoteLineId?: string;
  /** The neutral, client-friendly description ("Creative campaign
   *  development" not "Zeus The Agency design hours"). */
  description: string;
  /** Client-facing price in client currency, minor units. */
  amountMinor: number;
  /** Internal-only — what we paid the subsidiary (transfer price). NEVER
   *  emitted client-side. */
  costMinor: number;
  /** Internal-only — the producing subsidiary. Audit/finance lookup. NEVER
   *  emitted client-side. */
  sourceSubsidiaryId: string;
}

export interface ClientInvoice {
  id: string;
  /** External client the invoice is addressed to. */
  clientId: string;
  /** MasterJob the invoice rolls up. The (masterJobId, status != VOID)
   *  combination is UNIQUE — at most one non-void client invoice per job. */
  masterJobId: string;

  /** Always the Zeus parent; subsidiaries never appear as issuer. */
  issuerOrgId: 'zeus-group';

  /** Total in client currency (already FX-converted if the job spans
   *  multiple subsidiary currencies — §14.11 row 11.6). */
  total: Money;
  lines: ClientInvoiceLineInternal[];

  taxTreatment: TaxTreatment;

  /** FX rate used at consolidation (rate fromCurrency → client currency).
   *  Stored even when 1.0 to make the audit trail obvious. */
  fxConsolidation?: {
    effectiveDate: string;        // YYYY-MM-DD
    /** Per-subsidiary-currency rate applied. */
    rates: Record<CurrencyCode, number>;
    source: string;
  };

  status: ClientInvoiceStatus;
  paidMinor: number;

  /** Per-spec UNIQUE guard. The Firestore doc at `client_invoices/{masterJobId}:active`
   *  is the application-level lock; this field mirrors the lock for queries. */
  uniqueGuardKey: string;

  /** Once issued, becomes immutable except for payment recording. */
  issuedAt?: Timestamp | string;
  paidAt?: Timestamp | string;
  voidedAt?: Timestamp | string;

  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

// ─────────────────────────────────────────────────────────────────
// Client-facing shape — what the client portal + PDF see. The internal
// cost_minor / sourceSubsidiaryId fields are STRUCTURALLY ABSENT.
// ─────────────────────────────────────────────────────────────────

export interface ClientFacingInvoiceLine {
  id: string;
  description: string;
  amountMinor: number;
  // ^^^ No costMinor, no sourceSubsidiaryId, no quoteLineId — by design.
}

export interface ClientFacingInvoice {
  id: string;
  clientId: string;
  /** Same total visible to the client; lines map 1:1. */
  total: Money;
  lines: ClientFacingInvoiceLine[];
  taxTreatment: TaxTreatment;
  status: ClientInvoiceStatus;
  paidMinor: number;
  issuedAt?: Timestamp | string;
  paidAt?: Timestamp | string;
  // ^^^ No costMinor, no transferPriceMinor, no sourceSubsidiaryId, no
  //     fxConsolidation (FX is an internal accounting detail), no
  //     masterJobId (clients don't see our internal job graph).
}

/**
 * Payment recording shape for `recordClientPayment` (Phase 3.B will wire
 * the callable; today the service writes directly).
 */
export interface ClientPaymentInput {
  amountMinor: number;
  paymentRef: string;
  receivedAt?: Timestamp | string;
}
