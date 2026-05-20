/**
 * Template Placeholder Definitions
 * Standard placeholders for report templates
 */

import type { PlaceholderConfig } from '../types';

// ============================================================================
// PROJECT PLACEHOLDERS
// ============================================================================

export const PROJECT_PLACEHOLDERS: PlaceholderConfig[] = [
  {
    placeholder: '{{PROJECT_NAME}}',
    fieldPath: 'project.name',
    dataSource: 'project',
    format: 'text',
    required: true,
    description: 'Project name',
  },
  {
    placeholder: '{{PROJECT_CODE}}',
    fieldPath: 'project.projectCode',
    dataSource: 'project',
    format: 'text',
    required: true,
    description: 'Project code (e.g., RHC-26-001)',
  },
  {
    placeholder: '{{PROJECT_STATUS}}',
    fieldPath: 'project.status',
    dataSource: 'project',
    format: 'text',
    required: true,
    description: 'Current project status',
  },
  {
    placeholder: '{{PROJECT_DESCRIPTION}}',
    fieldPath: 'project.description',
    dataSource: 'project',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'Project description',
  },
  {
    placeholder: '{{SITE_NAME}}',
    fieldPath: 'project.location.siteName',
    dataSource: 'project',
    format: 'text',
    required: true,
    description: 'Site/facility name',
  },
  {
    placeholder: '{{SITE_ADDRESS}}',
    fieldPath: 'project.location.address',
    dataSource: 'project',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'Site address',
  },
  {
    placeholder: '{{DISTRICT}}',
    fieldPath: 'project.location.district',
    dataSource: 'project',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'District',
  },
  {
    placeholder: '{{REGION}}',
    fieldPath: 'project.location.region',
    dataSource: 'project',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'Region',
  },
  {
    placeholder: '{{PROJECT_START_DATE}}',
    fieldPath: 'project.timeline.startDate',
    dataSource: 'project',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    defaultValue: 'TBD',
    description: 'Project start date',
  },
  {
    placeholder: '{{PROJECT_END_DATE}}',
    fieldPath: 'project.timeline.endDate',
    dataSource: 'project',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    defaultValue: 'TBD',
    description: 'Project end date',
  },
  {
    placeholder: '{{PROJECT_CREATED_DATE}}',
    fieldPath: 'project.createdAt',
    dataSource: 'project',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    description: 'Date project was created',
  },
];

// ============================================================================
// PROGRAM PLACEHOLDERS
// ============================================================================

export const PROGRAM_PLACEHOLDERS: PlaceholderConfig[] = [
  {
    placeholder: '{{PROGRAM_NAME}}',
    fieldPath: 'program.name',
    dataSource: 'program',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'Program name',
  },
  {
    placeholder: '{{PROGRAM_CODE}}',
    fieldPath: 'program.code',
    dataSource: 'program',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'Program code',
  },
  {
    placeholder: '{{PROGRAM_DESCRIPTION}}',
    fieldPath: 'program.description',
    dataSource: 'program',
    format: 'text',
    required: false,
    defaultValue: '',
    description: 'Program description',
  },
  {
    placeholder: '{{PROGRAM_SECTORS}}',
    fieldPath: 'program.sectors',
    dataSource: 'program',
    format: 'list',
    required: false,
    defaultValue: '',
    description: 'Program sectors (comma-separated)',
  },
];

// ============================================================================
// BUDGET PLACEHOLDERS
// ============================================================================

export const BUDGET_PLACEHOLDERS: PlaceholderConfig[] = [
  {
    placeholder: '{{TOTAL_BUDGET}}',
    fieldPath: 'budget.totalBudget',
    dataSource: 'budget',
    format: 'currency',
    formatOptions: { currency: 'UGX' },
    required: true,
    description: 'Total project budget',
  },
  {
    placeholder: '{{TOTAL_SPENT}}',
    fieldPath: 'budget.spent',
    dataSource: 'budget',
    format: 'currency',
    formatOptions: { currency: 'UGX' },
    required: true,
    description: 'Total amount spent',
  },
  {
    placeholder: '{{COMMITTED_AMOUNT}}',
    fieldPath: 'budget.committed',
    dataSource: 'budget',
    format: 'currency',
    formatOptions: { currency: 'UGX' },
    required: true,
    description: 'Total committed amount',
  },
  {
    placeholder: '{{REMAINING_BUDGET}}',
    fieldPath: 'budget.remaining',
    dataSource: 'budget',
    format: 'currency',
    formatOptions: { currency: 'UGX' },
    required: true,
    description: 'Remaining budget',
  },
  {
    placeholder: '{{VARIANCE_AMOUNT}}',
    fieldPath: 'budget.variance',
    dataSource: 'budget',
    format: 'currency',
    formatOptions: { currency: 'UGX' },
    required: false,
    defaultValue: '0',
    description: 'Budget variance amount',
  },
  {
    placeholder: '{{VARIANCE_PERCENTAGE}}',
    fieldPath: 'budget.variancePercentage',
    dataSource: 'budget',
    format: 'percentage',
    formatOptions: { decimalPlaces: 1 },
    required: false,
    defaultValue: '0%',
    description: 'Budget variance percentage',
  },
  {
    placeholder: '{{BUDGET_CURRENCY}}',
    fieldPath: 'budget.currency',
    dataSource: 'budget',
    format: 'text',
    required: true,
    defaultValue: 'UGX',
    description: 'Budget currency',
  },
  {
    placeholder: '{{VARIANCE_STATUS}}',
    fieldPath: 'budget.varianceStatus',
    dataSource: 'budget',
    format: 'text',
    required: false,
    defaultValue: 'On Track',
    description: 'Budget variance status (On Track/Over/Under)',
  },
];

// ============================================================================
// PROGRESS PLACEHOLDERS
// ============================================================================

export const PROGRESS_PLACEHOLDERS: PlaceholderConfig[] = [
  {
    placeholder: '{{PHYSICAL_PROGRESS}}',
    fieldPath: 'progress.physicalProgress',
    dataSource: 'progress',
    format: 'percentage',
    formatOptions: { decimalPlaces: 1 },
    required: true,
    description: 'Physical progress percentage',
  },
  {
    placeholder: '{{FINANCIAL_PROGRESS}}',
    fieldPath: 'progress.financialProgress',
    dataSource: 'progress',
    format: 'percentage',
    formatOptions: { decimalPlaces: 1 },
    required: true,
    description: 'Financial progress percentage',
  },
  {
    placeholder: '{{COMPLETION_PERCENT}}',
    fieldPath: 'progress.completionPercent',
    dataSource: 'progress',
    format: 'percentage',
    formatOptions: { decimalPlaces: 1 },
    required: false,
    description: 'Overall completion percentage',
  },
  {
    placeholder: '{{TIME_ELAPSED}}',
    fieldPath: 'progress.timeElapsedPercent',
    dataSource: 'progress',
    format: 'percentage',
    formatOptions: { decimalPlaces: 1 },
    required: false,
    defaultValue: '0%',
    description: 'Time elapsed percentage',
  },
  {
    placeholder: '{{SCHEDULE_STATUS}}',
    fieldPath: 'progress.scheduleStatus',
    dataSource: 'progress',
    format: 'text',
    required: false,
    defaultValue: 'On Schedule',
    description: 'Schedule status (On Schedule/Ahead/Behind)',
  },
  {
    placeholder: '{{SCHEDULE_VARIANCE_DAYS}}',
    fieldPath: 'progress.scheduleVarianceDays',
    dataSource: 'progress',
    format: 'number',
    formatOptions: { suffix: ' days' },
    required: false,
    defaultValue: '0 days',
    description: 'Schedule variance in days',
  },
];

// ============================================================================
// FACILITY BRANDING PLACEHOLDERS
// ============================================================================

export const BRANDING_PLACEHOLDERS: PlaceholderConfig[] = [
  {
    placeholder: '{{FACILITY_NAME}}',
    fieldPath: 'facilityBranding.facilityName',
    dataSource: 'project',
    format: 'text',
    required: false,
    description: 'Facility name for header',
  },
  {
    placeholder: '{{FACILITY_CODE}}',
    fieldPath: 'facilityBranding.facilityCode',
    dataSource: 'project',
    format: 'text',
    required: false,
    description: 'Facility code',
  },
  {
    placeholder: '{{FACILITY_ADDRESS}}',
    fieldPath: 'facilityBranding.address',
    dataSource: 'project',
    format: 'text',
    required: false,
    description: 'Facility address',
  },
  {
    placeholder: '{{FACILITY_TELEPHONE}}',
    fieldPath: 'facilityBranding.telephone',
    dataSource: 'project',
    format: 'text',
    required: false,
    description: 'Facility telephone',
  },
  {
    placeholder: '{{FACILITY_EMAIL}}',
    fieldPath: 'facilityBranding.email',
    dataSource: 'project',
    format: 'text',
    required: false,
    description: 'Facility email',
  },
  {
    placeholder: '{{FACILITY_TAGLINE}}',
    fieldPath: 'facilityBranding.tagline',
    dataSource: 'project',
    format: 'text',
    required: false,
    description: 'Facility tagline or mission',
  },
];

// ============================================================================
// REPORT METADATA PLACEHOLDERS
// ============================================================================

export const REPORT_METADATA_PLACEHOLDERS: PlaceholderConfig[] = [
  {
    placeholder: '{{REPORT_PERIOD}}',
    fieldPath: 'reportPeriod.periodLabel',
    dataSource: 'custom',
    format: 'text',
    required: true,
    description: 'Report period label (e.g., January 2026)',
  },
  {
    placeholder: '{{REPORT_START_DATE}}',
    fieldPath: 'reportPeriod.startDate',
    dataSource: 'custom',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    description: 'Report period start date',
  },
  {
    placeholder: '{{REPORT_END_DATE}}',
    fieldPath: 'reportPeriod.endDate',
    dataSource: 'custom',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    description: 'Report period end date',
  },
  {
    placeholder: '{{GENERATION_DATE}}',
    fieldPath: 'generatedAt',
    dataSource: 'custom',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: true,
    description: 'Date report was generated',
  },
  {
    placeholder: '{{PREPARED_BY}}',
    fieldPath: 'preparedByName',
    dataSource: 'custom',
    format: 'text',
    required: true,
    description: 'Name of person who prepared the report',
  },
  {
    placeholder: '{{REPORT_YEAR}}',
    fieldPath: 'reportPeriod.year',
    dataSource: 'custom',
    format: 'number',
    required: false,
    description: 'Report year',
  },
];

// ============================================================================
// COMBINED PLACEHOLDER SETS
// ============================================================================

/**
 * All common placeholders combined
 */
export const ALL_COMMON_PLACEHOLDERS: PlaceholderConfig[] = [
  ...PROJECT_PLACEHOLDERS,
  ...PROGRAM_PLACEHOLDERS,
  ...BUDGET_PLACEHOLDERS,
  ...PROGRESS_PLACEHOLDERS,
  ...BRANDING_PLACEHOLDERS,
  ...REPORT_METADATA_PLACEHOLDERS,
];

/**
 * Placeholders for Monthly Progress Report
 */
export const MONTHLY_PROGRESS_PLACEHOLDERS: PlaceholderConfig[] = [
  ...PROJECT_PLACEHOLDERS,
  ...PROGRAM_PLACEHOLDERS,
  ...BUDGET_PLACEHOLDERS,
  ...PROGRESS_PLACEHOLDERS,
  ...BRANDING_PLACEHOLDERS,
  ...REPORT_METADATA_PLACEHOLDERS,
  // Additional monthly-specific placeholders
  {
    placeholder: '{{ACTIVITIES_THIS_PERIOD}}',
    fieldPath: 'customData.activitiesThisPeriod',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'No activities recorded',
    description: 'Activities completed this reporting period',
  },
  {
    placeholder: '{{ISSUES_AND_RISKS}}',
    fieldPath: 'customData.issuesAndRisks',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'No issues to report',
    description: 'Current issues and risks',
  },
  {
    placeholder: '{{NEXT_PERIOD_PLAN}}',
    fieldPath: 'customData.nextPeriodPlan',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'To be determined',
    description: 'Plan for next reporting period',
  },
];

/**
 * Placeholders for Activity Completion Report
 */
export const ACTIVITY_COMPLETION_PLACEHOLDERS: PlaceholderConfig[] = [
  ...PROJECT_PLACEHOLDERS,
  ...PROGRAM_PLACEHOLDERS,
  ...BRANDING_PLACEHOLDERS,
  ...REPORT_METADATA_PLACEHOLDERS,
  // Activity-specific placeholders
  {
    placeholder: '{{ACTIVITY_NAME}}',
    fieldPath: 'customData.activityName',
    dataSource: 'custom',
    format: 'text',
    required: true,
    description: 'Name of the completed activity',
  },
  {
    placeholder: '{{ACTIVITY_STAGE}}',
    fieldPath: 'customData.activityStage',
    dataSource: 'custom',
    format: 'text',
    required: false,
    description: 'Construction stage of the activity',
  },
  {
    placeholder: '{{ACTIVITY_START_DATE}}',
    fieldPath: 'customData.activityStartDate',
    dataSource: 'custom',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    description: 'Activity start date',
  },
  {
    placeholder: '{{ACTIVITY_END_DATE}}',
    fieldPath: 'customData.activityEndDate',
    dataSource: 'custom',
    format: 'date',
    formatOptions: { dateFormat: 'MMMM d, yyyy' },
    required: false,
    description: 'Activity completion date',
  },
  {
    placeholder: '{{ACTIVITY_EXPENDITURE}}',
    fieldPath: 'customData.activityExpenditure',
    dataSource: 'custom',
    format: 'currency',
    formatOptions: { currency: 'UGX' },
    required: false,
    description: 'Total expenditure for the activity',
  },
  {
    placeholder: '{{BOQ_ITEMS_COMPLETED}}',
    fieldPath: 'customData.boqItemsCompleted',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'See attached BOQ summary',
    description: 'BOQ items completed in this activity',
  },
  {
    placeholder: '{{QUALITY_NOTES}}',
    fieldPath: 'customData.qualityNotes',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'Quality verification pending',
    description: 'Quality verification notes',
  },
  {
    placeholder: '{{PHOTO_REFERENCES}}',
    fieldPath: 'customData.photoReferences',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'See attached photos',
    description: 'References to photo evidence',
  },
  {
    placeholder: '{{ACCOUNTABILITY_STATUS}}',
    fieldPath: 'customData.accountabilityStatus',
    dataSource: 'custom',
    format: 'text',
    required: false,
    defaultValue: 'Pending',
    description: 'Funds accountability status',
  },
];

/**
 * Get placeholders for a specific report type
 */
export function getPlaceholdersForReportType(
  type: string
): PlaceholderConfig[] {
  switch (type) {
    case 'monthly_progress':
      return MONTHLY_PROGRESS_PLACEHOLDERS;
    case 'activity_completion':
      return ACTIVITY_COMPLETION_PLACEHOLDERS;
    case 'quarterly_progress':
      return MONTHLY_PROGRESS_PLACEHOLDERS; // Similar structure
    case 'steering_committee':
      return ALL_COMMON_PLACEHOLDERS;
    default:
      return ALL_COMMON_PLACEHOLDERS;
  }
}
