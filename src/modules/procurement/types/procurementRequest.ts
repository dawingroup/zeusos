/**
 * Procurement Request Types
 * Material-driven procurement requests originating from the Materials Library.
 * Distinct from ProcurementRequirement (MO-driven BOM needs in procurement.ts).
 */

import type { Timestamp } from '@/shared/types';

/**
 * Urgency levels for procurement requests
 */
export type ProcurementUrgency = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Status of a procurement request
 */
export type ProcurementRequestStatus = 'pending' | 'in-progress' | 'ordered' | 'cancelled';

/**
 * Human-readable labels
 */
export const PROCUREMENT_REQUEST_STATUS_LABELS: Record<ProcurementRequestStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  ordered: 'Ordered',
  cancelled: 'Cancelled',
};

export const PROCUREMENT_URGENCY_LABELS: Record<ProcurementUrgency, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

/**
 * A procurement request created from the Materials Library.
 * Represents a material the team wants to purchase (often identified via Clipper).
 */
export interface ProcurementRequest {
  id: string;

  // Material reference
  materialId: string;
  materialName: string;
  materialCode: string;

  // What to buy
  quantity: number;
  unit: string;
  estimatedUnitCost: number;
  currency: string;

  // Source info (from clip/material)
  sourceUrl?: string;
  sourceImageUrl?: string;
  suggestedSupplier?: string;
  suggestedSupplierId?: string;

  // Context
  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;
  urgency: ProcurementUrgency;
  notes?: string;
  targetProjectId?: string;
  targetProjectName?: string;

  // Resolution
  status: ProcurementRequestStatus;
  assignedTo?: string;
  assignedToName?: string;
  poId?: string;
  poNumber?: string;
  resolvedAt?: Timestamp;
  cancellationReason?: string;

  // Metadata
  subsidiaryId: string;
  clipId?: string;
}

/**
 * Filters for querying procurement requests
 */
export interface ProcurementRequestFilters {
  status?: ProcurementRequestStatus | ProcurementRequestStatus[];
  urgency?: ProcurementUrgency;
  requestedBy?: string;
  search?: string;
}
