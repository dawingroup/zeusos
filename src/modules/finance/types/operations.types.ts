// ============================================================================
// OPERATIONS TYPES
// DawinOS v2.0 - Financial Management Module
// Types for accountability reports and refund requests
// ============================================================================

import { Timestamp } from 'firebase/firestore';

export interface AccountabilityReport {
  id: string;
  companyId: string;
  title: string;
  submittedBy: string;
  submittedByName: string;
  department: string;
  amount: number;
  currency: string;
  description: string;
  lineItems: AccountabilityLineItem[];
  receipts: string[];
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AccountabilityLineItem {
  description: string;
  amount: number;
  category: string;
  receiptUrl?: string;
}

export type RefundCategory = 'product_return' | 'service_issue' | 'billing_error' | 'duplicate_charge' | 'other';

export interface RefundRequest {
  id: string;
  companyId: string;
  requestedBy: string;
  requestedByName: string;
  customerName?: string;
  invoiceRef?: string;
  projectRef?: string;
  amount: number;
  currency: string;
  reason: string;
  category: RefundCategory;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  processedDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
