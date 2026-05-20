/**
 * AMH (ACCOUNTABILITY, MONITORING & HARMONIZATION) REPORT TYPES
 *
 * 8-section report structure for comprehensive project accountability reporting.
 * Used by the AMH Report Generator wizard and Cloud Function.
 */

import { Timestamp } from 'firebase/firestore';
import type { ReportPeriod } from '../reports/types/report.types';
import type { ExpenseCategory } from './requisition';
import type { VarianceStatus } from './accountability';

// ─────────────────────────────────────────────────────────────────
// SECTION 1: PROJECT SUMMARY
// ─────────────────────────────────────────────────────────────────

export interface AMHProjectSummary {
  projectId: string;
  projectName: string;
  projectCode: string;
  programName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  projectManager: string;
  location: string | null;
  donor: string | null;
  description: string | null;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 2: BUDGET OVERVIEW
// ─────────────────────────────────────────────────────────────────

export interface AMHProjectBudget {
  projectId: string;
  projectName: string;
  totalBudget: number;
  spent: number;
  committed: number;
  remaining: number;
  utilizationPercent: number;
  currency: 'UGX' | 'USD';
}

export interface AMHBudgetOverview {
  projectBudgets: AMHProjectBudget[];
  consolidated: {
    totalBudget: number;
    totalSpent: number;
    totalCommitted: number;
    totalRemaining: number;
    overallUtilization: number;
  };
  currency: 'UGX' | 'USD';
}

// ─────────────────────────────────────────────────────────────────
// SECTION 3: ACCOUNTABILITY ENTRIES
// ─────────────────────────────────────────────────────────────────

export interface AMHAccountabilityEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  vendor: string | null;
  projectName: string;
  receiptRef: string | null;
  requisitionRef: string | null;
  proofOfSpendStatus: 'complete' | 'partial' | 'missing';
  varianceStatus: VarianceStatus | null;
}

export interface AMHAccountabilitySection {
  entries: AMHAccountabilityEntry[];
  summary: {
    totalAccountedFor: number;
    pendingAccountability: number;
    unaccountedAmount: number;
    entryCount: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 4: VARIANCE ANALYSIS
// ─────────────────────────────────────────────────────────────────

export interface AMHCategoryVariance {
  category: ExpenseCategory;
  categoryLabel: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: VarianceStatus;
}

export interface AMHProjectVariance {
  projectId: string;
  projectName: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface AMHVarianceAnalysis {
  byCategory: AMHCategoryVariance[];
  byProject: AMHProjectVariance[];
  overallVariance: number;
  overallVariancePercent: number;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 5: RECONCILIATION STATUS
// ─────────────────────────────────────────────────────────────────

export interface AMHReconciliationStatus {
  totalAdvances: number;
  totalAccountedFor: number;
  outstandingBalance: number;
  reconciledEntries: number;
  pendingEntries: number;
  matchedToRequisitions: number;
  unmatchedEntries: number;
  overduePendingCount: number;
}

// ─────────────────────────────────────────────────────────────────
// SECTION 6: DOCUMENTATION COMPLETENESS
// ─────────────────────────────────────────────────────────────────

export interface AMHMissingDocument {
  expenseId: string;
  description: string;
  amount: number;
  missingDocs: string[];
  projectName: string;
}

export interface AMHDocumentation {
  totalExpenses: number;
  expensesWithReceipts: number;
  expensesWithEFRIS: number;
  completenessPercent: number;
  missingDocuments: AMHMissingDocument[];
}

// ─────────────────────────────────────────────────────────────────
// SECTION 7: APPROVALS
// ─────────────────────────────────────────────────────────────────

export interface AMHApprovalItem {
  id: string;
  description: string;
  amount: number;
  projectName: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface AMHApprovals {
  pendingApprovals: AMHApprovalItem[];
  approvedItems: AMHApprovalItem[];
  rejectedItems: AMHApprovalItem[];
}

// ─────────────────────────────────────────────────────────────────
// SECTION 8: AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────

export interface AMHAuditEvent {
  timestamp: string;
  action: string;
  user: string;
  details: string;
  entityType: 'accountability' | 'requisition' | 'allocation' | 'report';
  entityId: string;
}

export interface AMHAuditTrail {
  events: AMHAuditEvent[];
  totalEvents: number;
}

// ─────────────────────────────────────────────────────────────────
// AMH REPORT (TOP-LEVEL)
// ─────────────────────────────────────────────────────────────────

export type AMHReportStatus = 'generating' | 'draft' | 'final' | 'error';

export interface AMHReportSections {
  summary: AMHProjectSummary[];
  budget: AMHBudgetOverview;
  accountability: AMHAccountabilitySection;
  variance: AMHVarianceAnalysis;
  reconciliation: AMHReconciliationStatus;
  documentation: AMHDocumentation;
  approvals: AMHApprovals;
  auditTrail: AMHAuditTrail;
}

export type AMHSectionKey = keyof AMHReportSections;

export const AMH_SECTION_LABELS: Record<AMHSectionKey, { label: string; description: string }> = {
  summary: { label: 'Project Summary', description: 'Overview of selected projects' },
  budget: { label: 'Budget Overview', description: 'Budget utilization by project and consolidated' },
  accountability: { label: 'Accountability Entries', description: 'Detailed expense records with receipt status' },
  variance: { label: 'Variance Analysis', description: 'Budget vs. actual comparison by category and project' },
  reconciliation: { label: 'Reconciliation Status', description: 'Advances vs. accountabilities with matching' },
  documentation: { label: 'Documentation Completeness', description: 'Proof of spend checklist and missing documents' },
  approvals: { label: 'Approvals', description: 'Pending, approved, and rejected accountability items' },
  auditTrail: { label: 'Audit Trail', description: 'Chronological log of accountability actions' },
};

export interface AMHReport {
  id: string;
  title: string;
  organizationId: string;
  period: ReportPeriod;
  projectIds: string[];
  projectNames: string[];
  sections: AMHReportSections;
  enabledSections: AMHSectionKey[];
  generatedAt: Timestamp;
  generatedBy: string;
  status: AMHReportStatus;
  pdfUrl: string | null;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────
// WIZARD STATE
// ─────────────────────────────────────────────────────────────────

export type AMHWizardStep = 'projects' | 'sections' | 'preview' | 'generate';

export const AMH_WIZARD_STEPS: { key: AMHWizardStep; label: string; number: number }[] = [
  { key: 'projects', label: 'Select Projects', number: 1 },
  { key: 'sections', label: 'Configure Sections', number: 2 },
  { key: 'preview', label: 'Preview', number: 3 },
  { key: 'generate', label: 'Generate', number: 4 },
];

export interface AMHWizardState {
  step: AMHWizardStep;
  selectedProjectIds: string[];
  enabledSections: AMHSectionKey[];
  period: ReportPeriod | null;
  outputFormat: 'pdf' | 'docx';
  previewData: AMHReportSections | null;
  generating: boolean;
  generatedReportId: string | null;
  generatedPdfUrl: string | null;
  error: string | null;
}

export const DEFAULT_WIZARD_STATE: AMHWizardState = {
  step: 'projects',
  selectedProjectIds: [],
  enabledSections: ['summary', 'budget', 'accountability', 'variance', 'reconciliation', 'documentation', 'approvals', 'auditTrail'],
  period: null,
  outputFormat: 'pdf',
  previewData: null,
  generating: false,
  generatedReportId: null,
  generatedPdfUrl: null,
  error: null,
};
