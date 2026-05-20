import { Timestamp } from 'firebase/firestore';
import { Money } from './money';

/**
 * DISBURSEMENT STATUS
 */
export type DisbursementStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'disbursed'
  | 'rejected'
  | 'cancelled';

/**
 * DISBURSEMENT
 * Record of funds disbursed from a funding source
 */
export interface Disbursement {
  id: string;
  
  /** Parent funding source */
  fundingSourceId: string;
  
  /** Parent engagement */
  engagementId: string;
  
  // ─────────────────────────────────────────────────────────────────
  // AMOUNT
  // ─────────────────────────────────────────────────────────────────
  
  /** Requested amount */
  requestedAmount: Money;
  
  /** Approved amount (may differ from requested) */
  approvedAmount?: Money;
  
  /** Actually disbursed amount */
  disbursedAmount?: Money;
  
  // ─────────────────────────────────────────────────────────────────
  // DETAILS
  // ─────────────────────────────────────────────────────────────────
  
  /** Disbursement number (sequential) */
  disbursementNumber: number;
  
  /** Reference number */
  reference: string;
  
  /** Description/purpose */
  description: string;
  
  /** Request date */
  requestDate: Timestamp;
  
  /** Approval date */
  approvalDate?: Timestamp;
  
  /** Disbursement date */
  disbursementDate?: Timestamp;
  
  /** Value date (when funds available) */
  valueDate?: Timestamp;
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────
  
  status: DisbursementStatus;
  
  /** Rejection reason (if rejected) */
  rejectionReason?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // BANKING
  // ─────────────────────────────────────────────────────────────────
  
  /** Receiving bank account ID */
  bankAccountId?: string;
  
  /** Transfer reference */
  transferReference?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // SUPPORTING DOCS
  // ─────────────────────────────────────────────────────────────────
  
  /** Supporting document IDs */
  documentIds: string[];
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  requestedBy: string;
  approvedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * DISBURSEMENT SCHEDULE ITEM STATUS
 */
export type DisbursementScheduleItemStatus = 'pending' | 'met' | 'disbursed' | 'deferred';

/**
 * DISBURSEMENT SCHEDULE ITEM
 */
export interface DisbursementScheduleItem {
  /** Sequence number */
  sequence: number;
  
  /** Planned date */
  plannedDate: Timestamp;
  
  /** Planned amount */
  plannedAmount: Money;
  
  /** Actual disbursement ID (when realized) */
  actualDisbursementId?: string;
  
  /** Milestone/condition for disbursement */
  condition?: string;
  
  /** Status */
  status: DisbursementScheduleItemStatus;
}

/**
 * DISBURSEMENT SCHEDULE
 * Planned disbursement schedule
 */
export interface DisbursementSchedule {
  id: string;
  fundingSourceId: string;
  
  /** Schedule items */
  items: DisbursementScheduleItem[];
  
  /** Is schedule fixed or indicative */
  isFixed: boolean;
  
  /** Notes */
  notes?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * CREATE DISBURSEMENT DATA
 */
export interface CreateDisbursementData {
  fundingSourceId: string;
  engagementId: string;
  requestedAmount: Money;
  description: string;
  documentIds?: string[];
}

/**
 * DISBURSEMENT SUMMARY
 */
export interface DisbursementSummary {
  fundingSourceId: string;
  totalRequested: Money;
  totalApproved: Money;
  totalDisbursed: Money;
  disbursementCount: number;
  pendingCount: number;
  lastDisbursementDate?: Timestamp;
}

/**
 * Get disbursement status display name
 */
export function getDisbursementStatusDisplayName(status: DisbursementStatus): string {
  const names: Record<DisbursementStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    processing: 'Processing',
    disbursed: 'Disbursed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };
  return names[status];
}

/**
 * Get disbursement status color
 */
export function getDisbursementStatusColor(status: DisbursementStatus): string {
  const colors: Record<DisbursementStatus, string> = {
    draft: 'gray',
    pending_approval: 'yellow',
    approved: 'blue',
    processing: 'purple',
    disbursed: 'green',
    rejected: 'red',
    cancelled: 'gray',
  };
  return colors[status];
}

/**
 * Check if disbursement is pending
 */
export function isDisbursementPending(status: DisbursementStatus): boolean {
  return ['draft', 'pending_approval', 'approved', 'processing'].includes(status);
}

/**
 * Check if disbursement is complete
 */
export function isDisbursementComplete(status: DisbursementStatus): boolean {
  return status === 'disbursed';
}

/**
 * Check if disbursement is terminal
 */
export function isDisbursementTerminal(status: DisbursementStatus): boolean {
  return ['disbursed', 'rejected', 'cancelled'].includes(status);
}

/**
 * Valid status transitions
 */
export const DISBURSEMENT_STATUS_TRANSITIONS: Record<DisbursementStatus, DisbursementStatus[]> = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'rejected', 'cancelled'],
  processing: ['disbursed', 'rejected', 'cancelled'],
  disbursed: [],
  rejected: [],
  cancelled: [],
};

/**
 * Check if status transition is valid
 */
export function canTransitionDisbursementTo(
  currentStatus: DisbursementStatus,
  newStatus: DisbursementStatus
): boolean {
  return DISBURSEMENT_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Generate disbursement reference
 */
export function generateDisbursementReference(
  fundingSourceRef: string,
  disbursementNumber: number
): string {
  return `${fundingSourceRef}-D${disbursementNumber.toString().padStart(3, '0')}`;
}

/**
 * Calculate disbursement summary
 */
export function calculateDisbursementSummary(
  fundingSourceId: string,
  disbursements: Disbursement[],
  currency: string
): DisbursementSummary {
  const sourceDisbursements = disbursements.filter(d => d.fundingSourceId === fundingSourceId);
  
  let totalRequested = 0;
  let totalApproved = 0;
  let totalDisbursed = 0;
  let pendingCount = 0;
  let lastDisbursementDate: Timestamp | undefined;
  
  sourceDisbursements.forEach(d => {
    totalRequested += d.requestedAmount.amount;
    if (d.approvedAmount) totalApproved += d.approvedAmount.amount;
    if (d.disbursedAmount) totalDisbursed += d.disbursedAmount.amount;
    if (isDisbursementPending(d.status)) pendingCount++;
    if (d.disbursementDate && (!lastDisbursementDate || d.disbursementDate > lastDisbursementDate)) {
      lastDisbursementDate = d.disbursementDate;
    }
  });
  
  return {
    fundingSourceId,
    totalRequested: { amount: totalRequested, currency },
    totalApproved: { amount: totalApproved, currency },
    totalDisbursed: { amount: totalDisbursed, currency },
    disbursementCount: sourceDisbursements.length,
    pendingCount,
    lastDisbursementDate,
  };
}
