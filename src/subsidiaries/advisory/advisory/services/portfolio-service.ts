/**
 * Portfolio Service
 * 
 * Handles all portfolio operations:
 * - Portfolio CRUD
 * - NAV calculation and updates
 * - Allocation management
 * - Capital transactions
 * - Cash management
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
  Portfolio,
  PortfolioStatus,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  CapitalTransaction,
  PortfolioNAV,
  MoneyAmount,
  PortfolioSummary,
} from '../types/portfolio';
import type { NAVHistory } from '../types/nav';
import type { StrategicAllocation, AllocationAnalysis, RebalancingRecommendation } from '../types/allocation';
import type { CashForecast, BankAccount } from '../types/cash-management';
import type { CashPosition } from '../types/portfolio';

// Collection references
const PORTFOLIOS_COLLECTION = 'advisoryPlatform/advisory/portfolios';
const STATUS_HISTORY_COLLECTION = 'statusHistory';
const NAV_HISTORY_COLLECTION = 'navHistory';
const ALLOCATIONS_COLLECTION = 'allocations';
const TRANSACTIONS_COLLECTION = 'capitalTransactions';
const CASH_FORECASTS_COLLECTION = 'cashForecasts';
const BANK_ACCOUNTS_COLLECTION = 'bankAccounts';

// ============================================
// Helper Functions
// ============================================

function generatePortfolioCode(type: string): string {
  const typeCode = type.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PF-${typeCode}-${year}-${sequence}`;
}

function createEmptyMoneyAmount(currency: string): MoneyAmount {
  return { amount: 0, currency: currency as MoneyAmount['currency'] };
}

// ============================================
// Portfolio CRUD Operations
// ============================================

export async function createPortfolio(input: CreatePortfolioInput): Promise<Portfolio> {
  const portfolioRef = doc(collection(db, PORTFOLIOS_COLLECTION));
  
  const now = Timestamp.now();
  const portfolioCode = generatePortfolioCode(input.portfolioType);
  const baseCurrency = input.capitalStructure.baseCurrency;
  
  // Initialize empty NAV
  const initialNAV: PortfolioNAV = {
    grossAssetValue: createEmptyMoneyAmount(baseCurrency),
    totalLiabilities: createEmptyMoneyAmount(baseCurrency),
    netAssetValue: createEmptyMoneyAmount(baseCurrency),
    components: {
      investmentsFairValue: createEmptyMoneyAmount(baseCurrency),
      cash: createEmptyMoneyAmount(baseCurrency),
      receivables: { total: createEmptyMoneyAmount(baseCurrency) },
      liabilities: { total: createEmptyMoneyAmount(baseCurrency) },
    },
    valuationDate: now,
    navChange: {
      absolute: createEmptyMoneyAmount(baseCurrency),
      percentage: 0,
    },
    status: 'draft',
    ...input.initialNAV,
  };
  
  // Initialize performance summary
  const performanceSummary = {
    netIRR: 0,
    grossIRR: 0,
    netMOIC: 1.0,
    grossMOIC: 1.0,
    dpi: 0,
    rvpi: 1.0,
    tvpi: 1.0,
    periodReturns: {
      mtd: 0,
      qtd: 0,
      ytd: 0,
      sinceInception: 0,
    },
    asOfDate: now,
  };
  
  // Initialize allocations
  const allocations = {
    targetAllocation: {
      bySector: [],
      byGeography: [],
      byStage: [],
      byInstrument: [],
    },
    actualAllocation: {
      bySector: [],
      byGeography: [],
      byStage: [],
      byInstrument: [],
    },
    allocationVariance: {
      bySector: [],
      byGeography: [],
      byStage: [],
      byInstrument: [],
    },
  };
  
  // Initialize holdings summary
  const holdingsSummary = {
    totalHoldings: 0,
    activeHoldings: 0,
    realizedHoldings: 0,
    totalCost: createEmptyMoneyAmount(baseCurrency),
    currentValue: createEmptyMoneyAmount(baseCurrency),
    realizedValue: createEmptyMoneyAmount(baseCurrency),
    unrealizedGain: createEmptyMoneyAmount(baseCurrency),
    largestHoldingPercentage: 0,
    top5Concentration: 0,
    top10Concentration: 0,
  };
  
  const portfolio: Portfolio = {
    ...input,
    id: portfolioRef.id,
    portfolioCode,
    currentNAV: initialNAV,
    performanceSummary,
    allocations,
    holdingsSummary,
    createdAt: now,
  };
  
  await setDoc(portfolioRef, portfolio);
  
  // Record initial status
  await recordStatusChange(
    portfolioRef.id,
    undefined,
    input.status,
    'Portfolio created',
    input.createdBy
  );
  
  return portfolio;
}

export async function getPortfolio(portfolioId: string): Promise<Portfolio | null> {
  const docRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Portfolio;
}

export async function updatePortfolio(
  portfolioId: string,
  updates: UpdatePortfolioInput,
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedBy,
    updatedAt: Timestamp.now(),
  });
}

export async function deletePortfolio(portfolioId: string): Promise<void> {
  const docRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  await deleteDoc(docRef);
}

// ============================================
// Portfolio Status Management
// ============================================

export async function updatePortfolioStatus(
  portfolioId: string,
  newStatus: PortfolioStatus,
  reason: string,
  changedBy: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const portfolioRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
    const portfolioDoc = await transaction.get(portfolioRef);
    
    if (!portfolioDoc.exists()) {
      throw new Error('Portfolio not found');
    }
    
    const portfolio = portfolioDoc.data() as Portfolio;
    const previousStatus = portfolio.status;
    
    if (!isValidStatusTransition(previousStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${previousStatus} to ${newStatus}`);
    }
    
    transaction.update(portfolioRef, {
      status: newStatus,
      'lifecycle.statusChangedAt': Timestamp.now(),
      'lifecycle.previousStatus': previousStatus,
      updatedBy: changedBy,
      updatedAt: Timestamp.now(),
    });
    
    const historyRef = doc(collection(db, PORTFOLIOS_COLLECTION, portfolioId, STATUS_HISTORY_COLLECTION));
    transaction.set(historyRef, {
      id: historyRef.id,
      portfolioId,
      previousStatus,
      newStatus,
      reason,
      effectiveDate: Timestamp.now(),
      changedBy,
      changedAt: Timestamp.now(),
    });
  });
}

function isValidStatusTransition(from: PortfolioStatus | undefined, to: PortfolioStatus): boolean {
  const validTransitions: Record<PortfolioStatus, PortfolioStatus[]> = {
    formation: ['fundraising', 'terminated'],
    fundraising: ['investing', 'terminated'],
    investing: ['fully_invested', 'harvesting', 'terminated'],
    fully_invested: ['harvesting', 'terminated'],
    harvesting: ['wind_down', 'terminated'],
    wind_down: ['closed', 'terminated'],
    closed: [],
    terminated: [],
  };
  
  if (!from) return true;
  return validTransitions[from]?.includes(to) ?? false;
}

async function recordStatusChange(
  portfolioId: string,
  previousStatus: PortfolioStatus | undefined,
  newStatus: PortfolioStatus,
  reason: string,
  changedBy: string
): Promise<void> {
  const historyRef = doc(collection(db, PORTFOLIOS_COLLECTION, portfolioId, STATUS_HISTORY_COLLECTION));
  
  await setDoc(historyRef, {
    id: historyRef.id,
    portfolioId,
    previousStatus: previousStatus ?? null,
    newStatus,
    reason,
    effectiveDate: Timestamp.now(),
    changedBy,
    changedAt: Timestamp.now(),
  });
}

// ============================================
// NAV Management
// ============================================

export async function calculateNAV(portfolioId: string): Promise<PortfolioNAV> {
  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio) throw new Error('Portfolio not found');
  
  // In a real implementation, this would aggregate holding values
  return portfolio.currentNAV;
}

export async function updateNAV(
  portfolioId: string,
  nav: PortfolioNAV,
  updatedBy: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const portfolioRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
    const portfolioDoc = await transaction.get(portfolioRef);
    
    if (!portfolioDoc.exists()) {
      throw new Error('Portfolio not found');
    }
    
    const portfolio = portfolioDoc.data() as Portfolio;
    
    const previousNAV = portfolio.currentNAV.netAssetValue.amount;
    const changeAmount = nav.netAssetValue.amount - previousNAV;
    const changePercentage = previousNAV > 0 ? (changeAmount / previousNAV) * 100 : 0;
    
    const updatedNAV: PortfolioNAV = {
      ...nav,
      previousNAV: portfolio.currentNAV.netAssetValue,
      previousDate: portfolio.currentNAV.valuationDate,
      navChange: {
        absolute: { amount: changeAmount, currency: nav.netAssetValue.currency },
        percentage: changePercentage,
      },
    };
    
    transaction.update(portfolioRef, {
      currentNAV: updatedNAV,
      updatedBy,
      updatedAt: Timestamp.now(),
    });
    
    const historyRef = doc(collection(db, PORTFOLIOS_COLLECTION, portfolioId, NAV_HISTORY_COLLECTION));
    transaction.set(historyRef, {
      id: historyRef.id,
      portfolioId,
      valuationDate: nav.valuationDate,
      grossAssetValue: nav.grossAssetValue,
      netAssetValue: nav.netAssetValue,
      navPerUnit: nav.navPerUnit,
      components: nav.components,
      status: nav.status,
      changeFromPrevious: {
        absolute: { amount: changeAmount, currency: nav.netAssetValue.currency },
        percentage: changePercentage,
        days: Math.floor((nav.valuationDate.toMillis() - portfolio.currentNAV.valuationDate.toMillis()) / (1000 * 60 * 60 * 24)),
      },
      createdBy: updatedBy,
      createdAt: Timestamp.now(),
    });
  });
}

export async function getNAVHistory(
  portfolioId: string,
  limitCount?: number
): Promise<NAVHistory[]> {
  const historyRef = collection(db, PORTFOLIOS_COLLECTION, portfolioId, NAV_HISTORY_COLLECTION);
  const constraints: QueryConstraint[] = [orderBy('valuationDate', 'desc')];
  if (limitCount) constraints.push(limit(limitCount));
  
  const q = query(historyRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NAVHistory));
}

export async function finalizeNAV(
  portfolioId: string,
  finalizedBy: string
): Promise<void> {
  const portfolioRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  
  await updateDoc(portfolioRef, {
    'currentNAV.status': 'final',
    'currentNAV.approvedBy': finalizedBy,
    'currentNAV.approvedAt': Timestamp.now(),
    updatedBy: finalizedBy,
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Allocation Management
// ============================================

export async function setStrategicAllocation(
  portfolioId: string,
  allocation: Omit<StrategicAllocation, 'id' | 'portfolioId' | 'createdAt'>,
  createdBy: string
): Promise<StrategicAllocation> {
  const allocRef = doc(collection(db, PORTFOLIOS_COLLECTION, portfolioId, ALLOCATIONS_COLLECTION));
  
  const strategicAllocation: StrategicAllocation = {
    ...allocation,
    id: allocRef.id,
    portfolioId,
    createdBy,
    createdAt: Timestamp.now(),
  };
  
  await setDoc(allocRef, strategicAllocation);
  
  const portfolioRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  await updateDoc(portfolioRef, {
    'allocations.targetAllocation': allocation.targets,
    updatedBy: createdBy,
    updatedAt: Timestamp.now(),
  });
  
  return strategicAllocation;
}

export async function analyzeAllocation(portfolioId: string): Promise<AllocationAnalysis> {
  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio) throw new Error('Portfolio not found');
  
  const { allocations } = portfolio;
  
  type DimensionType = 'sector' | 'geography' | 'stage' | 'instrument' | 'currency';
  
  const calculateVariances = (dimension: DimensionType, targets: { category: string; targetWeight?: number; minWeight?: number; maxWeight?: number }[], actuals: { category: string; percentage: number }[]) => {
    return targets.map(target => {
      const actual = actuals.find(a => a.category === target.category);
      const actualWeight = actual?.percentage ?? 0;
      const targetWeight = target.targetWeight ?? 0;
      const variance = actualWeight - targetWeight;
      
      let status: 'in_range' | 'warning' | 'breach' = 'in_range';
      if (actualWeight < (target.minWeight ?? 0) || actualWeight > (target.maxWeight ?? 100)) {
        status = 'breach';
      } else if (Math.abs(variance) > 3) {
        status = 'warning';
      }
      
      return {
        dimension,
        category: target.category,
        targetWeight,
        actualWeight,
        variance,
        absoluteVariance: Math.abs(variance),
        status,
        minWeight: target.minWeight ?? 0,
        maxWeight: target.maxWeight ?? 100,
      };
    });
  };
  
  const varianceAnalysis = [
    ...calculateVariances('sector', allocations.targetAllocation.bySector, allocations.actualAllocation.bySector),
    ...calculateVariances('geography', allocations.targetAllocation.byGeography, allocations.actualAllocation.byGeography),
    ...calculateVariances('stage', allocations.targetAllocation.byStage, allocations.actualAllocation.byStage),
    ...calculateVariances('instrument', allocations.targetAllocation.byInstrument, allocations.actualAllocation.byInstrument),
  ];
  
  const hasBreach = varianceAnalysis.some(v => v.status === 'breach');
  const hasWarning = varianceAnalysis.some(v => v.status === 'warning');
  const overallDriftStatus = hasBreach ? 'breach' : hasWarning ? 'warning' : 'in_range';
  
  const recommendations: RebalancingRecommendation[] = varianceAnalysis
    .filter(v => v.status !== 'in_range')
    .map(v => ({
      action: v.variance > 0 ? 'decrease' : 'increase' as const,
      dimension: v.dimension,
      category: v.category,
      currentWeight: v.actualWeight,
      targetWeight: v.targetWeight,
      suggestedChange: Math.abs(v.variance),
      priority: v.status === 'breach' ? 'high' : 'medium' as const,
      rationale: `${v.category} is ${v.variance > 0 ? 'overweight' : 'underweight'} by ${Math.abs(v.variance).toFixed(1)}%`,
    }));
  
  const topHolding = portfolio.holdingsSummary.topHoldingsByValue?.[0];
  const concentrationAnalysis = {
    largestHolding: { holdingId: topHolding?.holdingId ?? '', weight: topHolding?.percentage ?? 0 },
    top5Holdings: (portfolio.holdingsSummary.topHoldingsByValue ?? []).slice(0, 5).map(h => ({ holdingId: h.holdingId, weight: h.percentage })),
    top10Holdings: (portfolio.holdingsSummary.topHoldingsByValue ?? []).slice(0, 10).map(h => ({ holdingId: h.holdingId, weight: h.percentage })),
    herfindahlIndex: calculateHerfindahl(portfolio),
    effectiveNumberOfHoldings: calculateEffectiveN(portfolio),
    breaches: [] as { type: 'single_asset' | 'sector' | 'geography' | 'counterparty'; entity: string; limit: number; actual: number; excess: number }[],
  };
  
  return {
    portfolioId,
    analysisDate: Timestamp.now(),
    currentAllocation: {
      bySector: allocations.actualAllocation.bySector.map(a => ({ ...a, weight: a.percentage, holdingCount: 0 })),
      byGeography: allocations.actualAllocation.byGeography.map(a => ({ ...a, weight: a.percentage, holdingCount: 0 })),
      byStage: allocations.actualAllocation.byStage.map(a => ({ ...a, weight: a.percentage, holdingCount: 0 })),
      byInstrument: allocations.actualAllocation.byInstrument.map(a => ({ ...a, weight: a.percentage, holdingCount: 0 })),
    },
    targetAllocation: {
      bySector: allocations.targetAllocation.bySector.map(a => ({ ...a, targetWeight: a.percentage ?? 0, minWeight: 0, maxWeight: 100, priority: 'should_have' as const })),
      byGeography: allocations.targetAllocation.byGeography.map(a => ({ ...a, targetWeight: a.percentage ?? 0, minWeight: 0, maxWeight: 100, priority: 'should_have' as const })),
      byStage: allocations.targetAllocation.byStage.map(a => ({ ...a, targetWeight: a.percentage ?? 0, minWeight: 0, maxWeight: 100, priority: 'should_have' as const })),
      byInstrument: allocations.targetAllocation.byInstrument.map(a => ({ ...a, targetWeight: a.percentage ?? 0, minWeight: 0, maxWeight: 100, priority: 'should_have' as const })),
    },
    varianceAnalysis,
    overallDriftStatus,
    rebalancingNeeded: overallDriftStatus !== 'in_range',
    recommendations,
    concentrationAnalysis,
  };
}

function calculateHerfindahl(portfolio: Portfolio): number {
  const weights = portfolio.holdingsSummary.topHoldingsByValue?.map(h => h.percentage / 100) ?? [];
  return weights.reduce((sum, w) => sum + w * w, 0);
}

function calculateEffectiveN(portfolio: Portfolio): number {
  const hhi = calculateHerfindahl(portfolio);
  return hhi > 0 ? 1 / hhi : 0;
}

// ============================================
// Capital Transactions
// ============================================

export async function createCapitalTransaction(
  transaction: Omit<CapitalTransaction, 'id' | 'createdAt'>
): Promise<CapitalTransaction> {
  const txnRef = doc(collection(db, PORTFOLIOS_COLLECTION, transaction.portfolioId, TRANSACTIONS_COLLECTION));
  
  const capitalTransaction: CapitalTransaction = {
    ...transaction,
    id: txnRef.id,
    createdAt: Timestamp.now(),
  };
  
  await setDoc(txnRef, capitalTransaction);
  
  return capitalTransaction;
}

export async function processCapitalTransaction(
  portfolioId: string,
  transactionId: string,
  processedBy: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const txnRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId, TRANSACTIONS_COLLECTION, transactionId);
    const txnDoc = await transaction.get(txnRef);
    
    if (!txnDoc.exists()) {
      throw new Error('Transaction not found');
    }
    
    const txn = txnDoc.data() as CapitalTransaction;
    
    transaction.update(txnRef, {
      status: 'completed',
      settlementDate: Timestamp.now(),
      processedBy,
      processedAt: Timestamp.now(),
    });
    
    const portfolioRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
    
    if (txn.type === 'capital_call') {
      transaction.update(portfolioRef, {
        'capitalStructure.calledCapital.amount': increment(txn.netAmount.amount),
        'capitalStructure.uncalledCommitments.amount': increment(-txn.netAmount.amount),
        'capitalStructure.paidInCapital.amount': increment(txn.netAmount.amount),
        'cashPosition.totalCash.amount': increment(txn.netAmount.amount),
        updatedAt: Timestamp.now(),
      });
    } else if (txn.type === 'distribution') {
      transaction.update(portfolioRef, {
        'capitalStructure.totalDistributions.amount': increment(txn.netAmount.amount),
        'capitalStructure.returnedCapital.amount': increment(txn.netAmount.amount),
        'cashPosition.totalCash.amount': increment(-txn.netAmount.amount),
        updatedAt: Timestamp.now(),
      });
    }
  });
}

export async function getCapitalTransactions(
  portfolioId: string,
  type?: string
): Promise<CapitalTransaction[]> {
  const txnRef = collection(db, PORTFOLIOS_COLLECTION, portfolioId, TRANSACTIONS_COLLECTION);
  
  const constraints: QueryConstraint[] = [orderBy('dueDate', 'desc')];
  if (type) {
    constraints.unshift(where('type', '==', type));
  }
  
  const q = query(txnRef, ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CapitalTransaction));
}

// ============================================
// Cash Management
// ============================================

export async function updateCashPosition(
  portfolioId: string,
  position: Partial<CashPosition>,
  updatedBy: string
): Promise<void> {
  const portfolioRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  
  await updateDoc(portfolioRef, {
    cashPosition: position,
    updatedBy,
    updatedAt: Timestamp.now(),
  });
}

export async function createCashForecast(
  forecast: Omit<CashForecast, 'id' | 'createdAt'>
): Promise<CashForecast> {
  const forecastRef = doc(collection(db, PORTFOLIOS_COLLECTION, forecast.portfolioId, CASH_FORECASTS_COLLECTION));
  
  const cashForecast: CashForecast = {
    ...forecast,
    id: forecastRef.id,
    createdAt: Timestamp.now(),
  };
  
  await setDoc(forecastRef, cashForecast);
  
  return cashForecast;
}

export async function manageBankAccount(
  portfolioId: string,
  account: Omit<BankAccount, 'id' | 'createdAt'> & { id?: string }
): Promise<BankAccount> {
  const accountRef = account.id
    ? doc(db, PORTFOLIOS_COLLECTION, portfolioId, BANK_ACCOUNTS_COLLECTION, account.id)
    : doc(collection(db, PORTFOLIOS_COLLECTION, portfolioId, BANK_ACCOUNTS_COLLECTION));
  
  const existingDoc = account.id ? await getDoc(accountRef) : null;
  
  const bankAccount: BankAccount = {
    ...account,
    id: accountRef.id,
    portfolioId,
    createdAt: existingDoc?.data()?.createdAt ?? Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  await setDoc(accountRef, bankAccount);
  
  return bankAccount;
}

// ============================================
// Portfolio Queries
// ============================================

export async function getPortfoliosByClient(clientId: string): Promise<Portfolio[]> {
  const q = query(
    collection(db, PORTFOLIOS_COLLECTION),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Portfolio));
}

export async function getPortfoliosByEngagement(engagementId: string): Promise<Portfolio[]> {
  const q = query(
    collection(db, PORTFOLIOS_COLLECTION),
    where('engagementId', '==', engagementId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Portfolio));
}

export async function getActivePortfolios(): Promise<Portfolio[]> {
  const activeStatuses: PortfolioStatus[] = ['investing', 'fully_invested', 'harvesting'];
  
  const q = query(
    collection(db, PORTFOLIOS_COLLECTION),
    where('status', 'in', activeStatuses),
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Portfolio));
}

export async function getPortfolioSummaries(
  options: { clientId?: string; status?: PortfolioStatus[] } = {}
): Promise<PortfolioSummary[]> {
  let q = query(collection(db, PORTFOLIOS_COLLECTION));
  
  if (options.clientId) {
    q = query(q, where('clientId', '==', options.clientId));
  }
  
  if (options.status?.length) {
    q = query(q, where('status', 'in', options.status));
  }
  
  q = query(q, orderBy('name'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      portfolioCode: data.portfolioCode,
      name: data.name,
      portfolioType: data.portfolioType,
      status: data.status,
      strategy: data.strategy,
      clientId: data.clientId,
      currentNAV: data.currentNAV?.netAssetValue,
      navChange: data.currentNAV?.navChange?.percentage ?? 0,
      netIRR: data.performanceSummary?.netIRR ?? 0,
      tvpi: data.performanceSummary?.tvpi ?? 1,
      activeHoldings: data.holdingsSummary?.activeHoldings ?? 0,
      updatedAt: data.updatedAt,
    } as PortfolioSummary;
  });
}

// ============================================
// Real-time Subscriptions
// ============================================

export function subscribeToPortfolio(
  portfolioId: string,
  callback: (portfolio: Portfolio | null) => void
): () => void {
  const docRef = doc(db, PORTFOLIOS_COLLECTION, portfolioId);
  
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Portfolio);
    } else {
      callback(null);
    }
  });
}

export function subscribeToClientPortfolios(
  clientId: string,
  callback: (portfolios: Portfolio[]) => void
): () => void {
  const q = query(
    collection(db, PORTFOLIOS_COLLECTION),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const portfolios = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Portfolio));
    callback(portfolios);
  });
}

export function subscribeToNAVHistory(
  portfolioId: string,
  callback: (history: NAVHistory[]) => void
): () => void {
  const historyRef = collection(db, PORTFOLIOS_COLLECTION, portfolioId, NAV_HISTORY_COLLECTION);
  const q = query(historyRef, orderBy('valuationDate', 'desc'), limit(24));
  
  return onSnapshot(q, (snapshot) => {
    const history = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NAVHistory));
    callback(history);
  });
}
