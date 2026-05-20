// ============================================================================
// CAPITAL HUB SCHEMAS
// DawinOS v2.0 — Zod validation for capital seeking & readiness
// ============================================================================

import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// CAPITAL NEED
// ────────────────────────────────────────────────────────────────────────────

export const capitalNeedSchema = z.object({
  type: z.enum([
    'working_capital',
    'asset_acquisition',
    'growth',
    'seasonal',
    'debt_refinancing',
    'emergency',
  ]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  amountRequired: z.number().positive(),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  urgency: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']),
  status: z.enum([
    'identified',
    'analyzing',
    'seeking',
    'applied',
    'resolved',
    'deferred',
  ]).default('identified'),
  detectedBy: z.enum(['system', 'manual']).default('manual'),
  detectionSource: z
    .enum(['cashflow_gap', 'asset_plan', 'liability_pressure', 'growth_plan'])
    .optional(),
});

export type CapitalNeedInput = z.infer<typeof capitalNeedSchema>;

export const capitalNeedUpdateSchema = capitalNeedSchema.partial();
export type CapitalNeedUpdateInput = z.infer<typeof capitalNeedUpdateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// CAPITAL PRODUCT
// ────────────────────────────────────────────────────────────────────────────

export const productRequirementSchema = z.object({
  document: z.string().min(1),
  description: z.string().optional(),
  mandatory: z.boolean(),
});

export const capitalProductSchema = z.object({
  name: z.string().min(1).max(200),
  provider: z.string().min(1).max(200),
  providerType: z.enum([
    'bank',
    'dfi',
    'government',
    'investor',
    'supplier',
    'microfinance',
    'fintech',
  ]),
  productType: z.enum([
    'term_loan',
    'overdraft',
    'line_of_credit',
    'asset_finance',
    'trade_finance',
    'invoice_discounting',
    'factoring',
    'lpo_financing',
    'lease',
    'hire_purchase',
    'equity',
    'convertible_note',
    'grant',
    'dfi_loan',
    'supplier_credit',
    'microfinance',
  ]),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  interestRate: z.number().min(0).max(100).optional(),
  interestType: z.enum(['fixed', 'variable', 'reducing_balance']).optional(),
  tenorMinMonths: z.number().int().positive().optional(),
  tenorMaxMonths: z.number().int().positive().optional(),
  processingFee: z.number().min(0).max(100).optional(),
  collateralRequired: z.boolean().default(false),
  collateralTypes: z.array(z.string()).optional(),
  requirements: z.array(productRequirementSchema).default([]),
  minRevenue: z.number().positive().optional(),
  minYearsInBusiness: z.number().int().min(0).optional(),
  sectors: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
  contactPerson: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
});

export type CapitalProductInput = z.infer<typeof capitalProductSchema>;

export const capitalProductUpdateSchema = capitalProductSchema.partial();
export type CapitalProductUpdateInput = z.infer<typeof capitalProductUpdateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// FACILITY TERMS (shared between application and facility)
// ────────────────────────────────────────────────────────────────────────────

export const facilityTermsSchema = z.object({
  interestRate: z.number().min(0).max(100),
  interestType: z.enum(['fixed', 'variable', 'reducing_balance']),
  tenorMonths: z.number().int().positive(),
  repaymentFrequency: z.enum([
    'monthly',
    'quarterly',
    'semi_annually',
    'annually',
    'bullet',
  ]),
  processingFee: z.number().min(0).max(100).optional(),
  insuranceFee: z.number().min(0).max(100).optional(),
  collateral: z.array(z.string()).optional(),
  gracePeriodMonths: z.number().int().min(0).optional(),
});

export type FacilityTermsInput = z.infer<typeof facilityTermsSchema>;

// ────────────────────────────────────────────────────────────────────────────
// CAPITAL APPLICATION
// ────────────────────────────────────────────────────────────────────────────

export const applicationDocumentSchema = z.object({
  name: z.string().min(1),
  category: z.string(),
  url: z.string().url().optional(),
  status: z.enum(['pending', 'uploaded', 'submitted', 'accepted', 'rejected']).default('pending'),
  notes: z.string().optional(),
});

export const applicationCommunicationSchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'letter', 'portal']),
  summary: z.string().min(1).max(2000),
  contactPerson: z.string().optional(),
  outcome: z.string().optional(),
});

export const capitalApplicationSchema = z.object({
  needId: z.string().optional(),
  productId: z.string().optional(),
  provider: z.string().min(1).max(200),
  productType: z.enum([
    'term_loan',
    'overdraft',
    'line_of_credit',
    'asset_finance',
    'trade_finance',
    'invoice_discounting',
    'factoring',
    'lpo_financing',
    'lease',
    'hire_purchase',
    'equity',
    'convertible_note',
    'grant',
    'dfi_loan',
    'supplier_credit',
    'microfinance',
  ]),
  amountRequested: z.number().positive(),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  stage: z.enum([
    'identifying',
    'preparing',
    'submitted',
    'under_review',
    'additional_info',
    'approved',
    'disbursing',
    'completed',
    'declined',
    'withdrawn',
  ]).default('identifying'),
  proposedTerms: facilityTermsSchema.optional(),
  assignedTo: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export type CapitalApplicationInput = z.infer<typeof capitalApplicationSchema>;

export const capitalApplicationUpdateSchema = capitalApplicationSchema.partial();
export type CapitalApplicationUpdateInput = z.infer<typeof capitalApplicationUpdateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// CAPITAL FACILITY
// ────────────────────────────────────────────────────────────────────────────

export const covenantSchema = z.object({
  name: z.string().min(1),
  metric: z.string(),
  threshold: z.number(),
  operator: z.enum(['gte', 'lte', 'eq']),
});

export const capitalFacilitySchema = z.object({
  applicationId: z.string().optional(),
  provider: z.string().min(1).max(200),
  productType: z.enum([
    'term_loan',
    'overdraft',
    'line_of_credit',
    'asset_finance',
    'trade_finance',
    'invoice_discounting',
    'factoring',
    'lpo_financing',
    'lease',
    'hire_purchase',
    'equity',
    'convertible_note',
    'grant',
    'dfi_loan',
    'supplier_credit',
    'microfinance',
  ]),
  facilityName: z.string().min(1).max(200),
  accountReference: z.string().max(100).optional(),
  facilityLimit: z.number().positive(),
  amountDisbursed: z.number().min(0).default(0),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  terms: facilityTermsSchema,
  isRevolving: z.boolean().default(false),
  covenants: z.array(covenantSchema).optional(),
  status: z.enum(['active', 'fully_repaid', 'defaulted', 'restructured', 'expired']).default('active'),
  liabilityId: z.string().optional(),
});

export type CapitalFacilityInput = z.infer<typeof capitalFacilitySchema>;

export const capitalFacilityUpdateSchema = capitalFacilitySchema.partial();
export type CapitalFacilityUpdateInput = z.infer<typeof capitalFacilityUpdateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// READINESS CHECKLIST ITEM
// ────────────────────────────────────────────────────────────────────────────

export const checklistItemUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(['complete', 'partial', 'missing', 'expired', 'not_applicable']),
  notes: z.string().optional(),
  documentUrl: z.string().url().optional(),
});

export type ChecklistItemUpdateInput = z.infer<typeof checklistItemUpdateSchema>;
