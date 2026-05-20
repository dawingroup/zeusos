/**
 * Stock Adjustment Types
 * Structured, auditable stock quantity changes with QBO journal entry support.
 */

import { Timestamp } from 'firebase/firestore';

// ── Adjustment Type ──────────────────────────────────────────────────────────

export type AdjustmentType =
  | 'physical_count_variance'   // Reconciliation after cycle count / stocktake
  | 'damage_spoilage'           // Goods written off — quality failure
  | 'shrinkage_loss'            // Unexplained loss (theft, evaporation, etc.)
  | 'production_consumption'    // Raw materials issued to Manufacturing Order
  | 'production_output'         // Finished goods received from production
  | 'internal_transfer'         // Movement between locations (net zero at org level)
  | 'opening_balance'           // Initial load or migration
  | 'reclassification'          // Item miscoded, correcting without value change
  | 'goods_received'            // Purchase order receipt (stock in)
  | 'customer_return'           // Stock returned by customer
  | 'supplier_return'           // Stock returned to supplier
  | 'offcut_adjustment';        // Scrap, write-off, or reclassify offcut library pieces

/** Grouped adjustment types for form UI */
export const ADJUSTMENT_TYPE_GROUPS = {
  'Count & Reconciliation': ['physical_count_variance', 'opening_balance'] as AdjustmentType[],
  'Loss & Write-off': ['damage_spoilage', 'shrinkage_loss'] as AdjustmentType[],
  'Production': ['production_consumption', 'production_output'] as AdjustmentType[],
  'Procurement & Returns': ['goods_received', 'customer_return', 'supplier_return'] as AdjustmentType[],
  'Movement': ['internal_transfer', 'reclassification'] as AdjustmentType[],
  'Offcuts': ['offcut_adjustment'] as AdjustmentType[],
} as const;

/** Human-readable labels for adjustment types */
export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  physical_count_variance: 'Physical Count Variance',
  damage_spoilage: 'Damage / Spoilage',
  shrinkage_loss: 'Shrinkage / Loss',
  production_consumption: 'Production Consumption',
  production_output: 'Production Output',
  internal_transfer: 'Internal Transfer',
  opening_balance: 'Opening Balance',
  reclassification: 'Reclassification',
  goods_received: 'Goods Received',
  customer_return: 'Customer Return',
  supplier_return: 'Supplier Return',
  offcut_adjustment: 'Offcut Adjustment',
};

// ── Adjustment Status ────────────────────────────────────────────────────────

export type AdjustmentStatus =
  | 'draft'       // Created, editable
  | 'submitted'   // Locked, awaiting approval
  | 'approved'    // Stock updated, QBO journal posted
  | 'rejected'    // Returned with comments
  | 'cancelled';  // Voided after submission

export const ADJUSTMENT_STATUS_LABELS: Record<AdjustmentStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

// ── Direction ────────────────────────────────────────────────────────────────

export type AdjustmentDirection = 'increase' | 'decrease';

// ── Reference Types ──────────────────────────────────────────────────────────

export type AdjustmentReferenceType =
  | 'cycle_count'
  | 'manufacturing_order'
  | 'purchase_order'
  | 'sales_order'
  | 'damage_report'
  | 'other';

// ── Line Item ────────────────────────────────────────────────────────────────

export interface StockAdjustmentLineItem {
  lineId: string;                        // Auto-generated UUID
  itemId: string;                        // Reference to inventory_items doc (or '' for offcut-only)
  itemName: string;                      // Denormalized for display
  itemSku: string;                       // Denormalized for display
  direction: AdjustmentDirection;
  quantity: number;                      // Always positive; direction determines sign
  unitOfMeasure: string;
  unitCostAtAdjustment: number;          // Frozen cost at time of adjustment (UGX)
  totalValue: number;                    // quantity * unitCostAtAdjustment
  lotNumber?: string;                    // For lot-tracked items
  locationFrom?: string;                 // For internal_transfer
  locationTo?: string;                   // For internal_transfer
  notes?: string;                        // Line-level notes

  // Count-based adjustment fields
  currentStock?: number;                 // System quantity at time of adjustment
  countedQuantity?: number;              // Physical count entered by user

  // Offcut fields
  offcutId?: string;                     // Reference to offcuts doc (for offcut_adjustment)
  offcutDimensions?: string;             // Denormalized dimensions display (e.g. "450×300mm")
}

// ── Main Entity ──────────────────────────────────────────────────────────────

export interface StockAdjustment {
  // BaseEntity fields
  id: string;
  organizationId: string;
  subsidiaryId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy?: string;

  // Identity
  adjustmentNumber: string;              // Auto: 'ADJ-YYYY-NNNN'

  // Classification
  adjustmentType: AdjustmentType;
  status: AdjustmentStatus;

  // Line items (multi-item adjustments supported)
  lineItems: StockAdjustmentLineItem[];

  // Denormalized item IDs for array-contains queries
  itemIds: string[];

  // Totals (computed, denormalized)
  totalIncreaseValue: number;            // Sum of increase line values (UGX)
  totalDecreaseValue: number;            // Sum of decrease line values (UGX)
  netValueImpact: number;               // increase - decrease
  lineCount: number;

  // Reference document
  referenceType?: AdjustmentReferenceType;
  referenceId?: string;                  // ID of linked document
  referenceNumber?: string;              // Denormalized display number

  // Approval workflow
  submittedAt?: Timestamp;
  submittedBy?: string;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;

  // QBO integration
  qboJournalEntryId?: string;           // QBO journal entry ID after posting
  qboSyncStatus?: 'pending' | 'synced' | 'failed' | 'not_applicable';
  qboSyncError?: string;

  // Metadata
  reason: string;                        // Required: human-readable explanation
  attachments?: string[];                // Storage URLs

  // Auto-approval
  isAutoApproved: boolean;               // True if below threshold
}

// ── Inventory Item Stock Extension ───────────────────────────────────────────

/** Fields added to existing inventory_items documents (backward compatible) */
export interface InventoryItemStockFields {
  stockOnHand: number;              // Current quantity
  stockAllocated: number;           // Soft-allocated to confirmed MOs
  stockAvailable: number;           // stockOnHand - stockAllocated
  lastStocktakeDate?: Timestamp;    // Last physical count date
  lastAdjustmentId?: string;        // Most recent adjustment reference
  stockValuation: number;           // stockOnHand * current unit cost (UGX)
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface StockAdjustmentSettings {
  autoApprovalEnabled: boolean;
  autoApprovalThreshold: number;        // Max net value (UGX) for auto-approval
  autoApprovalTypes: AdjustmentType[];  // Only these types eligible
  requireAttachmentForDamage: boolean;  // Force photo upload for damage_spoilage
  numberSequencePrefix: string;         // Default 'ADJ'
  numberSequenceYear: number;           // Current year for reset
  numberSequenceCounter: number;        // Current counter
}

export const DEFAULT_STOCK_ADJUSTMENT_SETTINGS: StockAdjustmentSettings = {
  autoApprovalEnabled: true,
  autoApprovalThreshold: 500000,          // UGX 500,000
  autoApprovalTypes: ['physical_count_variance', 'damage_spoilage', 'shrinkage_loss'],
  requireAttachmentForDamage: true,
  numberSequencePrefix: 'ADJ',
  numberSequenceYear: new Date().getFullYear(),
  numberSequenceCounter: 0,
};

// ── QBO Account Mapping ──────────────────────────────────────────────────────

export interface QBOStockAccountMapping {
  inventoryAsset: string;
  rawMaterialsInventory: string;
  finishedGoodsInventory: string;
  wipAccount: string;
  inventoryAdjustmentExpense: string;
  inventoryAdjustmentIncome: string;
  inventoryWriteOffExpense: string;
  inventoryShrinkageExpense: string;
  cogsAccount: string;
  accountsPayable: string;
  openingBalanceEquity: string;
}

// ── QBO Journal Entry Mapping ────────────────────────────────────────────────

export interface JournalEntryAccountPair {
  debitAccount: keyof QBOStockAccountMapping;
  creditAccount: keyof QBOStockAccountMapping;
  hasJournal: boolean;
}

/**
 * Maps each adjustment type to its debit/credit accounts.
 * Some types (internal_transfer, reclassification) have no journal impact.
 */
export const ADJUSTMENT_JOURNAL_MAPPING: Record<AdjustmentType, (direction: AdjustmentDirection) => JournalEntryAccountPair> = {
  physical_count_variance: (dir) => dir === 'decrease'
    ? { debitAccount: 'inventoryAdjustmentExpense', creditAccount: 'inventoryAsset', hasJournal: true }
    : { debitAccount: 'inventoryAsset', creditAccount: 'inventoryAdjustmentIncome', hasJournal: true },
  damage_spoilage: () => ({ debitAccount: 'inventoryWriteOffExpense', creditAccount: 'inventoryAsset', hasJournal: true }),
  shrinkage_loss: () => ({ debitAccount: 'inventoryShrinkageExpense', creditAccount: 'inventoryAsset', hasJournal: true }),
  production_consumption: () => ({ debitAccount: 'wipAccount', creditAccount: 'rawMaterialsInventory', hasJournal: true }),
  production_output: () => ({ debitAccount: 'finishedGoodsInventory', creditAccount: 'wipAccount', hasJournal: true }),
  goods_received: () => ({ debitAccount: 'inventoryAsset', creditAccount: 'accountsPayable', hasJournal: true }),
  customer_return: () => ({ debitAccount: 'inventoryAsset', creditAccount: 'cogsAccount', hasJournal: true }),
  supplier_return: () => ({ debitAccount: 'accountsPayable', creditAccount: 'inventoryAsset', hasJournal: true }),
  opening_balance: () => ({ debitAccount: 'inventoryAsset', creditAccount: 'openingBalanceEquity', hasJournal: true }),
  internal_transfer: () => ({ debitAccount: 'inventoryAsset', creditAccount: 'inventoryAsset', hasJournal: false }),
  reclassification: () => ({ debitAccount: 'inventoryAsset', creditAccount: 'inventoryAsset', hasJournal: false }),
  offcut_adjustment: (dir) => dir === 'decrease'
    ? { debitAccount: 'inventoryWriteOffExpense', creditAccount: 'inventoryAsset', hasJournal: true }
    : { debitAccount: 'inventoryAsset', creditAccount: 'inventoryAdjustmentIncome', hasJournal: true },
};
