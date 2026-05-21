import type { Timestamp } from 'firebase-admin/firestore';
import type {
  POStatus,
  MOStatus,
  MOStage,
  InventoryStatus,
  InventoryCategory,
  InventoryTier,
  FinishCategory,
  AdvisoryProjectStatus,
  AllocationGroupStatus,
} from './constants.js';

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  total: number;
  count: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset?: number;
  items: T[];
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export interface POLineItem {
  itemId?: string;
  itemName: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  // NOTE: field is poNumber or orderNumber depending on creation path
  poNumber?: string;
  orderNumber?: string;
  status: POStatus;
  supplierId?: string;
  supplierName?: string;
  projectId?: string;
  projectName?: string;
  // NOTE: lineItems is an EMBEDDED ARRAY on the document, NOT a subcollection
  // Source: functions/src/tools/manufacturingTools.js:238
  lineItems?: POLineItem[];
  lineItemCount?: number;
  subtotal?: number;
  // NOTE: field is 'total', NOT 'grandTotal'
  // Source: functions/src/tools/manufacturingTools.js:242
  total?: number;
  currency?: string;
  expectedDeliveryDate?: Timestamp;
  receivedDate?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Manufacturing Orders ─────────────────────────────────────────────────────

export interface BOMEntry {
  id: string;
  inventoryItemId?: string;
  itemName?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
  supplierName?: string;
  status?: string;
}

export interface MaterialConsumption {
  id: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  costPerUnit?: number;
  totalCost?: number;
  consumedAt?: Timestamp;
  consumedByName?: string;
  consumedBy?: string;
}

export interface StageTransition {
  id: string;
  fromStage?: MOStage;
  toStage?: MOStage;
  transitionedAt?: Timestamp;
  transitionedByName?: string;
  transitionedBy?: string;
  notes?: string;
}

export interface ManufacturingOrder {
  id: string;
  // NOTE: moNumber fallback to orderNumber — both may exist
  // Source: functions/src/tools/manufacturingTools.js:120
  moNumber?: string;
  orderNumber?: string;
  name?: string;
  status?: MOStatus;
  // NOTE: field is 'currentStage', NOT 'productionStage'
  // Source: functions/src/tools/manufacturingTools.js:105
  currentStage?: MOStage;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string;
  projectName?: string;
  customerId?: string;
  customerName?: string;
  bomItemCount?: number;
  startDate?: Timestamp;
  targetCompletionDate?: Timestamp;
  actualCompletionDate?: Timestamp;
  totalEstimatedCost?: number;
  totalActualCost?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Loaded from subcollections on get_manufacturing_order:
  bomEntries?: BOMEntry[];
  materialConsumptions?: MaterialConsumption[];
  stageTransitions?: StageTransition[];
}

// ─── Inventory Items ──────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  name?: string;
  sku?: string;
  category?: InventoryCategory;
  classification?: 'material' | 'product' | 'kit';
  status?: InventoryStatus;
  tier?: InventoryTier;
  restockable?: boolean;
  linkedProjectIds?: string[];
  unit?: string;
  // NOTE: field is 'stockOnHand', NOT 'stockQuantity'
  // Source: functions/src/tools/inventoryTools.js:119
  stockOnHand?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  // NOTE: field is 'costPrice', NOT 'unitCost'
  // Source: functions/src/tools/inventoryTools.js:122
  costPrice?: number;
  sellPrice?: number;
  currency?: string;
  primarySupplier?: string;
  preferredSupplierName?: string;
  tags?: string[];
  brand?: string;
  description?: string;
  displayName?: string;
  subcategory?: string;
  isFamily?: boolean;
  familyId?: string;
  parentItemId?: string;
  // Canonical nested pricing — frontend reads from here. Top-level
  // costPrice/currency/unit are legacy/orphan fields kept for back-compat.
  pricing?: {
    costPerUnit?: number;
    currency?: string;
    unit?: string;
    costPerCubicMetre?: number;
    pricingBasis?: 'per-unit' | 'per-cbm';
  };
  inventory?: {
    inStock?: number;
    reorderLevel?: number;
    volumeOnHand?: number;
    piecesOnHand?: number;
  };
}

// ─── Stock Levels ─────────────────────────────────────────────────────────────
// Separate collection 'stockLevels' — not a computed field on inventoryItems
// Source: functions/src/triggers/stockAdjustment.triggers.js:266

export interface StockLevel {
  id: string;
  inventoryItemId?: string;
  warehouseId?: string;
  sku?: string;
  itemName?: string;
  quantityOnHand?: number;
  quantityAllocated?: number;
  quantityAvailable?: number;
  reorderPoint?: number;
  updatedAt?: Timestamp;
}

// ─── Stock Adjustments ────────────────────────────────────────────────────────

export interface StockAdjustmentLineItem {
  lineId?: string;
  itemId?: string;
  itemName?: string;
  itemSku?: string;
  direction?: 'increase' | 'decrease';
  quantity?: number;
  currentStock?: number;
  countedQuantity?: number;
  unitCostAtAdjustment?: number;
  totalValue?: number;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber?: string;
  status?: string;
  adjustmentType?: string;
  lineItems?: StockAdjustmentLineItem[];
  lineCount?: number;
  totalIncreaseValue?: number;
  totalDecreaseValue?: number;
  netValueImpact?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  notes?: string;
  reason?: string;
  approvedBy?: string;
  isAutoApproved?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// ─── Finish Library ───────────────────────────────────────────────────────────

export interface FinishDocument {
  id: string;
  organizationId?: string;
  subsidiaryId?: string;
  name?: string;
  code?: string;
  category?: FinishCategory;
  subtype?: string;
  hexColor?: string;
  secondaryColor?: string;
  patternType?: 'solid' | 'woodgrain' | 'marble' | 'textile' | 'geometric' | 'speckled' | 'custom';
  thumbnailUrl?: string;
  costModifier?: number;
  costModifierType?: 'percentage' | 'absolute';
  availability?: 'in_stock' | 'made_to_order' | 'discontinued' | 'seasonal';
  tags?: string[];
  isActive?: boolean;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name?: string;
  companyName?: string;
  contactPerson?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status?: string;
  categories?: string[];
  materialCategories?: string[];
  rating?: number;
  leadTimeDays?: number;
  averageLeadTime?: number;
  currency?: string;
  country?: string;
  city?: string;
  paymentTerms?: string;
}

// ─── Advisory Projects / Campaigns ────────────────────────────────────────────
// Path: organizations/default/campaigns/{projectId}  (Phase 2.D rename — was
// `advisory_projects`; the AdvisoryProject shape stays for now and is extended
// in Phase 3 with campaign-specific fields: clientId, brandId, imcTeam,
// bigIdea, tier, performanceReview).
// Source: src/subsidiaries/advisory/core/project/types/project.types.ts

export interface ProjectBudget {
  currency?: 'UGX' | 'USD';
  totalBudget?: number;
  spent?: number;
  committed?: number;
  remaining?: number;
  variance?: number;
  varianceStatus?: 'on_track' | 'over' | 'under';
  contingencyPercent?: number;
}

export interface ProjectProgress {
  physicalProgress?: number;
  financialProgress?: number;
  completionPercent?: number;
  progressStatus?: 'ahead' | 'on_track' | 'behind' | 'critical';
}

export interface AccountabilitySummary {
  totalDisbursed?: number;
  totalAccounted?: number;
  unaccountedAmount?: number;
  requisitionCount?: number;
  manualRequisitionCount?: number;
  accountabilityRate?: number;
  overdueCount?: number;
  status?: 'healthy' | 'warning' | 'critical';
}

export interface AdvisoryProject {
  id: string;
  name?: string;
  projectCode?: string;
  description?: string;
  programId?: string;
  programName?: string;
  engagementId?: string;
  customerId?: string;
  customerName?: string;
  status?: AdvisoryProjectStatus;
  projectType?: string;
  budget?: ProjectBudget;
  progress?: ProjectProgress;
  accountabilitySummary?: AccountabilitySummary;
  location?: {
    siteName?: string;
    district?: string;
    region?: string;
    country?: string;
  };
  tags?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// ─── Allocation Groups ────────────────────────────────────────────────────────
// Path: organizations/default/allocation_groups/{groupId}
// Source: src/subsidiaries/advisory/delivery/types/allocation.ts

export interface AllocationEntry {
  projectId?: string;
  projectName?: string;
  programId?: string;
  budgetCategory?: string;
  percentage?: number;
  allocatedAmount?: number;
  accountabilityId?: string | null;
  requisitionId?: string | null;
}

export interface AllocationGroup {
  id: string;
  groupNumber?: string;
  date?: Timestamp;
  vendorName?: string;
  description?: string;
  totalAmount?: number;
  currency?: 'UGX' | 'USD';
  allocations?: AllocationEntry[];
  // Denormalized array of projectIds for array-contains queries
  projectIds?: string[];
  allocationMethod?: 'Percentage' | 'FixedAmount' | 'ProRata';
  rationale?: string;
  sourceDocumentUrls?: string[];
  memoUrl?: string | null;
  // NOTE: PascalCase — 'Draft' | 'Finalized'
  status?: AllocationGroupStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}
