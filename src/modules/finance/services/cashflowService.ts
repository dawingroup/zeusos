// ============================================================================
// CASH FLOW SERVICE
// DawinOS v2.0 - Financial Management Module
// Firebase service for Cash Flow Analysis
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
import {
  CashTransaction,
  CashTransactionInput,
  CashPosition,
  CashFlowSummary,
  CashForecast,
  ForecastInput,
  CashForecastPeriod,
  BankReconciliation,
  ReconciliationInput,
  CashFlowFilters,
  CashAccount,
  CashFlowTrend,
  CashFlowAnalysis,
  ForecastAssumptions,
} from '../types/cashflow.types';
import {
  CASH_TRANSACTIONS_COLLECTION,
  CASH_FORECASTS_COLLECTION,
  BANK_RECONCILIATIONS_COLLECTION,
  CASH_INFLOW_CATEGORIES,
  CATEGORY_TO_ACTIVITY,
  CASH_FLOW_CATEGORY_LABELS,
  CASH_POSITION_THRESHOLDS,
  FORECAST_PERIODS,
  CashFlowCategory,
  ForecastHorizon,
} from '../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// CASH TRANSACTION FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Create a new cash transaction
 */
export const createCashTransaction = async (
  companyId: string,
  input: CashTransactionInput,
  userId: string
): Promise<CashTransaction> => {
  const isInflow = CASH_INFLOW_CATEGORIES.includes(input.category);
  const activity = CATEGORY_TO_ACTIVITY[input.category];
  
  const transactionData = {
    companyId,
    ...input,
    currency: input.currency || 'UGX',
    type: isInflow ? 'inflow' : 'outflow',
    activity,
    cashAccountName: '', // Would be populated from account lookup
    isReconciled: false,
    createdAt: Timestamp.now(),
    createdBy: userId,
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(
    collection(db, CASH_TRANSACTIONS_COLLECTION),
    transactionData
  );
  
  return {
    id: docRef.id,
    ...transactionData,
  } as CashTransaction;
};

/**
 * Get cash transaction by ID
 */
export const getCashTransaction = async (
  transactionId: string
): Promise<CashTransaction | null> => {
  const docSnap = await getDoc(doc(db, CASH_TRANSACTIONS_COLLECTION, transactionId));
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    date: data.date?.toDate?.() || new Date(data.date),
  } as CashTransaction;
};

/**
 * Get cash transactions with filters
 */
export const getCashTransactions = async (
  companyId: string,
  filters: CashFlowFilters = {}
): Promise<CashTransaction[]> => {
  let q = query(
    collection(db, CASH_TRANSACTIONS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('date', 'desc')
  );
  
  if (filters.startDate) {
    q = query(q, where('date', '>=', Timestamp.fromDate(filters.startDate)));
  }
  
  if (filters.endDate) {
    q = query(q, where('date', '<=', Timestamp.fromDate(filters.endDate)));
  }
  
  if (filters.type) {
    q = query(q, where('type', '==', filters.type));
  }
  
  if (filters.category) {
    q = query(q, where('category', '==', filters.category));
  }
  
  if (filters.activity) {
    q = query(q, where('activity', '==', filters.activity));
  }
  
  if (filters.cashAccountId) {
    q = query(q, where('cashAccountId', '==', filters.cashAccountId));
  }
  
  if (filters.isReconciled !== undefined) {
    q = query(q, where('isReconciled', '==', filters.isReconciled));
  }
  
  if (filters.paymentMethod) {
    q = query(q, where('paymentMethod', '==', filters.paymentMethod));
  }
  
  const snapshot = await getDocs(q);
  
  let transactions = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: data.date?.toDate?.() || new Date(data.date),
    } as CashTransaction;
  });
  
  // Client-side filtering for search term
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    transactions = transactions.filter(t =>
      t.description.toLowerCase().includes(term) ||
      t.reference?.toLowerCase().includes(term) ||
      t.customerName?.toLowerCase().includes(term) ||
      t.supplierName?.toLowerCase().includes(term)
    );
  }
  
  // Client-side amount filtering
  if (filters.minAmount !== undefined) {
    transactions = transactions.filter(t => t.amount >= filters.minAmount!);
  }
  
  if (filters.maxAmount !== undefined) {
    transactions = transactions.filter(t => t.amount <= filters.maxAmount!);
  }
  
  return transactions;
};

/**
 * Update a cash transaction
 */
export const updateCashTransaction = async (
  transactionId: string,
  updates: Partial<CashTransactionInput>
): Promise<void> => {
  const docRef = doc(db, CASH_TRANSACTIONS_COLLECTION, transactionId);
  
  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  
  // Update type and activity if category changed
  if (updates.category) {
    updateData.type = CASH_INFLOW_CATEGORIES.includes(updates.category) ? 'inflow' : 'outflow';
    updateData.activity = CATEGORY_TO_ACTIVITY[updates.category];
  }
  
  await updateDoc(docRef, updateData);
};

/**
 * Delete a cash transaction
 */
export const deleteCashTransaction = async (transactionId: string): Promise<void> => {
  await deleteDoc(doc(db, CASH_TRANSACTIONS_COLLECTION, transactionId));
};

// ----------------------------------------------------------------------------
// CASH POSITION FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Get current cash position
 */
export const getCashPosition = async (
  companyId: string,
  asOfDate: Date = new Date()
): Promise<CashPosition> => {
  // Get cash accounts (simplified - would query accounts collection)
  const accounts: CashAccount[] = [];
  
  // Calculate totals by type
  const cashOnHand = accounts
    .filter(a => a.accountType === 'cash')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  
  const bankBalances = accounts
    .filter(a => a.accountType === 'bank')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  
  const mobileMoneyBalances = accounts
    .filter(a => a.accountType === 'mobile_money')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  
  const totalCash = cashOnHand + bankBalances + mobileMoneyBalances;
  
  // Calculate daily average expenses (last 90 days)
  const ninetyDaysAgo = new Date(asOfDate);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const recentTransactions = await getCashTransactions(companyId, {
    startDate: ninetyDaysAgo,
    endDate: asOfDate,
    type: 'outflow',
  });
  
  const totalExpenses = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
  const dailyAverageExpenses = totalExpenses / 90;
  const daysOfCashOnHand = dailyAverageExpenses > 0 ? Math.floor(totalCash / dailyAverageExpenses) : 999;
  
  // Determine coverage status
  let cashCoverageStatus: 'critical' | 'warning' | 'healthy' | 'excess';
  if (daysOfCashOnHand < CASH_POSITION_THRESHOLDS.CRITICAL) {
    cashCoverageStatus = 'critical';
  } else if (daysOfCashOnHand < CASH_POSITION_THRESHOLDS.WARNING) {
    cashCoverageStatus = 'warning';
  } else if (totalCash > CASH_POSITION_THRESHOLDS.EXCESS_THRESHOLD) {
    cashCoverageStatus = 'excess';
  } else {
    cashCoverageStatus = 'healthy';
  }
  
  // Calculate period changes (last 30 days)
  const thirtyDaysAgo = new Date(asOfDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const periodTransactions = await getCashTransactions(companyId, {
    startDate: thirtyDaysAgo,
    endDate: asOfDate,
  });
  
  const periodInflows = periodTransactions
    .filter(t => t.type === 'inflow')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const periodOutflows = periodTransactions
    .filter(t => t.type === 'outflow')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return {
    asOfDate,
    totalCash,
    currency: 'UGX',
    cashOnHand,
    bankBalances,
    mobileMoneyBalances,
    accounts,
    dailyAverageExpenses,
    daysOfCashOnHand,
    cashCoverageStatus,
    periodInflows,
    periodOutflows,
    netCashFlow: periodInflows - periodOutflows,
  };
};

/**
 * Get cash flow summary for a period
 */
export const getCashFlowSummary = async (
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowSummary> => {
  const transactions = await getCashTransactions(companyId, {
    startDate,
    endDate,
  });
  
  // Calculate by activity
  let operatingCashFlow = 0;
  let investingCashFlow = 0;
  let financingCashFlow = 0;
  
  // Category breakdown map
  const categoryMap = new Map<CashFlowCategory, {
    inflows: number;
    outflows: number;
    count: number;
  }>();
  
  transactions.forEach(t => {
    const amount = t.type === 'inflow' ? t.amount : -t.amount;
    
    // By activity
    switch (t.activity) {
      case 'operating':
        operatingCashFlow += amount;
        break;
      case 'investing':
        investingCashFlow += amount;
        break;
      case 'financing':
        financingCashFlow += amount;
        break;
    }
    
    // By category
    if (!categoryMap.has(t.category)) {
      categoryMap.set(t.category, { inflows: 0, outflows: 0, count: 0 });
    }
    const cat = categoryMap.get(t.category)!;
    if (t.type === 'inflow') {
      cat.inflows += t.amount;
    } else {
      cat.outflows += t.amount;
    }
    cat.count++;
  });
  
  // Build category breakdown
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    label: CASH_FLOW_CATEGORY_LABELS[category],
    inflows: data.inflows,
    outflows: data.outflows,
    net: data.inflows - data.outflows,
    transactionCount: data.count,
  }));
  
  // Get largest transactions
  const sortedByAmount = [...transactions].sort((a, b) => b.amount - a.amount);
  const largestInflows = sortedByAmount.filter(t => t.type === 'inflow').slice(0, 5);
  const largestOutflows = sortedByAmount.filter(t => t.type === 'outflow').slice(0, 5);
  
  const netChange = operatingCashFlow + investingCashFlow + financingCashFlow;
  
  return {
    period: {
      startDate,
      endDate,
      label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    },
    openingBalance: 0, // Would calculate from prior period
    closingBalance: netChange, // Simplified
    netChange,
    operatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    categoryBreakdown,
    largestInflows,
    largestOutflows,
    currency: 'UGX',
  };
};

// ----------------------------------------------------------------------------
// CASH FORECAST FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Create a new cash forecast
 */
export const createCashForecast = async (
  companyId: string,
  input: ForecastInput,
  userId: string
): Promise<CashForecast> => {
  const periodCount = FORECAST_PERIODS[input.horizon];
  const periods = generateForecastPeriods(
    input.startDate,
    input.horizon,
    periodCount,
    input.openingCashBalance,
    input.assumptions
  );
  
  const endDate = periods[periods.length - 1].endDate;
  
  // Calculate min/max/avg balances
  const balances = periods.map(p => p.closingBalance);
  const minimumCashBalance = Math.min(...balances);
  const maximumCashBalance = Math.max(...balances);
  const averageCashBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
  
  // Find minimum balance date
  const minIndex = balances.indexOf(minimumCashBalance);
  const maxIndex = balances.indexOf(maximumCashBalance);
  
  // Find cash gap periods
  const cashGapPeriods = periods
    .filter(p => p.closingBalance < CASH_POSITION_THRESHOLDS.MINIMUM_BALANCE)
    .map(p => ({
      periodIndex: p.periodIndex,
      periodLabel: p.periodLabel,
      shortfall: CASH_POSITION_THRESHOLDS.MINIMUM_BALANCE - p.closingBalance,
      date: p.endDate,
    }));
  
  const forecastData = {
    companyId,
    name: input.name,
    description: input.description,
    horizon: input.horizon,
    startDate: input.startDate,
    endDate,
    openingCashBalance: input.openingCashBalance,
    currency: 'UGX',
    periods,
    assumptions: input.assumptions,
    minimumCashBalance,
    minimumBalanceDate: periods[minIndex].endDate,
    maximumCashBalance,
    maximumBalanceDate: periods[maxIndex].endDate,
    averageCashBalance,
    cashGapPeriods,
    status: 'draft' as const,
    createdAt: Timestamp.now(),
    createdBy: userId,
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(
    collection(db, CASH_FORECASTS_COLLECTION),
    forecastData
  );
  
  return {
    id: docRef.id,
    ...forecastData,
  } as CashForecast;
};

/**
 * Generate forecast periods based on assumptions
 */
const generateForecastPeriods = (
  startDate: Date,
  horizon: ForecastHorizon,
  periodCount: number,
  openingBalance: number,
  assumptions: ForecastAssumptions
): CashForecastPeriod[] => {
  const periods: CashForecastPeriod[] = [];
  let currentBalance = openingBalance;
  let currentDate = new Date(startDate);
  
  for (let i = 1; i <= periodCount; i++) {
    const periodStart = new Date(currentDate);
    let periodEnd: Date;
    let periodLabel: string;
    
    // Calculate period dates based on horizon
    switch (horizon) {
      case 'weekly':
        periodEnd = new Date(currentDate);
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodLabel = `Week ${i}`;
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        periodLabel = currentDate.toLocaleDateString('en-UG', { month: 'short', year: 'numeric' });
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
      default:
        periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 3, 0);
        periodLabel = `Q${Math.ceil((currentDate.getMonth() + 1) / 3)} ${currentDate.getFullYear()}`;
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
    }
    
    // Calculate inflows
    const inflows: CashForecastPeriod['inflows'] = [];
    let totalInflows = 0;
    
    // Add fixed monthly costs that are inflows (if any)
    // For now, use base calculation
    const baseInflow = currentBalance * (1 + assumptions.salesGrowthRate / 100) * 0.1;
    inflows.push({
      category: 'sales_receipts' as CashFlowCategory,
      label: 'Expected Sales',
      amount: baseInflow,
      isRecurring: true,
    });
    totalInflows = baseInflow;
    
    // Add one-time items
    assumptions.oneTimeItems
      ?.filter(item => item.periodIndex === i && item.isInflow)
      .forEach(item => {
        inflows.push({
          category: item.category,
          label: item.description,
          amount: item.amount,
          isRecurring: false,
        });
        totalInflows += item.amount;
      });
    
    // Calculate outflows
    const outflows: CashForecastPeriod['outflows'] = [];
    let totalOutflows = 0;
    
    // Add fixed monthly costs
    assumptions.fixedMonthlyCosts?.forEach(cost => {
      outflows.push({
        category: cost.category,
        label: cost.description,
        amount: cost.amount,
        isRecurring: true,
        dueDate: cost.dueDay ? new Date(periodStart.getFullYear(), periodStart.getMonth(), cost.dueDay) : undefined,
      });
      totalOutflows += cost.amount;
    });
    
    // Add one-time items
    assumptions.oneTimeItems
      ?.filter(item => item.periodIndex === i && !item.isInflow)
      .forEach(item => {
        outflows.push({
          category: item.category,
          label: item.description,
          amount: item.amount,
          isRecurring: false,
        });
        totalOutflows += item.amount;
      });
    
    const netCashFlow = totalInflows - totalOutflows;
    const closingBalance = currentBalance + netCashFlow;
    
    periods.push({
      periodIndex: i,
      periodLabel,
      startDate: periodStart,
      endDate: periodEnd,
      openingBalance: currentBalance,
      closingBalance,
      inflows,
      totalInflows,
      outflows,
      totalOutflows,
      netCashFlow,
    });
    
    currentBalance = closingBalance;
  }
  
  return periods;
};

/**
 * Get cash forecast by ID
 */
export const getCashForecast = async (
  forecastId: string
): Promise<CashForecast | null> => {
  const docSnap = await getDoc(doc(db, CASH_FORECASTS_COLLECTION, forecastId));
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.() || new Date(data.startDate),
    endDate: data.endDate?.toDate?.() || new Date(data.endDate),
    minimumBalanceDate: data.minimumBalanceDate?.toDate?.() || new Date(data.minimumBalanceDate),
    maximumBalanceDate: data.maximumBalanceDate?.toDate?.() || new Date(data.maximumBalanceDate),
    periods: data.periods?.map((p: CashForecastPeriod) => ({
      ...p,
      startDate: p.startDate instanceof Date ? p.startDate : new Date(p.startDate),
      endDate: p.endDate instanceof Date ? p.endDate : new Date(p.endDate),
    })),
  } as CashForecast;
};

/**
 * Get cash forecasts with filters
 */
export const getCashForecasts = async (
  companyId: string,
  filters: { status?: string; horizon?: string } = {}
): Promise<CashForecast[]> => {
  let q = query(
    collection(db, CASH_FORECASTS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  if (filters.horizon) {
    q = query(q, where('horizon', '==', filters.horizon));
  }
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      startDate: data.startDate?.toDate?.() || new Date(data.startDate),
      endDate: data.endDate?.toDate?.() || new Date(data.endDate),
    } as CashForecast;
  });
};

/**
 * Update forecast period
 */
export const updateForecastPeriod = async (
  forecastId: string,
  periodIndex: number,
  updates: Partial<CashForecastPeriod>
): Promise<void> => {
  const forecast = await getCashForecast(forecastId);
  if (!forecast) throw new Error('Forecast not found');
  
  const periodIdx = forecast.periods.findIndex(p => p.periodIndex === periodIndex);
  if (periodIdx === -1) throw new Error('Period not found');
  
  // Update the period
  forecast.periods[periodIdx] = {
    ...forecast.periods[periodIdx],
    ...updates,
  };
  
  // Recalculate subsequent periods
  for (let i = periodIdx; i < forecast.periods.length; i++) {
    const period = forecast.periods[i];
    if (i > 0) {
      period.openingBalance = forecast.periods[i - 1].closingBalance;
    }
    period.netCashFlow = period.totalInflows - period.totalOutflows;
    period.closingBalance = period.openingBalance + period.netCashFlow;
  }
  
  await updateDoc(doc(db, CASH_FORECASTS_COLLECTION, forecastId), {
    periods: forecast.periods,
    updatedAt: Timestamp.now(),
  });
};

// ----------------------------------------------------------------------------
// BANK RECONCILIATION FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Create a new bank reconciliation
 */
export const createBankReconciliation = async (
  companyId: string,
  input: ReconciliationInput,
  userId: string
): Promise<BankReconciliation> => {
  // Get book balance (would query journal entries)
  const bookOpeningBalance = 0; // Simplified
  const bookClosingBalance = 0; // Simplified
  
  const reconciliationData = {
    companyId,
    bankAccountId: input.bankAccountId,
    bankAccountName: '', // Would get from account lookup
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    statementDate: input.statementDate,
    statementOpeningBalance: input.statementOpeningBalance,
    statementClosingBalance: input.statementClosingBalance,
    bookOpeningBalance,
    bookClosingBalance,
    adjustedBankBalance: input.statementClosingBalance,
    adjustedBookBalance: bookClosingBalance,
    difference: input.statementClosingBalance - bookClosingBalance,
    isReconciled: false,
    reconciledItems: [],
    outstandingItems: [],
    adjustments: [],
    status: 'not_started' as const,
    currency: 'UGX',
    createdAt: Timestamp.now(),
    createdBy: userId,
  };
  
  const docRef = await addDoc(
    collection(db, BANK_RECONCILIATIONS_COLLECTION),
    reconciliationData
  );
  
  return {
    id: docRef.id,
    ...reconciliationData,
  } as BankReconciliation;
};

/**
 * Get bank reconciliation by ID
 */
export const getBankReconciliation = async (
  reconciliationId: string
): Promise<BankReconciliation | null> => {
  const docSnap = await getDoc(doc(db, BANK_RECONCILIATIONS_COLLECTION, reconciliationId));
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    periodStart: data.periodStart?.toDate?.() || new Date(data.periodStart),
    periodEnd: data.periodEnd?.toDate?.() || new Date(data.periodEnd),
    statementDate: data.statementDate?.toDate?.() || new Date(data.statementDate),
  } as BankReconciliation;
};

/**
 * Get bank reconciliations for an account
 */
export const getBankReconciliations = async (
  companyId: string,
  bankAccountId?: string
): Promise<BankReconciliation[]> => {
  let q = query(
    collection(db, BANK_RECONCILIATIONS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('statementDate', 'desc')
  );
  
  if (bankAccountId) {
    q = query(q, where('bankAccountId', '==', bankAccountId));
  }
  
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      periodStart: data.periodStart?.toDate?.() || new Date(data.periodStart),
      periodEnd: data.periodEnd?.toDate?.() || new Date(data.periodEnd),
      statementDate: data.statementDate?.toDate?.() || new Date(data.statementDate),
    } as BankReconciliation;
  });
};

/**
 * Reconcile a transaction
 */
export const reconcileTransaction = async (
  reconciliationId: string,
  transactionId: string,
  bankReference?: string
): Promise<void> => {
  const transaction = await getCashTransaction(transactionId);
  if (!transaction) throw new Error('Transaction not found');
  
  // Update transaction as reconciled
  await updateDoc(doc(db, CASH_TRANSACTIONS_COLLECTION, transactionId), {
    isReconciled: true,
    reconciliationId,
    reconciliationDate: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  // Add to reconciliation
  const reconciliation = await getBankReconciliation(reconciliationId);
  if (!reconciliation) throw new Error('Reconciliation not found');
  
  const reconciledItems = [...reconciliation.reconciledItems, {
    transactionId,
    date: transaction.date,
    description: transaction.description,
    reference: transaction.reference,
    amount: transaction.amount,
    type: transaction.type === 'inflow' ? 'deposit' : 'withdrawal',
    matchedBankReference: bankReference,
    matchedAt: Timestamp.now(),
  }];
  
  await updateDoc(doc(db, BANK_RECONCILIATIONS_COLLECTION, reconciliationId), {
    reconciledItems,
    status: 'in_progress',
  });
};

/**
 * Complete bank reconciliation
 */
export const completeReconciliation = async (
  reconciliationId: string,
  userId: string
): Promise<void> => {
  const reconciliation = await getBankReconciliation(reconciliationId);
  if (!reconciliation) throw new Error('Reconciliation not found');
  
  const isReconciled = Math.abs(reconciliation.difference) < 1; // Allow for rounding
  
  await updateDoc(doc(db, BANK_RECONCILIATIONS_COLLECTION, reconciliationId), {
    isReconciled,
    status: isReconciled ? 'completed' : 'variance',
    completedAt: Timestamp.now(),
    completedBy: userId,
  });
};

// ----------------------------------------------------------------------------
// TREND & ANALYSIS FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Get cash flow trends over time
 */
export const getCashFlowTrends = async (
  companyId: string,
  startDate: Date,
  endDate: Date,
  interval: 'weekly' | 'monthly' = 'monthly'
): Promise<CashFlowTrend[]> => {
  const trends: CashFlowTrend[] = [];
  const currentDate = new Date(startDate);
  let periodNumber = 0;
  
  while (currentDate < endDate) {
    const periodStart = new Date(currentDate);
    let periodEnd: Date;
    let periodLabel: string;
    
    if (interval === 'weekly') {
      periodEnd = new Date(currentDate);
      periodEnd.setDate(periodEnd.getDate() + 6);
      periodLabel = `Week ${++periodNumber}`;
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      periodLabel = currentDate.toLocaleDateString('en-UG', { month: 'short', year: 'numeric' });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }
    
    const summary = await getCashFlowSummary(companyId, periodStart, periodEnd);
    
    trends.push({
      period: periodLabel,
      startDate: periodStart,
      endDate: periodEnd,
      openingBalance: summary.openingBalance,
      closingBalance: summary.closingBalance,
      inflows: summary.categoryBreakdown.reduce((sum, c) => sum + c.inflows, 0),
      outflows: summary.categoryBreakdown.reduce((sum, c) => sum + c.outflows, 0),
      netCashFlow: summary.netChange,
      operatingCashFlow: summary.operatingCashFlow,
      investingCashFlow: summary.investingCashFlow,
      financingCashFlow: summary.financingCashFlow,
    });
  }
  
  return trends;
};

/**
 * Analyze cash flow metrics
 */
export const analyzeCashFlow = async (
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowAnalysis> => {
  const summary = await getCashFlowSummary(companyId, startDate, endDate);
  const position = await getCashPosition(companyId, endDate);
  
  // Calculate months in period
  const months = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  // Calculate metrics
  const totalOutflows = summary.categoryBreakdown.reduce((sum, c) => sum + c.outflows, 0);
  const averageMonthlyBurn = totalOutflows / Math.max(1, months);
  const runwayMonths = averageMonthlyBurn > 0 ? position.totalCash / averageMonthlyBurn : 999;
  
  return {
    operatingCashFlowRatio: totalOutflows > 0 ? summary.operatingCashFlow / totalOutflows : 0,
    cashConversionCycle: 30, // Simplified - would calculate from AR/AP days
    currentRatio: 1.5, // Simplified
    quickRatio: 1.2, // Simplified
    cashRatio: 0.8, // Simplified
    debtCoverageRatio: 2.0, // Simplified
    interestCoverageRatio: 5.0, // Simplified
    averageMonthlyBurn,
    runwayMonths,
    budgetVariance: 0, // Would compare to budget
    priorPeriodVariance: 0, // Would compare to prior period
  };
};
