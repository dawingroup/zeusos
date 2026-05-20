/**
 * Procurement Types
 * Requirements generated from manufacturing orders for outsourced/special parts
 */

import type { Timestamp } from '@/shared/types';

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
  projectId?: string | null;
  designProjectId?: string | null;
  salesOrderId?: string | null;
  /** Composite key used to align procurement with grouped MOs (project + SO). */
  projectSalesOrderGroupKey?: string;

  // Item details
  inventoryItemId?: string;
  itemDescription: string;
  quantityRequired: number;
  unit: string;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  currency: string;
  /** Source material category from BOM (sheet-goods, hardware, special, etc.). */
  materialCategory?: string;
  /**
   * Canonical material signature for consolidation.
   * For sheet materials this aligns procurement line merging with cutlist/nesting demand grain.
   */
  materialGroupKey?: string;
  /** Optional optimization run/session reference for nesting-aligned traceability. */
  sourceRunId?: string | null;

  // Supplier
  supplierId?: string;
  supplierName?: string;

  // Status tracking
  status: ProcurementRequirementStatus;
  poId?: string;
  poLineItemId?: string;

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

/**
 * Result of syncing procurement requirements with a BOM change
 */
export interface BOMSyncResult {
  created: string[];
  updated: string[];
  cancelled: string[];
  skippedNonPending: string[];
}
