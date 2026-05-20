/**
 * Purchase Order Types
 * Full PO lifecycle with landed cost tracking and goods receipt
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Purchase Order Status
// ============================================

/**
 * Purchase order lifecycle statuses
 */
export type PurchaseOrderStatus =
  | 'draft'
  | 'pending-approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'partially-received'
  | 'received'
  | 'closed'
  | 'cancelled';

/**
 * Ordered list of PO statuses for pipeline display
 */
export const PO_STATUS_FLOW: PurchaseOrderStatus[] = [
  'draft',
  'pending-approval',
  'approved',
  'sent',
  'partially-received',
  'received',
  'closed',
];

/**
 * Human-readable labels for PO statuses
 */
export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  'pending-approval': 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  sent: 'Sent to Supplier',
  'partially-received': 'Partially Received',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

// ============================================
// Line Item Categories
// ============================================

/**
 * Procurement category for a PO line item.
 * Determines goods receipt routing and UI field visibility.
 *   - inventory: standard stock items → receive into warehouse
 *   - asset: capital equipment → create asset in registry
 *   - service: outsourced work → record as expense
 *   - overhead: operational costs → record as expense
 */
export type POLineItemCategory = 'inventory' | 'asset' | 'service' | 'overhead';

export const PO_LINE_CATEGORY_LABELS: Record<POLineItemCategory, string> = {
  inventory: 'Inventory',
  asset: 'Asset',
  service: 'Service',
  overhead: 'Overhead',
};

// ============================================
// Line Items
// ============================================

/**
 * Single line item in a purchase order
 */
export interface POLineItem {
  id: string;
  inventoryItemId?: string;
  materialId?: string;
  sku?: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  currency: string;
  unit: string;
  quantityReceived: number;

  /** Weight in kg, used for proportional landed cost distribution */
  weight?: number;

  /** Calculated share of PO-level landed costs allocated to this line */
  landedCostAllocation?: number;

  /** Unit cost including allocated landed costs: unitCost + (landedCostAllocation / quantity) */
  effectiveUnitCost?: number;

  /** Manufacturer Part Number — resolved from vendorSources on the inventory item */
  mpn?: string;

  /** Procurement category — determines receipt routing. Defaults to 'inventory'. */
  category?: POLineItemCategory;

  /** Asset registry ID — populated after receipt for 'asset' category lines */
  assetId?: string;

  /** Asset classification (e.g. 'POWER_TOOL', 'CNC') — for 'asset' category lines */
  assetCategory?: string;

  /** GL expense account code — for 'service' and 'overhead' category lines */
  expenseAccountCode?: string;
}

// ============================================
// Landed Costs
// ============================================

/**
 * Method for distributing landed costs across PO line items
 */
export type LandedCostDistributionMethod =
  | 'proportional_value'
  | 'proportional_weight'
  | 'equal';

/**
 * PO-level landed cost components
 */
export interface LandedCosts {
  shipping: number;
  customs: number;
  duties: number;
  insurance: number;
  handling: number;
  other: number;
  totalLandedCost: number;
  currency: string;
  distributionMethod: LandedCostDistributionMethod;
}

/**
 * Default (empty) landed costs
 */
export const DEFAULT_LANDED_COSTS: LandedCosts = {
  shipping: 0,
  customs: 0,
  duties: 0,
  insurance: 0,
  handling: 0,
  other: 0,
  totalLandedCost: 0,
  currency: 'USD',
  distributionMethod: 'proportional_value',
};

// ============================================
// Approvals
// ============================================

/**
 * Single approval record on a PO
 */
export interface POApproval {
  id: string;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt?: Timestamp;
  notes?: string;
  level: number;
}

// ============================================
// Goods Receipt
// ============================================

/**
 * Line-level receipt information
 */
export interface GoodsReceiptLine {
  lineItemId: string;
  quantityReceived: number;
  inventoryItemId?: string;
  warehouseId: string;
  /** Category of the line being received, mirrored from POLineItem */
  category?: POLineItemCategory;
}

/**
 * Goods receipt record (partial or full delivery)
 */
export interface GoodsReceipt {
  id: string;
  receivedDate?: Timestamp;
  receivedAt: Timestamp;
  receivedBy: string;
  lines: GoodsReceiptLine[];
  notes?: string;
  deliveryReference?: string;
}

// ============================================
// Goods Receipt Edit (Admin Correction)
// ============================================

/**
 * Audit record for an admin edit to a goods receipt
 */
export interface GoodsReceiptEditRecord {
  id: string;
  receiptId: string;
  editedAt: Timestamp;
  editedBy: string;
  reason: string;
  changes: {
    lineItemId: string;
    previousQuantity: number;
    newQuantity: number;
    delta: number;
  }[];
  previousReceivedDate?: Timestamp;
  newReceivedDate?: Timestamp;
}

// ============================================
// Purchase Order Totals
// ============================================

/**
 * Calculated totals for a purchase order
 */
export interface POTotals {
  subtotal: number;
  landedCostTotal: number;
  grandTotal: number;
  currency: string;
}

// ============================================
// Revision History (Edit Audit Trail)
// ============================================

/**
 * Field-level change record for audit logging
 */
export interface POFieldChange {
  field: string;
  lineItemId?: string;
  previousValue: unknown;
  newValue: unknown;
}

/**
 * Snapshot of a PO before an edit, stored for audit trail
 */
export interface PORevision {
  id: string;
  revisionNumber: number;
  editedAt: Timestamp;
  editedBy: string;
  changes: POFieldChange[];
  /** Snapshot of line items at the time of edit */
  previousLineItems: POLineItem[];
}

// ============================================
// Purchase Order
// ============================================

/**
 * Purchase Order - main entity
 */
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  orderDate?: Timestamp;
  /** Expected delivery date (planning aid; not the actual receipt date) */
  expectedDeliveryDate?: Timestamp;
  /** ISO currency code for PO totals (e.g. "USD", "UGX") */
  currency?: string;

  // Supplier
  supplierId?: string;
  supplierName: string;
  supplierContact?: string;

  // Line items
  lineItems: POLineItem[];

  // Landed costs (PO-level, distributed across line items)
  landedCosts: LandedCosts;

  // Calculated totals
  totals: POTotals;

  // Approval workflow
  approvals: POApproval[];

  // Goods receipt history
  receivingHistory: GoodsReceipt[];

  // Revision history (edit audit trail)
  revisionHistory?: PORevision[];

  // Goods receipt edit audit trail
  receiptEditHistory?: GoodsReceiptEditRecord[];

  // Links
  linkedMOIds?: string[];
  linkedProjectId?: string;

  // Notes
  notes?: string;

  // Scoping
  subsidiaryId: string;

  // QuickBooks Integration
  qboBillId?: string;               // QuickBooks Bill ID (after sync)
  qboBillDocNumber?: string;        // QuickBooks Bill document number
  qboSyncStatus?: 'pending' | 'synced' | 'error' | 'correction-pending';
  qboSyncedAt?: Timestamp;
  qboSyncError?: string;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================
// Approval Thresholds
// ============================================

/**
 * Multi-tier approval rules based on PO grand total.
 * Each tier defines a value ceiling and the required approver role.
 */
export interface ApprovalTier {
  maxValue: number;       // PO grand total up to this amount
  requiredRole: string;   // e.g. 'manager', 'director', 'cfo'
  label: string;          // Human-readable label
}

/**
 * Default approval tiers (amounts in UGX)
 */
export const DEFAULT_APPROVAL_TIERS: ApprovalTier[] = [
  { maxValue: 5_000_000, requiredRole: 'manager', label: 'Manager Approval' },
  { maxValue: 25_000_000, requiredRole: 'director', label: 'Director Approval' },
  { maxValue: Infinity, requiredRole: 'cfo', label: 'CFO / Executive Approval' },
];

/**
 * Determine required approval tier for a PO based on its grand total
 */
export function getRequiredApprovalTier(grandTotal: number): ApprovalTier {
  return DEFAULT_APPROVAL_TIERS.find((t) => grandTotal <= t.maxValue) ?? DEFAULT_APPROVAL_TIERS[DEFAULT_APPROVAL_TIERS.length - 1];
}

// ============================================
// Filters
// ============================================

/**
 * Filters for querying purchase orders
 */
export interface POFilters {
  status?: PurchaseOrderStatus | PurchaseOrderStatus[];
  supplierName?: string;
  linkedProjectId?: string;
  search?: string;
  /** Filter POs that contain at least one line item with this category */
  category?: POLineItemCategory | POLineItemCategory[];
  sortBy?: 'poNumber' | 'createdAt' | 'updatedAt' | 'supplierName';
  sortOrder?: 'asc' | 'desc';
}
