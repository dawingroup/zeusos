// ============================================================================
// JOURNAL SCHEMAS
// DawinOS v2.0 - Financial Management Module
// Zod validation schemas for journal entries
// ============================================================================

import { z } from 'zod';
import {
  JOURNAL_TYPES,
  JOURNAL_SOURCES,
} from '../types/journal.types';
import { CURRENCIES } from '../constants/currency.constants';

/**
 * Journal Line Schema
 */
export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  description: z.string().max(500).optional(),
  debit: z.number().min(0, 'Debit must be non-negative').default(0),
  credit: z.number().min(0, 'Credit must be non-negative').default(0),
  dimensions: z.object({
    departmentId: z.string().optional(),
    projectId: z.string().optional(),
    costCenterId: z.string().optional(),
    customerId: z.string().optional(),
    vendorId: z.string().optional(),
  }).optional(),
}).refine(
  (data) => data.debit > 0 || data.credit > 0,
  { message: 'Line must have either debit or credit amount' }
).refine(
  (data) => !(data.debit > 0 && data.credit > 0),
  { message: 'Line cannot have both debit and credit amounts' }
);

/**
 * Journal Entry Create Schema
 */
export const journalEntryCreateSchema = z.object({
  date: z.date(),
  type: z.enum([
    JOURNAL_TYPES.STANDARD,
    JOURNAL_TYPES.ADJUSTING,
    JOURNAL_TYPES.CLOSING,
    JOURNAL_TYPES.REVERSING,
    JOURNAL_TYPES.RECURRING,
    JOURNAL_TYPES.OPENING,
  ] as const).default(JOURNAL_TYPES.STANDARD),
  source: z.enum([
    JOURNAL_SOURCES.MANUAL,
    JOURNAL_SOURCES.INVOICE,
    JOURNAL_SOURCES.PAYMENT,
    JOURNAL_SOURCES.PAYROLL,
    JOURNAL_SOURCES.INVENTORY,
    JOURNAL_SOURCES.DEPRECIATION,
    JOURNAL_SOURCES.BANK_RECONCILIATION,
    JOURNAL_SOURCES.BUDGET_TRANSFER,
    JOURNAL_SOURCES.SYSTEM,
  ] as const).default(JOURNAL_SOURCES.MANUAL),
  sourceId: z.string().optional(),
  sourceReference: z.string().max(100).optional(),
  description: z
    .string()
    .min(5, 'Description must be at least 5 characters')
    .max(500, 'Description must be at most 500 characters'),
  currency: z.enum([
    CURRENCIES.UGX,
    CURRENCIES.USD,
    CURRENCIES.EUR,
    CURRENCIES.GBP,
    CURRENCIES.KES,
  ] as const).default(CURRENCIES.UGX),
  exchangeRate: z.number().positive().default(1),
  lines: z
    .array(journalLineSchema)
    .min(2, 'Journal must have at least 2 lines'),
  autoReverse: z.boolean().default(false),
  autoReverseDate: z.date().optional(),
  attachments: z.array(z.string().url()).default([]),
}).refine(
  (data) => {
    const totalDebits = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = data.lines.reduce((sum, line) => sum + line.credit, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01;
  },
  { message: 'Journal entry must be balanced (total debits = total credits)' }
).refine(
  (data) => !data.autoReverse || data.autoReverseDate,
  { message: 'Auto-reverse date is required when auto-reverse is enabled' }
);

export type JournalEntryCreateSchemaType = z.infer<typeof journalEntryCreateSchema>;

/**
 * Journal Entry Update Schema
 */
export const journalEntryUpdateSchema = z.object({
  date: z.date().optional(),
  description: z
    .string()
    .min(5, 'Description must be at least 5 characters')
    .max(500, 'Description must be at most 500 characters')
    .optional(),
  lines: z.array(journalLineSchema).min(2).optional(),
  attachments: z.array(z.string().url()).optional(),
});

export type JournalEntryUpdateSchemaType = z.infer<typeof journalEntryUpdateSchema>;

/**
 * Journal Filter Schema
 */
export const journalFilterSchema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
  fiscalPeriod: z.number().int().min(1).max(12).optional(),
  types: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  accountIds: z.array(z.string()).optional(),
  search: z.string().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
});

export type JournalFilterSchemaType = z.infer<typeof journalFilterSchema>;
