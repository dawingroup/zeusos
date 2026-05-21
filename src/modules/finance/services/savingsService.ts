// ============================================================================
// SAVINGS SERVICE
// ZeusOS v2.0 — Automated savings allocations, withdrawals, balance tracking
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  SavingsEntry,
  SavingsPosition,
  SavingsSettings,
} from '../types/optimizer.types';
import {
  SAVINGS_LEDGER_COLLECTION,
  OPTIMIZER_CONFIG_COLLECTION,
  DEFAULT_SAVINGS_SETTINGS,
} from '../constants/optimizer.constants';
import { calculateSavingsAllocation } from './optimizerEngine';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string, colName: string) {
  return collection(db, 'companies', companyId, colName);
}

function companyDoc(companyId: string, colName: string, docId: string) {
  return doc(db, 'companies', companyId, colName, docId);
}

type InflowCategory = 'project_milestone' | 'recurring' | 'ad_hoc' | 'other';

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class SavingsService {

  // ══════════════════════════════════════════════════════════════════════════
  // BALANCE
  // ══════════════════════════════════════════════════════════════════════════

  async getSavingsBalance(companyId: string, subsidiaryId: string = 'zeus-group'): Promise<SavingsPosition> {
    const q = query(
      companyCol(companyId, SAVINGS_LEDGER_COLLECTION),
      orderBy('date', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    const settings = await this.getSettings(companyId);

    if (snapshot.empty) {
      return {
        totalBalance: 0,
        totalAllocated: 0,
        totalWithdrawn: 0,
        subsidiaryId,
        monthlyAllocationTotal: 0,
        monthlyWithdrawalTotal: 0,
        settings,
      };
    }

    const latestEntry = snapshot.docs[0].data() as SavingsEntry;
    return {
      totalBalance: latestEntry.runningBalance,
      totalAllocated: await this.sumByType(companyId, 'allocation'),
      totalWithdrawn: await this.sumByType(companyId, 'withdrawal'),
      subsidiaryId,
      lastAllocationDate: latestEntry.date,
      monthlyAllocationTotal: 0,
      monthlyWithdrawalTotal: 0,
      settings,
    };
  }

  private async sumByType(companyId: string, type: SavingsEntry['type']): Promise<number> {
    const q = query(
      companyCol(companyId, SAVINGS_LEDGER_COLLECTION),
      where('type', '==', type)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.reduce((sum, d) => sum + ((d.data() as SavingsEntry).amount || 0), 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ALLOCATIONS
  // ══════════════════════════════════════════════════════════════════════════

  async allocateSavings(
    companyId: string,
    inflowAmount: number,
    inflowCategory: InflowCategory,
    sourceDescription: string,
    _userId: string,
    settings?: SavingsSettings
  ): Promise<SavingsEntry | null> {
    const savingsSettings = settings || await this.getSettings(companyId);
    const allocation = calculateSavingsAllocation(inflowAmount, inflowCategory, savingsSettings);

    if (allocation.amount <= 0) return null;

    const currentBalance = await this.getSavingsBalance(companyId);

    // Apply round-up if enabled
    let finalAmount = allocation.amount;
    if (savingsSettings.enableRoundUp && savingsSettings.roundUpUnit) {
      const remainder = allocation.amount % savingsSettings.roundUpUnit;
      if (remainder > 0) {
        finalAmount = allocation.amount + (savingsSettings.roundUpUnit - remainder);
      }
    }

    const entry: Omit<SavingsEntry, 'id'> = {
      companyId,
      type: 'allocation',
      amount: finalAmount,
      runningBalance: currentBalance.totalBalance + finalAmount,
      note: `Auto-allocation from ${sourceDescription}`,
      triggerType: 'auto_inflow',
      triggerSourceId: '',
      inflowAmount,
      subsidiaryId: currentBalance.subsidiaryId,
      date: Timestamp.now(),
    };

    const docRef = await addDoc(
      companyCol(companyId, SAVINGS_LEDGER_COLLECTION),
      entry
    );

    return { id: docRef.id, ...entry } as SavingsEntry;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // WITHDRAWALS
  // ══════════════════════════════════════════════════════════════════════════

  async requestWithdrawal(
    companyId: string,
    amount: number,
    reason: string,
    _userId: string,
    isStatutory: boolean = false,
  ): Promise<SavingsEntry> {
    const balance = await this.getSavingsBalance(companyId);
    const settings = await this.getSettings(companyId);

    if (amount > balance.totalBalance) {
      throw new Error('Withdrawal amount exceeds available savings balance');
    }

    const remainingBalance = balance.totalBalance - amount;
    if (remainingBalance < settings.minimumSavingsBalance && !isStatutory) {
      throw new Error(
        `Withdrawal would leave balance below minimum (${settings.minimumSavingsBalance.toLocaleString()} UGX)`
      );
    }

    const needsApproval = settings.withdrawalRequiresApproval && !isStatutory;

    const entry: Omit<SavingsEntry, 'id'> = {
      companyId,
      type: 'withdrawal',
      amount: -amount,
      runningBalance: balance.totalBalance - amount,
      withdrawalReason: reason,
      withdrawalCategory: isStatutory ? 'emergency' : 'planned',
      triggerType: 'manual',
      subsidiaryId: balance.subsidiaryId,
      status: needsApproval ? 'pending_approval' : 'approved',
      date: Timestamp.now(),
    };

    const docRef = await addDoc(
      companyCol(companyId, SAVINGS_LEDGER_COLLECTION),
      entry
    );

    return { id: docRef.id, ...entry } as SavingsEntry;
  }

  async approveWithdrawal(
    companyId: string,
    entryId: string,
    approverId: string,
  ): Promise<void> {
    const ref = companyDoc(companyId, SAVINGS_LEDGER_COLLECTION, entryId);
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) throw new Error('Savings entry not found');

    const entry = docSnap.data() as SavingsEntry;
    if (entry.status !== 'pending_approval') {
      throw new Error('Entry is not pending approval');
    }

    await updateDoc(ref, {
      status: 'approved',
      withdrawalApprovedBy: approverId,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HISTORY
  // ══════════════════════════════════════════════════════════════════════════

  async getSavingsHistory(
    companyId: string,
    limitCount: number = 50
  ): Promise<SavingsEntry[]> {
    const q = query(
      companyCol(companyId, SAVINGS_LEDGER_COLLECTION),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SavingsEntry));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  private async getSettings(companyId: string): Promise<SavingsSettings> {
    const q = query(
      companyCol(companyId, OPTIMIZER_CONFIG_COLLECTION),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return DEFAULT_SAVINGS_SETTINGS;

    const config = snapshot.docs[0].data();
    return config.savingsSettings || DEFAULT_SAVINGS_SETTINGS;
  }
}

export const savingsService = new SavingsService();
