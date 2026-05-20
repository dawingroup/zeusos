/**
 * ACCOUNTABILITY TYPES
 *
 * Expense reporting for requisition advances.
 */

import { Timestamp } from 'firebase/firestore';
import { Payment } from './payment';
import { ExpenseCategory } from './requisition';

// ─────────────────────────────────────────────────────────────────
// PROOF OF SPEND (ADD-FIN-001 Zero-Discrepancy Policy)
// ─────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'invoice'
  | 'receipt'
  | 'delivery_note'
  | 'purchase_order'
  | 'photo_evidence'
  | 'attendance_register'
  | 'payment_receipt'
  | 'rental_agreement'
  | 'waybill'
  | 'fuel_receipt'
  | 'other';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  delivery_note: 'Delivery Note',
  purchase_order: 'Purchase Order',
  photo_evidence: 'Photo Evidence',
  attendance_register: 'Attendance Register',
  payment_receipt: 'Payment Receipt',
  rental_agreement: 'Rental Agreement',
  waybill: 'Waybill',
  fuel_receipt: 'Fuel Receipt',
  other: 'Other',
};

export interface ProofOfSpendDocument {
  id: string;
  type: DocumentType;
  documentUrl: string;
  documentName: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
  fileSize: number;
  mimeType: string;

  // Quality validation
  dpi?: number;
  isQualityValid: boolean;
  qualityValidationNotes?: string;

  // Metadata
  issuer?: string;
  issueDate?: Date;
  amount?: number;
  notes?: string;
}

export interface ProofOfSpendEvidence {
  expenseId: string;
  category: ExpenseCategory;
  requiredDocuments: DocumentType[];
  providedDocuments: ProofOfSpendDocument[];
  isComplete: boolean;
  completionNotes?: string;
}

/**
 * ADD-FIN-001 Proof of Spend Requirements by Category
 */
export const PROOF_OF_SPEND_REQUIREMENTS: Record<
  ExpenseCategory,
  {
    requiredDocuments: DocumentType[];
    minimumDocumentQuality: number; // DPI
    requiresPhotographicEvidence: boolean;
    requiresPurchaseOrder: boolean;  // PO requirement
    poMandatoryThreshold?: number;   // Amount above which PO is mandatory (UGX)
    description: string;
  }
> = {
  construction_materials: {
    requiredDocuments: ['invoice', 'receipt', 'delivery_note', 'photo_evidence', 'purchase_order'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: true,
    requiresPurchaseOrder: true,
    poMandatoryThreshold: 500000,  // 500k UGX
    description: 'Materials require PO, invoice, receipt, delivery note, and photo evidence',
  },
  labor_wages: {
    requiredDocuments: ['attendance_register', 'payment_receipt'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: false,
    description: 'Labor requires attendance register and payment receipt',
  },
  equipment_rental: {
    requiredDocuments: ['rental_agreement', 'receipt', 'purchase_order'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: true,
    poMandatoryThreshold: 1000000,  // 1M UGX
    description: 'Equipment rental requires PO, agreement, and receipt',
  },
  transport_logistics: {
    requiredDocuments: ['waybill', 'fuel_receipt'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: false,
    description: 'Transport requires waybill and fuel receipts',
  },
  utilities: {
    requiredDocuments: ['invoice', 'receipt'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: false,
    description: 'Utilities require invoice and receipt',
  },
  permits_fees: {
    requiredDocuments: ['receipt', 'invoice'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: false,
    description: 'Permits and fees require receipt and invoice',
  },
  professional_services: {
    requiredDocuments: ['invoice', 'receipt', 'purchase_order'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: true,
    poMandatoryThreshold: 2000000,  // 2M UGX
    description: 'Professional services require PO, invoice, and receipt',
  },
  contingency: {
    requiredDocuments: ['receipt'],
    minimumDocumentQuality: 300,
    requiresPhotographicEvidence: false,
    requiresPurchaseOrder: false,
    description: 'Contingency expenses require receipt',
  },
};

// ─────────────────────────────────────────────────────────────────
// VARIANCE TRACKING (ADD-FIN-001 Zero-Discrepancy Policy)
// ─────────────────────────────────────────────────────────────────

export type VarianceStatus =
  | 'compliant' // Zero variance (< 0.01)
  | 'minor' // < 2% variance
  | 'moderate' // 2-5% variance - requires investigation
  | 'severe'; // > 5% variance - personal liability

export const VARIANCE_STATUS_CONFIG: Record<
  VarianceStatus,
  { label: string; color: string; threshold: number }
> = {
  compliant: { label: 'Compliant', color: 'green', threshold: 0.01 },
  minor: { label: 'Minor Variance', color: 'blue', threshold: 0.02 },
  moderate: { label: 'Moderate Variance', color: 'yellow', threshold: 0.05 },
  severe: { label: 'Severe Variance', color: 'red', threshold: Infinity },
};

export interface AccountabilityVariance {
  varianceAmount: number;
  variancePercentage: number;
  varianceStatus: VarianceStatus;
  isZeroDiscrepancy: boolean;

  // Shorthand aliases used by analytics services
  amount?: number;
  percentage?: number;

  // Breakdown
  totalExpenses: number;
  unspentReturned: number;
  requisitionAmount: number;

  // Investigation
  requiresInvestigation: boolean;
  investigationDeadline?: Date;
  investigationStatus?: 'pending' | 'in_progress' | 'completed' | 'escalated';
  investigationNotes?: string;
}

// ─────────────────────────────────────────────────────────────────
// VARIANCE INVESTIGATION
// ─────────────────────────────────────────────────────────────────

export type InvestigationStatus = 'pending' | 'in_progress' | 'completed' | 'escalated';

export interface VarianceInvestigation {
  id: string;
  accountabilityId: string;
  projectId?: string;
  varianceAmount: number;
  variancePercentage: number;

  // Assignment
  assignedTo: string;
  assignedAt: Timestamp;
  deadline: Date; // 48 hours from detection

  // Status
  status: InvestigationStatus;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Findings
  findings?: string;
  rootCause?: string;
  correctiveActions?: string;
  personalLiabilityAmount?: number;
  personalLiabilityAssignedTo?: string;

  // Escalation
  escalatedAt?: Timestamp;
  escalatedTo?: string;
  escalationReason?: string;
}

// ─────────────────────────────────────────────────────────────────
// RECONCILIATION
// ─────────────────────────────────────────────────────────────────

export type ReconciliationStatus = 'pending' | 'in_progress' | 'completed' | 'disputed';

export interface ReconciliationRecord {
  id: string;
  accountabilityId: string;
  reconciledBy: string;
  reconciledAt: Timestamp;
  status: ReconciliationStatus;

  // Reconciliation details
  requisitionAmount: number;
  totalExpenses: number;
  unspentReturned: number;
  variance: number;

  // Verification
  allReceiptsVerified: boolean;
  proofOfSpendComplete: boolean;
  zeroDiscrepancyAchieved: boolean;

  // Notes
  notes?: string;
  disputeReason?: string;
}

// ─────────────────────────────────────────────────────────────────
// EXPENSE STATUS
// ─────────────────────────────────────────────────────────────────

export type ExpenseStatus = 'pending' | 'verified' | 'rejected';

export const EXPENSE_STATUS_CONFIG: Record<ExpenseStatus, {
  label: string;
  color: string;
}> = {
  pending: { label: 'Pending Verification', color: 'yellow' },
  verified: { label: 'Verified', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
};

// ─────────────────────────────────────────────────────────────────
// SUPPORTING DOCUMENTS
// ─────────────────────────────────────────────────────────────────

export type SupportingDocumentType =
  | 'invoice'
  | 'receipt'
  | 'delivery_note'
  | 'purchase_order'
  | 'activity_report'
  | 'contract'
  | 'quotation'
  | 'waybill'
  | 'other';

export const DOCUMENT_TYPE_CONFIG: Record<SupportingDocumentType, {
  label: string;
  description: string;
  required: boolean;
  order: number;
}> = {
  purchase_order: {
    label: 'Purchase Order',
    description: 'PO issued to supplier',
    required: false,
    order: 1,
  },
  contract: {
    label: 'Contract/Agreement',
    description: 'Service contract or agreement (if no PO)',
    required: false,
    order: 2,
  },
  quotation: {
    label: 'Quotation',
    description: 'Price quotation from supplier',
    required: false,
    order: 3,
  },
  invoice: {
    label: 'Invoice',
    description: 'Supplier invoice',
    required: true,
    order: 4,
  },
  delivery_note: {
    label: 'Delivery Note',
    description: 'Goods received note / delivery confirmation',
    required: false,
    order: 5,
  },
  waybill: {
    label: 'Waybill',
    description: 'Transport/shipping document',
    required: false,
    order: 6,
  },
  receipt: {
    label: 'Payment Receipt',
    description: 'Proof of payment',
    required: true,
    order: 7,
  },
  activity_report: {
    label: 'Activity Report',
    description: 'Work completion or activity report',
    required: false,
    order: 8,
  },
  other: {
    label: 'Other Document',
    description: 'Additional supporting document',
    required: false,
    order: 9,
  },
};

export interface SupportingDocument {
  id: string;
  type: SupportingDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  documentNumber?: string;  // Invoice number, PO number, etc.
  documentDate?: Date;
  uploadedAt: Date;
  uploadedBy: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// ACCOUNTABILITY EXPENSE
// ─────────────────────────────────────────────────────────────────

export interface AccountabilityExpense {
  id: string;
  lineNumber: number;  // Sequential line number for display
  date: Date;
  description: string;
  category: ExpenseCategory;
  vendor?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  amount: number;

  // Supporting documents
  documents: SupportingDocument[];

  // Legacy field (for backward compatibility)
  receiptDocId?: string;

  // Verification
  status: ExpenseStatus;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: Date;

  // ADD-FIN-001: Proof of spend evidence
  proofOfSpend?: ProofOfSpendEvidence;
  isZeroDiscrepancy: boolean;
  variance?: number;
  varianceJustification?: string;

  // ADD-FIN-001: BOQ linkage (if applicable)
  boqItemId?: string;
  boqItemCode?: string;
  quantityExecuted?: number;

  // Purchase order linkage
  purchaseOrderId?: string;
  poItemId?: string;
  poItemLineNumber?: number;

  // Three-way match tracking
  threeWayMatchId?: string;
  threeWayMatchStatus?: 'matched' | 'variance' | 'missing_po' | 'not_applicable';

  // PO validation
  poValidated?: boolean;
  poValidationNotes?: string;
  poVariance?: {
    quantityVariance: number;
    amountVariance: number;
    variancePercentage: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// RECEIPTS SUMMARY
// ─────────────────────────────────────────────────────────────────

export interface ReceiptsSummary {
  totalReceipts: number;
  verifiedReceipts: number;
  pendingReceipts: number;
  rejectedReceipts: number;
  totalVerifiedAmount: number;
}

// ─────────────────────────────────────────────────────────────────
// ACCOUNTABILITY ENTITY
// ─────────────────────────────────────────────────────────────────

export interface Accountability extends Payment {
  paymentType: 'accountability';

  // Reference to requisition
  requisitionId: string;
  requisitionNumber: string;
  requisitionAmount: number;

  // ─── QUICK CAPTURE EXTENSION FIELDS ──────────────────────────
  // All optional with defaults for backward compatibility.
  // Existing records implicitly have captureMode: 'standard' and requisitionLinkStatus: 'linked'.
  captureMode?: 'standard' | 'quick_capture';
  capturedAt?: Timestamp | null;
  captureLocation?: { latitude: number; longitude: number } | null;
  requisitionLinkStatus?: 'linked' | 'pending' | 'retroactive';
  linkedRequisitionId?: string | null;
  linkDeadline?: Timestamp | null;
  allocationGroupId?: string | null; // Phase 2: multi-project allocation

  // Expense details
  expenses: AccountabilityExpense[];

  // Summary
  totalExpenses: number;
  unspentReturned: number;
  balanceDue: number;

  // Verification
  receiptsSummary: ReceiptsSummary;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  verificationNotes?: string;

  // ADD-FIN-001: Variance tracking
  variance: AccountabilityVariance;
  isZeroDiscrepancy: boolean;

  // ADD-FIN-001: Reconciliation
  reconciliationStatus: ReconciliationStatus;
  reconciliationDeadline: Date;
  reconciliationRecord?: ReconciliationRecord;

  // ADD-FIN-001: Investigation (if variance exceeds threshold)
  investigationId?: string;
  requiresInvestigation: boolean;

  // ADD-FIN-001: Notion integration
  notionPageId?: string;
  notionSyncStatus?: 'pending' | 'synced' | 'error';
  notionSyncError?: string;
  lastNotionSyncAt?: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// ACCOUNTABILITY FORM DATA
// ─────────────────────────────────────────────────────────────────

export interface AccountabilityFormData {
  requisitionId: string;
  expenses: Omit<AccountabilityExpense, 'id' | 'status'>[];
  unspentReturned: number;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate receipts summary
 */
export function calculateReceiptsSummary(
  expenses: AccountabilityExpense[]
): ReceiptsSummary {
  const verified = expenses.filter(e => e.status === 'verified');
  const pending = expenses.filter(e => e.status === 'pending');
  const rejected = expenses.filter(e => e.status === 'rejected');
  
  return {
    totalReceipts: expenses.length,
    verifiedReceipts: verified.length,
    pendingReceipts: pending.length,
    rejectedReceipts: rejected.length,
    totalVerifiedAmount: verified.reduce((sum, e) => sum + e.amount, 0),
  };
}

/**
 * Calculate total expenses
 */
export function calculateTotalExpenses(expenses: AccountabilityExpense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Calculate balance due (if expenses exceed requisition)
 */
export function calculateBalanceDue(
  totalExpenses: number,
  requisitionAmount: number,
  unspentReturned: number
): number {
  const accountedFor = totalExpenses + unspentReturned;
  if (accountedFor > requisitionAmount) {
    return totalExpenses - (requisitionAmount - unspentReturned);
  }
  return 0;
}

/**
 * Validate accountability completeness
 */
export function validateAccountability(
  totalExpenses: number,
  unspentReturned: number,
  requisitionAmount: number
): { valid: boolean; message?: string; variance: number } {
  const accountedFor = totalExpenses + unspentReturned;
  const variance = accountedFor - requisitionAmount;
  
  if (Math.abs(variance) < 0.01) {
    return { valid: true, variance: 0 };
  }
  
  if (variance < 0) {
    return {
      valid: false,
      message: `Unaccounted amount: ${Math.abs(variance)}`,
      variance,
    };
  }
  
  return {
    valid: true,
    message: `Additional amount due: ${variance}`,
    variance,
  };
}

/**
 * Get expense status color
 */
export function getExpenseStatusColor(status: ExpenseStatus): string {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-600 bg-yellow-100',
    green: 'text-green-600 bg-green-100',
    red: 'text-red-600 bg-red-100',
  };
  return colorMap[EXPENSE_STATUS_CONFIG[status].color] || colorMap.yellow;
}

/**
 * Format accountability number
 */
export function formatAccountabilityNumber(
  requisitionNumber: string,
  sequence: number
): string {
  return `ACC-${requisitionNumber.replace('REQ-', '')}-${sequence.toString().padStart(2, '0')}`;
}

/**
 * Create empty expense
 */
export function createEmptyExpense(lineNumber: number = 1): Omit<AccountabilityExpense, 'id' | 'status'> {
  return {
    lineNumber,
    date: new Date(),
    description: '',
    category: 'construction_materials',
    amount: 0,
    documents: [],
    isZeroDiscrepancy: false,
  };
}

/**
 * Check if all expenses are verified
 */
export function areAllExpensesVerified(expenses: AccountabilityExpense[]): boolean {
  return expenses.every(e => e.status === 'verified');
}

/**
 * Get pending expenses count
 */
export function getPendingExpensesCount(expenses: AccountabilityExpense[]): number {
  return expenses.filter(e => e.status === 'pending').length;
}

// ─────────────────────────────────────────────────────────────────
// ADD-FIN-001: VARIANCE & PROOF OF SPEND HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate accountability variance (ADD-FIN-001)
 */
export function calculateAccountabilityVariance(
  totalExpenses: number,
  unspentReturned: number,
  requisitionAmount: number
): AccountabilityVariance {
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
 * Validate proof of spend completeness for an expense
 */
export function validateProofOfSpend(
  category: ExpenseCategory,
  providedDocuments: ProofOfSpendDocument[]
): { isComplete: boolean; missingDocuments: DocumentType[]; completionNotes?: string } {
  const requirements = PROOF_OF_SPEND_REQUIREMENTS[category];
  const providedTypes = new Set(providedDocuments.map(d => d.type));

  const missingDocuments = requirements.requiredDocuments.filter(
    required => !providedTypes.has(required)
  );

  const isComplete = missingDocuments.length === 0;

  // Check document quality
  const lowQualityDocs = providedDocuments.filter(
    d => d.dpi && d.dpi < requirements.minimumDocumentQuality
  );

  let completionNotes: string | undefined;
  if (lowQualityDocs.length > 0) {
    completionNotes = `Warning: ${lowQualityDocs.length} document(s) below ${requirements.minimumDocumentQuality} DPI quality standard`;
  }

  return {
    isComplete,
    missingDocuments,
    completionNotes,
  };
}

/**
 * Check if all expenses have complete proof of spend
 */
export function areAllProofOfSpendComplete(expenses: AccountabilityExpense[]): boolean {
  return expenses.every(expense => {
    if (!expense.proofOfSpend) return false;
    return expense.proofOfSpend.isComplete;
  });
}

/**
 * Get variance status color for UI
 */
export function getVarianceStatusColor(status: VarianceStatus): string {
  const colorMap: Record<string, string> = {
    green: 'text-green-600 bg-green-100',
    blue: 'text-blue-600 bg-blue-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100',
  };
  return colorMap[VARIANCE_STATUS_CONFIG[status].color] || colorMap.green;
}

/**
 * Create proof of spend evidence for an expense
 */
export function createProofOfSpendEvidence(
  expenseId: string,
  category: ExpenseCategory,
  providedDocuments: ProofOfSpendDocument[]
): ProofOfSpendEvidence {
  const requirements = PROOF_OF_SPEND_REQUIREMENTS[category];
  const validation = validateProofOfSpend(category, providedDocuments);

  return {
    expenseId,
    category,
    requiredDocuments: requirements.requiredDocuments,
    providedDocuments,
    isComplete: validation.isComplete,
    completionNotes: validation.completionNotes,
  };
}

/**
 * Calculate investigation deadline (48 hours from now)
 */
export function calculateInvestigationDeadline(): Date {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

/**
 * Calculate reconciliation deadline (14 days from requisition disbursement)
 */
export function calculateReconciliationDeadline(disbursementDate: Date): Date {
  const deadline = new Date(disbursementDate);
  deadline.setDate(deadline.getDate() + 14);
  return deadline;
}

/**
 * Check if reconciliation is overdue
 */
export function isReconciliationOverdue(deadline: Date): boolean {
  return new Date() > deadline;
}
