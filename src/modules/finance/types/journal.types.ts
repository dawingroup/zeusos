// ============================================================================
// JOURNAL TYPES
// DawinOS v2.0 - Financial Management Module
// TypeScript interfaces for Journal Entries
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import { CurrencyCode } from '../constants/currency.constants';

/**
 * Journal Entry Status
 */
export const JOURNAL_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  POSTED: 'posted',
  REVERSED: 'reversed',
  VOID: 'void',
} as const;

export type JournalStatus = typeof JOURNAL_STATUS[keyof typeof JOURNAL_STATUS];

/**
 * Journal Entry Types
 */
export const JOURNAL_TYPES = {
  STANDARD: 'standard',
  ADJUSTING: 'adjusting',
  CLOSING: 'closing',
  REVERSING: 'reversing',
  RECURRING: 'recurring',
  OPENING: 'opening',
} as const;

export type JournalType = typeof JOURNAL_TYPES[keyof typeof JOURNAL_TYPES];

/**
 * Journal Source Types
 */
export const JOURNAL_SOURCES = {
  MANUAL: 'manual',
  INVOICE: 'invoice',
  PAYMENT: 'payment',
  PAYROLL: 'payroll',
  INVENTORY: 'inventory',
  DEPRECIATION: 'depreciation',
  BANK_RECONCILIATION: 'bank_reconciliation',
  BUDGET_TRANSFER: 'budget_transfer',
  SYSTEM: 'system',
} as const;

export type JournalSource = typeof JOURNAL_SOURCES[keyof typeof JOURNAL_SOURCES];

/**
 * Journal Line Item
 */
export interface JournalLine {
  /** Line ID */
  id: string;
  /** Line number */
  lineNumber: number;
  /** Account ID */
  accountId: string;
  /** Account code (denormalized) */
  accountCode: string;
  /** Account name (denormalized) */
  accountName: string;
  /** Line description */
  description?: string;
  /** Debit amount in transaction currency */
  debit: number;
  /** Credit amount in transaction currency */
  credit: number;
  /** Currency for this line */
  currency: CurrencyCode;
  /** Exchange rate to functional currency */
  exchangeRate: number;
  /** Debit in functional currency */
  functionalDebit: number;
  /** Credit in functional currency */
  functionalCredit: number;
  /** Reference dimensions */
  dimensions?: {
    departmentId?: string;
    projectId?: string;
    costCenterId?: string;
    customerId?: string;
    vendorId?: string;
  };
  /** Tax information */
  tax?: {
    taxCodeId: string;
    taxRate: number;
    taxAmount: number;
    isTaxInclusive: boolean;
  };
}

/**
 * Journal Entry Document
 */
export interface JournalEntry {
  /** Unique journal ID */
  id: string;
  /** Company ID */
  companyId: string;
  /** Journal number (auto-generated) */
  journalNumber: string;
  /** Journal date */
  date: Timestamp;
  /** Fiscal year */
  fiscalYear: number;
  /** Fiscal period (1-12) */
  fiscalPeriod: number;
  
  // Classification
  /** Journal type */
  type: JournalType;
  /** Source type */
  source: JournalSource;
  /** Source document ID */
  sourceId?: string;
  /** Source document reference */
  sourceReference?: string;
  
  // Content
  /** Journal description */
  description: string;
  /** Journal line items */
  lines: JournalLine[];
  
  // Totals
  /** Total debits */
  totalDebits: number;
  /** Total credits */
  totalCredits: number;
  /** Functional currency total debits */
  functionalTotalDebits: number;
  /** Functional currency total credits */
  functionalTotalCredits: number;
  /** Is balanced? */
  isBalanced: boolean;
  
  // Currency
  /** Primary transaction currency */
  currency: CurrencyCode;
  /** Exchange rate to functional currency */
  exchangeRate: number;
  
  // Status
  /** Journal status */
  status: JournalStatus;
  /** Posted timestamp */
  postedAt?: Timestamp;
  /** Posted by user ID */
  postedBy?: string;
  
  // Reversals
  /** Is this a reversal? */
  isReversal: boolean;
  /** Original journal ID (if reversal) */
  reversalOfId?: string;
  /** Reversal journal ID (if reversed) */
  reversedById?: string;
  /** Auto-reverse date */
  autoReverseDate?: Timestamp;
  
  // Recurring
  /** Is recurring? */
  isRecurring: boolean;
  /** Recurring schedule ID */
  recurringScheduleId?: string;
  
  // Attachments
  /** Attached document URLs */
  attachments: string[];
  
  // Audit
  /** Created by user ID */
  createdBy: string;
  /** Created timestamp */
  createdAt: Timestamp;
  /** Last updated by user ID */
  updatedBy: string;
  /** Updated timestamp */
  updatedAt: Timestamp;
  /** Approval history */
  approvalHistory?: Array<{
    action: 'submitted' | 'approved' | 'rejected';
    userId: string;
    timestamp: Timestamp;
    comments?: string;
  }>;
}

/**
 * Journal Entry Create Input
 */
export interface JournalEntryCreateInput {
  date: Date;
  type?: JournalType;
  source?: JournalSource;
  sourceId?: string;
  sourceReference?: string;
  description: string;
  currency?: CurrencyCode;
  exchangeRate?: number;
  lines: Array<{
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
    dimensions?: JournalLine['dimensions'];
  }>;
  autoReverse?: boolean;
  autoReverseDate?: Date;
  attachments?: string[];
}

/**
 * Journal Entry Update Input
 */
export interface JournalEntryUpdateInput {
  date?: Date;
  description?: string;
  lines?: JournalEntryCreateInput['lines'];
  attachments?: string[];
}

/**
 * Journal Filter Options
 */
export interface JournalFilter {
  dateFrom?: Date;
  dateTo?: Date;
  fiscalYear?: number;
  fiscalPeriod?: number;
  types?: JournalType[];
  sources?: JournalSource[];
  status?: JournalStatus[];
  accountIds?: string[];
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Journal Sort Options
 */
export interface JournalSort {
  field: 'date' | 'journalNumber' | 'totalDebits' | 'createdAt';
  direction: 'asc' | 'desc';
}

/**
 * Ledger Entry - Account-centric view of transactions
 */
export interface LedgerEntry {
  id: string;
  journalId: string;
  journalNumber: string;
  date: Timestamp;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  currency: CurrencyCode;
  source: JournalSource;
  sourceReference?: string;
}
