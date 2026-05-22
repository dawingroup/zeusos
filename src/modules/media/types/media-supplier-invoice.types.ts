/**
 * MediaSupplierInvoice — invoice submitted by a media supplier (house, agency)
 * for a media-buy line item.
 *
 * Collection: media_supplier_invoices/{invoiceId}
 *
 * Status flow:
 *   SUBMITTED → APPROVED (by traffic/media-ops) → PAID (by finance)
 *   SUBMITTED → REJECTED (by traffic)
 *
 * A REJECTED invoice cannot transition to PAID (enforced in service layer).
 *
 * On PAID transition, the `markMediaSupplierInvoicePaidFn` emits
 * `MediaSupplierInvoicePaid` so the procurement consumer can raise a PO.
 */

import type { Timestamp } from 'firebase/firestore';

export type MediaSupplierInvoiceStatus =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED';

export interface MediaSupplierInvoice {
  id: string;
  /** Organization that owns the media plan / buy. */
  orgId: string;
  /** Supplier organization id (media house). */
  supplierOrgId: string;
  /** Back-reference to the media plan. */
  mediaPlanId: string;
  /** Specific buy line item (vehicle × flight) if applicable. */
  mediaBuyId?: string;
  /** Master job engagement id. */
  masterJobId: string;
  /** Media vehicle type: OOH | DIGITAL | RADIO | TV | PRINT | etc. */
  vehicleType: string;
  amountMinor: number;
  currency: string;
  /** Storage reference to the invoice document. */
  invoiceStorageRef: string;
  status: MediaSupplierInvoiceStatus;
  /** Linked PO created when invoice is paid (stub). */
  linkedPoId?: string;
  approvedBy?: string;
  approvedAt?: Timestamp | string;
  rejectedBy?: string;
  rejectedAt?: Timestamp | string;
  rejectionReason?: string;
  paidAt?: Timestamp | string;
  paidBy?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
