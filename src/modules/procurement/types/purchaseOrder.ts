/**
 * Purchase Order Types
 * Full PO lifecycle with landed cost tracking and goods receipt
 * Extended with Outsourced Purchase Order (OPO) capability
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Purchase Order Type Discriminator
// ============================================

/**
 * Distinguishes standard material purchase orders from outsourced manufacturing orders.
 * Existing POs without this field are implicitly 'standard'.
 */
export type PurchaseOrderType = 'standard' | 'outsourced';

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

  assetId?: string;
  assetCategory?: string;
  category?: string;
  baseUnit?: string;
  packagingUnit?: string;
  packagingQty?: number;
  packagingMultiplier?: number;
  derivedUnitCost?: number;
  exchangeRateToUGX?: number;
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
 * The six landed cost component keys
 */
export type LandedCostComponentKey =
  | 'shipping'
  | 'customs'
  | 'duties'
  | 'insurance'
  | 'handling'
  | 'other';

/**
 * Supplier assignment for an individual landed cost component.
 * When absent, the cost defaults to the PO's main supplier.
 */
export interface LandedCostSupplierAssignment {
  supplierId: string;
  supplierName: string;
}

/**
 * Map of landed cost component keys to their supplier assignments.
 * Only populated for components that differ from the PO's main supplier.
 */
export type LandedCostSupplierMap = Partial<
  Record<LandedCostComponentKey, LandedCostSupplierAssignment>
>;

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
  /** Per-component supplier overrides. If absent or empty, all components bill to the PO supplier. */
  supplierOverrides?: LandedCostSupplierMap;
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
  baseUnitQuantityReceived?: number;
  inventoryItemId?: string;
  warehouseId: string;
  serialNumber?: string;
  sourceCurrency?: string;
  functionalCurrencyUnitCost?: number;
  exchangeRateUsed?: number;
  packagingMultiplier?: number;
}

/**
 * Goods receipt record (partial or full delivery)
 */
export interface GoodsReceipt {
  id: string;
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
// Outsourced Purchase Order (OPO) Types
// ============================================

/**
 * Aggregate ingredient availability status for an OPO or OPO line item.
 */
export type OPOIngredientAvailability =
  | 'in_stock'        // All ingredients available at tracking warehouse
  | 'partial'         // Some ingredients available, others short
  | 'not_available'   // Insufficient stock for one or more ingredients
  | 'no_recipe'       // Product has no BOM defined
  | 'not_applicable'; // Regular PO or non-Make item

/**
 * Snapshotted BOM ingredient row for an outsourced purchase order.
 * Captured from the product's BOM at OPO creation time.
 */
export interface OPORecipeRow {
  id: string;
  /** Which OPO line item this ingredient serves */
  parentLineItemId: string;
  /** FK to inventory items / materials collection */
  ingredientId: string;
  ingredientName: string;
  ingredientSku: string;
  category?: string;
  /** Amount needed per 1 unit of the parent product */
  quantityPerUnit: number;
  /** quantityPerUnit × parent line item quantity */
  totalQuantity: number;
  unit: string;
  /** Moving Average Cost at tracking warehouse when snapshot was taken */
  unitCostAtSnapshot: number;
  /** Current MAC (may be updated before receiving) */
  currentUnitCost: number;
  /** currentUnitCost × totalQuantity */
  totalCost: number;
  /** Source warehouse for this ingredient */
  warehouseId?: string;
  /** Per-ingredient availability at tracking warehouse */
  availability: OPOIngredientAvailability;
  /** Current available quantity at tracking warehouse */
  availableQuantity?: number;
  /** Original BOM entry ID this was copied from */
  sourceBomEntryId?: string;
  /** True if added manually after snapshot (not from BOM) */
  isManuallyAdded: boolean;
  /** True if quantity differs from original BOM */
  isModified: boolean;
}

/**
 * OPO-specific line item fields, extending POLineItem for outsourced items.
 */
export interface OPOLineItemExtension {
  /** True if this line represents an outsourced product */
  isOutsourcedItem: boolean;
  /** Whether the item has a recipe/BOM defined */
  hasRecipe: boolean;
  /** Per-item ingredient availability (worst-case across its recipe rows) */
  ingredientAvailability?: OPOIngredientAvailability;
  /** Landed cost per unit: unitCost + proportional additional costs */
  landedCostPerUnit?: number;
  /** Sum of ingredient costs per unit from recipe rows */
  ingredientCostPerUnit?: number;
  /** landedCostPerUnit + ingredientCostPerUnit */
  productCostPerUnit?: number;
  /** productCostPerUnit × quantity */
  totalProductCost?: number;
}

// ============================================
// OPO Material Dispatch
// ============================================

/**
 * Record of materials dispatched from tracking warehouse to contractor location.
 * Created when the "Dispatch Materials" action is used on an OPO.
 */
export interface OPOMaterialDispatch {
  id: string;
  dispatchedAt: Timestamp;
  dispatchedBy: string;
  toWarehouseId: string;
  toWarehouseName: string;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
  notes?: string;
}

// ============================================
// Purchase Order
// ============================================

/**
 * Purchase Order - main entity
 * Extended with OPO fields via optional properties.
 * When purchaseOrderType is 'outsourced', the OPO-specific fields are populated.
 */
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  /** ISO currency code for PO totals (e.g. "USD", "UGX"). Defaults to USD if absent. */
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

  /**
   * Multi-supplier bill tracking. Maps supplierId to QBO bill info.
   * Only populated when landed cost supplier overrides are used.
   * When absent, the legacy single-bill fields above are used.
   */
  qboBills?: Record<string, {
    qboBillId: string;
    qboBillDocNumber?: string;
    syncStatus: 'pending' | 'synced' | 'error';
    syncedAt?: Timestamp;
    syncError?: string;
    /** Which cost components this bill covers */
    components: ('lineItems' | LandedCostComponentKey)[];
  }>;

  // Multi-currency
  exchangeRateOverride?: number;

  // Order date (user-editable, defaults to creation date)
  orderDate?: Timestamp;

  // Expected delivery date
  expectedDeliveryDate?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;

  // ============================================
  // OPO-Specific Fields (only when purchaseOrderType === 'outsourced')
  // ============================================

  /** Discriminator: 'standard' for regular POs, 'outsourced' for OPOs. Undefined = 'standard'. */
  purchaseOrderType?: PurchaseOrderType;

  /** Warehouse where ingredients are tracked and consumed from */
  trackIngredientsWarehouseId?: string;
  trackIngredientsWarehouseName?: string;

  /** Warehouse where finished goods are received */
  shipToWarehouseId?: string;
  shipToWarehouseName?: string;

  /** Snapshotted BOM ingredients for all line items */
  recipeSnapshot?: OPORecipeRow[];
  /** When the recipe was captured from BOM */
  recipeSnapshotAt?: Timestamp;
  /** True if recipe rows were edited after snapshot */
  recipeModified?: boolean;

  /** Aggregate ingredient availability across all recipe rows */
  ingredientAvailability?: OPOIngredientAvailability;

  /** OPO costing summary */
  totalServiceFee?: number;       // Sum of line item prices (contractor fees)
  totalIngredientCost?: number;   // Sum of ingredient costs across all items
  totalProductCost?: number;      // Service fee + landed costs + ingredient costs

  /** OPO line item extensions (keyed by lineItem.id) */
  opoLineItemExtensions?: Record<string, OPOLineItemExtension>;

  /** Linked stock transfers for material movement to contractor */
  linkedStockTransferIds?: string[];

  /** Linked manufacturing orders this OPO coordinates with */
  linkedManufacturingOrderIds?: string[];

  /** History of material dispatches to contractor location */
  materialDispatchHistory?: OPOMaterialDispatch[];
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
  purchaseOrderType?: PurchaseOrderType;
  supplierName?: string;
  linkedProjectId?: string;
  search?: string;
  sortBy?: 'poNumber' | 'createdAt' | 'updatedAt' | 'supplierName';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Line Item Categories
// ============================================

/**
 * Category for a PO line item — determines routing on goods receipt
 */
export type POLineItemCategory = 'inventory' | 'asset' | 'service' | 'overhead' | 'manufacturing-overhead';

/**
 * Human-readable labels for PO line item categories
 */
export const PO_LINE_ITEM_CATEGORY_LABELS: Record<POLineItemCategory, string> = {
  inventory: 'Inventory',
  asset: 'Asset',
  service: 'Service',
  overhead: 'Overhead',
  'manufacturing-overhead': 'Manufacturing Overhead',
};

/**
 * Resolve the effective category for a PO line item.
 * Falls back to 'inventory' if not explicitly set.
 */
export function resolveLineItemCategory(lineItem: POLineItem): POLineItemCategory {
  return (lineItem as any).category ?? 'inventory';
}
