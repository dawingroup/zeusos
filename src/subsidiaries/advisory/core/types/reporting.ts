import { Timestamp } from 'firebase/firestore';

/**
 * REPORTING FREQUENCY
 */
export type ReportingFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'ad_hoc'
  | 'milestone_based'
  | 'on_completion';

/**
 * REPORT TYPE
 * Categories of reports required
 */
export type ReportType =
  // Financial Reports
  | 'financial_statement'
  | 'budget_variance'
  | 'expenditure_report'
  | 'cash_flow_forecast'
  | 'fund_utilization'
  | 'audit_report'
  
  // Progress Reports
  | 'progress_report'
  | 'milestone_report'
  | 'completion_report'
  | 'impact_report'
  
  // Technical Reports
  | 'technical_report'
  | 'monitoring_report'
  | 'evaluation_report'
  | 'environmental_assessment'
  | 'social_assessment'
  
  // Compliance Reports
  | 'covenant_compliance'
  | 'procurement_report'
  | 'anti_corruption'
  | 'safeguards_report'
  
  // Investment Reports
  | 'valuation_report'
  | 'portfolio_report'
  | 'performance_report'
  | 'risk_report'
  | 'esg_report'
  
  // Other
  | 'narrative_report'
  | 'custom';

/**
 * REPORT FORMAT
 */
export type ReportFormat = 'pdf' | 'excel' | 'word' | 'portal_submission' | 'custom';

/**
 * REPORTING REQUIREMENT
 * A specific reporting obligation from a funder
 */
export interface ReportingRequirement {
  id: string;
  
  /** Funding source this requirement comes from */
  fundingSourceId?: string;
  
  /** Funder ID (for funder-level defaults) */
  funderId?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // REQUIREMENT DETAILS
  // ─────────────────────────────────────────────────────────────────
  
  /** Report type */
  reportType: ReportType;
  
  /** Requirement name */
  name: string;
  
  /** Description of what's required */
  description: string;
  
  /** Reporting frequency */
  frequency: ReportingFrequency;
  
  /** Template URL (if funder provides template) */
  templateUrl?: string;
  
  /** Required format */
  format?: ReportFormat;
  
  // ─────────────────────────────────────────────────────────────────
  // TIMING
  // ─────────────────────────────────────────────────────────────────
  
  /** First due date */
  firstDueDate: Timestamp;
  
  /** Days after period end (for periodic reports) */
  daysAfterPeriodEnd?: number;
  
  /** Specific due dates (for milestone-based) */
  dueDates?: Timestamp[];
  
  /** Reminder days before due */
  reminderDaysBefore: number[];
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────
  
  /** Is requirement active */
  isActive: boolean;
  
  /** Is requirement mandatory */
  isMandatory: boolean;
  
  /** Consequence of non-compliance */
  nonComplianceConsequence?: string;
}

/**
 * REPORT SUBMISSION STATUS
 */
export type ReportSubmissionStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'submitted'
  | 'accepted'
  | 'revision_requested'
  | 'overdue';

/**
 * REPORT SUBMISSION
 * Record of a submitted report
 */
export interface ReportSubmission {
  id: string;
  
  /** Requirement being satisfied */
  requirementId: string;
  
  /** Engagement ID */
  engagementId: string;
  
  /** Funding source (if requirement is source-specific) */
  fundingSourceId?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // REPORT DETAILS
  // ─────────────────────────────────────────────────────────────────
  
  /** Report title */
  title: string;
  
  /** Period covered (start) */
  periodStart?: Timestamp;
  
  /** Period covered (end) */
  periodEnd?: Timestamp;
  
  /** Milestone (for milestone-based) */
  milestone?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // SUBMISSION
  // ─────────────────────────────────────────────────────────────────
  
  /** Document IDs */
  documentIds: string[];
  
  /** Submission date */
  submittedAt?: Timestamp;
  
  /** Submitted by */
  submittedBy?: string;
  
  /** Due date */
  dueDate: Timestamp;
  
  /** Was submitted late */
  isLate: boolean;
  
  /** Days late (if late) */
  daysLate?: number;
  
  // ─────────────────────────────────────────────────────────────────
  // REVIEW
  // ─────────────────────────────────────────────────────────────────
  
  /** Status */
  status: ReportSubmissionStatus;
  
  /** Reviewed by funder */
  reviewedByFunder: boolean;
  
  /** Funder feedback */
  funderFeedback?: string;
  
  /** Funder accepted */
  funderAccepted?: boolean;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * SCHEDULED REPORT STATUS
 */
export type ScheduledReportStatus = 'upcoming' | 'due_soon' | 'overdue';

/**
 * SCHEDULED REPORT
 */
export interface ScheduledReport {
  requirementId: string;
  requirementName: string;
  reportType: ReportType;
  funderName: string;
  dueDate: Timestamp;
  periodStart?: Timestamp;
  periodEnd?: Timestamp;
  daysUntilDue: number;
  status: ScheduledReportStatus;
}

/**
 * REPORTING SCHEDULE
 * Generated schedule of upcoming reports
 */
export interface ReportingSchedule {
  engagementId: string;
  
  /** Upcoming reports */
  upcoming: ScheduledReport[];
  
  /** Overdue reports */
  overdue: ScheduledReport[];
  
  /** Recently submitted */
  recentlySubmitted: ReportSubmission[];
}

/**
 * CREATE REPORT SUBMISSION DATA
 */
export interface CreateReportSubmissionData {
  requirementId: string;
  engagementId: string;
  fundingSourceId?: string;
  title: string;
  periodStart?: Date;
  periodEnd?: Date;
  milestone?: string;
  documentIds: string[];
}

/**
 * Get reporting frequency display name
 */
export function getReportingFrequencyDisplayName(frequency: ReportingFrequency): string {
  const names: Record<ReportingFrequency, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semi_annual: 'Semi-Annual',
    annual: 'Annual',
    ad_hoc: 'Ad Hoc',
    milestone_based: 'Milestone-Based',
    on_completion: 'On Completion',
  };
  return names[frequency];
}

/**
 * Get report type display name
 */
export function getReportTypeDisplayName(type: ReportType): string {
  const names: Record<ReportType, string> = {
    financial_statement: 'Financial Statement',
    budget_variance: 'Budget Variance Report',
    expenditure_report: 'Expenditure Report',
    cash_flow_forecast: 'Cash Flow Forecast',
    fund_utilization: 'Fund Utilization Report',
    audit_report: 'Audit Report',
    progress_report: 'Progress Report',
    milestone_report: 'Milestone Report',
    completion_report: 'Completion Report',
    impact_report: 'Impact Report',
    technical_report: 'Technical Report',
    monitoring_report: 'Monitoring Report',
    evaluation_report: 'Evaluation Report',
    environmental_assessment: 'Environmental Assessment',
    social_assessment: 'Social Assessment',
    covenant_compliance: 'Covenant Compliance Report',
    procurement_report: 'Procurement Report',
    anti_corruption: 'Anti-Corruption Report',
    safeguards_report: 'Safeguards Report',
    valuation_report: 'Valuation Report',
    portfolio_report: 'Portfolio Report',
    performance_report: 'Performance Report',
    risk_report: 'Risk Report',
    esg_report: 'ESG Report',
    narrative_report: 'Narrative Report',
    custom: 'Custom Report',
  };
  return names[type];
}

/**
 * Get report type category
 */
export function getReportTypeCategory(type: ReportType): string {
  const financial: ReportType[] = ['financial_statement', 'budget_variance', 'expenditure_report', 'cash_flow_forecast', 'fund_utilization', 'audit_report'];
  const progress: ReportType[] = ['progress_report', 'milestone_report', 'completion_report', 'impact_report'];
  const technical: ReportType[] = ['technical_report', 'monitoring_report', 'evaluation_report', 'environmental_assessment', 'social_assessment'];
  const compliance: ReportType[] = ['covenant_compliance', 'procurement_report', 'anti_corruption', 'safeguards_report'];
  const investment: ReportType[] = ['valuation_report', 'portfolio_report', 'performance_report', 'risk_report', 'esg_report'];
  
  if (financial.includes(type)) return 'Financial';
  if (progress.includes(type)) return 'Progress';
  if (technical.includes(type)) return 'Technical';
  if (compliance.includes(type)) return 'Compliance';
  if (investment.includes(type)) return 'Investment';
  return 'Other';
}

/**
 * Get submission status display name
 */
export function getSubmissionStatusDisplayName(status: ReportSubmissionStatus): string {
  const names: Record<ReportSubmissionStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    pending_review: 'Pending Review',
    submitted: 'Submitted',
    accepted: 'Accepted',
    revision_requested: 'Revision Requested',
    overdue: 'Overdue',
  };
  return names[status];
}

/**
 * Get submission status color
 */
export function getSubmissionStatusColor(status: ReportSubmissionStatus): string {
  const colors: Record<ReportSubmissionStatus, string> = {
    not_started: 'gray',
    in_progress: 'blue',
    pending_review: 'yellow',
    submitted: 'green',
    accepted: 'teal',
    revision_requested: 'orange',
    overdue: 'red',
  };
  return colors[status];
}

/**
 * Check if report is due soon (within 7 days)
 */
export function isReportDueSoon(daysUntilDue: number): boolean {
  return daysUntilDue >= 0 && daysUntilDue <= 7;
}

/**
 * Check if report is overdue
 */
export function isReportOverdue(daysUntilDue: number): boolean {
  return daysUntilDue < 0;
}

/**
 * Calculate days until due
 */
export function calculateDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
