// ============================================================================
// ACCOUNT TYPES
// DawinOS v2.0 - Financial Management Module
// TypeScript interfaces for Chart of Accounts
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  AccountType,
  AccountSubType,
  AccountStatus,
  AccountLevel,
} from '../constants/account.constants';
import { CurrencyCode } from '../constants/currency.constants';

/**
 * Account Balance Structure
 */
export interface AccountBalance {
  /** Debit balance in account currency */
  debit: number;
  /** Credit balance in account currency */
  credit: number;
  /** Net balance (debit - credit for debit accounts, credit - debit for credit accounts) */
  balance: number;
  /** Balance in functional currency (UGX) */
  functionalBalance: number;
  /** Last updated timestamp */
  updatedAt: Timestamp;
}

/**
 * Period Balance for historical tracking
 */
export interface PeriodBalance {
  /** Fiscal year */
  fiscalYear: number;
  /** Period (1-12 for months, 1-4 for quarters) */
  period: number;
  /** Period type */
  periodType: 'month' | 'quarter' | 'year';
  /** Opening balance */
  openingBalance: number;
  /** Total debits in period */
  periodDebits: number;
  /** Total credits in period */
  periodCredits: number;
  /** Closing balance */
  closingBalance: number;
  /** Functional currency balance */
  functionalBalance: number;
}

/**
 * Account Document - Firestore structure
 */
export interface Account {
  /** Unique account ID */
  id: string;
  /** Company ID */
  companyId: string;
  /** Account code (6-digit) */
  code: string;
  /** Account name */
  name: string;
  /** Account description */
  description?: string;
  
  // Classification
  /** Account type */
  type: AccountType;
  /** Account sub-type */
  subType: AccountSubType;
  /** Hierarchy level */
  level: AccountLevel;
  
  // Hierarchy
  /** Parent account ID */
  parentId: string | null;
  /** Path of ancestor IDs */
  ancestorIds: string[];
  /** Full path (code-based) for sorting */
  path: string;
  /** Is this a header/group account? */
  isHeader: boolean;
  /** Can transactions be posted to this account? */
  isPostable: boolean;
  
  // Currency
  /** Account currency */
  currency: CurrencyCode;
  /** Is this a multi-currency account? */
  isMultiCurrency: boolean;
  
  // Balance
  /** Current balance */
  balance: AccountBalance;
  /** Budget amount for current period */
  budgetAmount?: number;
  
  // Status & Metadata
  /** Account status */
  status: AccountStatus;
  /** Is this a system account? */
  isSystem: boolean;
  /** System account key (if system account) */
  systemKey?: string;
  /** Tags for filtering */
  tags: string[];
  /** Custom fields */
  customFields?: Record<string, unknown>;
  
  // Audit
  /** Created by user ID */
  createdBy: string;
  /** Created timestamp */
  createdAt: Timestamp;
  /** Last updated by user ID */
  updatedBy: string;
  /** Updated timestamp */
  updatedAt: Timestamp;
}

/**
 * Account Tree Node - For hierarchical display
 */
export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  level: AccountLevel;
  balance: number;
  currency: CurrencyCode;
  isHeader: boolean;
  isPostable: boolean;
  status: AccountStatus;
  children: AccountTreeNode[];
  expanded?: boolean;
}

/**
 * Account Summary - For list views
 */
export interface AccountSummary {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  balance: number;
  currency: CurrencyCode;
  status: AccountStatus;
  childCount: number;
}

/**
 * Account Create Input
 */
export interface AccountCreateInput {
  code: string;
  name: string;
  description?: string;
  type: AccountType;
  subType: AccountSubType;
  parentId?: string;
  currency?: CurrencyCode;
  isHeader?: boolean;
  isPostable?: boolean;
  tags?: string[];
}

/**
 * Account Update Input
 */
export interface AccountUpdateInput {
  name?: string;
  description?: string;
  parentId?: string | null;
  status?: AccountStatus;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

/**
 * Account Filter Options
 */
export interface AccountFilter {
  types?: AccountType[];
  subTypes?: AccountSubType[];
  status?: AccountStatus[];
  isHeader?: boolean;
  isPostable?: boolean;
  parentId?: string;
  currency?: CurrencyCode;
  search?: string;
  tags?: string[];
}

/**
 * Account Sort Options
 */
export interface AccountSort {
  field: 'code' | 'name' | 'balance' | 'type' | 'updatedAt';
  direction: 'asc' | 'desc';
}

/**
 * Trial Balance Entry
 */
export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

/**
 * Trial Balance Report
 */
export interface TrialBalance {
  companyId: string;
  asOfDate: Timestamp;
  fiscalYear: number;
  period?: number;
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  generatedAt: Timestamp;
  generatedBy: string;
}
