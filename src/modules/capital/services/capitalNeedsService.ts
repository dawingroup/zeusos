// ============================================================================
// CAPITAL NEEDS SERVICE
// ZeusOS v2.0 — Identify, track, and auto-detect capital requirements
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  CapitalNeed,
  CapitalNeedFilters,
  AffordabilityAnalysis,
  CashFlowGapDetails,
} from '../types/capital.types';
import type { CapitalNeedInput } from '../schemas/capital.schemas';
import { CAPITAL_NEEDS_COLLECTION } from '../constants/capital.constants';
import { optimizerService } from '@/modules/finance/services/optimizerService';
import { liabilityService } from '@/modules/finance/services/liabilityService';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string) {
  return collection(db, 'companies', companyId, CAPITAL_NEEDS_COLLECTION);
}

function companyDoc(companyId: string, docId: string) {
  return doc(db, 'companies', companyId, CAPITAL_NEEDS_COLLECTION, docId);
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class CapitalNeedsService {

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════════

  async createNeed(
    companyId: string,
    input: CapitalNeedInput,
    userId: string,
  ): Promise<CapitalNeed> {
    const data = {
      ...input,
      companyId,
      applicationIds: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
    };

    const docRef = await addDoc(companyCol(companyId), data);
    return { id: docRef.id, ...data } as CapitalNeed;
  }

  async getNeed(companyId: string, needId: string): Promise<CapitalNeed | null> {
    const docSnap = await getDoc(companyDoc(companyId, needId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as CapitalNeed;
  }

  async getNeeds(
    companyId: string,
    filters: CapitalNeedFilters = {},
  ): Promise<CapitalNeed[]> {
    let q = query(companyCol(companyId), orderBy('createdAt', 'desc'));

    if (filters.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.urgency) {
      q = query(q, where('urgency', '==', filters.urgency));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CapitalNeed));

    if (filters.detectedBy) {
      items = items.filter(i => i.detectedBy === filters.detectedBy);
    }
    if (filters.minAmount !== undefined) {
      items = items.filter(i => i.amountRequired >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      items = items.filter(i => i.amountRequired <= filters.maxAmount!);
    }

    return items;
  }

  async updateNeed(
    companyId: string,
    needId: string,
    updates: Partial<CapitalNeedInput>,
  ): Promise<void> {
    const ref = companyDoc(companyId, needId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteNeed(companyId: string, needId: string): Promise<void> {
    await deleteDoc(companyDoc(companyId, needId));
  }

  async linkApplication(
    companyId: string,
    needId: string,
    applicationId: string,
  ): Promise<void> {
    const need = await this.getNeed(companyId, needId);
    if (!need) throw new Error('Capital need not found');

    const applicationIds = [...(need.applicationIds || [])];
    if (!applicationIds.includes(applicationId)) {
      applicationIds.push(applicationId);
    }

    await updateDoc(companyDoc(companyId, needId), {
      applicationIds,
      status: 'applied',
      updatedAt: Timestamp.now(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-DETECTION — Integrates with Finance module
  // ══════════════════════════════════════════════════════════════════════════

  async detectCapitalNeeds(companyId: string): Promise<CashFlowGapDetails[]> {
    const gaps: CashFlowGapDetails[] = [];

    try {
      // 1. Get latest cash flow projection
      const projection = await optimizerService.getLatestProjection(companyId);
      if (!projection) return gaps;

      const config = await optimizerService.getConfig(companyId);
      const buffer = config.cashBufferSettings.minimumCashBuffer;

      // 2. Scan daily snapshots for cash flow gaps
      let gapStart: string | null = null;
      let maxGapAmount = 0;

      for (const snap of projection.dailySnapshots) {
        if (snap.closingBalance < buffer) {
          if (!gapStart) gapStart = snap.date;
          const deficit = buffer - snap.closingBalance;
          if (deficit > maxGapAmount) maxGapAmount = deficit;
        } else if (gapStart) {
          gaps.push({
            gapStartDate: gapStart,
            gapEndDate: snap.date,
            gapAmount: maxGapAmount,
          });
          gapStart = null;
          maxGapAmount = 0;
        }
      }

      // 3. Check weekly snapshots too
      for (const snap of projection.weeklySnapshots) {
        if (snap.closingBalance < buffer) {
          if (!gapStart) gapStart = snap.weekStartDate;
          const deficit = buffer - snap.closingBalance;
          if (deficit > maxGapAmount) maxGapAmount = deficit;
        } else if (gapStart) {
          gaps.push({
            gapStartDate: gapStart,
            gapEndDate: snap.weekStartDate,
            gapAmount: maxGapAmount,
          });
          gapStart = null;
          maxGapAmount = 0;
        }
      }

      // Close any open gap
      if (gapStart) {
        gaps.push({
          gapStartDate: gapStart,
          gapEndDate: projection.weeklySnapshots[projection.weeklySnapshots.length - 1]?.weekEndDate || gapStart,
          gapAmount: maxGapAmount,
        });
      }
    } catch {
      // Finance data may not be available yet
    }

    return gaps;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AFFORDABILITY CALCULATOR
  // ══════════════════════════════════════════════════════════════════════════

  async calculateAffordability(companyId: string): Promise<AffordabilityAnalysis> {
    let monthlyDebtService = 0;
    let monthlyRevenue = 0;

    try {
      // Get existing liabilities for debt service
      const liabilities = await liabilityService.getLiabilities(companyId);
      for (const l of liabilities) {
        if (l.status === 'current' || l.status === 'due_soon') {
          switch (l.frequency) {
            case 'monthly':
              monthlyDebtService += l.totalAmount;
              break;
            case 'quarterly':
              monthlyDebtService += l.totalAmount / 3;
              break;
            case 'annually':
              monthlyDebtService += l.totalAmount / 12;
              break;
          }
        }
      }

      // Get cash flow data for revenue estimate
      const projection = await optimizerService.getLatestProjection(companyId);
      if (projection) {
        // Estimate monthly revenue from confirmed receipts
        const totalInflow = projection.dailySnapshots.reduce(
          (s, d) => s + d.totalProjectedInflow,
          0,
        );
        const days = projection.dailySnapshots.length || 1;
        monthlyRevenue = (totalInflow / days) * 30;
      }
    } catch {
      // Finance data may not be available
    }

    const safetyFactor = 0.7;
    const estimatedExpenses = monthlyRevenue * 0.75; // Rough estimate
    const freeCashFlow = monthlyRevenue - estimatedExpenses - monthlyDebtService;
    const monthlyCapacity = Math.max(0, freeCashFlow * safetyFactor);
    const maxTermMonths = 60; // Default max
    const maxBorrowingAmount = monthlyCapacity * maxTermMonths * 0.8; // Simplified
    const dscr = monthlyDebtService > 0
      ? (monthlyRevenue - estimatedExpenses) / monthlyDebtService
      : monthlyRevenue > 0 ? 10 : 0;

    return {
      monthlyCapacity,
      maxTermMonths,
      maxBorrowingAmount,
      debtServiceRatio: Math.round(dscr * 100) / 100,
    };
  }
}

export const capitalNeedsService = new CapitalNeedsService();
