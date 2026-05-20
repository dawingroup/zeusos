/**
 * REQUISITION TYPES
 * 
 * Advance request for direct implementation projects.
 */

import { Payment } from './payment';
import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// QUOTATION MANAGEMENT (Optional - PM Responsibility)
// ─────────────────────────────────────────────────────────────────

export interface RequisitionQuotation {
  id: string;
  supplierName: string;
  contactInfo: string;
  quotedAmount: number;
  currency: string;
  validUntil?: Date;
  documentUrl?: string;
  documentName?: string;
  receivedAt: Timestamp;
  notes?: string;
}

export interface SelectedSupplier {
  name: string;
  contactInfo: string;
  quotedAmount: number;
  quotationReference?: string;
  selectionReason?: string; // Why this supplier was chosen
  alternativesConsidered: number; // How many other quotes were obtained
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION TYPE (Hierarchical: Funds → Materials / Labour)
// ─────────────────────────────────────────────────────────────────

export type RequisitionType = 'funds' | 'materials' | 'labour';

export const REQUISITION_TYPE_CONFIG: Record<RequisitionType, {
  label: string;
  description: string;
  color: string;
  supportsPO: boolean;
  isParent: boolean;
}> = {
  funds: {
    label: 'Funds Requisition',
    description: 'Cash advance for a set of BOQ activities. Parent document for material and labour requisitions.',
    color: 'orange',
    supportsPO: false,
    isParent: true,
  },
  materials: {
    label: 'Materials Requisition',
    description: 'Procurement of materials/equipment against a funds requisition. Purchase orders generated on approval.',
    color: 'blue',
    supportsPO: true,
    isParent: false,
  },
  labour: {
    label: 'Labour Requisition',
    description: 'Labour payments against BOQ activities. Reconciled for completion tracking. No PO generated.',
    color: 'green',
    supportsPO: false,
    isParent: false,
  },
};

/**
 * Determine requisition type from advance type.
 */
export function inferRequisitionType(advanceType: AdvanceType): RequisitionType {
  switch (advanceType) {
    case 'materials':
    case 'equipment':
      return 'materials';
    case 'labor':
      return 'labour';
    case 'transport':
    case 'miscellaneous':
      return 'funds';
    default:
      return 'funds';
  }
}

/**
 * Backward compatibility: normalize old 'materials_services' to 'materials'
 */
export function normalizeRequisitionType(type: string): RequisitionType {
  if (type === 'materials_services') return 'materials';
  return type as RequisitionType;
}

/**
 * Check if requisition type triggers PO generation
 */
export function requiresPurchaseOrder(type: RequisitionType): boolean {
  return type === 'materials';
}

// ─────────────────────────────────────────────────────────────────
// ADVANCE & EXPENSE TYPES
// ─────────────────────────────────────────────────────────────────

export type AdvanceType =
  | 'materials'
  | 'labor'
  | 'equipment'
  | 'transport'
  | 'miscellaneous';

export const ADVANCE_TYPE_LABELS: Record<AdvanceType, string> = {
  materials: 'Construction Materials',
  labor: 'Labor Payments',
  equipment: 'Equipment Rental',
  transport: 'Transport & Logistics',
  miscellaneous: 'Miscellaneous',
};

export type ExpenseCategory =
  | 'construction_materials'
  | 'labor_wages'
  | 'equipment_rental'
  | 'transport_logistics'
  | 'utilities'
  | 'permits_fees'
  | 'professional_services'
  | 'contingency';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  construction_materials: 'Construction Materials',
  labor_wages: 'Labor & Wages',
  equipment_rental: 'Equipment Rental',
  transport_logistics: 'Transport & Logistics',
  utilities: 'Utilities',
  permits_fees: 'Permits & Fees',
  professional_services: 'Professional Services',
  contingency: 'Contingency',
};

// ─────────────────────────────────────────────────────────────────
// ACCOUNTABILITY STATUS
// ─────────────────────────────────────────────────────────────────

export type AccountabilityStatus =
  | 'not_required'
  | 'pending'
  | 'partial'
  | 'complete'
  | 'overdue';

export const ACCOUNTABILITY_STATUS_CONFIG: Record<AccountabilityStatus, {
  label: string;
  color: string;
}> = {
  not_required: { label: 'Not Required', color: 'gray' },
  pending: { label: 'Pending', color: 'yellow' },
  partial: { label: 'Partial', color: 'blue' },
  complete: { label: 'Complete', color: 'green' },
  overdue: { label: 'Overdue', color: 'red' },
};

// ─────────────────────────────────────────────────────────────────
// REQUISITION ITEM (Manual entry)
// ─────────────────────────────────────────────────────────────────

export interface RequisitionItem {
  id: string;
  description: string;
  category: ExpenseCategory;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  amount?: number;
  notes?: string;

  // BOQ reference (if from Control BOQ)
  boqItemId?: string;
  boqItemCode?: string;
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION BOQ ITEM (Selected from Control BOQ)
// ─────────────────────────────────────────────────────────────────

export interface RequisitionBOQItem {
  id: string;

  // Reference to source BOQ item
  boqItemId: string;
  boqItemCode: string;

  // Item details (copied from BOQ)
  description: string;
  specification?: string;
  billName?: string;
  sectionName?: string;
  category?: ExpenseCategory;
  sourceType?: string;

  // Requisition quantity
  unit: string;
  quantity?: number;
  quantityRequested: number;
  quantityAvailable: number;
  
  // Rates & Amounts
  rate: number;
  amount: number;
  
  // Notes
  notes?: string;
  
  // Execution tracking
  quantityExecuted: number;
  executionNotes?: string;
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION ENTITY
// ─────────────────────────────────────────────────────────────────

export interface Requisition extends Payment {
  paymentType: 'requisition';

  // Requisition type: funds (cash advance) vs materials/services (procurement)
  requisitionType: RequisitionType;

  // Requisition-specific fields
  requisitionNumber: string;
  purpose: string;

  // Budget reference
  budgetLineId: string;
  budgetLineName: string;
  budgetLineBalance: number;

  // Line items (manual entry or BOQ-based)
  items: RequisitionItem[];

  // BOQ-based items (selected from Control BOQ)
  boqItems?: RequisitionBOQItem[];
  sourceType: 'manual' | 'boq' | 'mixed';

  // Accountability tracking
  accountabilityStatus: AccountabilityStatus;
  accountabilityDueDate: Date;
  linkedAccountabilityIds: string[];
  unaccountedAmount: number;

  // Advance details
  advanceType: AdvanceType;
  expectedReturnDate?: Date;

  // ADD-FIN-001: Quotation management (optional, PM responsibility)
  quotations?: RequisitionQuotation[];
  selectedSupplier?: SelectedSupplier;

  // ADD-FIN-001: Dual-approval tracking
  technicalApprover?: string;
  technicalApprovalDate?: Timestamp;
  financialApprover?: string;
  financialApprovalDate?: Timestamp;

  // ADD-FIN-001: Custom approval override
  useCustomApprovalChain: boolean;
  customApprovalChainId?: string;

  // ADD-FIN-001: Notion integration
  notionPageId?: string;
  notionSyncStatus?: 'pending' | 'synced' | 'error';
  notionSyncError?: string;
  lastNotionSyncAt?: Timestamp;

  // ─── HIERARCHICAL REQUISITION FIELDS ──────────────────────────
  // Parent-child relationship
  parentRequisitionId?: string;
  parentRequisitionNumber?: string;
  childRequisitionIds?: string[];

  // Budget tracking (on parent funds requisition)
  childRequisitionsSummary?: {
    totalChildAmount: number;
    materialRequisitionsCount: number;
    labourRequisitionsCount: number;
    materialRequisitionsAmount: number;
    labourRequisitionsAmount: number;
    remainingFundsBalance: number;
    budgetExceeded: boolean;
  };

  // Amount requested (for dashboard/monitoring views)
  amountRequested?: number;

  // Quick Capture: retroactive requisition flag (for audit trail)
  isRetroactive?: boolean;

  // Variance tracking (for country director dashboard)
  variance?: { amount?: number; percentage?: number; varianceStatus?: string; varianceAmount?: number; variancePercentage?: number };
  requiresInvestigation?: boolean;
  reconciliationStatus?: string;

  // Labour reconciliation (on labour requisitions)
  labourReconciliation?: {
    isAdvance: boolean;
    reconciled: boolean;
    reconciledAt?: Timestamp;
    reconciledBy?: string;
    reconciledBoqItems?: RequisitionBOQItem[];
  };
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION FORM DATA
// ─────────────────────────────────────────────────────────────────

export interface RequisitionFormData {
  projectId: string;
  purpose: string;
  budgetLineId: string;
  currency?: string;
  requisitionType: RequisitionType;
  advanceType: AdvanceType;
  expectedReturnDate?: Date;
  accountabilityDueDate: Date;

  // Source type determines which items array to use
  sourceType: 'manual' | 'boq' | 'mixed';

  // Manual entry items
  items: Omit<RequisitionItem, 'id'>[];

  // BOQ-based items (selected from Control BOQ)
  boqItems?: Omit<RequisitionBOQItem, 'id' | 'quantityExecuted'>[];

  // ADD-FIN-001: Optional quotation tracking
  quotations?: Omit<RequisitionQuotation, 'id' | 'receivedAt'>[];
  selectedSupplier?: SelectedSupplier;

  // ADD-FIN-001: Custom approval override
  useCustomApprovalChain?: boolean;
  customApprovalChainId?: string;

  // Hierarchical requisition fields
  parentRequisitionId?: string;
  parentRequisitionNumber?: string;

  // Labour advance mode
  isLabourAdvance?: boolean;
}

export interface BOQItemSelection {
  boqItemId: string;
  boqItemCode: string;
  description: string;
  specification?: string;
  billName?: string;
  sectionName?: string;
  unit: string;
  quantityAvailable: number;
  quantityRequested: number;
  rate: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate total from requisition items
 */
export function calculateRequisitionTotal(items: RequisitionItem[]): number {
  return items.reduce((sum, item) => sum + item.totalCost, 0);
}

/**
 * Validate requisition against budget
 */
export function validateAgainstBudget(
  requestedAmount: number,
  budgetBalance: number
): { valid: boolean; message?: string } {
  if (requestedAmount > budgetBalance) {
    return {
      valid: false,
      message: `Requested amount exceeds budget balance by ${requestedAmount - budgetBalance}`,
    };
  }
  return { valid: true };
}

/**
 * Calculate accountability percentage
 */
export function calculateAccountabilityPercentage(requisition: Requisition): number {
  const accountedAmount = requisition.grossAmount - requisition.unaccountedAmount;
  return requisition.grossAmount > 0
    ? (accountedAmount / requisition.grossAmount) * 100
    : 0;
}

/**
 * Check if accountability is overdue
 */
export function isAccountabilityOverdue(requisition: Requisition): boolean {
  if (requisition.accountabilityStatus === 'complete') return false;
  const dueDate = new Date(requisition.accountabilityDueDate);
  return dueDate < new Date();
}

/**
 * Get accountability status color
 */
export function getAccountabilityStatusColor(status: AccountabilityStatus): string {
  const colorMap: Record<string, string> = {
    gray: 'text-gray-600 bg-gray-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    red: 'text-red-600 bg-red-100',
  };
  return colorMap[ACCOUNTABILITY_STATUS_CONFIG[status].color] || colorMap.gray;
}

/**
 * Format requisition number
 */
export function formatRequisitionNumber(
  projectCode: string,
  sequence: number
): string {
  return `REQ-${projectCode}-${sequence.toString().padStart(3, '0')}`;
}

/**
 * Create empty requisition item
 */
export function createEmptyRequisitionItem(): Omit<RequisitionItem, 'id'> {
  return {
    description: '',
    category: 'construction_materials',
    quantity: 1,
    unit: 'units',
    unitCost: 0,
    totalCost: 0,
  };
}
