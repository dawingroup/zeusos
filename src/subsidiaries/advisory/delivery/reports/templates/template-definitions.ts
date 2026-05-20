/**
 * Default Template Definitions
 * Pre-configured templates for common report types
 */

import type { ReportTemplateInput, ReportType, DataSourceConfig } from '../types';
import {
  MONTHLY_PROGRESS_PLACEHOLDERS,
  ACTIVITY_COMPLETION_PLACEHOLDERS,
  ALL_COMMON_PLACEHOLDERS,
} from './template-placeholders';

// ============================================================================
// DATA SOURCE CONFIGURATIONS
// ============================================================================

const PROJECT_DATA_SOURCE: DataSourceConfig = {
  source: 'project',
  service: 'project',
  method: 'getProject',
};

const PROGRAM_DATA_SOURCE: DataSourceConfig = {
  source: 'program',
  service: 'program',
  method: 'getProgram',
};

const VARIANCE_DATA_SOURCE: DataSourceConfig = {
  source: 'variance',
  service: 'variance',
  method: 'generateBOQVarianceReport',
};

const RECONCILIATION_DATA_SOURCE: DataSourceConfig = {
  source: 'reconciliation',
  service: 'reconciliation',
  method: 'generateMonthlyReconciliation',
};

// ============================================================================
// DEFAULT TEMPLATE DEFINITIONS
// ============================================================================

/**
 * Monthly Progress Report Template
 */
export const MONTHLY_PROGRESS_TEMPLATE: Omit<ReportTemplateInput, 'googleDocTemplateId'> = {
  name: 'Monthly Progress Report',
  description: 'Standard monthly progress report with budget, progress, and activity updates',
  type: 'monthly_progress' as ReportType,
  placeholders: MONTHLY_PROGRESS_PLACEHOLDERS,
  dataSources: [
    PROJECT_DATA_SOURCE,
    PROGRAM_DATA_SOURCE,
    VARIANCE_DATA_SOURCE,
  ],
  defaultPeriodType: 'monthly',
  autoPopulateFields: [
    'project.name',
    'project.projectCode',
    'project.status',
    'budget.totalBudget',
    'budget.spent',
    'progress.physicalProgress',
    'progress.financialProgress',
  ],
  folderPath: 'Reports/{Year}/Monthly Progress',
  fileNamingPattern: '{ProjectCode}-MonthlyProgress-{Period}',
  includeFacilityBranding: true,
  includeClientLogo: true,
  includeDonorLogo: true,
  isActive: true,
  isDefault: true,
};

/**
 * Quarterly Progress Report Template
 */
export const QUARTERLY_PROGRESS_TEMPLATE: Omit<ReportTemplateInput, 'googleDocTemplateId'> = {
  name: 'Quarterly Progress Report',
  description: 'Comprehensive quarterly progress report with trends and analysis',
  type: 'quarterly_progress' as ReportType,
  placeholders: MONTHLY_PROGRESS_PLACEHOLDERS,
  dataSources: [
    PROJECT_DATA_SOURCE,
    PROGRAM_DATA_SOURCE,
    VARIANCE_DATA_SOURCE,
    RECONCILIATION_DATA_SOURCE,
  ],
  defaultPeriodType: 'quarterly',
  autoPopulateFields: [
    'project.name',
    'project.projectCode',
    'project.status',
    'budget.totalBudget',
    'budget.spent',
    'progress.physicalProgress',
    'progress.financialProgress',
  ],
  folderPath: 'Reports/{Year}/Quarterly Progress',
  fileNamingPattern: '{ProjectCode}-QuarterlyProgress-Q{Quarter}-{Year}',
  includeFacilityBranding: true,
  includeClientLogo: true,
  includeDonorLogo: true,
  isActive: true,
  isDefault: true,
};

/**
 * Steering Committee Update Template
 */
export const STEERING_COMMITTEE_TEMPLATE: Omit<ReportTemplateInput, 'googleDocTemplateId'> = {
  name: 'Steering Committee Update',
  description: 'Executive summary for steering committee meetings with KPIs and critical issues',
  type: 'steering_committee' as ReportType,
  placeholders: ALL_COMMON_PLACEHOLDERS,
  dataSources: [
    PROJECT_DATA_SOURCE,
    PROGRAM_DATA_SOURCE,
  ],
  defaultPeriodType: 'monthly',
  autoPopulateFields: [
    'project.name',
    'project.projectCode',
    'budget.totalBudget',
    'budget.remaining',
    'progress.physicalProgress',
  ],
  folderPath: 'Reports/{Year}/Steering Committee',
  fileNamingPattern: '{ProjectCode}-SteeringCommittee-{Date}',
  includeFacilityBranding: true,
  includeClientLogo: true,
  includeDonorLogo: true,
  isActive: true,
  isDefault: true,
};

/**
 * Activity Completion Report Template
 */
export const ACTIVITY_COMPLETION_TEMPLATE: Omit<ReportTemplateInput, 'googleDocTemplateId'> = {
  name: 'Activity Completion Report',
  description: 'Detailed report for completed project activities with BOQ and expenditure summary',
  type: 'activity_completion' as ReportType,
  placeholders: ACTIVITY_COMPLETION_PLACEHOLDERS,
  dataSources: [
    PROJECT_DATA_SOURCE,
    PROGRAM_DATA_SOURCE,
  ],
  defaultPeriodType: 'custom',
  autoPopulateFields: [
    'project.name',
    'project.projectCode',
    'customData.activityName',
  ],
  folderPath: 'Reports/{Year}/Activity Completion',
  fileNamingPattern: '{ProjectCode}-ActivityCompletion-{ActivityName}-{Date}',
  includeFacilityBranding: true,
  includeClientLogo: true,
  includeDonorLogo: true,
  isActive: true,
  isDefault: true,
};

/**
 * Variance Report Template
 */
export const VARIANCE_REPORT_TEMPLATE: Omit<ReportTemplateInput, 'googleDocTemplateId'> = {
  name: 'Budget Variance Report',
  description: 'Detailed budget variance analysis with item-level breakdown',
  type: 'variance_report' as ReportType,
  placeholders: [
    ...ALL_COMMON_PLACEHOLDERS,
  ],
  dataSources: [
    PROJECT_DATA_SOURCE,
    VARIANCE_DATA_SOURCE,
  ],
  defaultPeriodType: 'monthly',
  autoPopulateFields: [
    'project.name',
    'project.projectCode',
    'budget.variance',
    'budget.variancePercentage',
  ],
  folderPath: 'Reports/{Year}/Variance Reports',
  fileNamingPattern: '{ProjectCode}-VarianceReport-{Period}',
  includeFacilityBranding: true,
  includeClientLogo: false,
  includeDonorLogo: false,
  isActive: true,
  isDefault: true,
};

/**
 * Reconciliation Report Template
 */
export const RECONCILIATION_REPORT_TEMPLATE: Omit<ReportTemplateInput, 'googleDocTemplateId'> = {
  name: 'Monthly Reconciliation Report',
  description: 'Financial reconciliation report with cash flow and compliance metrics',
  type: 'reconciliation_report' as ReportType,
  placeholders: [
    ...ALL_COMMON_PLACEHOLDERS,
  ],
  dataSources: [
    PROJECT_DATA_SOURCE,
    RECONCILIATION_DATA_SOURCE,
  ],
  defaultPeriodType: 'monthly',
  autoPopulateFields: [
    'project.name',
    'project.projectCode',
    'budget.spent',
    'budget.remaining',
  ],
  folderPath: 'Reports/{Year}/Reconciliation',
  fileNamingPattern: '{ProjectCode}-Reconciliation-{Period}',
  includeFacilityBranding: true,
  includeClientLogo: false,
  includeDonorLogo: false,
  isActive: true,
  isDefault: true,
};

// ============================================================================
// ALL DEFAULT TEMPLATES
// ============================================================================

/**
 * All default template definitions
 */
export const DEFAULT_TEMPLATES = [
  MONTHLY_PROGRESS_TEMPLATE,
  QUARTERLY_PROGRESS_TEMPLATE,
  STEERING_COMMITTEE_TEMPLATE,
  ACTIVITY_COMPLETION_TEMPLATE,
  VARIANCE_REPORT_TEMPLATE,
  RECONCILIATION_REPORT_TEMPLATE,
];

/**
 * Get default template for a report type
 */
export function getDefaultTemplateForType(
  type: ReportType
): Omit<ReportTemplateInput, 'googleDocTemplateId'> | null {
  switch (type) {
    case 'monthly_progress':
      return MONTHLY_PROGRESS_TEMPLATE;
    case 'quarterly_progress':
      return QUARTERLY_PROGRESS_TEMPLATE;
    case 'steering_committee':
      return STEERING_COMMITTEE_TEMPLATE;
    case 'activity_completion':
      return ACTIVITY_COMPLETION_TEMPLATE;
    case 'variance_report':
      return VARIANCE_REPORT_TEMPLATE;
    case 'reconciliation_report':
      return RECONCILIATION_REPORT_TEMPLATE;
    default:
      return null;
  }
}

/**
 * Report type display names
 */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  monthly_progress: 'Monthly Progress Report',
  quarterly_progress: 'Quarterly Progress Report',
  steering_committee: 'Steering Committee Update',
  activity_completion: 'Activity Completion Report',
  variance_report: 'Budget Variance Report',
  reconciliation_report: 'Reconciliation Report',
  custom: 'Custom Report',
};

/**
 * Report type descriptions
 */
export const REPORT_TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  monthly_progress: 'Standard monthly update with budget, progress, and activities',
  quarterly_progress: 'Comprehensive quarterly review with trends and reconciliation',
  steering_committee: 'Executive summary with KPIs and critical issues',
  activity_completion: 'Detailed report for completed project activities',
  variance_report: 'Budget variance analysis with item-level breakdown',
  reconciliation_report: 'Financial reconciliation with compliance metrics',
  custom: 'Custom report with user-defined content',
};
