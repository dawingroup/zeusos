// ============================================================================
// FINANCE MODULE INDEX
// DawinOS v2.0 - Financial Management Module
// Comprehensive Chart of Accounts & General Ledger System
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

// Account Constants
export {
  ACCOUNT_TYPES,
  ACCOUNT_SUB_TYPES,
  ACCOUNT_TYPE_SUB_TYPES,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_SUB_TYPE_LABELS,
  NORMAL_BALANCE,
  ACCOUNT_STATUS,
  ACCOUNT_CODE_RANGES,
  ACCOUNT_CODE_FORMAT,
  ACCOUNT_LEVELS,
  ACCOUNT_LEVEL_LABELS,
  SYSTEM_ACCOUNTS,
  ACCOUNT_TYPE_COLORS,
  ACCOUNT_TYPE_ICONS,
} from './constants/account.constants';

export type {
  AccountType,
  AccountSubType,
  AccountStatus,
  AccountLevel,
} from './constants/account.constants';

// Budget Constants
export {
  BUDGET_TYPES,
  BUDGET_STATUSES,
  BUDGET_PERIODS,
  VARIANCE_THRESHOLDS,
  ALLOCATION_METHODS,
  BUDGET_APPROVAL_THRESHOLDS,
  FISCAL_MONTHS,
  BUDGET_TYPE_LABELS,
  BUDGET_TYPE_DESCRIPTIONS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_COLORS,
  BUDGET_PERIOD_LABELS,
  BUDGET_PERIOD_MONTHS,
  VARIANCE_THRESHOLD_LABELS,
  VARIANCE_THRESHOLD_COLORS,
  ALLOCATION_METHOD_LABELS,
  APPROVAL_LEVEL_LABELS,
  BUDGETS_COLLECTION,
  BUDGET_LINES_COLLECTION,
  BUDGET_REVISIONS_COLLECTION,
  BUDGET_APPROVALS_COLLECTION,
  getFiscalMonth,
  getFiscalQuarter,
  getFiscalYear,
} from './constants/budget.constants';

export type {
  BudgetType,
  BudgetStatus,
  BudgetPeriod,
  AllocationMethod,
} from './constants/budget.constants';

// Currency Constants
export {
  CURRENCIES,
  CURRENCY_CONFIG,
  DEFAULT_CURRENCY,
  FUNCTIONAL_CURRENCY,
  EXCHANGE_RATE_TYPES,
  EXCHANGE_RATE_SOURCES,
  formatCurrency,
  parseCurrency,
  convertCurrency,
} from './constants/currency.constants';

export type {
  CurrencyCode,
  CurrencyConfig,
  ExchangeRateType,
  ExchangeRateSource,
} from './constants/currency.constants';

export { CURRENCY_LABELS } from './constants/currency.constants';

// Reporting Constants
export {
  REPORT_TYPES,
  REPORT_CATEGORIES,
  REPORT_PERIODS,
  COMPARISON_TYPES,
  EXPORT_FORMATS,
  REPORT_STATUS,
  REPORTS_BY_CATEGORY,
  REPORT_TYPE_LABELS,
  REPORT_CATEGORY_LABELS,
  REPORT_PERIOD_LABELS,
  COMPARISON_TYPE_LABELS,
  EXPORT_FORMAT_LABELS,
  REPORTS_COLLECTION,
  URA_TAX_CONFIG,
  getFiscalYear as getReportFiscalYear,
  getFiscalYearDates,
} from './constants/reporting.constants';

export type {
  ReportType,
  ReportCategory,
  ReportPeriod,
  ComparisonType,
  ExportFormat,
  ReportStatus,
} from './constants/reporting.constants';

// Cash Flow Constants
export {
  CASH_FLOW_CATEGORIES,
  CASH_FLOW_CATEGORY_LABELS,
  CASH_INFLOW_CATEGORIES,
  CASH_OUTFLOW_CATEGORIES,
  CASH_FLOW_ACTIVITIES,
  CASH_FLOW_ACTIVITY_LABELS,
  CATEGORY_TO_ACTIVITY,
  FORECAST_HORIZONS,
  FORECAST_HORIZON_LABELS,
  FORECAST_PERIODS,
  CASH_POSITION_THRESHOLDS,
  RECONCILIATION_STATUS,
  RECONCILIATION_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  CASH_TRANSACTIONS_COLLECTION,
  CASH_FORECASTS_COLLECTION,
  BANK_RECONCILIATIONS_COLLECTION,
} from './constants/cashflow.constants';

export type {
  CashFlowCategory,
  CashFlowActivity,
  ForecastHorizon,
  ReconciliationStatus,
  PaymentMethod,
} from './constants/cashflow.constants';

// ============================================================================
// TYPES
// ============================================================================

// Account Types
export type {
  AccountBalance,
  PeriodBalance,
  Account,
  AccountTreeNode,
  AccountSummary,
  AccountCreateInput,
  AccountUpdateInput,
  AccountFilter,
  AccountSort,
  TrialBalanceEntry,
  TrialBalance,
} from './types/account.types';

// Journal Types
export {
  JOURNAL_STATUS,
  JOURNAL_TYPES,
  JOURNAL_SOURCES,
} from './types/journal.types';

export type {
  JournalStatus,
  JournalType,
  JournalSource,
  JournalLine,
  JournalEntry,
  JournalEntryCreateInput,
  JournalEntryUpdateInput,
  JournalFilter,
  JournalSort,
  LedgerEntry,
} from './types/journal.types';

// Reporting Types
export type {
  ReportParameters,
  ReportFilters as ReportFilterOptions,
  GeneratedReport,
  ReportLineItem,
  ReportSection,
  ReportTotal,
  IncomeStatement,
  BalanceSheet,
  TrialBalance as ReportTrialBalance,
  VATReturn,
  WHTReport,
  PAYEReturn,
} from './types/reporting.types';

// Cash Flow Types
export type {
  CashTransaction,
  CashTransactionInput,
  CashAccount,
  CashPosition,
  CashFlowSummary,
  CashForecast,
  CashForecastPeriod,
  ForecastAssumptions,
  ForecastInput,
  BankReconciliation as BankReconciliationType,
  ReconciledItem,
  OutstandingItem,
  ReconciliationAdjustment,
  ReconciliationInput,
  CashFlowFilters,
  ForecastFilters,
  CashFlowTrend,
  CashFlowAnalysis,
  ForecastParameters,
} from './types/cashflow.types';

// Budget Types
export type {
  Budget,
  BudgetLineItem,
  BudgetPeriodAmount,
  BudgetInput,
  BudgetUpdate,
  BudgetLineInput,
  BudgetLineUpdate,
  BudgetRevision,
  BudgetLineChange,
  BudgetVariance,
  VarianceSummary,
  LineVariance,
  VarianceStatus,
  BudgetFilters,
  BudgetQueryResult,
  BudgetForecast,
  MonthlyProjection,
} from './types/budget.types';

// ============================================================================
// SCHEMAS
// ============================================================================

export {
  validateAccountCodeForType,
  accountCreateSchema,
  accountUpdateSchema,
  accountFilterSchema,
} from './schemas/account.schemas';

export type {
  AccountCreateSchemaType,
  AccountUpdateSchemaType,
  AccountFilterSchemaType,
} from './schemas/account.schemas';

export {
  journalLineSchema,
  journalEntryCreateSchema,
  journalEntryUpdateSchema,
  journalFilterSchema,
} from './schemas/journal.schemas';

export type {
  JournalEntryCreateSchemaType,
  JournalEntryUpdateSchemaType,
  JournalFilterSchemaType,
} from './schemas/journal.schemas';

// Reporting Schemas
export {
  reportParametersSchema,
  reportFilterSchema,
  reportExportSchema,
  reportTemplateSchema,
  vatReturnSchema,
  whtTransactionSchema,
} from './schemas/reporting.schemas';

export type {
  ReportParametersInput,
  ReportFilterInput,
  ReportExportInput,
  ReportTemplateInput,
  VATReturnInput,
  WHTTransactionInput,
} from './schemas/reporting.schemas';

// Cash Flow Schemas
export {
  cashTransactionSchema,
  forecastAssumptionsSchema,
  cashForecastSchema,
  forecastPeriodSchema,
  bankReconciliationSchema,
  outstandingItemSchema,
  cashFlowFilterSchema,
  forecastParametersSchema,
} from './schemas/cashflow.schemas';

export type {
  CashTransactionFormData,
  CashForecastFormData,
  BankReconciliationFormData,
  OutstandingItemFormData,
  CashFlowFilterFormData,
  ForecastParametersFormData,
} from './schemas/cashflow.schemas';

// Budget Schemas
export {
  budgetInputSchema,
  budgetUpdateSchema,
  budgetLineInputSchema,
  budgetLineUpdateSchema,
  budgetRevisionSchema,
  budgetApprovalSchema,
  budgetFilterSchema,
} from './schemas/budget.schemas';

export type {
  BudgetInputSchema,
  BudgetUpdateSchema,
  BudgetLineInputSchema,
  BudgetLineUpdateSchema,
  BudgetRevisionSchema,
  BudgetApprovalSchema,
  BudgetFilterSchema,
} from './schemas/budget.schemas';

// ============================================================================
// SERVICES
// ============================================================================

export { accountService } from './services/accountService';
export { balanceService } from './services/balanceService';
export { journalService } from './services/journalService';
export { budgetService } from './services/budgetService';

// Reporting Service
export {
  generateIncomeStatement,
  generateBalanceSheet,
  generateTrialBalance,
  generateVATReturn,
  getReport,
  getReports,
} from './services/reportingService';

// Cash Flow Service
export {
  createCashTransaction,
  getCashTransaction,
  getCashTransactions,
  updateCashTransaction,
  deleteCashTransaction,
  getCashPosition,
  getCashFlowSummary,
  createCashForecast,
  getCashForecast,
  getCashForecasts,
  updateForecastPeriod,
  createBankReconciliation,
  getBankReconciliation,
  getBankReconciliations,
  reconcileTransaction,
  completeReconciliation,
  getCashFlowTrends,
  analyzeCashFlow,
} from './services/cashflowService';

// ============================================================================
// HOOKS
// ============================================================================

export {
  useAccounts,
  useAccountTree,
  useAccount,
  useTrialBalance,
} from './hooks/useAccounts';

export type {
  UseAccountsOptions,
  UseAccountsReturn,
  UseAccountTreeOptions,
  UseAccountTreeReturn,
  UseAccountOptions,
  UseAccountReturn,
  UseTrialBalanceOptions,
  UseTrialBalanceReturn,
} from './hooks/useAccounts';

export {
  useAccountBalance,
  useBalanceAsOf,
  useMultipleBalances,
} from './hooks/useAccountBalance';

export type {
  UseAccountBalanceOptions,
  UseAccountBalanceReturn,
  UseBalanceAsOfOptions,
  UseBalanceAsOfReturn,
  UseMultipleBalancesOptions,
  UseMultipleBalancesReturn,
} from './hooks/useAccountBalance';

export {
  useJournalEntries,
  useJournalEntry,
  useAccountLedger,
} from './hooks/useJournalEntries';

export type {
  UseJournalEntriesOptions,
  UseJournalEntriesReturn,
  UseJournalEntryOptions,
  UseJournalEntryReturn,
  UseAccountLedgerOptions,
  UseAccountLedgerReturn,
} from './hooks/useJournalEntries';

// Budget Hooks
export { useBudgets } from './hooks/useBudgets';
export { useBudget } from './hooks/useBudget';
export { useBudgetVariance } from './hooks/useBudgetVariance';

// Reporting Hooks
export { useFinancialReport } from './hooks/useFinancialReport';
export { useReportGenerator } from './hooks/useReportGenerator';

// Cash Flow Hooks
export { useCashFlow } from './hooks/useCashFlow';
export { useCashForecast } from './hooks/useCashForecast';

// ============================================================================
// COMPONENTS
// ============================================================================

export {
  AccountTree,
  AccountCard,
  AccountForm,
  AccountSelector,
  MultiAccountSelector,
} from './components/accounts';

// Budget Components
export {
  BudgetList,
  BudgetForm,
  BudgetLineEditor,
  BudgetVarianceTable,
  BudgetChart,
  BudgetApprovalDialog,
} from './components/budget';

// Report Components
export {
  IncomeStatement as IncomeStatementReport,
  BalanceSheet as BalanceSheetReport,
  TrialBalance as TrialBalanceReport,
  ReportFilters,
  ReportExport,
} from './components/reports';

// Cash Flow Components
export {
  CashPositionCard,
  CashFlowChart,
  CashForecastTable,
  CashTransactionList,
  BankReconciliation,
  CashFlowDashboard,
} from './components/cashflow';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  formatCurrency as formatCurrencyUtil,
  formatNumber,
  formatPercent,
  formatDate,
  formatFiscalYear,
  formatFiscalMonth,
  formatVariance,
  formatAccountCode,
  abbreviateNumber,
} from './utils/formatters';

// ============================================================================
// INTEGRATION CONSTANTS
// ============================================================================

export {
  QBO_DATA_CATEGORIES,
  QBO_SYNC_INTERVALS,
  QBO_SYNC_INTERVAL_LABELS,
  QBO_COLLECTIONS,
  RECONCILIATION_FREQUENCIES,
  RECONCILIATION_FREQUENCY_DAYS,
  RECONCILIATION_TYPES,
  RECONCILIATION_TYPE_ICONS,
  RECONCILIATION_TASK_STATUS_LABELS,
  RECONCILIATION_TASK_STATUS_COLORS,
  RECONCILIATION_COLLECTIONS,
  TAX_PORTAL_CATEGORIES,
  TAX_PORTAL_CATEGORY_ICONS,
  DEFAULT_TAX_PORTAL_LINKS,
  TAX_PORTAL_COLLECTIONS,
  FINANCE_DOCUMENT_CATEGORIES,
  FINANCE_DOCUMENT_CATEGORY_ICONS,
  FINANCE_DOCUMENT_STATUSES,
  FINANCE_DOCUMENT_STATUS_COLORS,
  FINANCE_DOCUMENT_COLLECTIONS,
  GOOGLE_DRIVE_CONFIG,
} from './constants/integrations.constants';

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

export type {
  QBOSyncStatus,
  QBODataCategory,
  QBOConnectionStatus,
  QBOSyncJob,
  QBOSyncHistory,
  QBOAccount as QBOAccountType,
  QBOReportRow,
  QBOProfitAndLoss,
  QBOBalanceSheet,
  QBOInvoice,
  QBOInvoiceLineItem,
  QBOBill,
  QBOBankTransaction,
  ReconciliationFrequency,
  ReconciliationTaskStatus,
  ReconciliationType,
  ReconciliationSchedule,
  ReconciliationScheduleInput,
  ReconciliationTask,
  TaxPortalLink,
  TaxPortalCategory,
  FinanceDocumentCategory,
  FinanceDocumentStatus,
  FinanceDocument,
  FinanceDocumentInput,
  FinanceDocumentFilter,
  GoogleDriveFile,
  GoogleDrivePickerResult,
} from './types/integrations.types';

// ============================================================================
// INTEGRATION SERVICES
// ============================================================================

// QBO Sync Service
export {
  getQBOConnectionStatus,
  getQBOAuthUrl,
  syncAllQBOData,
  syncQBOCategory,
  getQBOSyncHistory,
  subscribeToSyncJobs,
  getQBOProfitAndLoss,
  getQBOBalanceSheet,
  getQBOAccounts,
  getQBOInvoices,
  getQBOBills,
  getQBOBankTransactions,
} from './services/qboSyncService';

// Finance Admin Service
export {
  createReconciliationSchedule,
  getReconciliationSchedules,
  getReconciliationSchedule,
  updateReconciliationSchedule,
  toggleReconciliationSchedule,
  deleteReconciliationSchedule,
  completeReconciliationSchedule,
  getReconciliationTasks,
  subscribeToReconciliationSchedules,
  createFinanceDocument,
  getFinanceDocuments,
  getFinanceDocument,
  updateFinanceDocument,
  deleteFinanceDocument,
  subscribeToFinanceDocuments,
  getTaxPortalLinks,
  addTaxPortalLink,
  updateTaxPortalLink,
  deleteTaxPortalLink,
} from './services/financeAdminService';

// ============================================================================
// INTEGRATION HOOKS
// ============================================================================

export { useQBOSync } from './hooks/useQBOSync';
export type { UseQBOSyncOptions, UseQBOSyncReturn } from './hooks/useQBOSync';

export { useQBOConfig } from './hooks/useQBOConfig';

export { useReconciliationSchedule } from './hooks/useReconciliationSchedule';
export type { UseReconciliationScheduleOptions, UseReconciliationScheduleReturn } from './hooks/useReconciliationSchedule';

export { useFinanceDocuments } from './hooks/useFinanceDocuments';
export type { UseFinanceDocumentsOptions, UseFinanceDocumentsReturn } from './hooks/useFinanceDocuments';

export { useTaxPortals } from './hooks/useTaxPortals';
export type { UseTaxPortalsOptions, UseTaxPortalsReturn } from './hooks/useTaxPortals';

// ============================================================================
// INTEGRATION COMPONENTS
// ============================================================================

// Admin Components
export {
  ReconciliationScheduleList,
  TaxPortalLinks,
  FinanceDocumentLibrary,
} from './components/admin';

// Integration Components
export {
  QBOConnectionCard,
} from './components/integrations';

// ============================================================================
// PAGES
// ============================================================================

export { ChartOfAccounts } from './pages';
