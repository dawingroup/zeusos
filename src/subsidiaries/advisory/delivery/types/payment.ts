/**
 * PAYMENT TYPES
 * 
 * Unified payment entity for all payment workflows.
 * Payment type is determined by implementationType, not funding source.
 */

import { Timestamp } from 'firebase/firestore';
import type { TransactionExchangeRate } from './exchange-rate';

// ─────────────────────────────────────────────────────────────────
// PAYMENT TYPE & STATUS
// ─────────────────────────────────────────────────────────────────

export type PaymentType = 'ipc' | 'requisition' | 'accountability';

export type PaymentStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'paid'
  | 'cancelled';

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  color: string;
  description: string;
}> = {
  draft: { label: 'Draft', color: 'gray', description: 'Being prepared' },
  submitted: { label: 'Submitted', color: 'blue', description: 'Awaiting review' },
  under_review: { label: 'Under Review', color: 'yellow', description: 'Being reviewed' },
  approved: { label: 'Approved', color: 'green', description: 'Approved for payment' },
  rejected: { label: 'Rejected', color: 'red', description: 'Rejected - needs revision' },
  processing: { label: 'Processing', color: 'purple', description: 'Payment being processed' },
  paid: { label: 'Paid', color: 'teal', description: 'Payment completed' },
  cancelled: { label: 'Cancelled', color: 'gray', description: 'Payment cancelled' },
};

// ─────────────────────────────────────────────────────────────────
// DEDUCTION TYPES
// ─────────────────────────────────────────────────────────────────

export type DeductionType =
  | 'retention'
  | 'advance_recovery'
  | 'withholding_tax'
  | 'liquidated_damages'
  | 'defects_rectification'
  | 'other';

export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
  retention: 'Retention',
  advance_recovery: 'Advance Recovery',
  withholding_tax: 'Withholding Tax',
  liquidated_damages: 'Liquidated Damages',
  defects_rectification: 'Defects Rectification',
  other: 'Other Deduction',
};

export interface PaymentDeduction {
  id: string;
  type: DeductionType;
  description: string;
  rate?: number;
  amount: number;
  isAutomatic: boolean;
}

// ─────────────────────────────────────────────────────────────────
// APPROVAL CHAIN
// ─────────────────────────────────────────────────────────────────

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export interface ApprovalStep {
  level: number;
  role: string;
  name?: string;
  userId?: string;
  userName?: string;
  status: ApprovalStepStatus;
  isRequired?: boolean;
  timestamp?: Timestamp;
  completedAt?: any;
  completedBy?: string;
  comments?: string;
  signature?: string;
}

// ─────────────────────────────────────────────────────────────────
// DOCUMENT REFERENCE
// ─────────────────────────────────────────────────────────────────

export interface PaymentDocumentRef {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT ENTITY
// ─────────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  projectId: string;
  programId: string;
  engagementId: string;
  
  // Classification
  paymentType: PaymentType;
  paymentNumber: string;
  
  // Amounts
  currency: string;
  grossAmount: number;
  deductions: PaymentDeduction[];
  netAmount: number;
  
  // Status and workflow
  status: PaymentStatus;
  currentApprovalLevel: number;
  approvalChain: ApprovalStep[];
  
  // Dates
  periodFrom?: Date;
  periodTo?: Date;
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  paidAt?: Timestamp;
  
  // References
  supportingDocs: PaymentDocumentRef[];
  relatedPaymentId?: string;

  // Multi-currency & fund location tracking
  exchangeRate?: TransactionExchangeRate;
  fundLocationId?: string;
  budgetPeriodId?: string;

  // Co-investment tracking
  coInvestmentEntryId?: string;
  coInvestmentSourceName?: string;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT SUMMARY
// ─────────────────────────────────────────────────────────────────

export interface PaymentSummary {
  projectId: string;
  totalPaid: number;
  totalPending: number;
  pendingCount: number;
  retentionHeld: number;
  advanceOutstanding: number;
  lastPaymentDate?: Date;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get payment status color class
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
  const colorMap: Record<string, string> = {
    gray: 'text-gray-600 bg-gray-100',
    blue: 'text-blue-600 bg-blue-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    green: 'text-green-600 bg-green-100',
    red: 'text-red-600 bg-red-100',
    purple: 'text-purple-600 bg-purple-100',
    teal: 'text-teal-600 bg-teal-100',
  };
  return colorMap[PAYMENT_STATUS_CONFIG[status].color] || colorMap.gray;
}

/**
 * Calculate net amount after deductions
 */
export function calculateNetAmount(
  grossAmount: number,
  deductions: PaymentDeduction[]
): number {
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  return grossAmount - totalDeductions;
}

/**
 * Check if payment can be submitted
 */
export function canSubmitPayment(payment: Payment): boolean {
  return payment.status === 'draft' && payment.grossAmount > 0;
}

/**
 * Check if payment can be approved
 */
export function canApprovePayment(payment: Payment): boolean {
  return ['submitted', 'under_review'].includes(payment.status);
}

/**
 * Get current approver role
 */
export function getCurrentApproverRole(payment: Payment): string | null {
  if (!canApprovePayment(payment)) return null;
  const currentStep = payment.approvalChain[payment.currentApprovalLevel];
  return currentStep?.role || null;
}

/**
 * Check if user can approve at current level
 */
export function canUserApprove(
  payment: Payment,
  userRole: string
): boolean {
  const currentRole = getCurrentApproverRole(payment);
  return currentRole === userRole;
}

/**
 * Get payment type label
 */
export function getPaymentTypeLabel(type: PaymentType): string {
  const labels: Record<PaymentType, string> = {
    ipc: 'Interim Payment Certificate',
    requisition: 'Requisition',
    accountability: 'Accountability',
  };
  return labels[type];
}

/**
 * Generate payment number prefix
 */
export function getPaymentNumberPrefix(type: PaymentType): string {
  const prefixes: Record<PaymentType, string> = {
    ipc: 'IPC',
    requisition: 'REQ',
    accountability: 'ACC',
  };
  return prefixes[type];
}
