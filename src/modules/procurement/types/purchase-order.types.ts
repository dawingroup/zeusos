/**
 * PurchaseOrder — Phase 4.1 procurement primitive.
 *
 * A PO is the procurement-side anchor for every external 3rd-party
 * spend that needs to reach the GL. The Commercial Gravity model
 * (spec §1.3 / §7.4) treats subsidiaries as internal — their work
 * flows through IWOs + Inter-Company invoicing. POs are reserved for
 * truly external suppliers:
 *
 *   • Freelancers / talent (`kind: 'TALENT_FREELANCER'`)
 *   • Media houses (`kind: 'MEDIA_SUPPLIER'`)
 *   • One-off vendors — print, props, catering, etc. (future)
 *
 * Doc id is deterministic on the source invoice id
 * (`po_${kind}_${sourceInvoiceId}`) so the upstream outbox consumer
 * is idempotent on retry.
 *
 * NB: This file is a TYPE-only skeleton for Phase 4.1. The matching
 * Firestore rules + Cloud Functions live in:
 *   - functions/src/talent/onTalentInvoiceApproved.js
 *   - functions/src/media/onMediaSupplierInvoicePaid.js
 *   - functions/src/finance/postJournalEntryOnInvoicePaid.js
 */

import type { Timestamp } from 'firebase/firestore';

export type PurchaseOrderKind =
  | 'TALENT_FREELANCER'
  | 'MEDIA_SUPPLIER'
  | 'VENDOR_OTHER';

export type PurchaseOrderStatus =
  | 'OPEN'      // raised, awaiting GL posting
  | 'POSTED'   // journal entry written
  | 'CLOSED'  // fully settled (paid + reconciled)
  | 'VOID';

export type CurrencyCode = 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';

export interface PurchaseOrder {
  id: string;
  kind: PurchaseOrderKind;
  /** The talent_invoice or media_supplier_invoice that raised this PO. */
  sourceInvoiceId: string;
  /** Either a talent profile id (TALENT_FREELANCER) or supplier org id. */
  supplierProfileId?: string;
  supplierOrgId?: string;
  /** Total amount in minor units (cents). */
  amountMinor: number;
  currency: CurrencyCode;
  /** Link back into the campaign / engagement ledger. */
  masterJobId: string;
  /** Optional media-side joins for reconciliation queries. */
  mediaPlanId?: string;
  mediaBuyId?: string;
  vehicleType?: string;       // OOH | DIGITAL | RADIO | TV | …
  status: PurchaseOrderStatus;
  /** True after the finance consumer wrote a matching journal_entries doc. */
  postedToGL: boolean;
  /** Idempotency key copied from the upstream emission for replay safety. */
  idempotencyKey?: string | null;
  raisedAt: Timestamp | string;
  postedAt?: Timestamp | string;
  closedAt?: Timestamp | string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/**
 * Build the deterministic id used by both outbox consumers + the rules
 * layer. Centralised here so callers can construct the id without
 * importing the consumer source.
 */
export function buildPurchaseOrderId(
  kind: PurchaseOrderKind,
  sourceInvoiceId: string,
): string {
  const prefix = kind === 'TALENT_FREELANCER'
    ? 'po_talent'
    : kind === 'MEDIA_SUPPLIER'
      ? 'po_media'
      : 'po_vendor';
  return `${prefix}_${sourceInvoiceId}`;
}
