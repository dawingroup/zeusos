/**
 * COMPLIANCE.TS
 * Main compliance types index file
 * 
 * Re-exports all compliance-related types from modular files
 * and provides the EngagementComplianceState aggregate type.
 */

// Re-export all from modular files
export * from './reporting';
export * from './covenant';
export * from './approval';
export * from './approval-chain';

// Import for aggregate types
import { ReportingSchedule } from './reporting';
import { Covenant, CovenantMeasurement, CovenantStatus } from './covenant';
import { ApprovalRequest } from './approval';

/**
 * COMPLIANCE ISSUE SEVERITY
 */
export type ComplianceIssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * COMPLIANCE ISSUE TYPE
 */
export type ComplianceIssueType = 
  | 'overdue_report' 
  | 'covenant_breach' 
  | 'covenant_at_risk'
  | 'pending_approval' 
  | 'expiring_document'
  | 'sla_breach';

/**
 * COMPLIANCE ISSUE
 */
export interface ComplianceIssue {
  type: ComplianceIssueType;
  severity: ComplianceIssueSeverity;
  title: string;
  description: string;
  dueDate?: Date;
  relatedEntityId: string;
  relatedEntityType: string;
  actionRequired?: string;
}

/**
 * COVENANT WITH MEASUREMENTS
 */
export interface CovenantWithMeasurements extends Covenant {
  measurements: CovenantMeasurement[];
}

/**
 * ENGAGEMENT COMPLIANCE STATE
 * Complete compliance state for an engagement
 */
export interface EngagementComplianceState {
  /** Engagement ID */
  engagementId: string;
  
  /** Reporting schedule and status */
  reporting: ReportingSchedule;
  
  /** Active covenants */
  covenants: CovenantWithMeasurements[];
  
  /** Pending approvals */
  pendingApprovals: ApprovalRequest[];
  
  /** Overall compliance score (0-100) */
  complianceScore: number;
  
  /** Summary of issues */
  issues: ComplianceIssue[];
  
  /** Last updated */
  lastUpdated: Date;
}

/**
 * COMPLIANCE SUMMARY
 * Lightweight compliance overview
 */
export interface ComplianceSummary {
  engagementId: string;
  complianceScore: number;
  overdueReportCount: number;
  covenantIssueCount: number;
  pendingApprovalCount: number;
  criticalIssueCount: number;
  hasBreachedCovenant: boolean;
}

/**
 * Calculate compliance score
 */
export function calculateComplianceScore(
  state: Pick<EngagementComplianceState, 'reporting' | 'covenants' | 'pendingApprovals'>
): number {
  let score = 100;
  
  // Deduct for overdue reports (10 points each, max 30)
  const overdueReports = state.reporting.overdue.length;
  score -= Math.min(overdueReports * 10, 30);
  
  // Deduct for covenant issues
  const covenantStatuses: CovenantStatus[] = ['at_risk', 'in_grace_period', 'in_cure_period', 'breached'];
  const covenantIssues = state.covenants.filter(c => 
    covenantStatuses.includes(c.currentStatus)
  );
  
  for (const covenant of covenantIssues) {
    switch (covenant.currentStatus) {
      case 'at_risk':
        score -= 5;
        break;
      case 'in_grace_period':
        score -= 10;
        break;
      case 'in_cure_period':
        score -= 15;
        break;
      case 'breached':
        score -= 25;
        break;
    }
  }
  
  // Deduct for pending approvals past SLA (5 points each, max 20)
  const pastSLAApprovals = state.pendingApprovals.filter(a => 
    a.approvalChain.some(s => s.isPastSLA)
  ).length;
  score -= Math.min(pastSLAApprovals * 5, 20);
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get compliance score color
 */
export function getComplianceScoreColor(score: number): string {
  if (score >= 90) return 'green';
  if (score >= 70) return 'yellow';
  if (score >= 50) return 'orange';
  return 'red';
}

/**
 * Get compliance score label
 */
export function getComplianceScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

/**
 * Create compliance summary from state
 */
export function createComplianceSummary(state: EngagementComplianceState): ComplianceSummary {
  const covenantStatuses: CovenantStatus[] = ['at_risk', 'in_grace_period', 'in_cure_period', 'breached'];
  
  return {
    engagementId: state.engagementId,
    complianceScore: state.complianceScore,
    overdueReportCount: state.reporting.overdue.length,
    covenantIssueCount: state.covenants.filter(c => 
      covenantStatuses.includes(c.currentStatus)
    ).length,
    pendingApprovalCount: state.pendingApprovals.length,
    criticalIssueCount: state.issues.filter(i => i.severity === 'critical').length,
    hasBreachedCovenant: state.covenants.some(c => c.currentStatus === 'breached'),
  };
}

/**
 * Identify compliance issues from state
 */
export function identifyComplianceIssues(
  state: Pick<EngagementComplianceState, 'reporting' | 'covenants' | 'pendingApprovals'>
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  
  // Overdue reports
  for (const report of state.reporting.overdue) {
    issues.push({
      type: 'overdue_report',
      severity: Math.abs(report.daysUntilDue) > 30 ? 'critical' : 'high',
      title: `Overdue: ${report.requirementName}`,
      description: `Report is ${Math.abs(report.daysUntilDue)} days overdue`,
      dueDate: report.dueDate.toDate(),
      relatedEntityId: report.requirementId,
      relatedEntityType: 'ReportingRequirement',
      actionRequired: 'Submit report immediately',
    });
  }
  
  // Covenant issues
  for (const covenant of state.covenants) {
    if (covenant.currentStatus === 'breached') {
      issues.push({
        type: 'covenant_breach',
        severity: 'critical',
        title: `Breach: ${covenant.name}`,
        description: `Covenant is in breach status`,
        relatedEntityId: covenant.id,
        relatedEntityType: 'Covenant',
        actionRequired: 'Contact funder for waiver or cure plan',
      });
    } else if (covenant.currentStatus === 'at_risk') {
      issues.push({
        type: 'covenant_at_risk',
        severity: 'medium',
        title: `At Risk: ${covenant.name}`,
        description: `Covenant is close to threshold (headroom: ${covenant.currentHeadroom})`,
        relatedEntityId: covenant.id,
        relatedEntityType: 'Covenant',
        actionRequired: 'Monitor closely and prepare mitigation plan',
      });
    }
  }
  
  // Pending approvals past SLA
  for (const approval of state.pendingApprovals) {
    const pastSLASteps = approval.approvalChain.filter(s => s.isPastSLA);
    if (pastSLASteps.length > 0) {
      issues.push({
        type: 'sla_breach',
        severity: 'high',
        title: `SLA Breach: ${approval.title}`,
        description: `Approval has ${pastSLASteps.length} step(s) past SLA`,
        relatedEntityId: approval.id,
        relatedEntityType: 'ApprovalRequest',
        actionRequired: 'Escalate to pending approvers',
      });
    }
  }
  
  // Sort by severity
  const severityOrder: Record<ComplianceIssueSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
