/**
 * Report Generation Module - Type Definitions
 * Darwin Advisory Infrastructure Delivery
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// REPORT TYPE ENUMS
// ============================================================================

/**
 * Types of reports available for generation
 */
export type ReportType =
  | 'monthly_progress'
  | 'quarterly_progress'
  | 'steering_committee'
  | 'activity_completion'
  | 'variance_report'
  | 'reconciliation_report'
  | 'custom';

/**
 * Report period types
 */
export type ReportPeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';

/**
 * Report status
 */
export type ReportStatus = 'generating' | 'draft' | 'final' | 'error';

/**
 * Data source types for placeholder population
 */
export type DataSourceType =
  | 'project'
  | 'program'
  | 'budget'
  | 'progress'
  | 'variance'
  | 'reconciliation'
  | 'custom';

/**
 * Value format types for placeholders
 */
export type PlaceholderFormat =
  | 'text'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'number'
  | 'list';

// ============================================================================
// REPORT PERIOD
// ============================================================================

/**
 * Report period configuration
 */
export interface ReportPeriod {
  type: ReportPeriodType;
  startDate: Date;
  endDate: Date;
  periodLabel: string; // e.g., "January 2026", "Q1 2026"
  year: number;
  month?: number; // 1-12 for monthly reports
  quarter?: number; // 1-4 for quarterly reports
}

// ============================================================================
// PLACEHOLDER CONFIGURATION
// ============================================================================

/**
 * Format options for placeholder values
 */
export interface PlaceholderFormatOptions {
  currency?: 'UGX' | 'USD' | 'EUR';
  dateFormat?: string; // e.g., "MMMM d, yyyy"
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
}

/**
 * Placeholder configuration for template population
 */
export interface PlaceholderConfig {
  placeholder: string; // e.g., "{{PROJECT_NAME}}"
  fieldPath: string; // e.g., "project.name"
  dataSource: DataSourceType;
  format: PlaceholderFormat;
  formatOptions?: PlaceholderFormatOptions;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

// ============================================================================
// DATA SOURCE CONFIGURATION
// ============================================================================

/**
 * Data source configuration for fetching report data
 */
export interface DataSourceConfig {
  source: DataSourceType;
  service: 'project' | 'program' | 'variance' | 'reconciliation' | 'boq' | 'accountability';
  method: string;
  parameters?: Record<string, unknown>;
}

// ============================================================================
// REPORT TEMPLATE
// ============================================================================

/**
 * Report template configuration stored in Firestore
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: ReportType;

  // Google Docs template reference
  googleDocTemplateId: string;
  googleDocTemplateUrl?: string;

  // Placeholder configuration
  placeholders: PlaceholderConfig[];

  // Data sources needed for this template
  dataSources: DataSourceConfig[];

  // Settings
  defaultPeriodType: ReportPeriodType;
  autoPopulateFields: string[];

  // Folder structure for saving generated reports
  folderPath: string; // e.g., "Reports/{Year}/{ReportType}"
  fileNamingPattern: string; // e.g., "{ProjectCode}-{ReportType}-{Period}"

  // Branding options
  includeFacilityBranding: boolean;
  includeClientLogo: boolean;
  includeDonorLogo: boolean;

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Template creation input (without auto-generated fields)
 */
export type ReportTemplateInput = Omit<
  ReportTemplate,
  'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
>;

// ============================================================================
// GENERATED REPORT
// ============================================================================

/**
 * Generated report metadata stored in Firestore
 */
export interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  reportType: ReportType;

  // Context
  projectId: string;
  projectCode: string;
  projectName: string;
  programId?: string;
  programName?: string;

  // Google Docs references
  googleDocId: string;
  googleDocUrl: string;
  googleDriveFolderId: string;

  // Period
  reportPeriod: ReportPeriod;

  // Status
  status: ReportStatus;
  errorMessage?: string;

  // Audit
  generatedAt: Timestamp;
  generatedBy: string;
  generatedByName?: string;
  lastModifiedAt?: Timestamp;
}

// ============================================================================
// REPORT GENERATION REQUEST/RESPONSE
// ============================================================================

/**
 * Report generation request
 */
export interface ReportGenerationRequest {
  templateId: string;
  projectId: string;
  reportPeriod: ReportPeriod;
  customData?: Record<string, unknown>;
  saveToFolder?: boolean; // Default true
  folderId?: string; // Override default folder
}

/**
 * Report generation result
 */
export interface ReportGenerationResult {
  success: boolean;
  reportId?: string;
  googleDocId?: string;
  googleDocUrl?: string;
  error?: string;
}

// ============================================================================
// REPORT DATA CONTEXT
// ============================================================================

/**
 * Project context for report population
 */
export interface ProjectContext {
  id: string;
  name: string;
  projectCode: string;
  status: string;
  description?: string;
  /** Google Drive folder ID for project documents (used to anchor sub-folder creation) */
  driveFolderId?: string;
  location: {
    siteName: string;
    address?: string;
    district?: string;
    region?: string;
    country?: string;
  };
  timeline: {
    startDate?: Date;
    endDate?: Date;
    actualStartDate?: Date;
    percentTimeElapsed?: number;
  };
  createdAt: Date;
}

/**
 * Program context for report population
 */
export interface ProgramContext {
  id: string;
  name: string;
  code: string;
  description?: string;
  sectors?: string[];
}

/**
 * Budget summary for report population
 */
export interface BudgetSummary {
  currency: 'UGX' | 'USD';
  totalBudget: number;
  spent: number;
  committed: number;
  remaining: number;
  variance: number;
  variancePercentage: number;
  varianceStatus: 'on_track' | 'over' | 'under';
}

/**
 * Progress summary for report population
 */
export interface ProgressSummary {
  physicalProgress: number;
  financialProgress: number;
  completionPercent: number;
  timeElapsedPercent: number;
  scheduleVarianceDays?: number;
  scheduleStatus: 'on_schedule' | 'ahead' | 'behind';
}

/**
 * Facility branding for report headers
 */
export interface FacilityBrandingContext {
  facilityName: string;
  facilityCode?: string;
  address?: string;
  telephone?: string;
  email?: string;
  tagline?: string;
  clientLogoUrl?: string;
  donorLogoUrl?: string;
}

/**
 * Aggregated report data context
 */
export interface ReportDataContext {
  project: ProjectContext;
  program?: ProgramContext;
  budget: BudgetSummary;
  progress: ProgressSummary;
  facilityBranding?: FacilityBrandingContext;
  reportPeriod: ReportPeriod;
  generatedAt: Date;
  preparedByName: string;
  customData?: Record<string, unknown>;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validation result for templates
 */
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingPlaceholders: string[];
}

// ============================================================================
// HISTORY QUERY OPTIONS
// ============================================================================

/**
 * Options for querying report history
 */
export interface ReportHistoryOptions {
  limit?: number;
  reportType?: ReportType;
  startDate?: Date;
  endDate?: Date;
  status?: ReportStatus;
}
