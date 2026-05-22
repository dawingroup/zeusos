/**
 * TalentInvoice — invoice submitted by a freelancer against a contract or job.
 *
 * Collection: talent_invoices/{invoiceId}
 *
 * Approval flow:
 *   SUBMITTED → APPROVED (by AM / isCommercialActor) → PAID
 *   SUBMITTED → REJECTED (by AM)
 *
 * A REJECTED invoice cannot transition to PAID (enforced in service layer).
 */

import type { Timestamp } from 'firebase/firestore';

export type TalentInvoiceStatus =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED';

export interface TalentInvoice {
  id: string;
  talentProfileId: string;
  contractId?: string;
  masterJobId?: string;
  amountMinor: number;
  currency: string;
  /** Storage reference to the invoice document. */
  invoiceStorageRef: string;
  status: TalentInvoiceStatus;
  /** Linked PO created when invoice is approved (stub). */
  linkedPoId?: string;
  approvedBy?: string;
  approvedAt?: Timestamp | string;
  rejectedBy?: string;
  rejectedAt?: Timestamp | string;
  rejectionReason?: string;
  paidAt?: Timestamp | string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
