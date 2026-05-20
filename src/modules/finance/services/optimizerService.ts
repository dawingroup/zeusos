// ============================================================================
// CASH FLOW OPTIMIZER SERVICE
// DawinOS v2.0 - Firestore CRUD + orchestration for the optimizer engine
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  CashFlowProjection,
  ClientPaymentProfile,
  ExpenditureItem,
  ExpenditureFilters,
  ProjectedReceipt,
  ReceiptFilters,
  SpendPlan,
  SpendPlanFilters,
  OptimizerConfig,
  OptimizerRun,
  ScoringContext,
} from '../types/optimizer.types';
import {
  CASHFLOW_PROJECTIONS_COLLECTION,
  EXPENDITURE_QUEUE_COLLECTION,
  PROJECTED_RECEIPTS_COLLECTION,
  SPEND_PLANS_COLLECTION,
  OPTIMIZER_CONFIG_COLLECTION,
  OPTIMIZER_RUNS_COLLECTION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_PRIORITY_THRESHOLDS,
  DEFAULT_CASH_BUFFER,
  DEFAULT_SAVINGS_SETTINGS,
  DEFAULT_PARTIAL_PAYMENT_THRESHOLD,
  DEFAULT_MINIMUM_PARTIAL_PAYMENT,
} from '../constants/optimizer.constants';
import {
  scoreExpenditure,
  calculateCompositeScore,
  assignPriorityTier,
  generateDailySpendPlan,
  formatDate,
  type SpendPlanInput,
} from './optimizerEngine';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string, colName: string) {
  return collection(db, 'companies', companyId, colName);
}

function companyDoc(companyId: string, colName: string, docId: string) {
  return doc(db, 'companies', companyId, colName, docId);
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class CashFlowOptimizerService {

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECTIONS
  // ══════════════════════════════════════════════════════════════════════════

  async getLatestProjection(companyId: string): Promise<CashFlowProjection | null> {
    const q = query(
      companyCol(companyId, CASHFLOW_PROJECTIONS_COLLECTION),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as CashFlowProjection;
  }

  async saveProjection(
    companyId: string,
    projection: Omit<CashFlowProjection, 'id'>
  ): Promise<string> {
    const docRef = await addDoc(
      companyCol(companyId, CASHFLOW_PROJECTIONS_COLLECTION),
      projection
    );
    return docRef.id;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXPENDITURE QUEUE
  // ══════════════════════════════════════════════════════════════════════════

  async getExpenditureQueue(
    companyId: string,
    filters: ExpenditureFilters = {}
  ): Promise<ExpenditureItem[]> {
    let q = query(
      companyCol(companyId, EXPENDITURE_QUEUE_COLLECTION),
      orderBy('compositeScore', 'desc')
    );

    if (filters.priorityTier) {
      q = query(q, where('priorityTier', '==', filters.priorityTier));
    }
    if (filters.category) {
      q = query(q, where('category', '==', filters.category));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }
    if (filters.sourceType) {
      q = query(q, where('sourceType', '==', filters.sourceType));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as ExpenditureItem));

    // Client-side filters for fields that can't be combined in Firestore
    if (filters.projectId) {
      items = items.filter(i => i.projectId === filters.projectId);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(i =>
        i.description.toLowerCase().includes(term) ||
        i.vendor?.toLowerCase().includes(term) ||
        i.projectName?.toLowerCase().includes(term)
      );
    }
    if (filters.minAmount !== undefined) {
      items = items.filter(i => i.amountUGX >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      items = items.filter(i => i.amountUGX <= filters.maxAmount!);
    }

    return items;
  }

  async getExpenditureById(
    companyId: string,
    expenditureId: string
  ): Promise<ExpenditureItem | null> {
    const docSnap = await getDoc(
      companyDoc(companyId, EXPENDITURE_QUEUE_COLLECTION, expenditureId)
    );
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as ExpenditureItem;
  }

  async addExpenditure(
    companyId: string,
    input: Omit<ExpenditureItem, 'id' | 'createdAt' | 'updatedAt' | 'scores' | 'compositeScore' | 'priorityTier' | 'statusHistory'>,
    userId: string
  ): Promise<ExpenditureItem> {
    const config = await this.getConfig(companyId);
    const context = await this.buildScoringContext(companyId, config);

    // Score the expenditure
    const now = Timestamp.now();
    const itemForScoring = {
      ...input,
      id: '',
      createdAt: now,
      updatedAt: now,
      scores: {} as ExpenditureItem['scores'],
      compositeScore: 0,
      priorityTier: 'MEDIUM' as const,
      statusHistory: [],
    } as ExpenditureItem;

    const scores = scoreExpenditure(itemForScoring, context);
    const compositeScore = calculateCompositeScore(scores, config.scoringWeights, input.commitmentLevel);
    const priorityTier = assignPriorityTier(compositeScore, itemForScoring, config.priorityThresholds);

    const expenditureData = {
      ...input,
      companyId,
      scores,
      compositeScore,
      priorityTier,
      status: 'pending' as const,
      statusHistory: [{
        from: '',
        to: 'pending',
        changedAt: now,
        changedBy: userId,
      }],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(
      companyCol(companyId, EXPENDITURE_QUEUE_COLLECTION),
      expenditureData
    );

    return { id: docRef.id, ...expenditureData } as ExpenditureItem;
  }

  async updateExpenditure(
    companyId: string,
    expenditureId: string,
    updates: Partial<ExpenditureItem>,
    userId: string
  ): Promise<void> {
    const ref = companyDoc(companyId, EXPENDITURE_QUEUE_COLLECTION, expenditureId);
    const current = await getDoc(ref);
    if (!current.exists()) throw new Error('Expenditure not found');

    const currentData = current.data() as ExpenditureItem;
    const statusHistory = [...(currentData.statusHistory || [])];

    if (updates.status && updates.status !== currentData.status) {
      statusHistory.push({
        from: currentData.status,
        to: updates.status,
        changedAt: Timestamp.now(),
        changedBy: userId,
        reason: updates.deferralReason || updates.approvalNote,
      });
    }

    await updateDoc(ref, {
      ...updates,
      statusHistory,
      updatedAt: Timestamp.now(),
    });
  }

  async rescoreAllExpenditures(companyId: string): Promise<number> {
    const config = await this.getConfig(companyId);
    const context = await this.buildScoringContext(companyId, config);

    const items = await this.getExpenditureQueue(companyId, { status: 'pending' });
    const batch = writeBatch(db);
    let count = 0;

    for (const item of items) {
      const scores = scoreExpenditure(item, context);
      const compositeScore = calculateCompositeScore(scores, config.scoringWeights, item.commitmentLevel);
      const priorityTier = assignPriorityTier(compositeScore, item, config.priorityThresholds);

      const ref = companyDoc(companyId, EXPENDITURE_QUEUE_COLLECTION, item.id);
      batch.update(ref, {
        scores,
        compositeScore,
        priorityTier,
        updatedAt: Timestamp.now(),
      });
      count++;

      // Firestore batch limit is 500
      if (count % 450 === 0) {
        await batch.commit();
      }
    }

    if (count % 450 !== 0) {
      await batch.commit();
    }

    return count;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SPEND PLANS
  // ══════════════════════════════════════════════════════════════════════════

  async getSpendPlan(companyId: string, date: string): Promise<SpendPlan | null> {
    const q = query(
      companyCol(companyId, SPEND_PLANS_COLLECTION),
      where('date', '==', date),
      where('status', 'in', ['draft', 'active']),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as SpendPlan;
  }

  async getSpendPlans(
    companyId: string,
    filters: SpendPlanFilters = {}
  ): Promise<SpendPlan[]> {
    let q = query(
      companyCol(companyId, SPEND_PLANS_COLLECTION),
      orderBy('date', 'desc'),
      limit(30)
    );

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as SpendPlan));
  }

  async generateAndSaveSpendPlan(
    companyId: string,
    subsidiaryId: string,
    bankBalance: number,
    savingsBalance: number,
    todaysReceipts: SpendPlanInput['todaysReceipts'],
    date: Date = new Date()
  ): Promise<SpendPlan> {
    const config = await this.getConfig(companyId);
    const queue = await this.getExpenditureQueue(companyId, {
      status: 'pending',
      subsidiaryId,
    });

    // Supersede any existing plan for this date
    const existingPlan = await this.getSpendPlan(companyId, formatDate(date));
    if (existingPlan) {
      await updateDoc(
        companyDoc(companyId, SPEND_PLANS_COLLECTION, existingPlan.id),
        { status: 'superseded', updatedAt: Timestamp.now() }
      );
    }

    const result = generateDailySpendPlan({
      bankBalance,
      savingsBalance,
      todaysReceipts,
      queue,
      settings: {
        minimumCashBuffer: config.cashBufferSettings.minimumCashBuffer,
        savingsRatePercent: config.savingsSettings.baseRatePercent,
        partialPaymentThreshold: config.partialPaymentThreshold,
        minimumPartialPayment: config.minimumPartialPayment,
      },
      today: date,
    });

    const plan: Omit<SpendPlan, 'id'> = {
      companyId,
      date: formatDate(date),
      generatedAt: Timestamp.now(),
      subsidiaryId,
      openingBankBalance: bankBalance,
      openingSavingsBalance: savingsBalance,
      expectedReceipts: todaysReceipts.map(r => ({
        id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: r.description,
        amount: r.amount,
        source: r.source,
        sourceType: 'qbo_invoice' as const,
        sourceId: '',
        confidenceLevel: r.confidenceLevel as 'confirmed' | 'probable' | 'possible',
        confidenceScore: r.confidenceLevel === 'confirmed' ? 100 : r.confidenceLevel === 'probable' ? 70 : 30,
      })),
      scheduledExpenditures: result.scheduled,
      deferredExpenditures: result.deferred,
      savingsAllocation: result.savingsAllocation,
      totalInflow: todaysReceipts
        .filter(r => r.confidenceLevel === 'confirmed')
        .reduce((s, r) => s + r.amount, 0),
      totalOutflow: result.scheduled.reduce((s, e) => s + e.amount, 0),
      netMovement: 0,
      closingBalance: 0,
      closingSavingsBalance: savingsBalance + result.savingsAllocation,
      riskFlags: result.riskFlags,
      actionItems: result.actionItems,
      next7DaysOutlook: {
        totalInflow: 0,
        totalOutflow: 0,
        minimumBalance: bankBalance,
        minimumBalanceDate: formatDate(date),
        criticalActions: [],
      },
      manualOverrides: [],
      status: 'draft',
    };

    plan.netMovement = plan.totalInflow - plan.totalOutflow - plan.savingsAllocation;
    plan.closingBalance = bankBalance + plan.netMovement;

    const docRef = await addDoc(
      companyCol(companyId, SPEND_PLANS_COLLECTION),
      plan
    );

    return { id: docRef.id, ...plan } as SpendPlan;
  }

  async approveSpendPlanItem(
    companyId: string,
    planId: string,
    expenditureId: string,
    userId: string
  ): Promise<void> {
    // Update expenditure status
    await this.updateExpenditure(companyId, expenditureId, {
      status: 'approved',
      approvedBy: userId,
    }, userId);

    // Activate the plan if still in draft
    const planRef = companyDoc(companyId, SPEND_PLANS_COLLECTION, planId);
    const planSnap = await getDoc(planRef);
    if (planSnap.exists() && planSnap.data()?.status === 'draft') {
      await updateDoc(planRef, { status: 'active', updatedAt: Timestamp.now() });
    }
  }

  async deferSpendPlanItem(
    companyId: string,
    expenditureId: string,
    reason: string,
    userId: string
  ): Promise<void> {
    await this.updateExpenditure(companyId, expenditureId, {
      status: 'deferred',
      deferralReason: reason,
    }, userId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════════════════════════════════════════

  async getConfig(companyId: string): Promise<OptimizerConfig> {
    const q = query(
      companyCol(companyId, OPTIMIZER_CONFIG_COLLECTION),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Return defaults
      return this.getDefaultConfig(companyId);
    }

    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as OptimizerConfig;
  }

  async updateConfig(
    companyId: string,
    updates: Partial<OptimizerConfig>,
    userId: string
  ): Promise<void> {
    const current = await this.getConfig(companyId);

    if (current.id.startsWith('default-')) {
      // Create new config document
      await addDoc(companyCol(companyId, OPTIMIZER_CONFIG_COLLECTION), {
        ...current,
        ...updates,
        companyId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } else {
      await updateDoc(
        companyDoc(companyId, OPTIMIZER_CONFIG_COLLECTION, current.id),
        { ...updates, updatedAt: Timestamp.now(), updatedBy: userId }
      );
    }
  }

  private getDefaultConfig(companyId: string): OptimizerConfig {
    return {
      id: `default-${companyId}`,
      companyId,
      subsidiaryId: 'zeus-group',
      scoringWeights: DEFAULT_SCORING_WEIGHTS,
      priorityThresholds: DEFAULT_PRIORITY_THRESHOLDS,
      cashBufferSettings: DEFAULT_CASH_BUFFER,
      savingsSettings: DEFAULT_SAVINGS_SETTINGS,
      partialPaymentThreshold: DEFAULT_PARTIAL_PAYMENT_THRESHOLD,
      minimumPartialPayment: DEFAULT_MINIMUM_PARTIAL_PAYMENT,
      updatedAt: Timestamp.now(),
      updatedBy: 'system',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OPTIMIZER RUNS (Audit Log)
  // ══════════════════════════════════════════════════════════════════════════

  async logRun(companyId: string, run: Omit<OptimizerRun, 'id'>): Promise<string> {
    const docRef = await addDoc(
      companyCol(companyId, OPTIMIZER_RUNS_COLLECTION),
      run
    );
    return docRef.id;
  }

  async getRecentRuns(companyId: string, count: number = 10): Promise<OptimizerRun[]> {
    const q = query(
      companyCol(companyId, OPTIMIZER_RUNS_COLLECTION),
      orderBy('runAt', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OptimizerRun));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROJECTED RECEIPTS
  // ══════════════════════════════════════════════════════════════════════════

  async getProjectedReceipts(
    companyId: string,
    filters: ReceiptFilters = {}
  ): Promise<ProjectedReceipt[]> {
    let q = query(
      companyCol(companyId, PROJECTED_RECEIPTS_COLLECTION),
      orderBy('expectedDate', 'asc')
    );

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.confidenceLevel) {
      q = query(q, where('confidenceLevel', '==', filters.confidenceLevel));
    }
    if (filters.sourceType) {
      q = query(q, where('sourceType', '==', filters.sourceType));
    }
    if (filters.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as ProjectedReceipt));

    // Client-side filters for fields that can't be combined in Firestore
    if (filters.customerId) {
      items = items.filter(i => i.customerId === filters.customerId);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(i =>
        i.sourceName?.toLowerCase().includes(term) ||
        i.customerName?.toLowerCase().includes(term)
      );
    }
    if (filters.minAmount !== undefined) {
      items = items.filter(i => i.amount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      items = items.filter(i => i.amount <= filters.maxAmount!);
    }

    return items;
  }

  async updateProjectedReceipt(
    companyId: string,
    receiptId: string,
    updates: Partial<Pick<ProjectedReceipt, 'status' | 'actualReceivedDate' | 'actualAmount'>>,
  ): Promise<void> {
    const ref = doc(db, 'companies', companyId, PROJECTED_RECEIPTS_COLLECTION, receiptId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async confirmReceipt(
    companyId: string,
    receiptId: string,
    actualAmount: number,
    receivedDate?: Date,
  ): Promise<void> {
    await this.updateProjectedReceipt(companyId, receiptId, {
      status: 'received',
      actualAmount,
      actualReceivedDate: Timestamp.fromDate(receivedDate || new Date()),
    });
  }

  async markReceiptInvoiced(
    companyId: string,
    receiptId: string,
  ): Promise<void> {
    await this.updateProjectedReceipt(companyId, receiptId, {
      status: 'invoiced',
    });
  }

  async cancelReceipt(
    companyId: string,
    receiptId: string,
  ): Promise<void> {
    await this.updateProjectedReceipt(companyId, receiptId, {
      status: 'cancelled',
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SCORING CONTEXT BUILDER
  // ══════════════════════════════════════════════════════════════════════════

  async buildScoringContext(
    companyId: string,
    config: OptimizerConfig
  ): Promise<ScoringContext> {
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ── 1. Current bank balance from latest QBO bank transaction aggregate ──
    let currentBankBalance = 0;
    try {
      const balanceRef = collection(db, 'companies', companyId, 'qbo_bank_balances');
      const balanceQuery = query(balanceRef, orderBy('updatedAt', 'desc'), limit(1));
      const balanceSnap = await getDocs(balanceQuery);
      if (!balanceSnap.empty) {
        const balData = balanceSnap.docs[0].data();
        currentBankBalance = (balData.totalBalance as number) || 0;
      }
    } catch {
      // Fall back to zero — QBO may not be connected
    }

    // ── 2. Confirmed receipts for next 7 days ──
    let confirmedUpcomingReceipts = 0;
    try {
      const receiptsRef = collection(db, 'companies', companyId, 'projected_receipts');
      const receiptsQuery = query(
        receiptsRef,
        where('status', '==', 'projected'),
        where('confidenceLevel', '==', 'confirmed'),
        where('expectedDate', '<=', Timestamp.fromDate(sevenDaysOut))
      );
      const receiptsSnap = await getDocs(receiptsQuery);
      confirmedUpcomingReceipts = receiptsSnap.docs.reduce(
        (sum, d) => sum + ((d.data().amount as number) || 0), 0
      );
    } catch {
      // Index may not exist yet
    }

    // ── 3. Average daily burn from recent closed spend plans (last 14 days) ──
    let averageDailyBurn = 0;
    try {
      const fourteenDaysAgo = formatDate(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
      const plansRef = collection(db, 'companies', companyId, 'spend_plans');
      const plansQuery = query(
        plansRef,
        where('status', '==', 'closed'),
        where('date', '>=', fourteenDaysAgo),
        orderBy('date', 'desc')
      );
      const plansSnap = await getDocs(plansQuery);
      if (plansSnap.size > 0) {
        const totalOutflow = plansSnap.docs.reduce(
          (sum, d) => sum + ((d.data().totalOutflow as number) || 0), 0
        );
        averageDailyBurn = Math.round(totalOutflow / plansSnap.size);
      }
    } catch {
      // Fallback — no closed plans yet
    }

    // ── 4. Client payment profiles ──
    let clientPaymentProfiles: Map<string, ClientPaymentProfile> | undefined;
    try {
      const profilesRef = collection(db, 'companies', companyId, 'client_payment_profiles');
      const profilesSnap = await getDocs(profilesRef);
      if (!profilesSnap.empty) {
        clientPaymentProfiles = new Map();
        for (const pd of profilesSnap.docs) {
          const data = pd.data();
          clientPaymentProfiles.set(pd.id, data as unknown as ClientPaymentProfile);
        }
      }
    } catch {
      // Collection may not exist yet
    }

    const projectedBalance7Days = currentBankBalance + confirmedUpcomingReceipts - (averageDailyBurn * 7);
    const projectedBalance30Days = currentBankBalance + confirmedUpcomingReceipts - (averageDailyBurn * 30);

    return {
      currentBankBalance,
      projectedBalance7Days,
      projectedBalance30Days,
      averageDailyBurn,
      confirmedUpcomingReceipts,
      clientPaymentProfiles,
      settings: config,
    };
  }
}

export const optimizerService = new CashFlowOptimizerService();
