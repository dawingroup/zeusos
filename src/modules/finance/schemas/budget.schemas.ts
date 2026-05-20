// ============================================================================
// BUDGET SCHEMAS
// DawinOS v2.0 - Financial Management Module
// Zod validation schemas for Budget Management
// ============================================================================

import { z } from 'zod';
import {
  BUDGET_TYPES,
  BUDGET_STATUSES,
  BUDGET_PERIODS,
  ALLOCATION_METHODS,
} from '../constants/budget.constants';
import { CURRENCIES } from '../constants/currency.constants';

// ----------------------------------------------------------------------------
// BUDGET INPUT SCHEMA
// ----------------------------------------------------------------------------

export const budgetInputSchema = z.object({
  name: z.string()
    .min(3, 'Budget name must be at least 3 characters')
    .max(100, 'Budget name must be at most 100 characters')
    .trim(),
  
  code: z.string()
    .max(20, 'Budget code must be at most 20 characters')
    .optional(),
  
  description: z.string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  
  type: z.enum([
    BUDGET_TYPES.OPERATING,
    BUDGET_TYPES.CAPITAL,
    BUDGET_TYPES.PROJECT,
    BUDGET_TYPES.DEPARTMENTAL,
    BUDGET_TYPES.CASH_FLOW,
    BUDGET_TYPES.MASTER,
  ]),
  
  fiscalYear: z.number()
    .int()
    .min(2020, 'Fiscal year must be 2020 or later')
    .max(2100, 'Fiscal year must be before 2100'),
  
  periodType: z.enum([
    BUDGET_PERIODS.MONTHLY,
    BUDGET_PERIODS.QUARTERLY,
    BUDGET_PERIODS.SEMI_ANNUAL,
    BUDGET_PERIODS.ANNUAL,
  ]).default(BUDGET_PERIODS.MONTHLY),
  
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  
  currency: z.enum([
    CURRENCIES.UGX,
    CURRENCIES.USD,
    CURRENCIES.EUR,
    CURRENCIES.GBP,
    CURRENCIES.KES,
  ]).default(CURRENCIES.UGX),
  
  parentBudgetId: z.string().optional(),
  
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export type BudgetInputSchema = z.infer<typeof budgetInputSchema>;

// ----------------------------------------------------------------------------
// BUDGET UPDATE SCHEMA
// ----------------------------------------------------------------------------

export const budgetUpdateSchema = z.object({
  name: z.string()
    .min(3)
    .max(100)
    .trim()
    .optional(),
  
  description: z.string()
    .max(500)
    .optional()
    .nullable(),
  
  status: z.enum([
    BUDGET_STATUSES.DRAFT,
    BUDGET_STATUSES.PENDING_APPROVAL,
    BUDGET_STATUSES.APPROVED,
    BUDGET_STATUSES.ACTIVE,
    BUDGET_STATUSES.REVISED,
    BUDGET_STATUSES.CLOSED,
    BUDGET_STATUSES.REJECTED,
  ]).optional(),
  
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export type BudgetUpdateSchema = z.infer<typeof budgetUpdateSchema>;

// ----------------------------------------------------------------------------
// BUDGET LINE INPUT SCHEMA
// ----------------------------------------------------------------------------

export const budgetLineInputSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  
  description: z.string()
    .max(200, 'Description must be at most 200 characters')
    .optional(),
  
  notes: z.string()
    .max(500, 'Notes must be at most 500 characters')
    .optional(),
  
  annualBudget: z.number()
    .min(0, 'Budget amount must be non-negative'),
  
  allocationMethod: z.enum([
    ALLOCATION_METHODS.EQUAL,
    ALLOCATION_METHODS.SEASONAL,
    ALLOCATION_METHODS.HISTORICAL,
    ALLOCATION_METHODS.CUSTOM,
    ALLOCATION_METHODS.FRONT_LOADED,
    ALLOCATION_METHODS.BACK_LOADED,
  ]).default(ALLOCATION_METHODS.EQUAL),
  
  // Custom period amounts (required if allocationMethod is 'custom')
  periodAmounts: z.array(z.number().min(0)).length(12).optional(),
  
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  costCenterId: z.string().optional(),
}).refine(
  (data) => {
    if (data.allocationMethod === 'custom') {
      return data.periodAmounts && data.periodAmounts.length === 12;
    }
    return true;
  },
  {
    message: 'Custom allocation requires 12 period amounts',
    path: ['periodAmounts'],
  }
).refine(
  (data) => {
    if (data.allocationMethod === 'custom' && data.periodAmounts) {
      const total = data.periodAmounts.reduce((sum, amt) => sum + amt, 0);
      return Math.abs(total - data.annualBudget) < 1; // Allow 1 UGX rounding
    }
    return true;
  },
  {
    message: 'Period amounts must sum to annual budget',
    path: ['periodAmounts'],
  }
);

export type BudgetLineInputSchema = z.infer<typeof budgetLineInputSchema>;

// ----------------------------------------------------------------------------
// BUDGET LINE UPDATE SCHEMA
// ----------------------------------------------------------------------------

export const budgetLineUpdateSchema = z.object({
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  annualBudget: z.number().min(0).optional(),
  allocationMethod: z.enum([
    ALLOCATION_METHODS.EQUAL,
    ALLOCATION_METHODS.SEASONAL,
    ALLOCATION_METHODS.HISTORICAL,
    ALLOCATION_METHODS.CUSTOM,
    ALLOCATION_METHODS.FRONT_LOADED,
    ALLOCATION_METHODS.BACK_LOADED,
  ]).optional(),
  periodAmounts: z.array(z.number().min(0)).length(12).optional(),
});

export type BudgetLineUpdateSchema = z.infer<typeof budgetLineUpdateSchema>;

// ----------------------------------------------------------------------------
// BUDGET REVISION SCHEMA
// ----------------------------------------------------------------------------

export const budgetRevisionSchema = z.object({
  reason: z.string()
    .min(10, 'Please provide a reason for the revision (at least 10 characters)')
    .max(500, 'Reason must be at most 500 characters'),
  
  lineChanges: z.array(z.object({
    lineId: z.string(),
    newAmount: z.number().min(0),
    reason: z.string().max(200).optional(),
  })).min(1, 'At least one line change is required'),
});

export type BudgetRevisionSchema = z.infer<typeof budgetRevisionSchema>;

// ----------------------------------------------------------------------------
// BUDGET APPROVAL SCHEMA
// ----------------------------------------------------------------------------

export const budgetApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(500).optional(),
});

export type BudgetApprovalSchema = z.infer<typeof budgetApprovalSchema>;

// ----------------------------------------------------------------------------
// BUDGET FILTER SCHEMA
// ----------------------------------------------------------------------------

export const budgetFilterSchema = z.object({
  type: z.union([
    z.enum([
      BUDGET_TYPES.OPERATING,
      BUDGET_TYPES.CAPITAL,
      BUDGET_TYPES.PROJECT,
      BUDGET_TYPES.DEPARTMENTAL,
      BUDGET_TYPES.CASH_FLOW,
      BUDGET_TYPES.MASTER,
    ]),
    z.array(z.enum([
      BUDGET_TYPES.OPERATING,
      BUDGET_TYPES.CAPITAL,
      BUDGET_TYPES.PROJECT,
      BUDGET_TYPES.DEPARTMENTAL,
      BUDGET_TYPES.CASH_FLOW,
      BUDGET_TYPES.MASTER,
    ])),
  ]).optional(),
  
  status: z.union([
    z.enum([
      BUDGET_STATUSES.DRAFT,
      BUDGET_STATUSES.PENDING_APPROVAL,
      BUDGET_STATUSES.APPROVED,
      BUDGET_STATUSES.ACTIVE,
      BUDGET_STATUSES.REVISED,
      BUDGET_STATUSES.CLOSED,
      BUDGET_STATUSES.REJECTED,
    ]),
    z.array(z.enum([
      BUDGET_STATUSES.DRAFT,
      BUDGET_STATUSES.PENDING_APPROVAL,
      BUDGET_STATUSES.APPROVED,
      BUDGET_STATUSES.ACTIVE,
      BUDGET_STATUSES.REVISED,
      BUDGET_STATUSES.CLOSED,
      BUDGET_STATUSES.REJECTED,
    ])),
  ]).optional(),
  
  fiscalYear: z.number().int().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  searchTerm: z.string().optional(),
});

export type BudgetFilterSchema = z.infer<typeof budgetFilterSchema>;
