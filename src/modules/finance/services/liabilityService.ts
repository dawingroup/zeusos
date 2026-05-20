// ============================================================================
// LIABILITY SERVICE
// DawinOS v2.0 — Statutory obligations, recurring liabilities, deadline tracking
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  Liability,
  LiabilityPayment,
  LiabilityFilters,
} from '../types/optimizer.types';
import {
  LIABILITY_REGISTER_COLLECTION,
  UGANDA_STATUTORY_DEADLINES,
} from '../constants/optimizer.constants';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string, colName: string) {
  return collection(db, 'companies', companyId, colName);
}

function companyDoc(companyId: string, colName: string, docId: string) {
  return doc(db, 'companies', companyId, colName, docId);
}

function getNextDueDate(dueDayOfMonth: number, frequency: 'monthly' | 'quarterly' | 'annually'): Date {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let nextMonth = currentMonth;
  let nextYear = currentYear;

  if (currentDay >= dueDayOfMonth) {
    // Already past this month's due date
    switch (frequency) {
      case 'monthly':
        nextMonth += 1;
        break;
      case 'quarterly':
        nextMonth += 3;
        break;
      case 'annually':
        nextYear += 1;
        break;
    }
  }

  if (nextMonth > 11) {
    nextYear += Math.floor(nextMonth / 12);
    nextMonth = nextMonth % 12;
  }

  return new Date(nextYear, nextMonth, Math.min(dueDayOfMonth, new Date(nextYear, nextMonth + 1, 0).getDate()));
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class LiabilityService {

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════════

  async registerLiability(
    companyId: string,
    liability: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
  ): Promise<Liability> {
    const data = {
      ...liability,
      companyId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
    };

    const docRef = await addDoc(
      companyCol(companyId, LIABILITY_REGISTER_COLLECTION),
      data
    );

    return { id: docRef.id, ...data } as Liability;
  }

  async getLiabilities(
    companyId: string,
    filters: LiabilityFilters = {}
  ): Promise<Liability[]> {
    let q = query(
      companyCol(companyId, LIABILITY_REGISTER_COLLECTION),
      orderBy('nextDueDate', 'asc')
    );

    if (filters.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.priority) {
      q = query(q, where('priority', '==', filters.priority));
    }

    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Liability));

    return items;
  }

  async getLiabilityById(companyId: string, liabilityId: string): Promise<Liability | null> {
    const docSnap = await getDoc(
      companyDoc(companyId, LIABILITY_REGISTER_COLLECTION, liabilityId)
    );
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Liability;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPCOMING & OVERDUE
  // ══════════════════════════════════════════════════════════════════════════

  async getUpcomingLiabilities(
    companyId: string,
    days: number = 30
  ): Promise<Liability[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const all = await this.getLiabilities(companyId, { status: 'current' });

    return all.filter(l => {
      if (!l.nextDueDate) return false;
      const dueDate = l.nextDueDate instanceof Date
        ? l.nextDueDate
        : (l.nextDueDate as unknown as { toDate: () => Date }).toDate();
      return dueDate <= cutoff;
    }).sort((a, b) => {
      const aDate = a.nextDueDate instanceof Date ? a.nextDueDate : (a.nextDueDate as unknown as { toDate: () => Date }).toDate();
      const bDate = b.nextDueDate instanceof Date ? b.nextDueDate : (b.nextDueDate as unknown as { toDate: () => Date }).toDate();
      return aDate.getTime() - bDate.getTime();
    });
  }

  async getOverdueLiabilities(companyId: string): Promise<Liability[]> {
    const now = new Date();
    const all = await this.getLiabilities(companyId, { status: 'current' });

    return all.filter(l => {
      if (!l.nextDueDate) return false;
      const dueDate = l.nextDueDate instanceof Date
        ? l.nextDueDate
        : (l.nextDueDate as unknown as { toDate: () => Date }).toDate();
      return dueDate < now;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ══════════════════════════════════════════════════════════════════════════

  async markPaid(
    companyId: string,
    liabilityId: string,
    payment: Omit<LiabilityPayment, 'date'>,
    userId: string,
  ): Promise<void> {
    const ref = companyDoc(companyId, LIABILITY_REGISTER_COLLECTION, liabilityId);
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) throw new Error('Liability not found');

    const liability = docSnap.data() as Liability;
    const paymentEntry: LiabilityPayment = {
      ...payment,
      date: Timestamp.now(),
    };

    const paymentHistory = [...(liability.paymentHistory || []), paymentEntry];
    const totalPaid = paymentHistory.reduce((s, p) => s + p.amount, 0);
    const remaining = liability.totalAmount - totalPaid;

    const updates: Record<string, unknown> = {
      paymentHistory,
      amountPaid: totalPaid,
      amountRemaining: remaining,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    if (remaining <= 0) {
      // If recurring, advance to next due date
      if (liability.frequency !== 'once') {
        const currentDueDate = liability.nextDueDate instanceof Date
          ? liability.nextDueDate
          : (liability.nextDueDate as unknown as { toDate: () => Date }).toDate();
        const dueDayOfMonth = currentDueDate.getDate();
        updates.nextDueDate = Timestamp.fromDate(
          getNextDueDate(dueDayOfMonth, liability.frequency)
        );
        updates.amountPaid = 0;
        updates.amountRemaining = liability.totalAmount;
        updates.paymentHistory = [];
      } else {
        updates.status = 'paid';
      }
    }

    await updateDoc(ref, updates);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATUTORY DEADLINES
  // ══════════════════════════════════════════════════════════════════════════

  getStatutoryDeadlines() {
    return UGANDA_STATUTORY_DEADLINES.map(deadline => ({
      ...deadline,
      nextDueDate: getNextDueDate(deadline.dueDayOfMonth, deadline.frequency),
      daysUntilDue: Math.ceil(
        (getNextDueDate(deadline.dueDayOfMonth, deadline.frequency).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-DETECT RECURRING (from QBO)
  // ══════════════════════════════════════════════════════════════════════════

  async detectRecurringLiabilities(
    _companyId: string,
    bills: Array<{ vendor: string; amount: number; date: Date; description: string }>
  ): Promise<Array<{ vendor: string; amount: number; frequency: string; confidence: number }>> {
    // Group bills by vendor
    const byVendor = new Map<string, typeof bills>();
    for (const bill of bills) {
      const key = bill.vendor.toLowerCase();
      if (!byVendor.has(key)) byVendor.set(key, []);
      byVendor.get(key)!.push(bill);
    }

    const suggestions: Array<{ vendor: string; amount: number; frequency: string; confidence: number }> = [];

    for (const [_vendor, vendorBills] of byVendor) {
      if (vendorBills.length < 3) continue;

      // Sort by date
      vendorBills.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate intervals in days
      const intervals: number[] = [];
      for (let i = 1; i < vendorBills.length; i++) {
        const days = Math.round(
          (vendorBills[i].date.getTime() - vendorBills[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
        );
        intervals.push(days);
      }

      const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
      const variance = intervals.reduce((s, d) => s + Math.pow(d - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);

      // Determine frequency
      let frequency = 'irregular';
      if (avgInterval >= 25 && avgInterval <= 35 && stdDev < 5) frequency = 'monthly';
      else if (avgInterval >= 80 && avgInterval <= 100 && stdDev < 10) frequency = 'quarterly';
      else if (avgInterval >= 350 && avgInterval <= 380 && stdDev < 15) frequency = 'annually';

      if (frequency === 'irregular') continue;

      // Amount consistency
      const amounts = vendorBills.map(b => b.amount);
      const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const amountVariance = amounts.reduce((s, a) => s + Math.pow(a - avgAmount, 2), 0) / amounts.length;
      const amountStdDev = Math.sqrt(amountVariance);
      const amountCV = amountStdDev / avgAmount;

      const confidence = Math.max(0, Math.min(100,
        100 - (stdDev * 5) - (amountCV * 50) + (vendorBills.length * 5)
      ));

      if (confidence > 40) {
        suggestions.push({
          vendor: vendorBills[0].vendor,
          amount: Math.round(avgAmount),
          frequency,
          confidence: Math.round(confidence),
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}

export const liabilityService = new LiabilityService();
