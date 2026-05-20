/**
 * Procurement Types
 * Requirements generated from manufacturing orders for outsourced/special parts
 */

import type { Timestamp } from '@/shared/types';
import type { ProcurementUrgency } from './procurementRequest';

/**
 * Status of a procurement requirement
 */
export type ProcurementRequirementStatus =
  | 'pending'
  | 'added-to-po'
  | 'ordered'
  | 'received'
  | 'cancelled';

/**
 * Human-readable labels for procurement requirement statuses
 */
export const PROCUREMENT_STATUS_LABELS: Record<ProcurementRequirementStatus, string> = {
  pending: 'Pending',
  'added-to-po': 'Added to PO',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
};

/**
 * A single procurement requirement — one outsourced item needed from a supplier
 * Generated from BOM entries that have a supplier or are special parts
 */
export interface ProcurementRequirement {
  id: string;
  subsidiaryId: string;

  // Source (which MO needs this)
  moId: string;
  moNumber: string;
  bomEntryId: string;
  designItemName: string;
  projectCode: string;

  // Item details
  inventoryItemId?: string;
  itemDescription: string;
  quantityRequired: number;
  unit: string;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  currency: string;

  // Supplier
  supplierId?: string;
  supplierName?: string;

  // Status tracking
  status: ProcurementRequirementStatus;
  poId?: string;
  poLineItemId?: string;

  // Purchase priority (flows from BOM/design, can be overridden)
  purchasePriority?: number;         // 0-based rank, lower = buy first
  prioritySource?: 'design' | 'manufacturing' | 'procurement';
  upstreamPurchasePriority?: number; // Original priority before override

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * Grouped view of procurement requirements by supplier for consolidation
 */
export interface SupplierRequirementGroup {
  supplierId: string;
  supplierName: string;
  requirements: ProcurementRequirement[];
  totalEstimatedCost: number;
  currency: string;
  moCount: number;
}

/**
 * Filters for querying procurement requirements
 */
export interface ProcurementFilters {
  status?: ProcurementRequirementStatus | ProcurementRequirementStatus[];
  supplierId?: string;
  moId?: string;
  search?: string;
}

// ============================================
// Unified Procurement Queue Types
// ============================================

export type ProcurementSource = 'material' | 'manufacturing';

export type UnifiedProcurementStatus =
  | 'pending'
  | 'in-progress'
  | 'added-to-po'
  | 'ordered'
  | 'received'
  | 'cancelled';

export const UNIFIED_STATUS_LABELS: Record<UnifiedProcurementStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  'added-to-po': 'Added to PO',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
};

/**
 * Normalized item that merges ProcurementRequest (material-driven)
 * and ProcurementRequirement (MO-driven) into a single shape.
 */
export interface UnifiedProcurementItem {
  id: string;
  source: ProcurementSource;

  // Common fields (normalized from both types)
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  currency: string;

  // Supplier
  supplierName?: string;
  supplierId?: string;

  // Context
  projectRef?: string;
  moNumber?: string;
  designItemName?: string;
  sourceUrl?: string;

  // Status
  status: UnifiedProcurementStatus;
  poId?: string;
  poNumber?: string;

  // Who/when
  requestedBy: string;
  requestedByName: string;
  requestedAt: any;

  // Urgency (material-driven only)
  urgency?: ProcurementUrgency;

  // Purchase priority (part-level, from design/manufacturing/procurement)
  purchasePriority?: number;         // 0-based rank, lower = buy first
  prioritySource?: 'design' | 'manufacturing' | 'procurement';

  // Original reference for PO actions
  originalId: string;
}

export interface UnifiedQueueFilters {
  status?: UnifiedProcurementStatus[];
  source?: ProcurementSource;
  urgency?: ProcurementUrgency;
  search?: string;
}
