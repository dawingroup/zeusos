/**
 * Procurement Types
 * Types for material delivery tracking and procurement management
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// PROCUREMENT ENTRY TYPES
// ============================================================================

export type ProcurementType = 'delivery' | 'purchase_order' | 'stock_adjustment' | 'return' | 'transfer';

export type ProcurementStatus = 
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'disputed';

export type DeliveryCondition = 
  | 'good'
  | 'partial'
  | 'damaged'
  | 'rejected';

// ============================================================================
// CORE PROCUREMENT ENTRY
// ============================================================================

export interface ProcurementEntry {
  id: string;
  projectId: string;
  
  type: ProcurementType;
  status: ProcurementStatus;
  
  referenceNumber: string;
  externalReference?: string;
  
  materialId: string;
  materialName: string;
  unit: string;
  
  quantityOrdered?: number;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected?: number;
  
  unitPrice: number;
  totalAmount: number;
  currency: 'UGX';
  
  supplierId?: string;
  supplierName: string;
  supplierContact?: string;
  
  deliveryDate: Timestamp;
  deliveryCondition?: DeliveryCondition;
  receivedBy: string;
  receivedByName: string;
  
  boqItemIds: string[];
  stageId?: string;
  
  deliveryLocation?: string;
  warehouseId?: string;
  
  attachments: ProcurementAttachment[];
  notes?: string;
  
  qualityCheckDone: boolean;
  qualityCheckBy?: string;
  qualityCheckDate?: Timestamp;
  qualityNotes?: string;
  
  efrisValidated: boolean;
  efrisInvoiceNumber?: string;
  efrisTin?: string;

  // Purchase order linkage
  purchaseOrderId?: string;
  poItemId?: string;
  poItemLineNumber?: number;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface ProcurementAttachment {
  id: string;
  name: string;
  url: string;
  type: 'delivery_note' | 'invoice' | 'photo' | 'quality_report' | 'other';
  uploadedAt: Timestamp;
  uploadedBy: string;
}

export interface PurchaseOrder {
  id: string;
  projectId: string;

  // Source requisition (set when PO is generated from a requisition)
  requisitionId?: string;

  orderNumber: string;
  status: 'draft' | 'submitted' | 'approved' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
  
  supplierId?: string;
  supplierName: string;
  
  items: PurchaseOrderItem[];
  
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: 'UGX';
  
  expectedDeliveryDate?: Timestamp;
  deliveryAddress?: string;
  
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  notes?: string;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface PurchaseOrderItem {
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  boqItemIds: string[];

  // Delivery tracking
  deliveredQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  acceptedQuantity: number;
  deliveryEntryIds: string[];  // References to ProcurementEntry IDs
}

export interface StockAdjustment {
  id: string;
  projectId: string;
  
  adjustmentNumber: string;
  type: 'correction' | 'damage' | 'theft' | 'expiry' | 'other';
  
  materialId: string;
  materialName: string;
  unit: string;
  
  previousQuantity: number;
  adjustmentQuantity: number;
  newQuantity: number;
  
  reason: string;
  approvedBy?: string;
  
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

export interface MaterialProcurementSummary {
  materialId: string;
  materialName: string;
  unit: string;
  
  plannedQuantity: number;
  
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  
  variance: number;
  variancePercentage: number;
  fulfillmentPercentage: number;
  
  plannedCost: number;
  actualCost: number;
  costVariance: number;
  
  status: 'not_started' | 'in_progress' | 'complete' | 'over_procured';
}

export interface ProjectProcurementSummary {
  projectId: string;
  
  totalMaterials: number;
  materialsComplete: number;
  overallProgress: number;
  
  totalPlannedCost: number;
  totalActualCost: number;
  costVariance: number;
  costVariancePercentage: number;
  
  totalEntries: number;
  pendingEntries: number;
  disputedEntries: number;
  
  stageProgress: StageProgressSummary[];
  
  lastDeliveryDate?: Timestamp;
  lastUpdated: Timestamp;
}

export interface StageProgressSummary {
  stageId: string;
  stageName: string;
  stageOrder: number;
  
  plannedMaterials: number;
  receivedMaterials: number;
  progress: number;
  
  plannedCost: number;
  actualCost: number;
}

// ============================================================================
// FILTER AND QUERY TYPES
// ============================================================================

export interface ProcurementFilters {
  type?: ProcurementType[];
  status?: ProcurementStatus[];
  materialId?: string;
  supplierId?: string;
  stageId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  efrisValidated?: boolean;
  searchQuery?: string;
}

export interface ProcurementSortOptions {
  field: 'deliveryDate' | 'createdAt' | 'totalAmount' | 'materialName' | 'referenceNumber';
  direction: 'asc' | 'desc';
}

// ============================================================================
// INPUT TYPES FOR FORMS
// ============================================================================

export interface CreateProcurementInput {
  type: ProcurementType;
  materialId: string;
  materialName: string;
  unit: string;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected?: number;
  unitPrice: number;
  supplierName: string;
  supplierContact?: string;
  deliveryDate: Date;
  deliveryCondition?: DeliveryCondition;
  deliveryLocation?: string;
  boqItemIds: string[];
  stageId?: string;
  externalReference?: string;
  notes?: string;
}

export interface UpdateProcurementInput {
  status?: ProcurementStatus;
  quantityAccepted?: number;
  quantityRejected?: number;
  deliveryCondition?: DeliveryCondition;
  qualityNotes?: string;
  notes?: string;
}

export interface QualityCheckInput {
  quantityAccepted: number;
  quantityRejected: number;
  condition: DeliveryCondition;
  notes?: string;
}

// ============================================================================
// THREE-WAY MATCH
// ============================================================================

/**
 * Three-way match record linking PO → Delivery → Accountability
 * Used for variance detection and investigation triggers
 */
export interface ThreeWayMatch {
  id: string;
  purchaseOrderId: string;
  poItemId: string;
  deliveryEntryId: string;
  accountabilityExpenseId?: string;

  // Quantities
  poQuantity: number;
  deliveredQuantity: number;
  accountedQuantity?: number;

  // Amounts
  poAmount: number;
  deliveryAmount: number;
  accountedAmount?: number;

  // Variance tracking
  quantityVariance: number;
  amountVariance: number;
  variancePercentage: number;

  // Status & investigation
  matchStatus: 'pending' | 'matched' | 'variance_detected' | 'disputed';
  varianceSeverity?: 'minor' | 'moderate' | 'severe';
  requiresInvestigation: boolean;
  investigationId?: string;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  lastMatchedAt?: Timestamp;
}
