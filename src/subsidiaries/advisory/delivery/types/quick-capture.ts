/**
 * QUICK CAPTURE TYPES
 *
 * Types for the Quick Capture field expenditure recording feature.
 * Quick captures create records in the existing accountability/payments structure;
 * this file defines the denormalized index for cross-project querying and
 * shared input types used by the capture form and service.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// QUICK CAPTURE DOCUMENT (attached photos / receipts)
// ─────────────────────────────────────────────────────────────────

export type QuickCaptureDocumentType =
  | 'Receipt'
  | 'Invoice'
  | 'DeliveryNote'
  | 'Photo'
  | 'Other';

export const QUICK_CAPTURE_DOCUMENT_TYPE_LABELS: Record<QuickCaptureDocumentType, string> = {
  Receipt: 'Receipt',
  Invoice: 'Invoice',
  DeliveryNote: 'Delivery Note',
  Photo: 'Photo',
  Other: 'Other',
};

export interface QuickCaptureDocument {
  type: QuickCaptureDocumentType;
  storageUrl: string;
  fileName: string;
  pdfStorageUrl?: string; // Generated PDF version of the image
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT METHOD
// ─────────────────────────────────────────────────────────────────

export type PaymentMethod = 'Cash' | 'MobileMoney' | 'BankTransfer' | 'Cheque';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Cash: 'Cash',
  MobileMoney: 'Mobile Money',
  BankTransfer: 'Bank Transfer',
  Cheque: 'Cheque',
};

// ─────────────────────────────────────────────────────────────────
// QUICK CAPTURE INPUT (form → service)
// ─────────────────────────────────────────────────────────────────

export interface QuickCaptureInput {
  date: Date;
  vendorName: string;
  description: string;
  totalAmount: number;
  currency: 'UGX' | 'USD';
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  projectId: string;
  programId?: string;
  budgetCategory: string;
  requisitionId: string | null;
  documents: QuickCaptureDocument[];
  notes: string;
}

// ─────────────────────────────────────────────────────────────────
// QUICK CAPTURE INDEX (denormalized for cross-project querying)
// Firestore: organizations/{orgId}/quick_capture_index/{indexId}
// ─────────────────────────────────────────────────────────────────

export interface QuickCaptureIndex {
  id: string;
  projectId: string;
  projectName: string;
  programId: string;
  vendorName: string;
  description: string;
  amount: number;
  currency: string;
  capturedAt: Timestamp;
  linkDeadline: Timestamp;
  requisitionLinkStatus: 'pending' | 'linked' | 'retroactive';
  thumbnailUrl: string | null;
  organizationId: string;
  budgetCategory: string;
  paymentMethod: PaymentMethod;
  /** The accountability record ID in the payments collection */
  accountabilityId: string;
  createdBy: string;
}

// ─────────────────────────────────────────────────────────────────
// QUICK CAPTURE SUMMARY (for inbox header)
// ─────────────────────────────────────────────────────────────────

export interface QuickCaptureSummary {
  pendingCount: number;
  overdueCount: number;
  totalValue: number;
  currency: string;
}
