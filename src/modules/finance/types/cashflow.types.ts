// ============================================================================
// CASH FLOW TYPES
// DawinOS v2.0 - Financial Management Module
// TypeScript interfaces for Cash Flow Analysis
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  CashFlowCategory,
  CashFlowActivity,
  ForecastHorizon,
  ReconciliationStatus,
  PaymentMethod,
} from '../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// CASH TRANSACTION
// ----------------------------------------------------------------------------

export interface CashTransaction {
  id: string;
  companyId: string;
  
  // Transaction details
  date: Date;
  description: string;
  reference?: string;
  
  // Amount
  amount: number;
  currency: string;
  type: 'inflow' | 'outflow';
  
  // Classification
  category: CashFlowCategory;
  activity: CashFlowActivity;
  
  // Account references
  cashAccountId: string;
  cashAccountName: string;
  offsetAccountId?: string;
  offsetAccountName?: string;
  
  // Payment details
  paymentMethod: PaymentMethod;
  bankReference?: string;
  chequeNumber?: string;
  mobileMoneyRef?: string;
  
  // Entity references
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  employeeId?: string;
  employeeName?: string;
  
  // Project/department
  departmentId?: string;
  projectId?: string;
  
  // Related documents
  invoiceId?: string;
  billId?: string;
  journalEntryId?: string;
  
  // Reconciliation
  isReconciled: boolean;
  reconciliationId?: string;
  reconciliationDate?: Date;
  
  // Metadata
  tags?: string[];
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CashTransactionInput {
  date: Date;
  description: string;
  reference?: string;
  amount: number;
  currency?: string;
  category: CashFlowCategory;
  cashAccountId: string;
  offsetAccountId?: string;
  paymentMethod: PaymentMethod;
  bankReference?: string;
  chequeNumber?: string;
  mobileMoneyRef?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  employeeId?: string;
  employeeName?: string;
  departmentId?: string;
  projectId?: string;
  invoiceId?: string;
  billId?: string;
  tags?: string[];
  notes?: string;
}

// ----------------------------------------------------------------------------
// CASH ACCOUNT
// ----------------------------------------------------------------------------

export interface CashAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'cash' | 'bank' | 'mobile_money';
  bankName?: string;
  accountNumber?: string;
  currentBalance: number;
  currency: string;
  lastReconciled?: Date;
  isActive: boolean;
}

// ----------------------------------------------------------------------------
// CASH POSITION
// ----------------------------------------------------------------------------

export interface CashPosition {
  asOfDate: Date;
  totalCash: number;
  currency: string;
  
  // Breakdown by account type
  cashOnHand: number;
  bankBalances: number;
  mobileMoneyBalances: number;
  
  // By account
  accounts: CashAccount[];
  
  // Operating metrics
  dailyAverageExpenses: number;
  daysOfCashOnHand: number;
  cashCoverageStatus: 'critical' | 'warning' | 'healthy' | 'excess';
  
  // Period changes
  periodInflows: number;
  periodOutflows: number;
  netCashFlow: number;
  
  // Comparison
  priorPeriodBalance?: number;
  changeFromPrior?: number;
  changePercent?: number;
}

// ----------------------------------------------------------------------------
// CASH FLOW SUMMARY
// ----------------------------------------------------------------------------

export interface CashFlowSummary {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  
  // Opening/Closing
  openingBalance: number;
  closingBalance: number;
  netChange: number;
  
  // By activity
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  
  // By category
  categoryBreakdown: Array<{
    category: CashFlowCategory;
    label: string;
    inflows: number;
    outflows: number;
    net: number;
    transactionCount: number;
  }>;
  
  // Top transactions
  largestInflows: CashTransaction[];
  largestOutflows: CashTransaction[];
  
  currency: string;
}

// ----------------------------------------------------------------------------
// CASH FORECAST
// ----------------------------------------------------------------------------

export interface CashForecast {
  id: string;
  companyId: string;
  
  // Forecast settings
  name: string;
  description?: string;
  horizon: ForecastHorizon;
  startDate: Date;
  endDate: Date;
  
  // Base position
  openingCashBalance: number;
  currency: string;
  
  // Forecast periods
  periods: CashForecastPeriod[];
  
  // Assumptions
  assumptions: ForecastAssumptions;
  
  // Results
  minimumCashBalance: number;
  minimumBalanceDate: Date;
  maximumCashBalance: number;
  maximumBalanceDate: Date;
  averageCashBalance: number;
  
  // Cash gap analysis
  cashGapPeriods: Array<{
    periodIndex: number;
    periodLabel: string;
    shortfall: number;
    date: Date;
  }>;
  
  // Status
  status: 'draft' | 'active' | 'archived';
  
  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CashForecastPeriod {
  periodIndex: number;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  
  // Opening/Closing
  openingBalance: number;
  closingBalance: number;
  
  // Inflows by category
  inflows: Array<{
    category: CashFlowCategory;
    label: string;
    amount: number;
    isRecurring: boolean;
    source?: string;
  }>;
  totalInflows: number;
  
  // Outflows by category
  outflows: Array<{
    category: CashFlowCategory;
    label: string;
    amount: number;
    isRecurring: boolean;
    dueDate?: Date;
  }>;
  totalOutflows: number;
  
  // Net cash flow
  netCashFlow: number;
  
  // Variance (if actuals available)
  actualInflows?: number;
  actualOutflows?: number;
  actualClosingBalance?: number;
  varianceAmount?: number;
  variancePercent?: number;
}

export interface ForecastAssumptions {
  // Revenue assumptions
  salesGrowthRate: number;
  collectionDays: number;
  
  // Expense assumptions
  expenseGrowthRate: number;
  paymentDays: number;
  
  // Fixed costs
  fixedMonthlyCosts: Array<{
    category: CashFlowCategory;
    description: string;
    amount: number;
    dueDay?: number;
  }>;
  
  // Seasonal adjustments
  seasonalFactors?: Record<number, number>; // month -> factor
  
  // One-time items
  oneTimeItems: Array<{
    category: CashFlowCategory;
    description: string;
    amount: number;
    periodIndex: number;
    isInflow: boolean;
  }>;
}

export interface ForecastInput {
  name: string;
  description?: string;
  horizon: ForecastHorizon;
  startDate: Date;
  openingCashBalance: number;
  assumptions: ForecastAssumptions;
}

// ----------------------------------------------------------------------------
// BANK RECONCILIATION
// ----------------------------------------------------------------------------

export interface BankReconciliation {
  id: string;
  companyId: string;
  
  // Account info
  bankAccountId: string;
  bankAccountName: string;
  bankName?: string;
  
  // Period
  periodStart: Date;
  periodEnd: Date;
  statementDate: Date;
  
  // Statement balances
  statementOpeningBalance: number;
  statementClosingBalance: number;
  
  // Book balances
  bookOpeningBalance: number;
  bookClosingBalance: number;
  
  // Adjustments
  adjustedBankBalance: number;
  adjustedBookBalance: number;
  
  // Reconciliation result
  difference: number;
  isReconciled: boolean;
  
  // Items
  reconciledItems: ReconciledItem[];
  outstandingItems: OutstandingItem[];
  adjustments: ReconciliationAdjustment[];
  
  // Status
  status: ReconciliationStatus;
  
  // Metadata
  currency: string;
  createdBy: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  completedBy?: string;
  notes?: string;
}

export interface ReconciledItem {
  transactionId: string;
  date: Date;
  description: string;
  reference?: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  matchedBankReference?: string;
  matchedAt: Timestamp;
}

export interface OutstandingItem {
  id: string;
  type: 'outstanding_deposit' | 'outstanding_cheque' | 'unrecorded_charge' | 'unrecorded_credit';
  date: Date;
  description: string;
  reference?: string;
  amount: number;
  transactionId?: string;
  expectedClearDate?: Date;
  notes?: string;
}

export interface ReconciliationAdjustment {
  id: string;
  type: 'bank_error' | 'book_error' | 'timing_difference' | 'other';
  description: string;
  amount: number;
  affectsBank: boolean;
  affectsBook: boolean;
  journalEntryId?: string;
  notes?: string;
}

export interface ReconciliationInput {
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  statementDate: Date;
  statementOpeningBalance: number;
  statementClosingBalance: number;
}

// ----------------------------------------------------------------------------
// FILTER INTERFACES
// ----------------------------------------------------------------------------

export interface CashFlowFilters {
  startDate?: Date;
  endDate?: Date;
  type?: 'inflow' | 'outflow';
  category?: CashFlowCategory;
  activity?: CashFlowActivity;
  cashAccountId?: string;
  paymentMethod?: PaymentMethod;
  isReconciled?: boolean;
  searchTerm?: string;
  departmentId?: string;
  projectId?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ForecastFilters {
  horizon?: ForecastHorizon;
  status?: 'draft' | 'active' | 'archived';
  startDateFrom?: Date;
  startDateTo?: Date;
}

// ----------------------------------------------------------------------------
// TREND & ANALYSIS
// ----------------------------------------------------------------------------

export interface CashFlowTrend {
  period: string;
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  closingBalance: number;
  inflows: number;
  outflows: number;
  netCashFlow: number;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
}

export interface CashFlowAnalysis {
  // Operating efficiency
  operatingCashFlowRatio: number;
  cashConversionCycle: number;
  
  // Liquidity metrics
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  
  // Coverage metrics
  debtCoverageRatio: number;
  interestCoverageRatio: number;
  
  // Burn rate analysis
  averageMonthlyBurn: number;
  runwayMonths: number;
  
  // Variance analysis
  budgetVariance: number;
  priorPeriodVariance: number;
}

// ----------------------------------------------------------------------------
// FORECAST PARAMETERS
// ----------------------------------------------------------------------------

export interface ForecastParameters {
  horizon: ForecastHorizon;
  startDate: Date;
  openingBalance: number;
  
  // Growth assumptions
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  
  // Collection/Payment assumptions
  daysReceivable: number;
  daysPayable: number;
  
  // Fixed items
  recurringInflows: Array<{
    category: CashFlowCategory;
    amount: number;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    description: string;
  }>;
  
  recurringOutflows: Array<{
    category: CashFlowCategory;
    amount: number;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    description: string;
    dueDay?: number;
  }>;
  
  // One-time items
  plannedInflows: Array<{
    category: CashFlowCategory;
    amount: number;
    date: Date;
    description: string;
    probability?: number;
  }>;
  
  plannedOutflows: Array<{
    category: CashFlowCategory;
    amount: number;
    date: Date;
    description: string;
    isCommitted: boolean;
  }>;
}
