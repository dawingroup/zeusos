// ============================================================================
// BUDGET TYPES
// ZeusOS v2.0 - Financial Management Module
// Type definitions for Budget Management
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  BudgetType,
  BudgetStatus,
  BudgetPeriod,
  AllocationMethod,
} from '../constants/budget.constants';
import { AccountType, AccountSubType } from '../constants/account.constants';
import { CurrencyCode } from '../constants/currency.constants';

// ----------------------------------------------------------------------------
// BUDGET
// ----------------------------------------------------------------------------

export interface Budget {
  id: string;
  companyId: string;
  
  // Identification
  name: string;
  code: string;              // e.g., 'BUD-2026-OP'
  description?: string;
  
  // Classification
  type: BudgetType;
  
  // Period
  fiscalYear: number;        // e.g., 2026 (FY2026: July 2025 - June 2026)
  periodType: BudgetPeriod;
  startDate: Timestamp;
  endDate: Timestamp;
  
  // Ownership
  departmentId?: string;
  departmentName?: string;
  projectId?: string;
  projectName?: string;
  
  // Currency
  currency: CurrencyCode;
  
  // Totals
  totalBudget: number;
  totalActual: number;
  totalCommitted: number;    // Approved but not yet spent
  totalAvailable: number;    // Budget - Actual - Committed
  
  // Variance
  totalVariance: number;     // Budget - Actual
  variancePercent: number;
  
  // Status
  status: BudgetStatus;
  version: number;           // For tracking revisions
  isLocked: boolean;
  
  // Approval
  approvalLevel?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  approvalNotes?: string;
  
  // Parent budget (for consolidated/master budgets)
  parentBudgetId?: string;
  hasChildren: boolean;
  
  // Metadata
  tags?: string[];
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ----------------------------------------------------------------------------
// BUDGET LINE ITEM
// ----------------------------------------------------------------------------

export interface BudgetLineItem {
  id: string;
  budgetId: string;
  companyId: string;
  
  // Account reference
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  
  // Description
  description?: string;
  notes?: string;
  
  // Annual amounts
  annualBudget: number;
  annualActual: number;
  annualCommitted: number;
  annualAvailable: number;
  annualVariance: number;
  variancePercent: number;
  
  // Period breakdown (12 months for monthly budgets)
  periodAmounts: BudgetPeriodAmount[];
  
  // Allocation
  allocationMethod: AllocationMethod;
  
  // Dimensions
  departmentId?: string;
  projectId?: string;
  costCenterId?: string;
  
  // Source tracking (for forecast / procurement integration)
  sourceType?: 'manual' | 'forecast' | 'procurement';
  sourceForecastId?: string;
  sourcePOId?: string;
  sourceProcurementReqId?: string;

  // Status
  isLocked: boolean;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface BudgetPeriodAmount {
  period: number;            // 1-12 for fiscal months
  fiscalMonth: number;       // 1-12
  calendarMonth: number;     // 1-12
  calendarYear: number;
  
  budgetAmount: number;
  actualAmount: number;
  committedAmount: number;
  availableAmount: number;
  variance: number;
  variancePercent: number;
  
  // Cumulative (YTD)
  ytdBudget: number;
  ytdActual: number;
  ytdVariance: number;
  ytdVariancePercent: number;
}

// ----------------------------------------------------------------------------
// BUDGET INPUT/UPDATE
// ----------------------------------------------------------------------------

export interface BudgetInput {
  name: string;
  code?: string;
  description?: string;
  type: BudgetType;
  fiscalYear: number;
  periodType: BudgetPeriod;
  departmentId?: string;
  projectId?: string;
  currency?: CurrencyCode;
  parentBudgetId?: string;
  tags?: string[];
}

export interface BudgetUpdate {
  name?: string;
  description?: string;
  status?: BudgetStatus;
  tags?: string[];
}

export interface BudgetLineInput {
  accountId: string;
  description?: string;
  notes?: string;
  annualBudget: number;
  allocationMethod: AllocationMethod;
  periodAmounts?: number[];   // Custom amounts for each period
  departmentId?: string;
  projectId?: string;
  costCenterId?: string;
}

export interface BudgetLineUpdate {
  description?: string;
  notes?: string;
  annualBudget?: number;
  allocationMethod?: AllocationMethod;
  periodAmounts?: number[];
}

// ----------------------------------------------------------------------------
// BUDGET REVISION
// ----------------------------------------------------------------------------

export interface BudgetRevision {
  id: string;
  budgetId: string;
  companyId: string;
  
  revisionNumber: number;
  revisionDate: Timestamp;
  reason: string;
  
  // Changes
  previousVersion: number;
  newVersion: number;
  previousTotal: number;
  newTotal: number;
  changeAmount: number;
  
  // Line changes
  lineChanges: BudgetLineChange[];
  
  // Approval
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Timestamp;
  approvalNotes?: string;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
}

export interface BudgetLineChange {
  lineId: string;
  accountCode: string;
  accountName: string;
  previousAmount: number;
  newAmount: number;
  changeAmount: number;
  reason?: string;
}

// ----------------------------------------------------------------------------
// BUDGET VARIANCE
// ----------------------------------------------------------------------------

export type VarianceStatus = 'favorable' | 'minor' | 'moderate' | 'significant' | 'critical';

export interface BudgetVariance {
  budgetId: string;
  budgetName: string;
  fiscalYear: number;
  asOfDate: Date;
  
  // Summary
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  varianceStatus: VarianceStatus;
  
  // By account type
  byAccountType: Record<string, VarianceSummary>;
  
  // By sub-type
  bySubType: Record<string, VarianceSummary>;
  
  // Line details
  lineVariances: LineVariance[];
  
  // Top variances
  topOverBudget: LineVariance[];
  topUnderBudget: LineVariance[];
}

export interface VarianceSummary {
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  lineCount: number;
}

export interface LineVariance {
  lineId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  
  budget: number;
  actual: number;
  committed: number;
  available: number;
  variance: number;
  variancePercent: number;
  
  // Period detail
  currentPeriodBudget: number;
  currentPeriodActual: number;
  currentPeriodVariance: number;
  
  // YTD
  ytdBudget: number;
  ytdActual: number;
  ytdVariance: number;
  
  // Status
  varianceStatus: VarianceStatus;
  
  // Notes
  notes?: string;
}

// ----------------------------------------------------------------------------
// BUDGET FILTERS & QUERIES
// ----------------------------------------------------------------------------

export interface BudgetFilters {
  type?: BudgetType | BudgetType[];
  status?: BudgetStatus | BudgetStatus[];
  fiscalYear?: number;
  departmentId?: string;
  projectId?: string;
  searchTerm?: string;
}

export interface BudgetQueryResult {
  budgets: Budget[];
  total: number;
  totalBudget: number;
  totalActual: number;
}

// ----------------------------------------------------------------------------
// BUDGET FORECAST
// ----------------------------------------------------------------------------

export interface BudgetForecast {
  budgetId: string;
  fiscalYear: number;
  asOfDate: Date;
  
  // YTD
  ytdActual: number;
  ytdBudget: number;
  
  // Remaining
  remainingBudget: number;
  remainingPeriods: number;
  
  // Forecast methods
  linearForecast: number;        // Based on linear projection
  trendForecast: number;         // Based on trend analysis
  seasonalForecast: number;      // Based on seasonal patterns
  
  // Recommended
  recommendedForecast: number;
  forecastConfidence: number;    // 0-100%
  
  // Projected variance
  projectedVariance: number;
  projectedVariancePercent: number;
  
  // Monthly projections
  monthlyProjections: MonthlyProjection[];
}

export interface MonthlyProjection {
  period: number;
  fiscalMonth: number;
  calendarMonth: number;
  calendarYear: number;
  
  isActual: boolean;           // True if period has passed
  actualAmount?: number;
  budgetAmount: number;
  forecastAmount: number;
  
  cumulativeBudget: number;
  cumulativeForecast: number;
}
