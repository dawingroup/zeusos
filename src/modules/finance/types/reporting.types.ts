// ============================================================================
// REPORTING TYPES
// DawinOS v2.0 - Financial Management Module
// TypeScript interfaces for Financial Reporting
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  ReportType,
  ReportPeriod,
  ComparisonType,
  ExportFormat,
  ReportCategory,
  ReportStatus,
} from '../constants/reporting.constants';
import { AccountType, AccountSubType } from '../constants/account.constants';

// ----------------------------------------------------------------------------
// REPORT PARAMETERS
// ----------------------------------------------------------------------------

export interface ReportParameters {
  reportType: ReportType;
  companyId: string;
  
  // Period settings
  periodType: ReportPeriod;
  startDate: Date;
  endDate: Date;
  fiscalYear?: number;
  
  // Comparison settings
  comparisonType?: ComparisonType;
  comparisonStartDate?: Date;
  comparisonEndDate?: Date;
  budgetId?: string;
  
  // Filters
  departmentId?: string;
  projectId?: string;
  costCenterId?: string;
  subsidiaryId?: string;
  
  // Display options
  showZeroBalances?: boolean;
  showAccountCodes?: boolean;
  showSubtotals?: boolean;
  consolidate?: boolean;
  
  // Currency
  currency?: string;
  exchangeRate?: number;
}

export interface ReportFilters {
  reportType?: ReportType | ReportType[];
  category?: ReportCategory;
  fiscalYear?: number;
  departmentId?: string;
  projectId?: string;
  status?: ReportStatus;
  createdBy?: string;
  fromDate?: Date;
  toDate?: Date;
}

// ----------------------------------------------------------------------------
// REPORT LINE ITEMS
// ----------------------------------------------------------------------------

export interface ReportLineItem {
  id: string;
  accountId?: string;
  accountCode?: string;
  accountName: string;
  accountType?: AccountType;
  accountCategory?: AccountSubType;
  
  level: number;
  isHeader: boolean;
  isTotal: boolean;
  isCalculated: boolean;
  
  currentAmount: number;
  comparisonAmount?: number;
  variance?: number;
  variancePercent?: number;
  
  budgetAmount?: number;
  budgetVariance?: number;
  budgetVariancePercent?: number;
  
  periodAmounts?: {
    period: string;
    amount: number;
    comparison?: number;
  }[];
  
  children?: ReportLineItem[];
  
  notes?: string;
}

// ----------------------------------------------------------------------------
// REPORT SECTIONS
// ----------------------------------------------------------------------------

export interface ReportSection {
  key: string;
  label: string;
  lines: ReportLineItem[];
  total: number;
  comparisonTotal?: number;
  variance?: number;
  variancePercent?: number;
}

export interface ReportTotal {
  key: string;
  label: string;
  amount: number;
  comparisonAmount?: number;
  variance?: number;
  variancePercent?: number;
  isCalculated: boolean;
}

// ----------------------------------------------------------------------------
// ACCOUNT BALANCE (for report generation)
// ----------------------------------------------------------------------------

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountCategory: AccountSubType;
  balance: number;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceData {
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

// ----------------------------------------------------------------------------
// FINANCIAL STATEMENTS
// ----------------------------------------------------------------------------

export interface IncomeStatement {
  id: string;
  companyId: string;
  reportType: 'income_statement';
  
  // Period
  startDate: Date;
  endDate: Date;
  fiscalYear: number;
  periodLabel: string;
  
  // Sections
  revenue: ReportSection;
  costOfSales: ReportSection;
  grossProfit: ReportTotal;
  operatingExpenses: ReportSection;
  operatingProfit: ReportTotal;
  otherIncome: ReportSection;
  otherExpenses: ReportSection;
  profitBeforeTax: ReportTotal;
  taxExpense: ReportSection;
  netProfit: ReportTotal;
  
  // Comparison
  comparison?: {
    type: ComparisonType;
    periodLabel: string;
    revenue: number;
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
  };
  
  // Metrics
  grossProfitMargin: number;
  operatingProfitMargin: number;
  netProfitMargin: number;
  
  // Metadata
  currency: string;
  generatedAt: Timestamp;
  generatedBy: string;
  status: ReportStatus;
}

export interface BalanceSheet {
  id: string;
  companyId: string;
  reportType: 'balance_sheet';
  
  // As of date
  asOfDate: Date;
  fiscalYear: number;
  
  // Assets
  currentAssets: ReportSection;
  nonCurrentAssets: ReportSection;
  totalAssets: ReportTotal;
  
  // Liabilities
  currentLiabilities: ReportSection;
  nonCurrentLiabilities: ReportSection;
  totalLiabilities: ReportTotal;
  
  // Equity
  shareCapital: ReportSection;
  retainedEarnings: ReportSection;
  reserves: ReportSection;
  totalEquity: ReportTotal;
  
  totalLiabilitiesEquity: ReportTotal;
  
  // Validation
  isBalanced: boolean;
  difference: number;
  
  // Comparison
  comparison?: {
    type: ComparisonType;
    asOfDate: Date;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  
  // Metrics
  currentRatio: number;
  quickRatio: number;
  debtToEquityRatio: number;
  
  // Metadata
  currency: string;
  generatedAt: Timestamp;
  generatedBy: string;
  status: ReportStatus;
}

export interface CashFlowStatement {
  id: string;
  companyId: string;
  reportType: 'cash_flow_statement';
  
  // Period
  startDate: Date;
  endDate: Date;
  fiscalYear: number;
  
  // Operating Activities
  netIncome: number;
  adjustments: ReportSection;
  workingCapitalChanges: ReportSection;
  operatingCashFlow: ReportTotal;
  
  // Investing Activities
  investingActivities: ReportSection;
  investingCashFlow: ReportTotal;
  
  // Financing Activities
  financingActivities: ReportSection;
  financingCashFlow: ReportTotal;
  
  // Summary
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
  
  // Validation
  isReconciled: boolean;
  reconciliationDifference: number;
  
  // Metadata
  currency: string;
  generatedAt: Timestamp;
  generatedBy: string;
  status: ReportStatus;
}

export interface TrialBalance {
  id: string;
  companyId: string;
  reportType: 'trial_balance';
  
  asOfDate: Date;
  fiscalYear: number;
  
  lines: TrialBalanceLine[];
  
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
  
  // Metadata
  currency: string;
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountCategory: AccountSubType;
  
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

// ----------------------------------------------------------------------------
// TAX REPORTS (Uganda-specific)
// ----------------------------------------------------------------------------

export interface VATReturn {
  id: string;
  companyId: string;
  reportType: 'vat_return';
  
  // Period
  periodStart: Date;
  periodEnd: Date;
  filingDeadline: Date;
  
  // Output VAT (Sales)
  standardRatedSales: number;
  zeroRatedSales: number;
  exemptSales: number;
  totalSales: number;
  outputVAT: number;
  
  // Input VAT (Purchases)
  standardRatedPurchases: number;
  capitalPurchases: number;
  exemptPurchases: number;
  totalPurchases: number;
  inputVAT: number;
  
  // Net VAT
  netVATPayable: number;
  
  // Status
  status: 'draft' | 'submitted' | 'assessed' | 'paid';
  submittedAt?: Timestamp;
  uraReferenceNo?: string;
  
  // Metadata
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface WHTReport {
  id: string;
  companyId: string;
  reportType: 'wht_report';
  
  periodStart: Date;
  periodEnd: Date;
  
  transactions: WHTTransaction[];
  
  totalServices: number;
  totalGoods: number;
  totalProfessional: number;
  totalWHTDeducted: number;
  
  status: 'draft' | 'submitted' | 'remitted';
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface WHTTransaction {
  vendorName: string;
  vendorTIN: string;
  invoiceNo: string;
  invoiceDate: Date;
  grossAmount: number;
  whtType: 'services' | 'goods' | 'professional' | 'commission' | 'rent';
  whtRate: number;
  whtAmount: number;
}

export interface PAYEReturn {
  id: string;
  companyId: string;
  reportType: 'paye_return';
  
  periodStart: Date;
  periodEnd: Date;
  
  employees: PAYEEmployee[];
  
  totalGrossPayroll: number;
  totalTaxablePay: number;
  totalPAYE: number;
  totalNSSFEmployee: number;
  totalNSSFEmployer: number;
  totalLST: number;
  
  status: 'draft' | 'submitted' | 'remitted';
  generatedAt: Timestamp;
  generatedBy: string;
}

export interface PAYEEmployee {
  employeeId: string;
  employeeName: string;
  tin: string;
  nssf: string;
  
  grossPay: number;
  allowances: number;
  deductions: number;
  taxablePay: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  lst: number;
  netPay: number;
}

// ----------------------------------------------------------------------------
// REPORT GENERATION
// ----------------------------------------------------------------------------

export interface GeneratedReport {
  id: string;
  companyId: string;
  reportType: ReportType;
  
  title: string;
  description?: string;
  
  parameters: ReportParameters;
  
  // The actual report data (varies by type)
  data: IncomeStatement | BalanceSheet | CashFlowStatement | TrialBalance | VATReturn | WHTReport | PAYEReturn;
  
  // Export info
  exportFormats: ExportFormat[];
  lastExportedAt?: Timestamp;
  lastExportedFormat?: ExportFormat;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  status: ReportStatus;
  
  // Scheduling
  isScheduled?: boolean;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  nextScheduledRun?: Date;
}

// ----------------------------------------------------------------------------
// REPORT TEMPLATES
// ----------------------------------------------------------------------------

export interface ReportTemplate {
  id: string;
  companyId: string;
  
  name: string;
  description?: string;
  reportType: ReportType;
  
  // Default parameters
  defaultParameters: Partial<ReportParameters>;
  
  // Customization
  customSections?: {
    sectionKey: string;
    include: boolean;
    customLabel?: string;
    customAccounts?: string[];
  }[];
  
  // Branding
  headerText?: string;
  footerText?: string;
  showLogo?: boolean;
  
  // Access
  isDefault?: boolean;
  isShared?: boolean;
  
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}
