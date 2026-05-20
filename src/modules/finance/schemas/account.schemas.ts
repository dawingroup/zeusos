// ============================================================================
// ACCOUNT SCHEMAS
// DawinOS v2.0 - Financial Management Module
// Zod validation schemas for accounts
// ============================================================================

import { z } from 'zod';
import {
  ACCOUNT_TYPES,
  ACCOUNT_SUB_TYPES,
  ACCOUNT_STATUS,
  ACCOUNT_CODE_FORMAT,
  ACCOUNT_CODE_RANGES,
  AccountType,
} from '../constants/account.constants';
import { CURRENCIES } from '../constants/currency.constants';

/**
 * Account code validation
 */
const accountCodeSchema = z
  .string()
  .length(ACCOUNT_CODE_FORMAT.TOTAL_DIGITS, `Account code must be ${ACCOUNT_CODE_FORMAT.TOTAL_DIGITS} digits`)
  .regex(/^\d+$/, 'Account code must contain only digits');

/**
 * Validate account code is in correct range for type
 */
export function validateAccountCodeForType(code: string, type: AccountType): boolean {
  const numericCode = parseInt(code, 10);
  const range = ACCOUNT_CODE_RANGES[type];
  return numericCode >= range.start && numericCode <= range.end;
}

/**
 * Account Create Schema
 */
export const accountCreateSchema = z.object({
  code: accountCodeSchema,
  name: z
    .string()
    .min(2, 'Account name must be at least 2 characters')
    .max(100, 'Account name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  type: z.enum([
    ACCOUNT_TYPES.ASSET,
    ACCOUNT_TYPES.LIABILITY,
    ACCOUNT_TYPES.EQUITY,
    ACCOUNT_TYPES.REVENUE,
    ACCOUNT_TYPES.EXPENSE,
  ] as const),
  subType: z.enum([
    ACCOUNT_SUB_TYPES.CURRENT_ASSET,
    ACCOUNT_SUB_TYPES.FIXED_ASSET,
    ACCOUNT_SUB_TYPES.INTANGIBLE_ASSET,
    ACCOUNT_SUB_TYPES.OTHER_ASSET,
    ACCOUNT_SUB_TYPES.CURRENT_LIABILITY,
    ACCOUNT_SUB_TYPES.LONG_TERM_LIABILITY,
    ACCOUNT_SUB_TYPES.OTHER_LIABILITY,
    ACCOUNT_SUB_TYPES.SHARE_CAPITAL,
    ACCOUNT_SUB_TYPES.RETAINED_EARNINGS,
    ACCOUNT_SUB_TYPES.RESERVES,
    ACCOUNT_SUB_TYPES.OPERATING_REVENUE,
    ACCOUNT_SUB_TYPES.NON_OPERATING_REVENUE,
    ACCOUNT_SUB_TYPES.OTHER_INCOME,
    ACCOUNT_SUB_TYPES.COST_OF_SALES,
    ACCOUNT_SUB_TYPES.OPERATING_EXPENSE,
    ACCOUNT_SUB_TYPES.ADMINISTRATIVE_EXPENSE,
    ACCOUNT_SUB_TYPES.FINANCIAL_EXPENSE,
    ACCOUNT_SUB_TYPES.OTHER_EXPENSE,
  ] as const),
  parentId: z.string().optional(),
  currency: z.enum([
    CURRENCIES.UGX,
    CURRENCIES.USD,
    CURRENCIES.EUR,
    CURRENCIES.GBP,
    CURRENCIES.KES,
  ] as const).default(CURRENCIES.UGX),
  isHeader: z.boolean().default(false),
  isPostable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
}).refine(
  (data) => validateAccountCodeForType(data.code, data.type),
  {
    message: 'Account code is not in valid range for account type',
    path: ['code'],
  }
);

export type AccountCreateSchemaType = z.infer<typeof accountCreateSchema>;

/**
 * Account Update Schema
 */
export const accountUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'Account name must be at least 2 characters')
    .max(100, 'Account name must be at most 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  parentId: z.string().nullable().optional(),
  status: z.enum([
    ACCOUNT_STATUS.ACTIVE,
    ACCOUNT_STATUS.INACTIVE,
    ACCOUNT_STATUS.ARCHIVED,
  ] as const).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type AccountUpdateSchemaType = z.infer<typeof accountUpdateSchema>;

/**
 * Account Filter Schema
 */
export const accountFilterSchema = z.object({
  types: z.array(z.enum([
    ACCOUNT_TYPES.ASSET,
    ACCOUNT_TYPES.LIABILITY,
    ACCOUNT_TYPES.EQUITY,
    ACCOUNT_TYPES.REVENUE,
    ACCOUNT_TYPES.EXPENSE,
  ] as const)).optional(),
  subTypes: z.array(z.string()).optional(),
  status: z.array(z.enum([
    ACCOUNT_STATUS.ACTIVE,
    ACCOUNT_STATUS.INACTIVE,
    ACCOUNT_STATUS.ARCHIVED,
  ] as const)).optional(),
  isHeader: z.boolean().optional(),
  isPostable: z.boolean().optional(),
  parentId: z.string().optional(),
  currency: z.enum([
    CURRENCIES.UGX,
    CURRENCIES.USD,
    CURRENCIES.EUR,
    CURRENCIES.GBP,
    CURRENCIES.KES,
  ] as const).optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type AccountFilterSchemaType = z.infer<typeof accountFilterSchema>;
