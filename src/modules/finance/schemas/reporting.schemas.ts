// ============================================================================
// REPORTING SCHEMAS
// DawinOS v2.0 - Financial Management Module
// Zod validation schemas for Financial Reporting
// ============================================================================

import { z } from 'zod';
import { REPORT_TYPES, REPORT_PERIODS, COMPARISON_TYPES, EXPORT_FORMATS } from '../constants/reporting.constants';

// ----------------------------------------------------------------------------
// REPORT PARAMETERS SCHEMA
// ----------------------------------------------------------------------------

export const reportParametersSchema = z.object({
  reportType: z.enum([
    REPORT_TYPES.INCOME_STATEMENT,
    REPORT_TYPES.BALANCE_SHEET,
    REPORT_TYPES.CASH_FLOW_STATEMENT,
    REPORT_TYPES.TRIAL_BALANCE,
    REPORT_TYPES.GENERAL_LEDGER,
    REPORT_TYPES.BUDGET_VARIANCE,
    REPORT_TYPES.DEPARTMENTAL_PL,
    REPORT_TYPES.PROJECT_PROFITABILITY,
    REPORT_TYPES.AGED_RECEIVABLES,
    REPORT_TYPES.AGED_PAYABLES,
    REPORT_TYPES.VAT_RETURN,
    REPORT_TYPES.WHT_REPORT,
    REPORT_TYPES.PAYE_RETURN,
    REPORT_TYPES.NSSF_RETURN,
    REPORT_TYPES.LST_RETURN,
  ]),
  
  companyId: z.string().min(1, 'Company ID is required'),
  
  // Period settings
  periodType: z.enum([
    REPORT_PERIODS.MONTHLY,
    REPORT_PERIODS.QUARTERLY,
    REPORT_PERIODS.SEMI_ANNUAL,
    REPORT_PERIODS.ANNUAL,
    REPORT_PERIODS.YTD,
    REPORT_PERIODS.CUSTOM,
  ]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  fiscalYear: z.number().int().min(2020).max(2100).optional(),
  
  // Comparison settings
  comparisonType: z.enum([
    COMPARISON_TYPES.NONE,
    COMPARISON_TYPES.PRIOR_PERIOD,
    COMPARISON_TYPES.PRIOR_YEAR,
    COMPARISON_TYPES.BUDGET,
    COMPARISON_TYPES.FORECAST,
  ]).optional(),
  comparisonStartDate: z.coerce.date().optional(),
  comparisonEndDate: z.coerce.date().optional(),
  budgetId: z.string().optional(),
  
  // Filters
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  costCenterId: z.string().optional(),
  subsidiaryId: z.string().optional(),
  
  // Display options
  showZeroBalances: z.boolean().default(false),
  showAccountCodes: z.boolean().default(true),
  showSubtotals: z.boolean().default(true),
  consolidate: z.boolean().default(false),
  
  // Currency
  currency: z.string().length(3).default('UGX'),
  exchangeRate: z.number().positive().optional(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
).refine(
  (data) => {
    if (data.comparisonType && data.comparisonType !== 'none') {
      if (data.comparisonType === 'budget') {
        return !!data.budgetId;
      }
      return !!data.comparisonStartDate && !!data.comparisonEndDate;
    }
    return true;
  },
  { message: 'Comparison period or budget must be specified', path: ['comparisonType'] }
);

export type ReportParametersInput = z.infer<typeof reportParametersSchema>;

// ----------------------------------------------------------------------------
// REPORT FILTER SCHEMA
// ----------------------------------------------------------------------------

export const reportFilterSchema = z.object({
  reportType: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional(),
  category: z.string().optional(),
  fiscalYear: z.number().int().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(['draft', 'final', 'archived']).optional(),
  createdBy: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

// ----------------------------------------------------------------------------
// EXPORT SCHEMA
// ----------------------------------------------------------------------------

export const reportExportSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  format: z.enum([
    EXPORT_FORMATS.PDF,
    EXPORT_FORMATS.EXCEL,
    EXPORT_FORMATS.CSV,
  ]),
  options: z.object({
    includeHeader: z.boolean().default(true),
    includeFooter: z.boolean().default(true),
    includeLogo: z.boolean().default(true),
    pageOrientation: z.enum(['portrait', 'landscape']).default('portrait'),
    paperSize: z.enum(['A4', 'Letter']).default('A4'),
  }).optional(),
});

export type ReportExportInput = z.infer<typeof reportExportSchema>;

// ----------------------------------------------------------------------------
// TEMPLATE SCHEMA
// ----------------------------------------------------------------------------

export const reportTemplateSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  description: z.string().max(500).optional(),
  reportType: z.string(),
  
  defaultParameters: z.record(z.string(), z.unknown()).optional(),
  
  customSections: z.array(z.object({
    sectionKey: z.string(),
    include: z.boolean(),
    customLabel: z.string().optional(),
    customAccounts: z.array(z.string()).optional(),
  })).optional(),
  
  headerText: z.string().max(200).optional(),
  footerText: z.string().max(200).optional(),
  showLogo: z.boolean().default(true),
  
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
});

export type ReportTemplateInput = z.infer<typeof reportTemplateSchema>;

// ----------------------------------------------------------------------------
// VAT RETURN SCHEMA (Uganda-specific)
// ----------------------------------------------------------------------------

export const vatReturnSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  
  standardRatedSales: z.number().min(0),
  zeroRatedSales: z.number().min(0).default(0),
  exemptSales: z.number().min(0).default(0),
  
  standardRatedPurchases: z.number().min(0),
  capitalPurchases: z.number().min(0).default(0),
  exemptPurchases: z.number().min(0).default(0),
});

export type VATReturnInput = z.infer<typeof vatReturnSchema>;

// ----------------------------------------------------------------------------
// WHT TRANSACTION SCHEMA
// ----------------------------------------------------------------------------

export const whtTransactionSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  vendorTIN: z.string().min(10, 'Invalid TIN format'),
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.coerce.date(),
  grossAmount: z.number().positive('Amount must be positive'),
  whtType: z.enum(['services', 'goods', 'professional', 'commission', 'rent']),
});

export type WHTTransactionInput = z.infer<typeof whtTransactionSchema>;
