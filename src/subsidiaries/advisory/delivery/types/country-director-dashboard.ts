/**
 * COUNTRY DIRECTOR DASHBOARD TYPES
 *
 * Types for the consolidated Country Director Dashboard that integrates
 * manual requisitions with system requisitions for ADD-FIN-001 compliance monitoring.
 */

import { Timestamp } from 'firebase/firestore';
import { AccountabilityStatus } from './requisition';
import {
  VarianceStatus,
  ReconciliationStatus,
  VarianceInvestigation,
} from './accountability';

// ─────────────────────────────────────────────────────────────────
// UNIFIED REQUISITION SUMMARY
// ─────────────────────────────────────────────────────────────────

/**
 * Source of the requisition - either manual entry or system-generated
 */
export type RequisitionSource = 'manual' | 'system';

/**
 * Unified view of a requisition from either manual or system source
 */
export interface UnifiedRequisitionSummary {
  id: string;
  source: RequisitionSource;
  referenceNumber: string;
  description: string;
  amount: number;
  currency: string;

  // Accountability tracking
  accountabilityStatus: AccountabilityStatus;
  totalAccountedAmount: number;
  unaccountedAmount: number;
  accountabilityDueDate?: Date;
  daysSinceDisbursement?: number;
  daysUntilDue?: number;

  // ADD-FIN-001 Compliance
  varianceStatus?: VarianceStatus;
  varianceAmount?: number;
  variancePercentage?: number;
  hasActiveInvestigation?: boolean;
  reconciliationStatus?: ReconciliationStatus;

  // Project linkage
  projectId?: string;
  projectName?: string;
  programId?: string;
  programName?: string;

  // Timestamps
  requisitionDate: Date;
  paidDate?: Date;

  // Link info (for manual requisitions)
  linkedSystemAccountabilityId?: string;
}

// ─────────────────────────────────────────────────────────────────
// COUNTRY DIRECTOR SUMMARY
// ─────────────────────────────────────────────────────────────────

/**
 * Variance summary breakdown by status
 */
export interface VarianceSummary {
  compliant: number;
  minor: number;
  moderate: number;
  severe: number;
}

/**
 * Consolidated summary for the Country Director Dashboard
 */
export interface CountryDirectorSummary {
  // Portfolio metrics
  totalRequisitions: number;
  systemRequisitions: number;
  manualRequisitions: number;

  // Financial summary
  totalDisbursed: number;
  totalAccounted: number;
  totalUnaccounted: number;

  // Status breakdown
  pendingCount: number;
  partialCount: number;
  completeCount: number;
  overdueCount: number;

  // ADD-FIN-001 Compliance
  complianceRate: number; // % of zero-discrepancy submissions
  varianceSummary: VarianceSummary;
  activeInvestigations: number;
  overdueInvestigations: number;
  pendingReconciliations: number;

  // Aging
  agingByBucket: AgingBucket[];
}

// ─────────────────────────────────────────────────────────────────
// COMPLIANCE ALERTS
// ─────────────────────────────────────────────────────────────────

/**
 * Types of compliance alerts
 */
export type ComplianceAlertType =
  | 'overdue_accountability'
  | 'variance_investigation'
  | 'overdue_investigation'
  | 'overdue_reconciliation'
  | 'severe_variance';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'warning' | 'critical';

/**
 * Entity types that can trigger alerts
 */
export type AlertEntityType = 'manual_requisition' | 'system_requisition' | 'investigation';

/**
 * Compliance alert requiring attention
 */
export interface ComplianceAlert {
  id: string;
  type: ComplianceAlertType;
  severity: AlertSeverity;
  entityId: string;
  entityType: AlertEntityType;
  message: string;
  actionRequired: string;
  deadline?: Date;
  assignedTo?: string;
  projectName?: string;
  programName?: string;
  amount?: number;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────
// AGING BUCKETS
// ─────────────────────────────────────────────────────────────────

/**
 * Aging bucket for accountability tracking
 */
export interface AgingBucket {
  range: string;
  minDays: number;
  maxDays: number;
  count: number;
  amount: number;
  manualCount: number;
  manualAmount: number;
  systemCount: number;
  systemAmount: number;
}

/**
 * Unified aging analysis combining manual and system requisitions
 */
export interface UnifiedAgingAnalysis {
  buckets: AgingBucket[];
  totalPending: {
    count: number;
    amount: number;
  };
  manualTotal: {
    count: number;
    amount: number;
  };
  systemTotal: {
    count: number;
    amount: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// COMPLIANCE SCORE
// ─────────────────────────────────────────────────────────────────

/**
 * Breakdown of compliance score factors
 */
export interface ComplianceScoreBreakdown {
  zeroDiscrepancyRate: number; // % of requisitions with zero variance
  onTimeReconciliationRate: number; // % of requisitions reconciled on time
  proofOfSpendCompleteness: number; // % of expenses with complete documentation
  investigationResolutionRate: number; // % of investigations completed on time
}

/**
 * Overall compliance score with breakdown
 */
export interface ComplianceScore {
  overallScore: number; // 0-100
  breakdown: ComplianceScoreBreakdown;
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

// ─────────────────────────────────────────────────────────────────
// INVESTIGATION TRACKING
// ─────────────────────────────────────────────────────────────────

/**
 * Extended investigation with countdown info
 */
export interface InvestigationWithCountdown extends VarianceInvestigation {
  hoursRemaining: number;
  isOverdue: boolean;
  requisitionNumber: string;
  projectName?: string;
  programName?: string;
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD FILTERS
// ─────────────────────────────────────────────────────────────────

/**
 * Filters for the Country Director Dashboard
 */
export interface CountryDirectorFilters {
  programId: string; // Required - single program view
  dateRange?: {
    start: Date;
    end: Date;
  };
  accountabilityStatus?: AccountabilityStatus;
  source?: RequisitionSource;
  varianceStatus?: VarianceStatus;
}

/**
 * Program option for the selector
 */
export interface ProgramOption {
  id: string;
  name: string;
  projectCount: number;
  requisitionCount: number;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate alert severity based on alert type and context
 */
export function calculateAlertSeverity(
  type: ComplianceAlertType,
  daysOverdue?: number,
  variancePercentage?: number
): AlertSeverity {
  switch (type) {
    case 'severe_variance':
      return 'critical';
    case 'overdue_investigation':
      return 'critical';
    case 'overdue_accountability':
      if (daysOverdue && daysOverdue > 14) return 'critical';
      return 'warning';
    case 'variance_investigation':
      if (variancePercentage && variancePercentage > 5) return 'critical';
      return 'warning';
    case 'overdue_reconciliation':
      if (daysOverdue && daysOverdue > 7) return 'critical';
      return 'warning';
    default:
      return 'warning';
  }
}

/**
 * Create aging buckets with default structure
 */
export function createDefaultAgingBuckets(): AgingBucket[] {
  return [
    { range: '0-7 days', minDays: 0, maxDays: 7, count: 0, amount: 0, manualCount: 0, manualAmount: 0, systemCount: 0, systemAmount: 0 },
    { range: '8-14 days', minDays: 8, maxDays: 14, count: 0, amount: 0, manualCount: 0, manualAmount: 0, systemCount: 0, systemAmount: 0 },
    { range: '15-30 days', minDays: 15, maxDays: 30, count: 0, amount: 0, manualCount: 0, manualAmount: 0, systemCount: 0, systemAmount: 0 },
    { range: '30+ days', minDays: 31, maxDays: Infinity, count: 0, amount: 0, manualCount: 0, manualAmount: 0, systemCount: 0, systemAmount: 0 },
  ];
}

/**
 * Calculate compliance score from breakdown
 */
export function calculateOverallComplianceScore(breakdown: ComplianceScoreBreakdown): number {
  // Weighted average: zero discrepancy is most important
  const weights = {
    zeroDiscrepancyRate: 0.4,
    onTimeReconciliationRate: 0.25,
    proofOfSpendCompleteness: 0.2,
    investigationResolutionRate: 0.15,
  };

  return (
    breakdown.zeroDiscrepancyRate * weights.zeroDiscrepancyRate +
    breakdown.onTimeReconciliationRate * weights.onTimeReconciliationRate +
    breakdown.proofOfSpendCompleteness * weights.proofOfSpendCompleteness +
    breakdown.investigationResolutionRate * weights.investigationResolutionRate
  );
}

/**
 * Get alert type label for display
 */
export function getAlertTypeLabel(type: ComplianceAlertType): string {
  const labels: Record<ComplianceAlertType, string> = {
    overdue_accountability: 'Overdue Accountability',
    variance_investigation: 'Variance Investigation Required',
    overdue_investigation: 'Overdue Investigation',
    overdue_reconciliation: 'Overdue Reconciliation',
    severe_variance: 'Severe Variance Detected',
  };
  return labels[type];
}

/**
 * Get alert severity color classes for UI
 */
export function getAlertSeverityStyles(severity: AlertSeverity): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
      };
  }
}

/**
 * Get source badge styles for unified table
 */
export function getSourceBadgeStyles(source: RequisitionSource): {
  bg: string;
  text: string;
} {
  switch (source) {
    case 'manual':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
      };
    case 'system':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
      };
  }
}

// ─────────────────────────────────────────────────────────────────
// PORTAL ACCESS TOKEN
// ─────────────────────────────────────────────────────────────────

/**
 * Portal access token stored in Firestore
 * Allows unauthenticated access to specific program data
 */
export interface PortalAccessToken {
  id: string;
  token: string; // The actual token string used in URL
  programId: string;
  programName: string;
  label?: string; // Optional label for identifying the token
  expiresAt?: Date | Timestamp; // Optional expiration
  createdAt: Timestamp;
  createdBy: string;
  isActive: boolean;
  lastAccessedAt?: Timestamp;
  accessCount: number;
}

/**
 * Portal session data (derived from valid token)
 */
export interface PortalSession {
  programId: string;
  programName: string;
  tokenId: string;
  isValid: boolean;
  expiresAt?: Date;
}

// ─────────────────────────────────────────────────────────────────
// PORTAL ACCOUNTABILITY DETAIL
// ─────────────────────────────────────────────────────────────────

/**
 * Document attached to an accountability entry
 */
export interface AccountabilityDocument {
  id: string;
  name: string;
  url: string;
  type: string; // MIME type
  size?: number;
  uploadedAt: Date;
  uploadedBy?: string;
  category?: 'receipt' | 'invoice' | 'activity_report' | 'photo' | 'other';
}

/**
 * Accountability entry for portal display
 */
export interface PortalAccountabilityEntry {
  id: string;
  date: Date;
  description: string;
  category: string;
  vendor?: string;
  amount: number;
  receiptNumber?: string;
  invoiceNumber?: string;
  documents: AccountabilityDocument[];
  activityReportUrl?: string;
  paymentMethod?: string;
  contractOrPONumber?: string;
  contractOrPODocument?: AccountabilityDocument;
}

/**
 * Detailed requisition view for portal
 */
export interface PortalRequisitionDetail extends UnifiedRequisitionSummary {
  purpose?: string;
  advanceType?: string;
  accountabilities: PortalAccountabilityEntry[];
  acknowledgementDocumentUrl?: string;
  activityReportUrl?: string;
  notes?: string;
}
