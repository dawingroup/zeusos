/**
 * Payroll Validation Schemas
 * DawinOS HR Central - Payroll Module
 * 
 * Zod validation schemas for payroll inputs and data.
 */

import { z } from 'zod';
import { PAYROLL_CONFIG, ALLOWANCE_TAX_TREATMENT } from '../constants/uganda-tax-constants';

const allowanceTypes = Object.keys(ALLOWANCE_TAX_TREATMENT) as [string, ...string[]];

/**
 * Earnings item schema
 */
export const earningsItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['basic_salary', 'allowance', 'overtime', 'bonus', 'commission', 'arrears', 'other']),
  category: z.string(),
  description: z.string().min(1, 'Description is required'),
  amount: z.number()
    .min(0, 'Amount must be positive')
    .max(PAYROLL_CONFIG.maxMonthlyGross, `Amount cannot exceed ${PAYROLL_CONFIG.maxMonthlyGross}`),
  taxable: z.boolean().default(true),
  nssfApplicable: z.boolean().default(false),
  metadata: z.object({
    hours: z.number().optional(),
    rate: z.number().optional(),
    period: z.string().optional(),
    reference: z.string().optional()
  }).optional()
});

/**
 * Deduction item schema
 */
export const deductionItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'paye', 'nssf_employee', 'lst', 'pension', 'loan', 'advance',
    'savings', 'insurance', 'union', 'sacco', 'garnishment', 
    'child_support', 'maintenance', 'overpayment', 'damage', 'other'
  ]),
  category: z.enum(['statutory', 'voluntary', 'recovery', 'court']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  mandatory: z.boolean().default(false),
  reference: z.string().optional(),
  metadata: z.object({
    installmentNumber: z.number().optional(),
    totalInstallments: z.number().optional(),
    balanceRemaining: z.number().optional(),
    courtOrderNumber: z.string().optional(),
    loanId: z.string().optional()
  }).optional()
});

/**
 * Additional earnings input schema
 */
export const additionalEarningsSchema = z.object({
  type: z.enum(allowanceTypes),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  taxable: z.boolean().optional()
});

/**
 * Additional deductions input schema
 */
export const additionalDeductionsSchema = z.object({
  type: z.string().min(1, 'Deduction type is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive')
});

/**
 * Calculate payroll input schema
 */
export const calculatePayrollInputSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  year: z.number()
    .int()
    .min(2020, 'Year must be 2020 or later')
    .max(2100, 'Year must be before 2100'),
  month: z.number()
    .int()
    .min(1, 'Month must be between 1 and 12')
    .max(12, 'Month must be between 1 and 12'),
  overrides: z.object({
    basicSalary: z.number().min(0).optional(),
    additionalEarnings: z.array(additionalEarningsSchema).max(PAYROLL_CONFIG.maxAllowances).optional(),
    additionalDeductions: z.array(additionalDeductionsSchema).max(PAYROLL_CONFIG.maxDeductions).optional(),
    prorationDays: z.number().int().min(0).max(31).optional(),
    unpaidLeaveDays: z.number().int().min(0).max(31).optional()
  }).optional(),
  recalculate: z.boolean().default(false)
});

/**
 * Process payroll batch input schema
 */
export const processPayrollBatchInputSchema = z.object({
  subsidiaryId: z.string().min(1, 'Subsidiary ID is required'),
  departmentIds: z.array(z.string()).optional(),
  employeeIds: z.array(z.string()).optional(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  paymentDate: z.date(),
  notes: z.string().max(500).optional()
});

/**
 * Create loan recovery schema
 */
export const createLoanRecoverySchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  loanType: z.enum(['salary_advance', 'staff_loan', 'emergency_loan', 'education_loan', 'other']),
  principalAmount: z.number().min(1, 'Principal amount must be greater than 0'),
  interestRate: z.number().min(0).max(100, 'Interest rate must be between 0 and 100'),
  monthlyDeduction: z.number().min(1, 'Monthly deduction must be greater than 0'),
  startDate: z.date(),
  notes: z.string().max(500).optional()
}).refine(
  data => data.monthlyDeduction <= data.principalAmount,
  { message: 'Monthly deduction cannot exceed principal amount', path: ['monthlyDeduction'] }
);

/**
 * Create overtime record schema
 */
export const createOvertimeSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  date: z.date(),
  type: z.enum(['regular', 'weekend', 'holiday', 'night', 'straight_time']),
  hours: z.number()
    .min(0.5, 'Minimum overtime is 0.5 hours')
    .max(24, 'Maximum overtime is 24 hours per day'),
  notes: z.string().max(500).optional()
});

/**
 * Create salary revision schema
 */
export const createSalaryRevisionSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  effectiveDate: z.date(),
  newBasicSalary: z.number().min(0, 'Salary must be positive'),
  newAllowances: z.array(z.object({
    type: z.enum(allowanceTypes),
    amount: z.number().min(0)
  })).optional(),
  retroactiveMonths: z.number()
    .int()
    .min(0)
    .max(PAYROLL_CONFIG.maxRetroactiveMonths, 
      `Maximum ${PAYROLL_CONFIG.maxRetroactiveMonths} months retroactive adjustment allowed`)
    .optional(),
  reason: z.string().min(1, 'Reason is required').max(500)
});

/**
 * Payroll adjustment schema
 */
export const payrollAdjustmentSchema = z.object({
  type: z.enum(['addition', 'deduction']),
  category: z.enum(['correction', 'bonus', 'penalty', 'reimbursement', 'other']),
  reason: z.string().min(1, 'Reason is required').max(500),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  taxable: z.boolean().default(true),
  reference: z.string().optional()
});

/**
 * Payroll filters schema
 */
export const payrollFiltersSchema = z.object({
  subsidiaryId: z.string().optional(),
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  status: z.enum(['draft', 'calculated', 'reviewed', 'approved', 'paid', 'reversed']).optional(),
  paymentMethod: z.enum(['bank_transfer', 'mobile_money', 'cash', 'cheque']).optional(),
  minNetPay: z.number().min(0).optional(),
  maxNetPay: z.number().min(0).optional()
});

/**
 * Approve payroll schema
 */
export const approvePayrollSchema = z.object({
  payrollId: z.string().min(1, 'Payroll ID is required'),
  notes: z.string().max(500).optional()
});

/**
 * Batch approve payroll schema
 */
export const batchApprovePayrollSchema = z.object({
  payrollIds: z.array(z.string()).min(1, 'At least one payroll ID is required'),
  notes: z.string().max(500).optional()
});

// ============================================================================
// Type Exports
// ============================================================================

export type EarningsItemInput = z.infer<typeof earningsItemSchema>;
export type DeductionItemInput = z.infer<typeof deductionItemSchema>;
export type CalculatePayrollInputValidated = z.infer<typeof calculatePayrollInputSchema>;
export type ProcessPayrollBatchInputValidated = z.infer<typeof processPayrollBatchInputSchema>;
export type CreateLoanRecoveryInput = z.infer<typeof createLoanRecoverySchema>;
export type CreateOvertimeInput = z.infer<typeof createOvertimeSchema>;
export type CreateSalaryRevisionInput = z.infer<typeof createSalaryRevisionSchema>;
export type PayrollAdjustmentInput = z.infer<typeof payrollAdjustmentSchema>;
export type PayrollFiltersInput = z.infer<typeof payrollFiltersSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate calculate payroll input
 */
export function validateCalculatePayrollInput(data: unknown) {
  return calculatePayrollInputSchema.safeParse(data);
}

/**
 * Validate process payroll batch input
 */
export function validateProcessPayrollBatchInput(data: unknown) {
  return processPayrollBatchInputSchema.safeParse(data);
}

/**
 * Validate loan recovery input
 */
export function validateLoanRecoveryInput(data: unknown) {
  return createLoanRecoverySchema.safeParse(data);
}

/**
 * Validate overtime input
 */
export function validateOvertimeInput(data: unknown) {
  return createOvertimeSchema.safeParse(data);
}

/**
 * Validate salary revision input
 */
export function validateSalaryRevisionInput(data: unknown) {
  return createSalaryRevisionSchema.safeParse(data);
}
