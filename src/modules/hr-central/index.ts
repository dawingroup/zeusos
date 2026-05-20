/**
 * HR Central Module Index - DawinOS v2.0
 * Export all HR Central types, constants, services, and hooks
 */

// Types
export * from './types/employee.types';
export {
  // Contract types
  type ContractType,
  type ContractStatus,
  type AmendmentType,
  type TerminationType,
  type ContractCompensation,
  type ContractAllowance,
  type ContractDeduction,
  type ContractSchedule,
  type ContractLeaveEntitlements,
  type ContractBenefits,
  type NoticePeriod,
  type ProbationPeriod,
  type RestrictiveCovenants,
  type ContractSignatory,
  type ContractDocument,
  type Contract,
  type ContractAuditEntry,
  type ContractAmendment,
  type TemplateVariable,
  type TemplateSection,
  type ContractTemplate,
  type ContractSummary,
  type AmendmentSummary,
  type CreateContractInput,
  type UpdateContractInput,
  type CreateAmendmentInput,
  type RenewContractInput,
  type TerminateContractInput,
  type ContractFilters,
  type ContractSort,
  type ContractListResult,
  type ContractStats,
  // Contract constants
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  AMENDMENT_TYPE_LABELS,
  TERMINATION_TYPE_LABELS,
  CONTRACT_NUMBER_CONFIG,
  AMENDMENT_NUMBER_CONFIG,
  DEFAULT_NOTICE_PERIODS,
  DEFAULT_LEAVE_ENTITLEMENTS as CONTRACT_DEFAULT_LEAVE_ENTITLEMENTS,
  DEFAULT_PROBATION_CONFIG,
  EXPIRY_WARNING_THRESHOLDS,
  VALID_CONTRACT_STATUS_TRANSITIONS,
  CONTRACT_CONFIG,
  // Validation schemas
  createContractSchema,
  createAmendmentSchema,
  terminateContractSchema,
} from './types/contract.types';

// Validation
export * from './validation/employee.validation';

// Constants
export * from './config/employee.constants';

// Services
export * from './services/employee.service';
export {
  createContract,
  getContract,
  getContractByNumber,
  getActiveContractForEmployee,
  getContractsForEmployee,
  updateContract,
  listContracts,
  changeContractStatus,
  approveContract,
  signContract,
  createAmendment,
  getAmendment,
  getAmendmentsForContract,
  activateAmendment,
  renewContract,
  terminateContract,
  getContractStats,
  getExpiringContracts as getExpiringContractsForRenewal,
  searchContracts,
} from './services/contract.service';
export * from './services/contract-template.service';

// Hooks
export * from './hooks/useEmployee';

// Components
export * from './components';

// Payroll Module (explicit exports to avoid conflicts with employee.constants)
export {
  // Constants
  UGANDA_PAYE_BANDS,
  NSSF_CONFIG as PAYROLL_NSSF_CONFIG,
  LST_BANDS as PAYROLL_LST_BANDS,
  PAYMENT_FREQUENCIES,
  ALLOWANCE_TAX_TREATMENT,
  DEDUCTION_CATEGORIES,
  PAYROLL_CONFIG,
  UGANDA_PUBLIC_HOLIDAYS,
  PAYROLL_STATUS_FLOW,
  EARNINGS_TYPE_LABELS,
  DEDUCTION_TYPE_LABELS,
  type PAYEBandId,
  type LSTBandId,
  type PaymentFrequency,
  type AllowanceType,
  type DeductionCategory,
  type PayrollStatus,
  
  // Types
  type EarningsItem,
  type OvertimeRecord,
  type DeductionItem,
  type LoanRecovery,
  type PAYEBreakdown,
  type NSSFBreakdown,
  type LSTBreakdown,
  type ProrationDetails,
  type SalaryRevision,
  type PayrollAdjustment,
  type YearToDateTotals,
  type PayrollPeriod,
  type EmployeePayroll,
  type CalculatePayrollInput,
  type ProcessPayrollBatchInput,
  type CreateLoanRecoveryInput,
  type CreateOvertimeInput,
  type CreateSalaryRevisionInput,
  type PayrollSummary,
  type EmployeePayrollSummary,
  type TaxRemittanceSummary,
  type PayslipData,
  type PayrollFilters,
  type PayrollSort,
  type PayrollListResult,
  
  // Schemas
  earningsItemSchema,
  deductionItemSchema,
  calculatePayrollInputSchema,
  processPayrollBatchInputSchema,
  createLoanRecoverySchema,
  createOvertimeSchema,
  createSalaryRevisionSchema,
  payrollAdjustmentSchema,
  payrollFiltersSchema,
  validateCalculatePayrollInput,
  validateProcessPayrollBatchInput,
  validateLoanRecoveryInput,
  validateOvertimeInput,
  validateSalaryRevisionInput,
  
  // Tax Calculator (renamed to avoid conflicts)
  calculatePAYE as calculatePayrollPAYE,
  calculateAnnualPAYE,
  calculateNSSF as calculatePayrollNSSF,
  calculateLST as calculatePayrollLST,
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
  isCurrentPeriod,
  
  // Service
  calculateEmployeePayroll,
  getPayroll,
  getPayrollHistory,
  getPayrollsForPeriod,
  getPayrollSummary,
  approvePayroll,
  markPayrollPaid,
  
  // Hooks
  usePayrollCalculation,
  usePayrollHistory,
  usePayrollPeriod,
  usePayrollDetails,
  useTaxCalculations,
  usePayrollApproval,
  useSalaryBreakdown
} from './payroll';

// Performance Module
export * from './performance';

// Skills & Training Module
export * from './skills';

// Succession Planning Module
export * from './succession';

// Module info
export const HR_CENTRAL_MODULE = {
  id: 'hr-central',
  name: 'HR Central',
  version: '2.0.0',
  description: 'Complete staff lifecycle management with payroll orchestration',
  dependencies: ['intelligence', 'shared'],
};
