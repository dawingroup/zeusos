/**
 * MANUAL REQUISITION TYPES
 *
 * Types for manually entered requisitions from backlog.
 * These can later be linked to projects and auto-generated requisitions.
 */

import { Timestamp } from 'firebase/firestore';
import { AccountabilityStatus, AdvanceType, ExpenseCategory } from './requisition';
import {
  AccountabilityVariance,
  ReconciliationRecord,
  ReconciliationStatus,
  SupportingDocument,
  VarianceStatus,
} from './accountability';

// ─────────────────────────────────────────────────────────────────
// MANUAL REQUISITION STATUS
// ─────────────────────────────────────────────────────────────────

export type ManualRequisitionStatus =
  | 'unlinked'      // Not yet linked to a project
  | 'linked'        // Linked to a project
  | 'reconciled';   // Linked and reconciled with system-generated requisition

export const MANUAL_REQUISITION_STATUS_CONFIG: Record<ManualRequisitionStatus, {
  label: string;
  color: string;
  description: string;
}> = {
  unlinked: {
    label: 'Unlinked',
    color: 'yellow',
    description: 'Not yet linked to a project'
  },
  linked: {
    label: 'Linked',
    color: 'blue',
    description: 'Linked to a project'
  },
  reconciled: {
    label: 'Reconciled',
    color: 'green',
    description: 'Fully reconciled with system requisition'
  },
};

// ─────────────────────────────────────────────────────────────────
// ACKNOWLEDGEMENT DOCUMENT
// ─────────────────────────────────────────────────────────────────

export interface AcknowledgementDocument {
  id: string;
  amountReceived: number;
  dateReceived: Date | Timestamp;
  receivedBy: string;           // Name of person who received
  receivedByEmail: string;      // Email for signature
  receivedByTitle?: string;     // Job title
  signatureImageUrl?: string;   // URL to uploaded signature image
  signatureHtml?: string;       // HTML email signature
  notes?: string;
  generatedAt?: Timestamp;
  generatedBy?: string;
  documentUrl?: string;         // URL to generated PDF
}

export interface AcknowledgementFormData {
  amountReceived: number;
  dateReceived: Date;
  receivedBy: string;
  receivedByEmail: string;
  receivedByTitle?: string;
  signatureHtml?: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// ACTIVITY REPORT
// ─────────────────────────────────────────────────────────────────

/**
 * Activity Report Types:
 *
 * 1. REQUISITION-LEVEL: Overall report for the requisition showing
 *    evidence of work implemented for the funds disbursed
 *
 * 2. ACCOUNTABILITY-LEVEL: Specific to labour payments and professional
 *    services. Required for expense categories: 'labor_wages' and
 *    'professional_services'
 */
export type ActivityReportLevel = 'requisition' | 'accountability';

/**
 * Categories that REQUIRE an activity report at accountability level
 */
export const ACTIVITY_REPORT_REQUIRED_CATEGORIES: ExpenseCategory[] = [
  'labor_wages',
  'professional_services',
];

/**
 * Check if an expense category requires an activity report
 */
export function requiresActivityReport(category: ExpenseCategory): boolean {
  return ACTIVITY_REPORT_REQUIRED_CATEGORIES.includes(category);
}

/**
 * Activity Report - Documentation showing evidence of work implemented
 *
 * Used at two levels:
 * - Requisition level: Overall work progress for the entire requisition
 * - Accountability level: Specific to labour/service payments
 */
export interface ActivityReport {
  id: string;
  level: ActivityReportLevel;       // Whether this is requisition or accountability level
  title: string;                    // Title/name of the activity report
  description: string;              // Summary of work implemented
  workSection: string;              // Section of work this report covers

  // Implementation details
  startDate?: Date | Timestamp;     // When work started
  endDate?: Date | Timestamp;       // When work completed
  location?: string;                // Site/location where work was done

  // Uploaded document
  documentUrl: string;              // URL to uploaded PDF/document
  documentName: string;             // Original filename
  documentType: string;             // MIME type (e.g., application/pdf)
  documentSize?: number;            // File size in bytes

  // Supporting photos (optional)
  photos?: {
    url: string;
    caption?: string;
    takenAt?: Date | Timestamp;
  }[];

  // Submission details
  submittedBy: string;              // User ID of PM who submitted
  submittedByName?: string;         // Name of PM
  submittedAt: Timestamp;           // When report was submitted

  // Review status
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
}

export interface ActivityReportFormData {
  level: ActivityReportLevel;
  title: string;
  description: string;
  workSection: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  documentUrl: string;
  documentName: string;
  documentType: string;
  documentSize?: number;
  photos?: {
    url: string;
    caption?: string;
  }[];
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT METHOD
// ─────────────────────────────────────────────────────────────────

export type PaymentMethod = 'bank_transfer' | 'mobile_money' | 'cash';

export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, {
  label: string;
  description: string;
  icon: string;
}> = {
  bank_transfer: {
    label: 'Bank Transfer',
    description: 'Payment via bank account transfer',
    icon: '🏦',
  },
  mobile_money: {
    label: 'Mobile Money',
    description: 'Payment via mobile money (MTN, Airtel, etc.)',
    icon: '📱',
  },
  cash: {
    label: 'Cash',
    description: 'Cash payment',
    icon: '💵',
  },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cash: 'Cash',
};

// ─────────────────────────────────────────────────────────────────
// MANUAL ACCOUNTABILITY ENTRY
// ─────────────────────────────────────────────────────────────────

export interface ManualAccountabilityEntry {
  id: string;
  date: Date;
  description: string;
  category: ExpenseCategory;
  vendor?: string;
  amount: number;
  receiptNumber?: string;
  invoiceNumber?: string;
  notes?: string;
  documents: SupportingDocument[];

  // Payment Method
  paymentMethod?: PaymentMethod;

  // Contract or Purchase Order
  contractOrPONumber?: string;
  contractOrPODocument?: SupportingDocument;

  // Activity Report - Required evidence of work implemented
  activityReport?: ActivityReport;
}

// ─────────────────────────────────────────────────────────────────
// MANUAL REQUISITION ENTITY
// ─────────────────────────────────────────────────────────────────

export interface ManualRequisition {
  id: string;

  // Basic info
  referenceNumber: string;        // Original reference (e.g., from Excel/paper)
  description: string;
  purpose: string;

  // Amount
  currency: string;
  amount: number;

  // Dates (stored as Timestamp in Firestore)
  requisitionDate: Timestamp | Date;   // When the requisition was originally made
  paidDate?: Timestamp | Date;         // When the advance was paid
  accountabilityDueDate?: Timestamp | Date;   // When accountability was/is due

  // Accountability
  accountabilityStatus: AccountabilityStatus;
  accountabilities: ManualAccountabilityEntry[];
  totalAccountedAmount: number;
  unaccountedAmount: number;

  // Categorization
  advanceType: AdvanceType;

  // Linking (optional - for later association)
  linkStatus: ManualRequisitionStatus;
  linkedProjectId?: string;
  linkedProjectName?: string;
  linkedProgramId?: string;
  linkedProgramName?: string;
  linkedRequisitionId?: string;   // System-generated requisition ID
  linkedRequisitionNumber?: string;

  // Source info
  sourceDocument?: string;        // e.g., "Excel backlog 2024", "Paper requisition"
  sourceReference?: string;       // Original file reference

  // Acknowledgement document (first step before accountabilities)
  acknowledgement?: AcknowledgementDocument;

  // Requisition-level Activity Report - Overall work progress for the requisition
  activityReport?: ActivityReport;

  // Notes
  notes?: string;
  linkingNotes?: string;          // Notes about how/why it was linked

  // ─────────────────────────────────────────────────────────────────
  // ADD-FIN-001 COMPLIANCE FIELDS
  // ─────────────────────────────────────────────────────────────────

  // Variance tracking (calculated from accountability entries)
  variance?: AccountabilityVariance;

  // Reconciliation status
  reconciliationStatus?: ReconciliationStatus;
  reconciliationDeadline?: Timestamp | Date;
  reconciliationRecord?: ReconciliationRecord;

  // Investigation (if variance exceeds threshold)
  investigationId?: string;
  requiresInvestigation?: boolean;

  // Link to system accountability (auto-created when linked to project)
  linkedSystemAccountabilityId?: string;

  // Funds Acknowledgement (branded AMH Uganda form)
  fundsAcknowledgementId?: string;
  fundsAcknowledgementReceiptNumber?: string;
  fundsAcknowledgementDocumentUrl?: string; // Firebase Storage URL to view/download

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// FORM DATA TYPES
// ─────────────────────────────────────────────────────────────────

export interface ManualRequisitionFormData {
  referenceNumber: string;
  description: string;
  purpose: string;
  currency: string;
  amount: number;
  requisitionDate: Date;
  paidDate?: Date;
  accountabilityDueDate?: Date;
  advanceType: AdvanceType;
  accountabilityStatus: AccountabilityStatus;
  accountabilities: (Omit<ManualAccountabilityEntry, 'id'> & { id?: string })[];
  sourceDocument?: string;
  sourceReference?: string;
  notes?: string;

  // Optional pre-linking
  linkedProjectId?: string;
  linkedProgramId?: string;
}

export interface ManualAccountabilityFormData {
  date: Date;
  description: string;
  category: ExpenseCategory;
  vendor?: string;
  amount: number;
  receiptNumber?: string;
  invoiceNumber?: string;
  notes?: string;
}

export interface LinkToProjectData {
  projectId: string;
  projectName: string;
  programId: string;
  programName: string;
  linkingNotes?: string;
}

export interface LinkToRequisitionData {
  requisitionId: string;
  requisitionNumber: string;
  linkingNotes?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate total accounted amount from accountability entries
 */
export function calculateManualAccountedTotal(
  accountabilities: ManualAccountabilityEntry[]
): number {
  return accountabilities.reduce((sum, acc) => sum + acc.amount, 0);
}

/**
 * Calculate accountability status based on amounts
 */
export function calculateManualAccountabilityStatus(
  amount: number,
  accountedAmount: number,
  dueDate?: Date | Timestamp
): AccountabilityStatus {
  if (accountedAmount >= amount) {
    return 'complete';
  }
  if (accountedAmount > 0) {
    return 'partial';
  }
  if (dueDate) {
    // Handle both Date and Firestore Timestamp
    const dueDateObj = dueDate instanceof Date ? dueDate : (dueDate as Timestamp).toDate();
    if (dueDateObj < new Date()) {
      return 'overdue';
    }
  }
  return 'pending';
}

/**
 * Get link status color
 */
export function getManualRequisitionStatusColor(status: ManualRequisitionStatus): string {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-600 bg-yellow-100',
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
  };
  return colorMap[MANUAL_REQUISITION_STATUS_CONFIG[status].color] || colorMap.yellow;
}

/**
 * Generate a reference number for manual requisitions
 */
export function generateManualRequisitionRef(sequence: number): string {
  return `MAN-REQ-${new Date().getFullYear()}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Create empty manual accountability entry
 */
export function createEmptyManualAccountability(): Omit<ManualAccountabilityEntry, 'id'> {
  return {
    date: new Date(),
    description: '',
    category: 'construction_materials',
    amount: 0,
    documents: [],
  };
}

/**
 * Calculate accountability percentage
 */
export function calculateManualAccountabilityPercentage(
  amount: number,
  accountedAmount: number
): number {
  return amount > 0 ? (accountedAmount / amount) * 100 : 0;
}

// ─────────────────────────────────────────────────────────────────
// ADD-FIN-001 COMPLIANCE HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate variance for a manual requisition (ADD-FIN-001)
 */
export function calculateManualRequisitionVariance(
  requisition: ManualRequisition
): AccountabilityVariance {
  const totalExpenses = requisition.totalAccountedAmount;
  const unspentReturned = 0; // Manual requisitions don't track unspent returns separately
  const requisitionAmount = requisition.amount;

  const accountedFor = totalExpenses + unspentReturned;
  const varianceAmount = accountedFor - requisitionAmount;
  const variancePercentage = requisitionAmount > 0
    ? Math.abs(varianceAmount / requisitionAmount) * 100
    : 0;

  // Determine variance status based on ADD-FIN-001 thresholds
  let varianceStatus: VarianceStatus;
  if (Math.abs(varianceAmount) < 0.01) {
    varianceStatus = 'compliant';
  } else if (variancePercentage < 2) {
    varianceStatus = 'minor';
  } else if (variancePercentage < 5) {
    varianceStatus = 'moderate';
  } else {
    varianceStatus = 'severe';
  }

  const isZeroDiscrepancy = Math.abs(varianceAmount) < 0.01;
  const requiresInvestigation = varianceStatus === 'moderate' || varianceStatus === 'severe';

  return {
    varianceAmount,
    variancePercentage,
    varianceStatus,
    isZeroDiscrepancy,
    totalExpenses,
    unspentReturned,
    requisitionAmount,
    requiresInvestigation,
    investigationDeadline: requiresInvestigation
      ? new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
      : undefined,
    investigationStatus: requiresInvestigation ? 'pending' : undefined,
  };
}

/**
 * Calculate reconciliation deadline (14 days from paid date)
 */
export function calculateManualReconciliationDeadline(paidDate: Date | Timestamp): Date {
  const date = paidDate instanceof Date ? paidDate : paidDate.toDate();
  const deadline = new Date(date);
  deadline.setDate(deadline.getDate() + 14);
  return deadline;
}

/**
 * Check if manual requisition reconciliation is overdue
 */
export function isManualReconciliationOverdue(requisition: ManualRequisition): boolean {
  if (!requisition.reconciliationDeadline) return false;
  if (requisition.reconciliationStatus === 'completed') return false;

  const deadline = requisition.reconciliationDeadline instanceof Date
    ? requisition.reconciliationDeadline
    : requisition.reconciliationDeadline.toDate();

  return new Date() > deadline;
}
