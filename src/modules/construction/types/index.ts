/**
 * Construction Module Types
 *
 * Construction Orders (CO) are the on-site execution analog of
 * Manufacturing Orders (MO). A CO is auto-created from a DesignItem when
 * the design-side workflow reaches `const-approve`; the CO then owns
 * mobilisation → execution → QC → handover.
 *
 * This mirrors the MO two-doc pattern so construction items get the same
 * clean split between design-side gating + a contractor-facing work order.
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// CO Stage + Status
// ============================================

export type COStage = 'mobilisation' | 'execution' | 'qc' | 'handover';

export const CO_STAGES: COStage[] = ['mobilisation', 'execution', 'qc', 'handover'];

export const CO_STAGE_LABELS: Record<COStage, string> = {
  mobilisation: 'Mobilisation',
  execution: 'Execution',
  qc: 'Quality Check',
  handover: 'Handover',
};

export const CO_STAGE_SHORT_LABELS: Record<COStage, string> = {
  mobilisation: 'Mobilise',
  execution: 'Execute',
  qc: 'QC',
  handover: 'Handover',
};

export type ConstructionOrderStatus =
  | 'draft'
  | 'released'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'closed-out'
  | 'cancelled';

export const CO_STATUS_LABELS: Record<ConstructionOrderStatus, string> = {
  draft: 'Draft',
  released: 'Released',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  completed: 'Completed',
  'closed-out': 'Closed Out',
  cancelled: 'Cancelled',
};

// ============================================
// Execution Tracking
// ============================================

/**
 * Snag / punch-list entry captured during QC or handover.
 */
export interface ConstructionSnag {
  id: string;
  description: string;
  severity?: 'minor' | 'major' | 'critical';
  raisedAt?: Timestamp;
  raisedBy?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolutionNotes?: string;
}

/**
 * Canonical execution timestamps for a construction order.
 *
 * Analog of `FulfillmentTracking` for manufactured items — derivation
 * layers (`deriveConstructionStatus`) read the most-advanced signal.
 */
export interface ConstructionExecutionTracking {
  siteHandoverAt?: Timestamp;
  siteHandoverBy?: string;

  kickoffAt?: Timestamp;
  kickoffBy?: string;

  inspectionPassedAt?: Timestamp;
  inspectedBy?: string;

  signoffAt?: Timestamp;
  signedOffBy?: string;

  completedAt?: Timestamp;
  completedBy?: string;

  snagList?: ConstructionSnag[];
}

// ============================================
// Stage History
// ============================================

export interface COStageTransition {
  fromStage: COStage | null;
  toStage: COStage;
  at: Timestamp;
  by: string;
  notes?: string;
}

// ============================================
// Construction Order
// ============================================

export interface ConstructionOrder {
  id: string;
  coNumber: string; // CO-YYYY-NNNN

  // Source link
  projectId: string;
  projectCode?: string;
  projectName?: string;
  designItemId: string;
  designItemName?: string;

  // Contractor
  contractorId?: string;
  contractorName?: string;
  contractorContact?: string;

  // Cost (copied from DesignItem.construction at release time)
  totalCost: number;
  currency: string;

  // Stage + status
  currentStage: COStage;
  status: ConstructionOrderStatus;
  stageHistory: COStageTransition[];

  // Execution signals
  execution: ConstructionExecutionTracking;

  // Scope text copied forward for the contractor
  scopeOfWork?: string;
  exclusions?: string;
  notes?: string;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}
