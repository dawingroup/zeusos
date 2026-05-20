/**
 * ALLOCATION TYPES
 *
 * Multi-project allocation: one purchase split across 2–5 projects.
 * Each project gets its own accountability entry linked by an AllocationGroup.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// ALLOCATION GROUP (links accountability entries across projects)
// ─────────────────────────────────────────────────────────────────

export type AllocationMethod = 'Percentage' | 'FixedAmount' | 'ProRata';
export type AllocationGroupStatus = 'Draft' | 'Finalized';

export interface AllocationEntry {
  projectId: string;
  projectName: string;
  programId: string;
  budgetCategory: string;
  percentage: number;
  allocatedAmount: number;
  accountabilityId: string | null;
  requisitionId: string | null;
}

export interface AllocationGroup {
  id: string;
  organizationId: string;
  groupNumber: string;               // ALLOC-YYYY-NNNN
  date: Timestamp;
  vendorName: string;
  description: string;
  totalAmount: number;
  currency: 'UGX' | 'USD';
  allocations: AllocationEntry[];
  allocationMethod: AllocationMethod;
  rationale: string;
  sourceDocumentUrls: string[];
  memoUrl: string | null;
  status: AllocationGroupStatus;
  projectIds: string[];              // Denormalized for array-contains queries
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;

  // Matrix allocation detail (optional — present when split by line item)
  lineItems?: CaptureLineItem[];
  matrixAllocations?: MatrixAllocationEntry[];
}

// ─────────────────────────────────────────────────────────────────
// UI TYPES (used by AllocationSplitter component)
// ─────────────────────────────────────────────────────────────────

export interface AllocationSplitRow {
  projectId: string;
  projectName: string;
  programId: string;
  budgetCategory: string;
  budgetCategoryLabel: string;
  availableBudget: number;
  percentage: number;
  allocatedAmount: number;
  rationale: string;
}

export interface AllocationSuggestion {
  projectId: string;
  projectName: string;
  budgetCategory: string;
  percentage: number;
  frequency: number;
  lastUsed: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// ALLOCATION METHOD CONFIG
// ─────────────────────────────────────────────────────────────────

export const ALLOCATION_METHOD_CONFIG: Record<AllocationMethod, {
  label: string;
  description: string;
}> = {
  Percentage: {
    label: 'Percentage Split',
    description: 'Divide the total by percentage across projects',
  },
  FixedAmount: {
    label: 'Fixed Amounts',
    description: 'Specify exact amounts per project',
  },
  ProRata: {
    label: 'Pro Rata (Budget-Based)',
    description: 'Split proportionally based on remaining project budgets',
  },
};

// ─────────────────────────────────────────────────────────────────
// MATRIX ALLOCATION TYPES (line-item × project grid)
// ─────────────────────────────────────────────────────────────────

/** A single line item from the captured receipt/invoice */
export interface CaptureLineItem {
  id: string;                    // client-side UUID (crypto.randomUUID())
  description: string;
  quantity: number;
  unit: string;                  // "bags", "sheets", "pieces", "litres"
  unitPrice: number;
  totalPrice: number;            // quantity × unitPrice
  budgetCategory: string;
}

/** A single cell in the allocation matrix: qty of one line item → one project */
export interface MatrixCell {
  lineItemId: string;
  projectId: string;
  allocatedQuantity: number;
  allocatedAmount: number;       // allocatedQuantity × unitPrice
}

/** Lightweight project reference used as a column header in the matrix */
export interface MatrixProject {
  projectId: string;
  projectName: string;
  programId: string;
  budgetCategory: string;
  availableBudget: number;
}

/** Per-line-item-per-project detail stored in Firestore */
export interface MatrixAllocationEntry {
  lineItemId: string;
  lineItemDescription: string;
  projectId: string;
  projectName: string;
  programId: string;
  budgetCategory: string;
  allocatedQuantity: number;
  unitPrice: number;
  allocatedAmount: number;       // allocatedQuantity × unitPrice
}

export const COMMON_UNITS = ['pcs', 'bags', 'sheets', 'rolls', 'kg', 'litres', 'm', 'trips', 'days', 'lots'] as const;
