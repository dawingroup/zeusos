/**
 * Holding Service
 * 
 * Handles all holding operations:
 * - Holding CRUD
 * - Transaction management
 * - Valuation tracking
 * - Income recording
 * - Return calculations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  runTransaction,
  increment,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Holding,
  HoldingStatus,
  CreateHoldingInput,
  UpdateHoldingInput,
  HoldingReturnMetrics,
  HoldingSummary,
} from '../types/holding';
import type {
  HoldingTransaction,
  TransactionType,
  TransactionCreateInput,
} from '../types/holding-transaction';
import type { ValuationHistory } from '../types/holding-valuation';
import type { HoldingIncome, IncomeType } from '../types/holding-income';
import type { MoneyAmount } from '../types/portfolio';

// Collection references
const HOLDINGS_COLLECTION = 'advisoryPlatform/advisory/holdings';
const TRANSACTIONS_SUBCOLLECTION = 'transactions';
const VALUATIONS_SUBCOLLECTION = 'valuations';
const INCOME_SUBCOLLECTION = 'income';
const STATUS_HISTORY_SUBCOLLECTION = 'statusHistory';

// ============================================
// Helper Functions
// ============================================

function generateHoldingCode(type: string): string {
  const typeCode = type.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `HLD-${typeCode}-${year}-${sequence}`;
}

function createEmptyMoneyAmount(currency: string): MoneyAmount {
  return { amount: 0, currency: currency as MoneyAmount['currency'] };
}

function calculateReturnMetrics(
  costBasis: MoneyAmount,
  currentValue: MoneyAmount,
  totalIncome: MoneyAmount,
  totalRealized: MoneyAmount,
  initialDate: Timestamp
): HoldingReturnMetrics {
  const now = Timestamp.now();
  const holdingPeriodDays = Math.floor((now.toMillis() - initialDate.toMillis()) / (1000 * 60 * 60 * 24));
  const holdingPeriodYears = holdingPeriodDays / 365;
  
  const totalValue = currentValue.amount + totalRealized.amount + totalIncome.amount;
  const paidIn = costBasis.amount;
  
  const tvpi = paidIn > 0 ? totalValue / paidIn : 0;
  const dpi = paidIn > 0 ? (totalRealized.amount + totalIncome.amount) / paidIn : 0;
  const rvpi = paidIn > 0 ? currentValue.amount / paidIn : 0;
  
  const moic = tvpi;
  const annualizedReturn = holdingPeriodYears > 0 ? (Math.pow(tvpi, 1 / holdingPeriodYears) - 1) * 100 : 0;
  
  return {
    grossIRR: annualizedReturn,
    grossMOIC: moic,
    totalValue: { amount: totalValue, currency: costBasis.currency },
    dpi,
    rvpi,
    tvpi,
    holdingPeriodDays,
    holdingPeriodYears,
    asOfDate: now,
  };
}

// ============================================
// Holding CRUD Operations
// ============================================

export async function createHolding(input: CreateHoldingInput): Promise<Holding> {
  const holdingRef = doc(collection(db, HOLDINGS_COLLECTION));
  
  const now = Timestamp.now();
  const holdingCode = generateHoldingCode(input.holdingType);
  const currency = input.costBasis.totalCost.currency;
  
  // Initialize income summary
  const incomeSummary = {
    totalIncome: createEmptyMoneyAmount(currency),
    dividends: createEmptyMoneyAmount(currency),
    interest: createEmptyMoneyAmount(currency),
    fees: createEmptyMoneyAmount(currency),
    otherIncome: createEmptyMoneyAmount(currency),
    currentPeriodIncome: createEmptyMoneyAmount(currency),
  };
  
  // Initialize realization summary
  const realizationSummary = {
    totalRealizedProceeds: createEmptyMoneyAmount(currency),
    realizedGainLoss: createEmptyMoneyAmount(currency),
    realizedGainLossPercentage: 0,
    realizations: [],
    remainingOwnership: input.ownership.ownershipPercentage,
    remainingCost: input.costBasis.totalCost,
    remainingFairValue: input.currentValuation.fairValue,
    isFullyRealized: false,
  };
  
  // Calculate initial return metrics
  const returnMetrics = calculateReturnMetrics(
    input.costBasis.totalCost,
    input.currentValuation.fairValue,
    incomeSummary.totalIncome,
    realizationSummary.totalRealizedProceeds,
    input.keyDates.initialInvestmentDate
  );
  
  // Initialize linked entities
  const linkedEntities = {
    portfolioId: input.portfolioId,
    clientId: '',
    dealId: input.underlyingAsset.dealId,
    projectId: input.underlyingAsset.projectId,
    transactionIds: [],
    valuationHistoryIds: [],
    incomeRecordIds: [],
  };
  
  const holding: Holding = {
    ...input,
    id: holdingRef.id,
    holdingCode,
    incomeSummary,
    realizationSummary,
    returnMetrics,
    linkedEntities,
    createdAt: now,
  };
  
  await setDoc(holdingRef, holding);
  
  // Create initial transaction if provided
  if (input.initialTransaction) {
    await createTransaction({
      holdingId: holdingRef.id,
      portfolioId: input.portfolioId,
      type: 'initial_acquisition' as const,
      amount: input.costBasis.initialInvestment,
      tradeDate: input.keyDates.initialInvestmentDate,
      effectiveDate: input.keyDates.initialInvestmentDate,
      createdBy: input.createdBy,
    });
  }
  
  // Create initial valuation record
  await createValuationRecord(
    holdingRef.id, 
    input.portfolioId, 
    input.currentValuation, 
    input.costBasis.totalCost, 
    input.createdBy
  );
  
  // Update portfolio holdings summary
  await updatePortfolioHoldingsSummary(input.portfolioId);
  
  return holding;
}

export async function getHolding(holdingId: string): Promise<Holding | null> {
  const docRef = doc(db, HOLDINGS_COLLECTION, holdingId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Holding;
}

export async function updateHolding(
  holdingId: string,
  updates: UpdateHoldingInput,
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, HOLDINGS_COLLECTION, holdingId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedBy,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteHolding(holdingId: string): Promise<void> {
  const holding = await getHolding(holdingId);
  if (!holding) return;
  
  const docRef = doc(db, HOLDINGS_COLLECTION, holdingId);
  await deleteDoc(docRef);
  
  await updatePortfolioHoldingsSummary(holding.portfolioId);
}

// ============================================
// Holding Status Management
// ============================================

export async function updateHoldingStatus(
  holdingId: string,
  newStatus: HoldingStatus,
  reason: string,
  changedBy: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const holdingRef = doc(db, HOLDINGS_COLLECTION, holdingId);
    const holdingDoc = await transaction.get(holdingRef);
    
    if (!holdingDoc.exists()) {
      throw new Error('Holding not found');
    }
    
    const holding = holdingDoc.data() as Holding;
    const previousStatus = holding.status;
    
    transaction.update(holdingRef, {
      status: newStatus,
      updatedBy: changedBy,
      updatedAt: Timestamp.now(),
    });
    
    const historyRef = doc(collection(db, HOLDINGS_COLLECTION, holdingId, STATUS_HISTORY_SUBCOLLECTION));
    transaction.set(historyRef, {
      id: historyRef.id,
      holdingId,
      previousStatus,
      newStatus,
      reason,
      effectiveDate: Timestamp.now(),
      changedBy,
      changedAt: Timestamp.now(),
    });
  });
}

// ============================================
// Transaction Management
// ============================================

export async function createTransaction(input: TransactionCreateInput): Promise<HoldingTransaction> {
  const txnRef = doc(collection(db, HOLDINGS_COLLECTION, input.holdingId, TRANSACTIONS_SUBCOLLECTION));
  
  let costBasisImpact: MoneyAmount = { amount: 0, currency: input.amount.currency };
  let realizedGainLoss: MoneyAmount | undefined;
  
  if (['initial_acquisition', 'follow_on'].includes(input.type)) {
    costBasisImpact = input.amount;
  } else if (['partial_realization', 'full_realization', 'dividend_recap'].includes(input.type)) {
    const holding = await getHolding(input.holdingId);
    if (holding && input.proceeds) {
      const costReturned = input.amount;
      realizedGainLoss = {
        amount: input.proceeds.amount - costReturned.amount,
        currency: input.amount.currency,
      };
      costBasisImpact = { amount: -costReturned.amount, currency: input.amount.currency };
    }
  } else if (['write_down', 'impairment'].includes(input.type)) {
    costBasisImpact = { amount: -input.amount.amount, currency: input.amount.currency };
  } else if (['write_up', 'reversal'].includes(input.type)) {
    costBasisImpact = input.amount;
  }
  
  const counterparty = input.counterparty 
    ? { name: input.counterparty.name, type: input.counterparty.type as 'buyer' | 'seller' | 'company' | 'bank' | 'other' }
    : undefined;
  
  const transaction: HoldingTransaction = {
    holdingId: input.holdingId,
    portfolioId: input.portfolioId,
    type: input.type,
    amount: input.amount,
    shares: input.shares,
    pricePerShare: input.pricePerShare,
    proceeds: input.proceeds,
    tradeDate: input.tradeDate,
    settlementDate: input.settlementDate,
    effectiveDate: input.effectiveDate,
    documentIds: input.documentIds,
    notes: input.notes,
    createdBy: input.createdBy,
    counterparty,
    id: txnRef.id,
    status: 'pending',
    costBasisImpact,
    realizedGainLoss,
    approvalRequired: ['full_realization', 'write_down', 'impairment'].includes(input.type),
    createdAt: Timestamp.now(),
  };
  
  await setDoc(txnRef, transaction);
  
  const holding = await getHolding(input.holdingId);
  if (holding) {
    await updateDoc(doc(db, HOLDINGS_COLLECTION, input.holdingId), {
      'linkedEntities.transactionIds': [...holding.linkedEntities.transactionIds, txnRef.id],
      updatedAt: Timestamp.now(),
    });
  }
  
  return transaction;
}

export async function processTransaction(
  holdingId: string,
  transactionId: string,
  processedBy: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const txnRef = doc(db, HOLDINGS_COLLECTION, holdingId, TRANSACTIONS_SUBCOLLECTION, transactionId);
    const txnDoc = await transaction.get(txnRef);
    
    if (!txnDoc.exists()) {
      throw new Error('Transaction not found');
    }
    
    const txn = txnDoc.data() as HoldingTransaction;
    
    transaction.update(txnRef, {
      status: 'completed',
      processedBy,
      processedAt: Timestamp.now(),
    });
    
    const holdingRef = doc(db, HOLDINGS_COLLECTION, holdingId);
    const holdingDoc = await transaction.get(holdingRef);
    
    if (holdingDoc.exists()) {
      const holding = holdingDoc.data() as Holding;
      const updates: Record<string, unknown> = {
        updatedAt: Timestamp.now(),
      };
      
      const newCostBasis = holding.costBasis.adjustedCostBasis.amount + txn.costBasisImpact.amount;
      updates['costBasis.adjustedCostBasis.amount'] = newCostBasis;
      
      if (['initial_acquisition', 'follow_on'].includes(txn.type)) {
        updates['costBasis.followOnInvestments.amount'] = increment(txn.amount.amount);
        updates['costBasis.totalCost.amount'] = increment(txn.amount.amount);
      }
      
      if (txn.type === 'partial_realization' && txn.proceeds && txn.realizedGainLoss) {
        updates['realizationSummary.totalRealizedProceeds.amount'] = increment(txn.proceeds.amount);
        updates['realizationSummary.realizedGainLoss.amount'] = increment(txn.realizedGainLoss.amount);
        updates['realizationSummary.remainingCost.amount'] = increment(-txn.amount.amount);
        if (txn.ownershipAfter !== undefined) {
          updates['realizationSummary.remainingOwnership'] = txn.ownershipAfter;
        }
      }
      
      if (txn.type === 'full_realization') {
        updates.status = 'fully_realized';
        updates['realizationSummary.isFullyRealized'] = true;
        updates['realizationSummary.remainingOwnership'] = 0;
        updates['keyDates.actualExitDate'] = Timestamp.now();
      }
      
      transaction.update(holdingRef, updates);
    }
  });
  
  await recalculateReturnMetrics(holdingId);
  
  const holding = await getHolding(holdingId);
  if (holding) {
    await updatePortfolioHoldingsSummary(holding.portfolioId);
  }
}

export async function getTransactions(
  holdingId: string,
  type?: TransactionType
): Promise<HoldingTransaction[]> {
  const txnRef = collection(db, HOLDINGS_COLLECTION, holdingId, TRANSACTIONS_SUBCOLLECTION);
  
  const constraints: QueryConstraint[] = [orderBy('effectiveDate', 'desc')];
  if (type) {
    constraints.unshift(where('type', '==', type));
  }
  
  const q = query(txnRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HoldingTransaction));
}

// ============================================
// Valuation Management
// ============================================

async function createValuationRecord(
  holdingId: string,
  portfolioId: string,
  valuation: Holding['currentValuation'],
  costBasis: MoneyAmount,
  createdBy: string
): Promise<ValuationHistory> {
  const valRef = doc(collection(db, HOLDINGS_COLLECTION, holdingId, VALUATIONS_SUBCOLLECTION));
  
  const record: ValuationHistory = {
    id: valRef.id,
    holdingId,
    portfolioId,
    valuationDate: valuation.valuationDate,
    fairValue: valuation.fairValue,
    previousValue: valuation.fairValue,
    valueChange: { amount: 0, currency: valuation.fairValue.currency },
    percentageChange: 0,
    methodology: valuation.methodology,
    fairValueLevel: valuation.fairValueLevel,
    keyInputs: valuation.keyInputs,
    multiplesUsed: valuation.multiplesUsed,
    discountRate: valuation.discountRate,
    costBasis,
    unrealizedGainLoss: {
      amount: valuation.fairValue.amount - costBasis.amount,
      currency: valuation.fairValue.currency,
    },
    unrealizedGainLossPercentage: costBasis.amount > 0 
      ? ((valuation.fairValue.amount - costBasis.amount) / costBasis.amount) * 100 
      : 0,
    status: 'draft',
    preparedBy: createdBy,
    preparedAt: Timestamp.now(),
  };
  
  await setDoc(valRef, record);
  
  return record;
}

export async function updateValuation(
  holdingId: string,
  valuation: Holding['currentValuation'],
  updatedBy: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const holdingRef = doc(db, HOLDINGS_COLLECTION, holdingId);
    const holdingDoc = await transaction.get(holdingRef);
    
    if (!holdingDoc.exists()) {
      throw new Error('Holding not found');
    }
    
    const holding = holdingDoc.data() as Holding;
    const previousValue = holding.currentValuation.fairValue;
    
    const valueChange = {
      amount: valuation.fairValue.amount - previousValue.amount,
      currency: valuation.fairValue.currency,
    };
    const percentageChange = previousValue.amount > 0
      ? (valueChange.amount / previousValue.amount) * 100
      : 0;
    
    const unrealizedGainLoss = {
      amount: valuation.fairValue.amount - holding.costBasis.adjustedCostBasis.amount,
      currency: valuation.fairValue.currency,
    };
    
    transaction.update(holdingRef, {
      currentValuation: {
        ...valuation,
        unrealizedGainLoss,
        unrealizedGainLossPercentage: holding.costBasis.adjustedCostBasis.amount > 0
          ? (unrealizedGainLoss.amount / holding.costBasis.adjustedCostBasis.amount) * 100
          : 0,
      },
      'keyDates.lastValuationDate': valuation.valuationDate,
      'realizationSummary.remainingFairValue': valuation.fairValue,
      updatedBy,
      updatedAt: Timestamp.now(),
    });
    
    const valRef = doc(collection(db, HOLDINGS_COLLECTION, holdingId, VALUATIONS_SUBCOLLECTION));
    transaction.set(valRef, {
      id: valRef.id,
      holdingId,
      portfolioId: holding.portfolioId,
      valuationDate: valuation.valuationDate,
      fairValue: valuation.fairValue,
      previousValue,
      valueChange,
      percentageChange,
      methodology: valuation.methodology,
      fairValueLevel: valuation.fairValueLevel,
      keyInputs: valuation.keyInputs,
      costBasis: holding.costBasis.adjustedCostBasis,
      unrealizedGainLoss,
      unrealizedGainLossPercentage: holding.costBasis.adjustedCostBasis.amount > 0
        ? (unrealizedGainLoss.amount / holding.costBasis.adjustedCostBasis.amount) * 100
        : 0,
      status: 'draft',
      preparedBy: updatedBy,
      preparedAt: Timestamp.now(),
    });
  });
  
  await recalculateReturnMetrics(holdingId);
  
  const holding = await getHolding(holdingId);
  if (holding) {
    await updatePortfolioHoldingsSummary(holding.portfolioId);
  }
}

export async function getValuationHistory(
  holdingId: string,
  limitCount?: number
): Promise<ValuationHistory[]> {
  const valRef = collection(db, HOLDINGS_COLLECTION, holdingId, VALUATIONS_SUBCOLLECTION);
  
  const constraints: QueryConstraint[] = [orderBy('valuationDate', 'desc')];
  if (limitCount) constraints.push(limit(limitCount));
  
  const q = query(valRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ValuationHistory));
}

export async function approveValuation(
  holdingId: string,
  valuationId: string,
  approvedBy: string
): Promise<void> {
  const valRef = doc(db, HOLDINGS_COLLECTION, holdingId, VALUATIONS_SUBCOLLECTION, valuationId);
  
  await updateDoc(valRef, {
    status: 'approved',
    approvedBy,
    approvedAt: Timestamp.now(),
  });
}

// ============================================
// Income Management
// ============================================

export async function recordIncome(
  income: Omit<HoldingIncome, 'id' | 'createdAt'>
): Promise<HoldingIncome> {
  const incomeRef = doc(collection(db, HOLDINGS_COLLECTION, income.holdingId, INCOME_SUBCOLLECTION));
  
  const incomeRecord: HoldingIncome = {
    ...income,
    id: incomeRef.id,
    createdAt: Timestamp.now(),
  };
  
  await setDoc(incomeRef, incomeRecord);
  
  await updateHoldingIncomeSummary(income.holdingId);
  
  return incomeRecord;
}

export async function processIncome(
  holdingId: string,
  incomeId: string,
  processedBy: string
): Promise<void> {
  const incomeRef = doc(db, HOLDINGS_COLLECTION, holdingId, INCOME_SUBCOLLECTION, incomeId);
  
  await updateDoc(incomeRef, {
    status: 'received',
    receivedDate: Timestamp.now(),
    processedBy,
    processedAt: Timestamp.now(),
  });
  
  await updateHoldingIncomeSummary(holdingId);
  await recalculateReturnMetrics(holdingId);
  
  const holding = await getHolding(holdingId);
  if (holding) {
    await updatePortfolioHoldingsSummary(holding.portfolioId);
  }
}

export async function getIncomeHistory(
  holdingId: string,
  type?: IncomeType
): Promise<HoldingIncome[]> {
  const incomeRef = collection(db, HOLDINGS_COLLECTION, holdingId, INCOME_SUBCOLLECTION);
  
  const constraints: QueryConstraint[] = [orderBy('paymentDate', 'desc')];
  if (type) {
    constraints.unshift(where('type', '==', type));
  }
  
  const q = query(incomeRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HoldingIncome));
}

async function updateHoldingIncomeSummary(holdingId: string): Promise<void> {
  const incomeRecords = await getIncomeHistory(holdingId);
  const received = incomeRecords.filter(i => i.status === 'received');
  
  if (received.length === 0) return;
  
  const currency = received[0].netAmount.currency;
  
  const summary = {
    totalIncome: { amount: received.reduce((sum, i) => sum + i.netAmount.amount, 0), currency },
    dividends: { amount: received.filter(i => i.type.includes('dividend')).reduce((sum, i) => sum + i.netAmount.amount, 0), currency },
    interest: { amount: received.filter(i => i.type.includes('interest')).reduce((sum, i) => sum + i.netAmount.amount, 0), currency },
    fees: { amount: received.filter(i => i.type.includes('fee')).reduce((sum, i) => sum + i.netAmount.amount, 0), currency },
    otherIncome: { amount: received.filter(i => !i.type.includes('dividend') && !i.type.includes('interest') && !i.type.includes('fee')).reduce((sum, i) => sum + i.netAmount.amount, 0), currency },
    currentPeriodIncome: { amount: 0, currency },
    lastDistributionDate: received[0].receivedDate,
    lastDistributionAmount: received[0].netAmount,
  };
  
  await updateDoc(doc(db, HOLDINGS_COLLECTION, holdingId), {
    incomeSummary: summary,
    'keyDates.lastIncomeDate': received[0].receivedDate,
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Return Metrics Calculation
// ============================================

async function recalculateReturnMetrics(holdingId: string): Promise<void> {
  const holding = await getHolding(holdingId);
  if (!holding) return;
  
  const returnMetrics = calculateReturnMetrics(
    holding.costBasis.adjustedCostBasis,
    holding.currentValuation.fairValue,
    holding.incomeSummary.totalIncome,
    holding.realizationSummary.totalRealizedProceeds,
    holding.keyDates.initialInvestmentDate
  );
  
  await updateDoc(doc(db, HOLDINGS_COLLECTION, holdingId), {
    returnMetrics,
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Portfolio Integration
// ============================================

async function updatePortfolioHoldingsSummary(portfolioId: string): Promise<void> {
  const holdings = await getHoldingsByPortfolio(portfolioId);
  const active = holdings.filter(h => !['fully_realized', 'written_off'].includes(h.status));
  const realized = holdings.filter(h => h.status === 'fully_realized');
  
  if (holdings.length === 0) return;
  
  const currency = holdings[0].costBasis.totalCost.currency;
  
  const summary: Record<string, unknown> = {
    totalHoldings: holdings.length,
    activeHoldings: active.length,
    realizedHoldings: realized.length,
    totalCost: { amount: active.reduce((sum, h) => sum + h.costBasis.adjustedCostBasis.amount, 0), currency },
    currentValue: { amount: active.reduce((sum, h) => sum + h.currentValuation.fairValue.amount, 0), currency },
    realizedValue: { amount: realized.reduce((sum, h) => sum + h.realizationSummary.totalRealizedProceeds.amount, 0), currency },
    unrealizedGain: { 
      amount: active.reduce((sum, h) => sum + h.currentValuation.unrealizedGainLoss.amount, 0), 
      currency 
    },
    largestHoldingPercentage: 0,
    top5Concentration: 0,
    top10Concentration: 0,
  };
  
  const totalValue = (summary.currentValue as MoneyAmount).amount;
  if (totalValue > 0) {
    const sorted = [...active].sort((a, b) => b.currentValuation.fairValue.amount - a.currentValuation.fairValue.amount);
    summary.largestHoldingPercentage = (sorted[0]?.currentValuation.fairValue.amount ?? 0) / totalValue * 100;
    summary.top5Concentration = sorted.slice(0, 5).reduce((sum, h) => sum + h.currentValuation.fairValue.amount, 0) / totalValue * 100;
    summary.top10Concentration = sorted.slice(0, 10).reduce((sum, h) => sum + h.currentValuation.fairValue.amount, 0) / totalValue * 100;
    
    summary.topHoldingsByValue = sorted.slice(0, 10).map(h => ({
      holdingId: h.id,
      name: h.name,
      value: h.currentValuation.fairValue,
      percentage: h.currentValuation.fairValue.amount / totalValue * 100,
    }));
  }
  
  const portfolioRef = doc(db, 'advisoryPlatform/advisory/portfolios', portfolioId);
  await updateDoc(portfolioRef, {
    holdingsSummary: summary,
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Holding Queries
// ============================================

export async function getHoldingsByPortfolio(portfolioId: string): Promise<Holding[]> {
  const q = query(
    collection(db, HOLDINGS_COLLECTION),
    where('portfolioId', '==', portfolioId),
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Holding));
}

export async function getHoldingsByDeal(dealId: string): Promise<Holding[]> {
  const q = query(
    collection(db, HOLDINGS_COLLECTION),
    where('underlyingAsset.dealId', '==', dealId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Holding));
}

export async function getActiveHoldings(): Promise<Holding[]> {
  const activeStatuses: HoldingStatus[] = ['active', 'partially_funded', 'fully_funded'];
  
  const q = query(
    collection(db, HOLDINGS_COLLECTION),
    where('status', 'in', activeStatuses),
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Holding));
}

export async function getHoldingSummaries(portfolioId?: string): Promise<HoldingSummary[]> {
  let q = query(collection(db, HOLDINGS_COLLECTION));
  
  if (portfolioId) {
    q = query(q, where('portfolioId', '==', portfolioId));
  }
  
  q = query(q, orderBy('name'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      holdingCode: data.holdingCode,
      name: data.name,
      holdingType: data.holdingType,
      status: data.status,
      sector: data.underlyingAsset?.sector ?? '',
      country: data.underlyingAsset?.country ?? '',
      costBasis: data.costBasis?.adjustedCostBasis,
      fairValue: data.currentValuation?.fairValue,
      unrealizedGainLoss: data.currentValuation?.unrealizedGainLoss,
      grossIRR: data.returnMetrics?.grossIRR ?? 0,
      grossMOIC: data.returnMetrics?.grossMOIC ?? 1,
      portfolioId: data.portfolioId,
      updatedAt: data.updatedAt,
    } as HoldingSummary;
  });
}

// ============================================
// Real-time Subscriptions
// ============================================

export function subscribeToHolding(
  holdingId: string,
  callback: (holding: Holding | null) => void
): () => void {
  const docRef = doc(db, HOLDINGS_COLLECTION, holdingId);
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Holding);
    } else {
      callback(null);
    }
  });
}

export function subscribeToPortfolioHoldings(
  portfolioId: string,
  callback: (holdings: Holding[]) => void
): () => void {
  const q = query(
    collection(db, HOLDINGS_COLLECTION),
    where('portfolioId', '==', portfolioId),
    orderBy('name')
  );
  
  return onSnapshot(q, (snapshot) => {
    const holdings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Holding));
    callback(holdings);
  });
}

export function subscribeToValuationHistory(
  holdingId: string,
  callback: (history: ValuationHistory[]) => void
): () => void {
  const valRef = collection(db, HOLDINGS_COLLECTION, holdingId, VALUATIONS_SUBCOLLECTION);
  const q = query(valRef, orderBy('valuationDate', 'desc'), limit(12));
  
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ValuationHistory));
    callback(history);
  });
}
