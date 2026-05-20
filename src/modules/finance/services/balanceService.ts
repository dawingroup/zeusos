// ============================================================================
// BALANCE SERVICE
// DawinOS v2.0 - Financial Management Module
// Service for real-time balance management
// ============================================================================

import {
  doc,
  getDoc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Account, AccountBalance } from '../types/account.types';
import { JournalLine } from '../types/journal.types';
import { NORMAL_BALANCE, AccountType } from '../constants/account.constants';

/**
 * Balance Update Entry
 */
interface BalanceUpdate {
  accountId: string;
  debit: number;
  credit: number;
  functionalDebit: number;
  functionalCredit: number;
}

/**
 * Balance Service Class
 */
class BalanceService {
  /**
   * Update account balances for journal lines
   * Uses Firestore transactions for consistency
   */
  async updateBalances(
    companyId: string,
    lines: JournalLine[],
    isReversal: boolean = false
  ): Promise<void> {
    // Group by account
    const updates = new Map<string, BalanceUpdate>();

    for (const line of lines) {
      const existing = updates.get(line.accountId) || {
        accountId: line.accountId,
        debit: 0,
        credit: 0,
        functionalDebit: 0,
        functionalCredit: 0,
      };

      if (isReversal) {
        // Reverse the amounts
        existing.debit += line.credit;
        existing.credit += line.debit;
        existing.functionalDebit += line.functionalCredit;
        existing.functionalCredit += line.functionalDebit;
      } else {
        existing.debit += line.debit;
        existing.credit += line.credit;
        existing.functionalDebit += line.functionalDebit;
        existing.functionalCredit += line.functionalCredit;
      }

      updates.set(line.accountId, existing);
    }

    // Run transaction to update all balances atomically
    await runTransaction(db, async (transaction) => {
      const accountDocs = new Map<string, Account>();

      // Read all accounts first
      for (const [accountId] of updates) {
        const accountRef = doc(db, 'companies', companyId, 'accounts', accountId);
        const accountSnap = await transaction.get(accountRef);
        if (!accountSnap.exists()) {
          throw new Error(`Account ${accountId} not found`);
        }
        accountDocs.set(accountId, {
          id: accountSnap.id,
          ...accountSnap.data(),
        } as Account);
      }

      // Update balances
      const now = Timestamp.now();
      for (const [accountId, update] of updates) {
        const account = accountDocs.get(accountId)!;
        const accountRef = doc(db, 'companies', companyId, 'accounts', accountId);

        const newDebit = account.balance.debit + update.debit;
        const newCredit = account.balance.credit + update.credit;
        const newBalance = this.calculateBalance(account.type, newDebit, newCredit);
        const newFunctionalBalance = account.balance.functionalBalance +
          update.functionalDebit - update.functionalCredit;

        transaction.update(accountRef, {
          'balance.debit': newDebit,
          'balance.credit': newCredit,
          'balance.balance': newBalance,
          'balance.functionalBalance': newFunctionalBalance,
          'balance.updatedAt': now,
        });
      }
    });
  }

  /**
   * Calculate net balance based on account type
   */
  calculateBalance(type: AccountType, debit: number, credit: number): number {
    const normalBalance = NORMAL_BALANCE[type];
    if (normalBalance === 'debit') {
      return debit - credit;
    } else {
      return credit - debit;
    }
  }

  /**
   * Recalculate all account balances from journal entries
   */
  async recalculateAllBalances(
    _companyId: string,
    _fromDate?: Date
  ): Promise<{ accountsUpdated: number }> {
    // This would query all posted journal entries and recalculate
    // Implementation depends on journal service
    // For now, return placeholder
    return { accountsUpdated: 0 };
  }

  /**
   * Get account balance as of a specific date
   */
  async getBalanceAsOf(
    companyId: string,
    accountId: string,
    _asOfDate: Date
  ): Promise<AccountBalance | null> {
    // This would query journal entries up to the date
    // and calculate the balance
    // For now, return current balance
    const accountRef = doc(db, 'companies', companyId, 'accounts', accountId);
    const snap = await getDoc(accountRef);
    if (!snap.exists()) return null;
    return (snap.data() as Account).balance;
  }

  /**
   * Validate account can be debited/credited
   */
  async validateTransaction(
    companyId: string,
    accountId: string,
    _amount: number,
    _isDebit: boolean
  ): Promise<{ valid: boolean; message?: string }> {
    const accountRef = doc(db, 'companies', companyId, 'accounts', accountId);
    const snap = await getDoc(accountRef);
    
    if (!snap.exists()) {
      return { valid: false, message: 'Account not found' };
    }
    
    const account = snap.data() as Account;
    
    if (!account.isPostable) {
      return { valid: false, message: 'Account is not postable (header account)' };
    }
    
    if (account.status !== 'active') {
      return { valid: false, message: 'Account is not active' };
    }
    
    return { valid: true };
  }
}

export const balanceService = new BalanceService();
