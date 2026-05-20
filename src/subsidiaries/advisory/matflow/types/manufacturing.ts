/**
 * Manufacturing Order Types
 * Types for tracking manufacturing/production work orders within projects
 */

import { Timestamp } from 'firebase/firestore';

export type ManufacturingOrderStatus =
  | 'draft'
  | 'planned'
  | 'in_progress'
  | 'on_hold'
  | 'quality_check'
  | 'completed'
  | 'cancelled';

export type ManufacturingPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ManufacturingOrderItem {
  materialId: string;
  materialName: string;
  unit: string;
  quantityRequired: number;
  quantityConsumed: number;
  unitCost: number;
  totalCost: number;
  boqItemId?: string;
}

export interface ManufacturingOrder {
  id: string;
  projectId: string;

  orderNumber: string;
  status: ManufacturingOrderStatus;
  priority: ManufacturingPriority;

  /** What is being produced */
  productName: string;
  productDescription?: string;
  quantity: number;
  unit: string;
  completedQuantity: number;

  /** Bill of materials - input materials */
  materials: ManufacturingOrderItem[];

  /** Work center / location */
  workCenter?: string;
  assignedTo?: string;
  assignedToName?: string;

  /** Timeline */
  plannedStartDate?: Timestamp;
  plannedEndDate?: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;

  /** Cost tracking */
  estimatedCost: number;
  actualCost: number;
  laborCost: number;
  materialCost: number;
  currency: 'UGX';

  /** Quality */
  qualityCheckRequired: boolean;
  qualityCheckBy?: string;
  qualityCheckDate?: Timestamp;
  qualityNotes?: string;
  defectQuantity: number;

  /** Link to BOQ */
  boqId?: string;
  boqItemIds: string[];

  notes?: string;

  history: Array<{
    action: string;
    timestamp: Timestamp;
    userId: string;
    userName: string;
    notes?: string;
  }>;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface CreateManufacturingOrderInput {
  productName: string;
  productDescription?: string;
  quantity: number;
  unit: string;
  priority: ManufacturingPriority;
  workCenter?: string;
  assignedTo?: string;
  assignedToName?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  materials: Array<{
    materialId: string;
    materialName: string;
    unit: string;
    quantityRequired: number;
    unitCost: number;
    boqItemId?: string;
  }>;
  boqId?: string;
  boqItemIds?: string[];
  qualityCheckRequired?: boolean;
  notes?: string;
}

/** Status display configuration */
export const MO_STATUS_CONFIG: Record<ManufacturingOrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  planned: { label: 'Planned', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  quality_check: { label: 'Quality Check', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export const MO_PRIORITY_CONFIG: Record<ManufacturingPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
};

/** Valid status transitions */
export const MO_STATUS_TRANSITIONS: Record<ManufacturingOrderStatus, ManufacturingOrderStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'quality_check', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  quality_check: ['completed', 'in_progress'],
  completed: [],
  cancelled: [],
};
