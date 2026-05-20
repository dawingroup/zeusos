// ============================================================================
// ACCOUNT SERVICE
// DawinOS v2.0 - Financial Management Module
// Service for Chart of Accounts management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  DocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  Account,
  AccountTreeNode,
  AccountCreateInput,
  AccountUpdateInput,
  AccountFilter,
  AccountSort,
  TrialBalance,
  TrialBalanceEntry,
} from '../types/account.types';
import {
  ACCOUNT_TYPES,
  ACCOUNT_STATUS,
  ACCOUNT_LEVELS,
  NORMAL_BALANCE,
  AccountLevel,
} from '../constants/account.constants';
import { DEFAULT_CURRENCY } from '../constants/currency.constants';

const COLLECTION_NAME = 'accounts';

/**
 * Account Service Class
 */
class AccountService {
  private collectionRef(companyId: string) {
    return collection(db, 'companies', companyId, COLLECTION_NAME);
  }

  private docRef(companyId: string, accountId: string) {
    return doc(db, 'companies', companyId, COLLECTION_NAME, accountId);
  }

  /**
   * Get account by ID
   */
  async getById(companyId: string, accountId: string): Promise<Account | null> {
    const docSnap = await getDoc(this.docRef(companyId, accountId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Account;
  }

  /**
   * Get account by code
   */
  async getByCode(companyId: string, code: string): Promise<Account | null> {
    const q = query(
      this.collectionRef(companyId),
      where('code', '==', code),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Account;
  }

  /**
   * Get all accounts with optional filtering
   */
  async getAll(
    companyId: string,
    filter?: AccountFilter,
    sort?: AccountSort,
    pageSize: number = 100,
    lastDoc?: DocumentSnapshot
  ): Promise<{ accounts: Account[]; lastDoc: DocumentSnapshot | null }> {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filter?.types && filter.types.length > 0) {
      constraints.push(where('type', 'in', filter.types));
    }
    if (filter?.status && filter.status.length > 0) {
      constraints.push(where('status', 'in', filter.status));
    }
    if (filter?.isHeader !== undefined) {
      constraints.push(where('isHeader', '==', filter.isHeader));
    }
    if (filter?.isPostable !== undefined) {
      constraints.push(where('isPostable', '==', filter.isPostable));
    }
    if (filter?.parentId) {
      constraints.push(where('parentId', '==', filter.parentId));
    }
    if (filter?.currency) {
      constraints.push(where('currency', '==', filter.currency));
    }

    // Apply sorting
    const sortField = sort?.field || 'code';
    const sortDirection = sort?.direction || 'asc';
    constraints.push(orderBy(sortField, sortDirection));

    // Apply pagination
    constraints.push(limit(pageSize));
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(this.collectionRef(companyId), ...constraints);
    const snapshot = await getDocs(q);

    const accounts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Account[];

    // Apply search filter (client-side for now)
    let filteredAccounts = accounts;
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      filteredAccounts = accounts.filter(
        (a) =>
          a.code.includes(searchLower) ||
          a.name.toLowerCase().includes(searchLower) ||
          a.description?.toLowerCase().includes(searchLower)
      );
    }

    const newLastDoc = snapshot.docs.length > 0 
      ? snapshot.docs[snapshot.docs.length - 1] 
      : null;

    return { accounts: filteredAccounts, lastDoc: newLastDoc };
  }

  /**
   * Get accounts as tree structure
   */
  async getTree(companyId: string): Promise<AccountTreeNode[]> {
    const { accounts } = await this.getAll(companyId, {
      status: [ACCOUNT_STATUS.ACTIVE],
    });

    // Build tree
    const nodeMap = new Map<string, AccountTreeNode>();
    const roots: AccountTreeNode[] = [];

    // First pass: create all nodes
    accounts.forEach((account) => {
      nodeMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        subType: account.subType,
        level: account.level,
        balance: account.balance.balance,
        currency: account.currency,
        isHeader: account.isHeader,
        isPostable: account.isPostable,
        status: account.status,
        children: [],
        expanded: false,
      });
    });

    // Second pass: build hierarchy
    accounts.forEach((account) => {
      const node = nodeMap.get(account.id)!;
      if (account.parentId && nodeMap.has(account.parentId)) {
        nodeMap.get(account.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by code
    const sortChildren = (nodes: AccountTreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach((node) => sortChildren(node.children));
    };
    sortChildren(roots);

    return roots;
  }

  /**
   * Create new account
   */
  async create(
    companyId: string,
    userId: string,
    input: AccountCreateInput
  ): Promise<Account> {
    // Validate code uniqueness
    const existing = await this.getByCode(companyId, input.code);
    if (existing) {
      throw new Error(`Account with code ${input.code} already exists`);
    }

    // Get parent account if specified
    let parentAccount: Account | null = null;
    let level: AccountLevel = ACCOUNT_LEVELS.TYPE;
    let ancestorIds: string[] = [];
    let path = input.code;

    if (input.parentId) {
      parentAccount = await this.getById(companyId, input.parentId);
      if (!parentAccount) {
        throw new Error(`Parent account ${input.parentId} not found`);
      }
      // Validate same account type
      if (parentAccount.type !== input.type) {
        throw new Error('Child account must have same type as parent');
      }
      level = Math.min(parentAccount.level + 1, ACCOUNT_LEVELS.DETAIL) as AccountLevel;
      ancestorIds = [...parentAccount.ancestorIds, parentAccount.id];
      path = `${parentAccount.path}/${input.code}`;
    }

    const accountId = doc(this.collectionRef(companyId)).id;
    const now = Timestamp.now();

    const account: Account = {
      id: accountId,
      companyId,
      code: input.code,
      name: input.name,
      description: input.description,
      type: input.type,
      subType: input.subType,
      level,
      parentId: input.parentId || null,
      ancestorIds,
      path,
      isHeader: input.isHeader ?? false,
      isPostable: input.isPostable ?? !input.isHeader,
      currency: input.currency || DEFAULT_CURRENCY,
      isMultiCurrency: false,
      balance: {
        debit: 0,
        credit: 0,
        balance: 0,
        functionalBalance: 0,
        updatedAt: now,
      },
      status: ACCOUNT_STATUS.ACTIVE,
      isSystem: false,
      tags: input.tags || [],
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    };

    await setDoc(this.docRef(companyId, accountId), account);
    return account;
  }

  /**
   * Update account
   */
  async update(
    companyId: string,
    accountId: string,
    userId: string,
    input: AccountUpdateInput
  ): Promise<Account> {
    const account = await this.getById(companyId, accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Prevent updating system accounts
    if (account.isSystem && input.status === ACCOUNT_STATUS.ARCHIVED) {
      throw new Error('Cannot archive system accounts');
    }

    // Handle parent change
    const updateData: Partial<Account> = {
      ...input,
      updatedBy: userId,
      updatedAt: Timestamp.now(),
    };

    if (input.parentId !== undefined && input.parentId !== account.parentId) {
      if (input.parentId) {
        const newParent = await this.getById(companyId, input.parentId);
        if (!newParent) {
          throw new Error(`Parent account ${input.parentId} not found`);
        }
        if (newParent.type !== account.type) {
          throw new Error('Parent must have same account type');
        }
        updateData.level = Math.min(newParent.level + 1, ACCOUNT_LEVELS.DETAIL) as AccountLevel;
        updateData.ancestorIds = [...newParent.ancestorIds, newParent.id];
        updateData.path = `${newParent.path}/${account.code}`;
      } else {
        updateData.level = ACCOUNT_LEVELS.TYPE;
        updateData.ancestorIds = [];
        updateData.path = account.code;
      }
    }

    await updateDoc(this.docRef(companyId, accountId), updateData);
    return { ...account, ...updateData } as Account;
  }

  /**
   * Delete account (soft delete via archive)
   */
  async delete(companyId: string, accountId: string, userId: string): Promise<void> {
    const account = await this.getById(companyId, accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    if (account.isSystem) {
      throw new Error('Cannot delete system accounts');
    }

    if (account.balance.balance !== 0) {
      throw new Error('Cannot delete account with non-zero balance');
    }

    // Check for child accounts
    const { accounts: children } = await this.getAll(companyId, {
      status: [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.INACTIVE],
    });
    const hasChildren = children.some((a) => a.parentId === accountId);
    if (hasChildren) {
      throw new Error('Cannot delete account with child accounts');
    }

    await updateDoc(this.docRef(companyId, accountId), {
      status: ACCOUNT_STATUS.ARCHIVED,
      updatedBy: userId,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Generate trial balance
   */
  async generateTrialBalance(
    companyId: string,
    userId: string,
    asOfDate: Date,
    fiscalYear: number,
    fiscalPeriod?: number
  ): Promise<TrialBalance> {
    const { accounts } = await this.getAll(companyId, {
      status: [ACCOUNT_STATUS.ACTIVE],
      isPostable: true,
    });

    const entries: TrialBalanceEntry[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accounts) {
      const balance = account.balance.balance;
      if (balance === 0) continue;

      const isDebitNormal = NORMAL_BALANCE[account.type] === 'debit';
      const debit = isDebitNormal && balance > 0 ? balance : (!isDebitNormal && balance < 0 ? Math.abs(balance) : 0);
      const credit = !isDebitNormal && balance > 0 ? balance : (isDebitNormal && balance < 0 ? Math.abs(balance) : 0);

      entries.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit,
        credit,
        balance,
      });

      totalDebits += debit;
      totalCredits += credit;
    }

    // Sort by account code
    entries.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      companyId,
      asOfDate: Timestamp.fromDate(asOfDate),
      fiscalYear,
      period: fiscalPeriod,
      entries,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      generatedAt: Timestamp.now(),
      generatedBy: userId,
    };
  }

  /**
   * Initialize default chart of accounts
   */
  async initializeDefaultAccounts(companyId: string, userId: string): Promise<void> {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    const defaultAccounts: Array<{
      code: string;
      name: string;
      type: typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES];
      subType: string;
      isHeader?: boolean;
      systemKey?: string;
      isSystem?: boolean;
      currency?: string;
    }> = [
      // Assets
      { code: '100000', name: 'Assets', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', isHeader: true },
      { code: '110000', name: 'Cash and Bank', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', isHeader: true },
      { code: '110001', name: 'Cash on Hand', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', systemKey: 'CASH_ON_HAND', isSystem: true },
      { code: '110002', name: 'Petty Cash', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', systemKey: 'PETTY_CASH', isSystem: true },
      { code: '111001', name: 'Bank Account - UGX', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', systemKey: 'BANK_UGX', isSystem: true },
      { code: '111002', name: 'Bank Account - USD', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', systemKey: 'BANK_USD', isSystem: true, currency: 'USD' },
      { code: '120000', name: 'Receivables', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', isHeader: true },
      { code: '120001', name: 'Accounts Receivable', type: ACCOUNT_TYPES.ASSET, subType: 'current_asset', systemKey: 'ACCOUNTS_RECEIVABLE', isSystem: true },
      { code: '150000', name: 'Fixed Assets', type: ACCOUNT_TYPES.ASSET, subType: 'fixed_asset', isHeader: true },
      { code: '150001', name: 'Property and Equipment', type: ACCOUNT_TYPES.ASSET, subType: 'fixed_asset', systemKey: 'FIXED_ASSETS', isSystem: true },
      { code: '159001', name: 'Accumulated Depreciation', type: ACCOUNT_TYPES.ASSET, subType: 'fixed_asset', systemKey: 'ACCUMULATED_DEPRECIATION', isSystem: true },

      // Liabilities
      { code: '200000', name: 'Liabilities', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', isHeader: true },
      { code: '210000', name: 'Payables', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', isHeader: true },
      { code: '210001', name: 'Accounts Payable', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', systemKey: 'ACCOUNTS_PAYABLE', isSystem: true },
      { code: '230000', name: 'Tax Liabilities', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', isHeader: true },
      { code: '230001', name: 'VAT Payable', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', systemKey: 'VAT_PAYABLE', isSystem: true },
      { code: '230002', name: 'PAYE Payable', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', systemKey: 'PAYE_PAYABLE', isSystem: true },
      { code: '230003', name: 'NSSF Payable', type: ACCOUNT_TYPES.LIABILITY, subType: 'current_liability', systemKey: 'NSSF_PAYABLE', isSystem: true },

      // Equity
      { code: '300000', name: 'Equity', type: ACCOUNT_TYPES.EQUITY, subType: 'share_capital', isHeader: true },
      { code: '310001', name: 'Share Capital', type: ACCOUNT_TYPES.EQUITY, subType: 'share_capital', systemKey: 'SHARE_CAPITAL', isSystem: true },
      { code: '320001', name: 'Retained Earnings', type: ACCOUNT_TYPES.EQUITY, subType: 'retained_earnings', systemKey: 'RETAINED_EARNINGS', isSystem: true },
      { code: '320002', name: 'Current Year Earnings', type: ACCOUNT_TYPES.EQUITY, subType: 'retained_earnings', systemKey: 'CURRENT_YEAR_EARNINGS', isSystem: true },

      // Revenue
      { code: '400000', name: 'Revenue', type: ACCOUNT_TYPES.REVENUE, subType: 'operating_revenue', isHeader: true },
      { code: '410001', name: 'Sales Revenue', type: ACCOUNT_TYPES.REVENUE, subType: 'operating_revenue', systemKey: 'SALES_REVENUE', isSystem: true },
      { code: '410002', name: 'Service Revenue', type: ACCOUNT_TYPES.REVENUE, subType: 'operating_revenue', systemKey: 'SERVICE_REVENUE', isSystem: true },
      { code: '420001', name: 'Interest Income', type: ACCOUNT_TYPES.REVENUE, subType: 'non_operating_revenue', systemKey: 'INTEREST_INCOME', isSystem: true },
      { code: '430001', name: 'Other Income', type: ACCOUNT_TYPES.REVENUE, subType: 'other_income', systemKey: 'OTHER_INCOME', isSystem: true },

      // Expenses
      { code: '500000', name: 'Expenses', type: ACCOUNT_TYPES.EXPENSE, subType: 'operating_expense', isHeader: true },
      { code: '510001', name: 'Cost of Goods Sold', type: ACCOUNT_TYPES.EXPENSE, subType: 'cost_of_sales', systemKey: 'COST_OF_GOODS_SOLD', isSystem: true },
      { code: '520000', name: 'Operating Expenses', type: ACCOUNT_TYPES.EXPENSE, subType: 'operating_expense', isHeader: true },
      { code: '520001', name: 'Salaries and Wages', type: ACCOUNT_TYPES.EXPENSE, subType: 'operating_expense', systemKey: 'SALARIES_EXPENSE', isSystem: true },
      { code: '520002', name: 'Rent Expense', type: ACCOUNT_TYPES.EXPENSE, subType: 'operating_expense', systemKey: 'RENT_EXPENSE', isSystem: true },
      { code: '520003', name: 'Utilities Expense', type: ACCOUNT_TYPES.EXPENSE, subType: 'operating_expense', systemKey: 'UTILITIES_EXPENSE', isSystem: true },
      { code: '530001', name: 'Depreciation Expense', type: ACCOUNT_TYPES.EXPENSE, subType: 'operating_expense', systemKey: 'DEPRECIATION_EXPENSE', isSystem: true },
      { code: '540000', name: 'Financial Expenses', type: ACCOUNT_TYPES.EXPENSE, subType: 'financial_expense', isHeader: true },
      { code: '540001', name: 'Bank Charges', type: ACCOUNT_TYPES.EXPENSE, subType: 'financial_expense', systemKey: 'BANK_CHARGES', isSystem: true },
      { code: '540002', name: 'Interest Expense', type: ACCOUNT_TYPES.EXPENSE, subType: 'financial_expense', systemKey: 'INTEREST_EXPENSE', isSystem: true },
    ];

    for (const accountData of defaultAccounts) {
      const accountId = doc(this.collectionRef(companyId)).id;
      const account: Account = {
        id: accountId,
        companyId,
        code: accountData.code,
        name: accountData.name,
        description: undefined,
        type: accountData.type,
        subType: accountData.subType as Account['subType'],
        level: accountData.isHeader ? ACCOUNT_LEVELS.SUBTYPE : ACCOUNT_LEVELS.DETAIL,
        parentId: null,
        ancestorIds: [],
        path: accountData.code,
        isHeader: accountData.isHeader || false,
        isPostable: !accountData.isHeader,
        currency: (accountData.currency as Account['currency']) || DEFAULT_CURRENCY,
        isMultiCurrency: false,
        balance: {
          debit: 0,
          credit: 0,
          balance: 0,
          functionalBalance: 0,
          updatedAt: now,
        },
        status: ACCOUNT_STATUS.ACTIVE,
        isSystem: accountData.isSystem || false,
        systemKey: accountData.systemKey,
        tags: [],
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
      };

      batch.set(this.docRef(companyId, accountId), account);
    }

    await batch.commit();
  }
}

export const accountService = new AccountService();
