// ============================================================================
// CASH FLOW SCHEMAS
// DawinOS v2.0 - Financial Management Module
// Zod validation schemas for Cash Flow Analysis
// ============================================================================

import { z } from 'zod';
import {
  CASH_FLOW_CATEGORIES,
  CASH_FLOW_ACTIVITIES,
  PAYMENT_METHODS,
  FORECAST_HORIZONS,
} from '../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// CASH TRANSACTION SCHEMAS
// ----------------------------------------------------------------------------

export const cashTransactionSchema = z.object({
  date: z.date(),
  description: z.string().min(1, 'Description is required').max(200),
  reference: z.string().max(50).optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('UGX'),
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  cashAccountId: z.string().min(1, 'Cash account is required'),
  offsetAccountId: z.string().optional(),
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS) as [string, ...string[]]),
  bankReference: z.string().max(50).optional(),
  chequeNumber: z.string().max(20).optional(),
  mobileMoneyRef: z.string().max(50).optional(),
  customerId: z.string().optional(),
  customerName: z.string().max(100).optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().max(100).optional(),
  employeeId: z.string().optional(),
  employeeName: z.string().max(100).optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  invoiceId: z.string().optional(),
  billId: z.string().optional(),
  tags: z.array(z.string()).max(10).optional(),
  notes: z.string().max(500).optional(),
});

export type CashTransactionFormData = z.infer<typeof cashTransactionSchema>;

// ----------------------------------------------------------------------------
// FORECAST SCHEMAS
// ----------------------------------------------------------------------------

export const fixedMonthlyCostSchema = z.object({
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  description: z.string().min(1).max(100),
  amount: z.number().positive(),
  dueDay: z.number().int().min(1).max(31).optional(),
});

export const oneTimeItemSchema = z.object({
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  description: z.string().min(1).max(100),
  amount: z.number().positive(),
  periodIndex: z.number().int().min(1),
  isInflow: z.boolean(),
});

export const forecastAssumptionsSchema = z.object({
  salesGrowthRate: z.number().min(-100).max(100).default(0),
  collectionDays: z.number().int().min(0).max(365).default(30),
  expenseGrowthRate: z.number().min(-100).max(100).default(0),
  paymentDays: z.number().int().min(0).max(365).default(30),
  fixedMonthlyCosts: z.array(fixedMonthlyCostSchema).optional(),
  seasonalFactors: z.record(z.string(), z.number()).optional(),
  oneTimeItems: z.array(oneTimeItemSchema).optional(),
});

export const cashForecastSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  horizon: z.enum(Object.values(FORECAST_HORIZONS) as [string, ...string[]]),
  startDate: z.date(),
  openingCashBalance: z.number(),
  assumptions: forecastAssumptionsSchema,
});

export type CashForecastFormData = z.infer<typeof cashForecastSchema>;

// ----------------------------------------------------------------------------
// FORECAST PERIOD SCHEMAS
// ----------------------------------------------------------------------------

export const forecastPeriodItemSchema = z.object({
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  label: z.string(),
  amount: z.number(),
  isRecurring: z.boolean().default(false),
  source: z.string().optional(),
  dueDate: z.date().optional(),
});

export const forecastPeriodSchema = z.object({
  periodIndex: z.number().int().min(1),
  periodLabel: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  inflows: z.array(forecastPeriodItemSchema),
  totalInflows: z.number(),
  outflows: z.array(forecastPeriodItemSchema),
  totalOutflows: z.number(),
  netCashFlow: z.number(),
});

export type ForecastPeriodFormData = z.infer<typeof forecastPeriodSchema>;

// ----------------------------------------------------------------------------
// RECONCILIATION SCHEMAS
// ----------------------------------------------------------------------------

export const reconciliationAdjustmentSchema = z.object({
  id: z.string(),
  type: z.enum(['bank_error', 'book_error', 'timing_difference', 'other']),
  description: z.string().min(1).max(200),
  amount: z.number(),
  affectsBank: z.boolean(),
  affectsBook: z.boolean(),
  journalEntryId: z.string().optional(),
  notes: z.string().max(300).optional(),
});

export const bankReconciliationSchema = z.object({
  bankAccountId: z.string().min(1, 'Bank account is required'),
  periodStart: z.date(),
  periodEnd: z.date(),
  statementDate: z.date(),
  statementOpeningBalance: z.number(),
  statementClosingBalance: z.number(),
}).refine(
  (data) => data.periodEnd >= data.periodStart,
  { message: 'End date must be after start date', path: ['periodEnd'] }
);

export type BankReconciliationFormData = z.infer<typeof bankReconciliationSchema>;

export const outstandingItemSchema = z.object({
  type: z.enum(['outstanding_deposit', 'outstanding_cheque', 'unrecorded_charge', 'unrecorded_credit']),
  date: z.date(),
  description: z.string().min(1).max(200),
  reference: z.string().max(50).optional(),
  amount: z.number(),
  transactionId: z.string().optional(),
  expectedClearDate: z.date().optional(),
  notes: z.string().max(300).optional(),
});

export type OutstandingItemFormData = z.infer<typeof outstandingItemSchema>;

// ----------------------------------------------------------------------------
// FILTER SCHEMAS
// ----------------------------------------------------------------------------

export const cashFlowFilterSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  type: z.enum(['inflow', 'outflow']).optional(),
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]).optional(),
  activity: z.enum(Object.values(CASH_FLOW_ACTIVITIES) as [string, ...string[]]).optional(),
  cashAccountId: z.string().optional(),
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS) as [string, ...string[]]).optional(),
  isReconciled: z.boolean().optional(),
  searchTerm: z.string().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
});

export type CashFlowFilterFormData = z.infer<typeof cashFlowFilterSchema>;

// ----------------------------------------------------------------------------
// FORECAST PARAMETERS SCHEMA
// ----------------------------------------------------------------------------

export const recurringItemSchema = z.object({
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  amount: z.number().positive(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly']),
  description: z.string().min(1).max(100),
  dueDay: z.number().int().min(1).max(31).optional(),
});

export const plannedInflowSchema = z.object({
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  amount: z.number().positive(),
  date: z.date(),
  description: z.string().min(1).max(100),
  probability: z.number().min(0).max(100).optional(),
});

export const plannedOutflowSchema = z.object({
  category: z.enum(Object.values(CASH_FLOW_CATEGORIES) as [string, ...string[]]),
  amount: z.number().positive(),
  date: z.date(),
  description: z.string().min(1).max(100),
  isCommitted: z.boolean().default(false),
});

export const forecastParametersSchema = z.object({
  horizon: z.enum(Object.values(FORECAST_HORIZONS) as [string, ...string[]]),
  startDate: z.date(),
  openingBalance: z.number(),
  revenueGrowthRate: z.number().min(-100).max(100).default(0),
  expenseGrowthRate: z.number().min(-100).max(100).default(0),
  daysReceivable: z.number().int().min(0).max(365).default(30),
  daysPayable: z.number().int().min(0).max(365).default(30),
  recurringInflows: z.array(recurringItemSchema).optional(),
  recurringOutflows: z.array(recurringItemSchema).optional(),
  plannedInflows: z.array(plannedInflowSchema).optional(),
  plannedOutflows: z.array(plannedOutflowSchema).optional(),
});

export type ForecastParametersFormData = z.infer<typeof forecastParametersSchema>;
