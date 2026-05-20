/**
 * Payroll Module Index
 * DawinOS HR Central - Payroll Module
 * 
 * Exports all payroll types, constants, services, utilities, and hooks.
 */

// Constants
export * from './constants/uganda-tax-constants';

// Types
export * from './types/payroll.types';

// Validation Schemas (excluding conflicting type exports)
export {
  earningsItemSchema,
  deductionItemSchema,
  additionalEarningsSchema,
  additionalDeductionsSchema,
  calculatePayrollInputSchema,
  processPayrollBatchInputSchema,
  createLoanRecoverySchema,
  createOvertimeSchema,
  createSalaryRevisionSchema,
  payrollAdjustmentSchema,
  payrollFiltersSchema,
  approvePayrollSchema,
  batchApprovePayrollSchema,
  validateCalculatePayrollInput,
  validateProcessPayrollBatchInput,
  validateLoanRecoveryInput,
  validateOvertimeInput,
  validateSalaryRevisionInput,
  type EarningsItemInput,
  type DeductionItemInput,
  type CalculatePayrollInputValidated,
  type ProcessPayrollBatchInputValidated,
  type PayrollAdjustmentInput,
  type PayrollFiltersInput
} from './schemas/payroll.schemas';

// Tax Calculator Utilities
export {
  calculatePAYE,
  calculateAnnualPAYE,
  calculateNSSF,
  calculateLST,
  calculateTaxableIncome,
  calculateNSSFApplicableIncome,
  getAllowanceTaxTreatment,
  calculateOvertime,
  calculateHourlyRate,
  calculateDailyRate,
  calculateProrationFactor,
  calculateProratedAmount,
  calculateRetroactiveAdjustment,
  roundCurrency,
  formatCurrency,
  formatCurrencyNumber,
  numberToWords,
  getTaxYear,
  getFiscalYearDates,
  getDaysInMonth,
  getRemainingMonthsInFiscalYear,
  getPeriodString,
  parsePeriodString,
  getMonthName,
  getWorkingDaysInMonth,
  isValidPayrollPeriod,
  isPastPeriod,
  isCurrentPeriod
} from './utils/tax-calculator';

// Payroll Calculator Service
export {
  calculateEmployeePayroll,
  getPayroll,
  getPayrollHistory,
  getPayrollsForPeriod,
  getPayrollSummary,
  approvePayroll,
  markPayrollPaid
} from './services/payroll-calculator.service';

// React Hooks - Payroll Calculation
export {
  usePayrollCalculation,
  usePayrollHistory,
  usePayrollPeriod,
  usePayrollDetails,
  useTaxCalculations,
  usePayrollApproval,
  useSalaryBreakdown
} from './hooks/usePayrollCalculation';

// Batch Types (explicitly export to avoid PayslipData conflict with payroll.types)
// Type exports
export type {
  PayrollBatchStatus,
  ApprovalThresholds,
  ApprovalAction,
  ApprovalLevel,
  ApprovalRecord,
  PaymentMethodType,
  PaymentBatchStatus,
  FailedPayment,
  PaymentBatch,
  StatusHistoryEntry,
  BatchCalculationError,
  BatchDocumentType,
  BatchDocument,
  PayrollBatch,
  CreatePayrollBatchInput,
  UpdatePayrollBatchInput,
  BatchCalculationProgress,
  PayrollBatchFilters,
  PayrollBatchSortField,
  PayrollBatchSort,
  PayrollBatchListResult,
  PayrollBatchSummary,
  BankFileFormat,
  BankFileEntry,
  BankFileOptions,
  URAReturnData,
  NSSFReturnData
} from './types/payroll-batch.types';

// Value exports (constants)
export {
  VALID_STATUS_TRANSITIONS,
  BATCH_STATUS_LABELS,
  BATCH_STATUS_COLORS,
  DEFAULT_CEO_THRESHOLD
} from './types/payroll-batch.types';

// Payroll Batch Service
export {
  createPayrollBatch,
  calculateBatch,
  submitForReview,
  processApproval,
  processPayments,
  completePaymentBatch,
  cancelBatch,
  getBatch,
  getBatchForPeriod,
  listBatches,
  getBatchPayrolls,
  getBatchStatistics
} from './services/payroll-batch.service';

// Payslip Generator Service
export {
  generatePayslipData,
  generatePayslipHTML,
  generateBatchPayslipsHTML,
  openPayslipForPrint,
  downloadPayslipHTML,
  downloadBatchPayslipsHTML,
  generateBankTransferCSV,
  generateMobileMoneyCSV,
  downloadCSV,
  generateURAReturnData,
  generateNSSFReturnData,
  type CompanyInfo
} from './services/payslip-generator.service';

// React Hooks - Batch Management
export {
  usePayrollBatch,
  usePayrollBatchList,
  usePayrollBatchActions
} from './hooks/usePayrollBatch';

// UI Components
export { PayrollBatchList } from './components/PayrollBatchList';
export { PayrollBatchDetail } from './components/PayrollBatchDetail';
