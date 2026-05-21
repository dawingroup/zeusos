// ============================================================================
// BUDGET SERVICE
// ZeusOS v2.0 - Financial Management Module
// Service for managing budgets and budget line items
// ============================================================================

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
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  BUDGETS_COLLECTION,
  BUDGET_LINES_COLLECTION,
  BUDGET_REVISIONS_COLLECTION,
  FISCAL_MONTHS,
  ALLOCATION_METHODS,
  VARIANCE_THRESHOLDS,
  getFiscalMonth,
} from '../constants/budget.constants';
import { DEFAULT_CURRENCY } from '../constants/currency.constants';
import {
  Budget,
  BudgetInput,
  BudgetUpdate,
  BudgetLineItem,
  BudgetLineInput,
  BudgetLineUpdate,
  BudgetPeriodAmount,
  BudgetFilters,
  BudgetQueryResult,
  BudgetVariance,
  LineVariance,
  BudgetRevision,
  BudgetLineChange,
  BudgetForecast,
  MonthlyProjection,
  VarianceStatus,
} from '../types/budget.types';
import { accountService } from './accountService';

// ----------------------------------------------------------------------------
// BUDGET CRUD OPERATIONS
// ----------------------------------------------------------------------------

class BudgetService {
  /**
   * Create a new budget
   */
  async createBudget(
    companyId: string,
    input: BudgetInput,
    userId: string
  ): Promise<Budget> {
    const budgetRef = doc(collection(db, 'companies', companyId, BUDGETS_COLLECTION));
    
    // Generate budget code if not provided
    const code = input.code || `BUD-${input.fiscalYear}-${input.type.substring(0, 2).toUpperCase()}`;
    
    // Calculate fiscal year dates (Uganda: July 1 - June 30)
    const startDate = new Date(input.fiscalYear - 1, 6, 1); // July 1 of previous year
    const endDate = new Date(input.fiscalYear, 5, 30);      // June 30 of fiscal year
    
    const now = Timestamp.now();
    const budget: Budget = {
      id: budgetRef.id,
      companyId,
      
      name: input.name,
      code,
      description: input.description || '',

      type: input.type,

      fiscalYear: input.fiscalYear,
      periodType: input.periodType,
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),

      departmentId: input.departmentId,
      projectId: input.projectId,
      
      currency: input.currency || DEFAULT_CURRENCY,
      
      totalBudget: 0,
      totalActual: 0,
      totalCommitted: 0,
      totalAvailable: 0,
      
      totalVariance: 0,
      variancePercent: 0,
      
      status: 'draft',
      version: 1,
      isLocked: false,
      
      parentBudgetId: input.parentBudgetId,
      hasChildren: false,

      tags: input.tags,
      
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };
    
    // Strip undefined fields — Firestore rejects undefined values
    const cleanBudget = Object.fromEntries(
      Object.entries(budget).filter(([, v]) => v !== undefined)
    );
    await setDoc(budgetRef, cleanBudget);
    
    // Update parent budget if exists
    if (input.parentBudgetId) {
      const parentRef = doc(db, 'companies', companyId, BUDGETS_COLLECTION, input.parentBudgetId);
      await updateDoc(parentRef, {
        hasChildren: true,
        updatedAt: now,
        updatedBy: userId,
      });
    }
    
    return budget;
  }

  /**
   * Get budget by ID
   */
  async getBudget(companyId: string, budgetId: string): Promise<Budget | null> {
    const budgetDoc = await getDoc(
      doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId)
    );
    if (!budgetDoc.exists()) {
      return null;
    }
    return { id: budgetDoc.id, ...budgetDoc.data() } as Budget;
  }

  /**
   * Update a budget
   */
  async updateBudget(
    companyId: string,
    budgetId: string,
    update: BudgetUpdate,
    userId: string
  ): Promise<Budget> {
    const budgetRef = doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId);
    const budgetDoc = await getDoc(budgetRef);
    
    if (!budgetDoc.exists()) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    const budget = { id: budgetDoc.id, ...budgetDoc.data() } as Budget;
    
    if (budget.isLocked) {
      throw new Error('Cannot update locked budget');
    }
    
    await updateDoc(budgetRef, {
      ...update,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return { ...budget, ...update };
  }

  /**
   * Get budgets for a company
   */
  async getBudgets(
    companyId: string,
    filters?: BudgetFilters
  ): Promise<BudgetQueryResult> {
    let q = query(
      collection(db, 'companies', companyId, BUDGETS_COLLECTION),
      orderBy('fiscalYear', 'desc'),
      orderBy('name')
    );
    
    if (filters?.fiscalYear) {
      q = query(
        collection(db, 'companies', companyId, BUDGETS_COLLECTION),
        where('fiscalYear', '==', filters.fiscalYear),
        orderBy('name')
      );
    }
    
    const snapshot = await getDocs(q);
    let budgets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
    
    // Client-side filtering
    if (filters?.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      budgets = budgets.filter(b => types.includes(b.type));
    }
    
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      budgets = budgets.filter(b => statuses.includes(b.status));
    }
    
    if (filters?.departmentId) {
      budgets = budgets.filter(b => b.departmentId === filters.departmentId);
    }
    
    if (filters?.projectId) {
      budgets = budgets.filter(b => b.projectId === filters.projectId);
    }
    
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      budgets = budgets.filter(b =>
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        b.description?.toLowerCase().includes(term)
      );
    }
    
    return {
      budgets,
      total: budgets.length,
      totalBudget: budgets.reduce((sum, b) => sum + b.totalBudget, 0),
      totalActual: budgets.reduce((sum, b) => sum + b.totalActual, 0),
    };
  }

  // --------------------------------------------------------------------------
  // BUDGET LINE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Add a line item to a budget
   */
  async addBudgetLine(
    companyId: string,
    budgetId: string,
    input: BudgetLineInput,
    userId: string
  ): Promise<BudgetLineItem> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    if (budget.isLocked) {
      throw new Error('Cannot add lines to locked budget');
    }
    
    // Get account details
    const account = await accountService.getById(companyId, input.accountId);
    if (!account) {
      throw new Error(`Account not found: ${input.accountId}`);
    }
    
    const lineRef = doc(collection(db, 'companies', companyId, BUDGET_LINES_COLLECTION));
    
    // Calculate period amounts based on allocation method
    const periodAmounts = this.calculatePeriodAmounts(
      input.annualBudget,
      input.allocationMethod,
      input.periodAmounts,
      budget.fiscalYear
    );
    
    const now = Timestamp.now();
    const line: BudgetLineItem = {
      id: lineRef.id,
      budgetId,
      companyId,
      
      accountId: input.accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      accountSubType: account.subType,
      
      description: input.description,
      notes: input.notes,
      
      annualBudget: input.annualBudget,
      annualActual: 0,
      annualCommitted: 0,
      annualAvailable: input.annualBudget,
      annualVariance: input.annualBudget,
      variancePercent: 100,
      
      periodAmounts,
      
      allocationMethod: input.allocationMethod,
      
      departmentId: input.departmentId,
      projectId: input.projectId,
      costCenterId: input.costCenterId,
      
      isLocked: false,
      
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };
    
    await setDoc(lineRef, line);
    
    // Update budget totals
    await this.recalculateBudgetTotals(companyId, budgetId, userId);
    
    return line;
  }

  /**
   * Get budget lines for a budget
   */
  async getBudgetLines(companyId: string, budgetId: string): Promise<BudgetLineItem[]> {
    const q = query(
      collection(db, 'companies', companyId, BUDGET_LINES_COLLECTION),
      where('budgetId', '==', budgetId),
      orderBy('accountCode')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetLineItem));
  }

  /**
   * Update a budget line
   */
  async updateBudgetLine(
    companyId: string,
    lineId: string,
    update: BudgetLineUpdate,
    userId: string
  ): Promise<BudgetLineItem> {
    const lineRef = doc(db, 'companies', companyId, BUDGET_LINES_COLLECTION, lineId);
    const lineDoc = await getDoc(lineRef);
    
    if (!lineDoc.exists()) {
      throw new Error(`Budget line not found: ${lineId}`);
    }
    
    const line = { id: lineDoc.id, ...lineDoc.data() } as BudgetLineItem;
    
    if (line.isLocked) {
      throw new Error('Cannot update locked budget line');
    }
    
    // Recalculate period amounts if annual budget or allocation changed
    let periodAmounts = line.periodAmounts;
    if (update.annualBudget !== undefined || update.allocationMethod) {
      const budget = await this.getBudget(companyId, line.budgetId);
      periodAmounts = this.calculatePeriodAmounts(
        update.annualBudget ?? line.annualBudget,
        update.allocationMethod ?? line.allocationMethod,
        update.periodAmounts,
        budget!.fiscalYear
      );
    }
    
    const annualBudget = update.annualBudget ?? line.annualBudget;
    
    await updateDoc(lineRef, {
      ...update,
      periodAmounts,
      annualAvailable: annualBudget - line.annualActual - line.annualCommitted,
      annualVariance: annualBudget - line.annualActual,
      variancePercent: annualBudget > 0 
        ? ((annualBudget - line.annualActual) / annualBudget) * 100 
        : 0,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    // Update budget totals
    await this.recalculateBudgetTotals(companyId, line.budgetId, userId);
    
    return { ...line, ...update, periodAmounts };
  }

  /**
   * Delete a budget line
   */
  async deleteBudgetLine(
    companyId: string,
    lineId: string,
    userId: string
  ): Promise<void> {
    const lineRef = doc(db, 'companies', companyId, BUDGET_LINES_COLLECTION, lineId);
    const lineDoc = await getDoc(lineRef);
    
    if (!lineDoc.exists()) {
      throw new Error(`Budget line not found: ${lineId}`);
    }
    
    const line = lineDoc.data() as BudgetLineItem;
    
    if (line.isLocked) {
      throw new Error('Cannot delete locked budget line');
    }
    
    if (line.annualActual > 0) {
      throw new Error('Cannot delete budget line with actual amounts');
    }
    
    await deleteDoc(lineRef);
    
    // Update budget totals
    await this.recalculateBudgetTotals(companyId, line.budgetId, userId);
  }

  // --------------------------------------------------------------------------
  // ALLOCATION CALCULATIONS
  // --------------------------------------------------------------------------

  /**
   * Calculate period amounts based on allocation method
   */
  private calculatePeriodAmounts(
    annualBudget: number,
    method: string,
    customAmounts?: number[],
    fiscalYear?: number
  ): BudgetPeriodAmount[] {
    const periods: BudgetPeriodAmount[] = [];
    let amounts: number[];
    
    switch (method) {
      case ALLOCATION_METHODS.EQUAL: {
        const monthly = Math.floor(annualBudget / 12);
        const remainder = annualBudget - (monthly * 12);
        amounts = Array(12).fill(monthly);
        amounts[11] += remainder;
        break;
      }
      
      case ALLOCATION_METHODS.FRONT_LOADED: {
        const firstHalf = Math.floor((annualBudget * 0.6) / 6);
        const secondHalf = Math.floor((annualBudget * 0.4) / 6);
        amounts = [
          ...Array(6).fill(firstHalf),
          ...Array(6).fill(secondHalf),
        ];
        const diff = annualBudget - amounts.reduce((a, b) => a + b, 0);
        amounts[11] += diff;
        break;
      }
      
      case ALLOCATION_METHODS.BACK_LOADED: {
        const firstHalfBL = Math.floor((annualBudget * 0.4) / 6);
        const secondHalfBL = Math.floor((annualBudget * 0.6) / 6);
        amounts = [
          ...Array(6).fill(firstHalfBL),
          ...Array(6).fill(secondHalfBL),
        ];
        const diffBL = annualBudget - amounts.reduce((a, b) => a + b, 0);
        amounts[11] += diffBL;
        break;
      }
      
      case ALLOCATION_METHODS.CUSTOM:
        amounts = customAmounts || Array(12).fill(Math.floor(annualBudget / 12));
        break;
      
      default: {
        const defaultMonthly = Math.floor(annualBudget / 12);
        amounts = Array(12).fill(defaultMonthly);
        amounts[11] += annualBudget - amounts.reduce((a, b) => a + b, 0);
      }
    }
    
    // Build period amounts with fiscal month mapping
    let cumulative = 0;
    FISCAL_MONTHS.forEach((fm, index) => {
      cumulative += amounts[index];
      
      const calendarYear = fiscalYear 
        ? (fm.month >= 7 ? fiscalYear - 1 : fiscalYear)
        : new Date().getFullYear();
      
      periods.push({
        period: index + 1,
        fiscalMonth: fm.fiscalMonth,
        calendarMonth: fm.month,
        calendarYear,
        
        budgetAmount: amounts[index],
        actualAmount: 0,
        committedAmount: 0,
        availableAmount: amounts[index],
        variance: amounts[index],
        variancePercent: 100,
        
        ytdBudget: cumulative,
        ytdActual: 0,
        ytdVariance: cumulative,
        ytdVariancePercent: 100,
      });
    });
    
    return periods;
  }

  // --------------------------------------------------------------------------
  // BUDGET TOTALS & VARIANCE
  // --------------------------------------------------------------------------

  /**
   * Recalculate budget totals from line items
   */
  async recalculateBudgetTotals(
    companyId: string,
    budgetId: string,
    userId: string
  ): Promise<void> {
    const lines = await this.getBudgetLines(companyId, budgetId);
    
    const totals = lines.reduce(
      (acc, line) => ({
        totalBudget: acc.totalBudget + line.annualBudget,
        totalActual: acc.totalActual + line.annualActual,
        totalCommitted: acc.totalCommitted + line.annualCommitted,
      }),
      { totalBudget: 0, totalActual: 0, totalCommitted: 0 }
    );
    
    const totalAvailable = totals.totalBudget - totals.totalActual - totals.totalCommitted;
    const totalVariance = totals.totalBudget - totals.totalActual;
    const variancePercent = totals.totalBudget > 0
      ? (totalVariance / totals.totalBudget) * 100
      : 0;
    
    await updateDoc(doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId), {
      ...totals,
      totalAvailable,
      totalVariance,
      variancePercent,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Calculate budget variance report
   */
  async calculateBudgetVariance(
    companyId: string,
    budgetId: string,
    asOfDate?: Date
  ): Promise<BudgetVariance> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    const lines = await this.getBudgetLines(companyId, budgetId);
    const effectiveDate = asOfDate || new Date();
    
    // Calculate line variances
    const lineVariances: LineVariance[] = lines.map(line => {
      const varianceStatus = this.getVarianceStatus(line.variancePercent);
      
      // Get current period
      const currentFiscalMonth = getFiscalMonth(effectiveDate);
      const currentPeriod = line.periodAmounts.find(p => p.fiscalMonth === currentFiscalMonth);
      
      // Calculate YTD
      const ytdPeriods = line.periodAmounts.filter(p => p.fiscalMonth <= currentFiscalMonth);
      const ytdBudget = ytdPeriods.reduce((sum, p) => sum + p.budgetAmount, 0);
      const ytdActual = ytdPeriods.reduce((sum, p) => sum + p.actualAmount, 0);
      
      return {
        lineId: line.id,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        accountType: line.accountType,
        accountSubType: line.accountSubType,
        
        budget: line.annualBudget,
        actual: line.annualActual,
        committed: line.annualCommitted,
        available: line.annualAvailable,
        variance: line.annualVariance,
        variancePercent: line.variancePercent,
        
        currentPeriodBudget: currentPeriod?.budgetAmount || 0,
        currentPeriodActual: currentPeriod?.actualAmount || 0,
        currentPeriodVariance: (currentPeriod?.budgetAmount || 0) - (currentPeriod?.actualAmount || 0),
        
        ytdBudget,
        ytdActual,
        ytdVariance: ytdBudget - ytdActual,
        
        varianceStatus,
        notes: line.notes,
      };
    });
    
    // Group by account type
    const byAccountType: Record<string, { budget: number; actual: number; variance: number; variancePercent: number; lineCount: number }> = {};
    const bySubType: Record<string, { budget: number; actual: number; variance: number; variancePercent: number; lineCount: number }> = {};
    
    lineVariances.forEach(lv => {
      // By type
      if (!byAccountType[lv.accountType]) {
        byAccountType[lv.accountType] = {
          budget: 0, actual: 0, variance: 0, variancePercent: 0, lineCount: 0
        };
      }
      byAccountType[lv.accountType].budget += lv.budget;
      byAccountType[lv.accountType].actual += lv.actual;
      byAccountType[lv.accountType].variance += lv.variance;
      byAccountType[lv.accountType].lineCount++;
      
      // By sub-type
      if (!bySubType[lv.accountSubType]) {
        bySubType[lv.accountSubType] = {
          budget: 0, actual: 0, variance: 0, variancePercent: 0, lineCount: 0
        };
      }
      bySubType[lv.accountSubType].budget += lv.budget;
      bySubType[lv.accountSubType].actual += lv.actual;
      bySubType[lv.accountSubType].variance += lv.variance;
      bySubType[lv.accountSubType].lineCount++;
    });
    
    // Calculate percentages
    Object.keys(byAccountType).forEach(key => {
      const item = byAccountType[key];
      item.variancePercent = item.budget > 0 ? (item.variance / item.budget) * 100 : 0;
    });
    
    Object.keys(bySubType).forEach(key => {
      const item = bySubType[key];
      item.variancePercent = item.budget > 0 ? (item.variance / item.budget) * 100 : 0;
    });
    
    // Top variances
    const sortedByVariance = [...lineVariances].sort((a, b) => a.variance - b.variance);
    const topOverBudget = sortedByVariance.filter(lv => lv.variance < 0).slice(0, 5);
    const topUnderBudget = sortedByVariance.filter(lv => lv.variance > 0).reverse().slice(0, 5);
    
    return {
      budgetId,
      budgetName: budget.name,
      fiscalYear: budget.fiscalYear,
      asOfDate: effectiveDate,
      
      totalBudget: budget.totalBudget,
      totalActual: budget.totalActual,
      totalVariance: budget.totalVariance,
      variancePercent: budget.variancePercent,
      varianceStatus: this.getVarianceStatus(budget.variancePercent),
      
      byAccountType,
      bySubType,
      
      lineVariances,
      topOverBudget,
      topUnderBudget,
    };
  }

  /**
   * Get variance status based on percentage
   */
  private getVarianceStatus(variancePercent: number): VarianceStatus {
    if (variancePercent >= 0) return 'favorable';
    const absPercent = Math.abs(variancePercent);
    if (absPercent <= VARIANCE_THRESHOLDS.MINOR) return 'minor';
    if (absPercent <= VARIANCE_THRESHOLDS.MODERATE) return 'moderate';
    if (absPercent <= VARIANCE_THRESHOLDS.SIGNIFICANT) return 'significant';
    return 'critical';
  }

  // --------------------------------------------------------------------------
  // BUDGET APPROVAL
  // --------------------------------------------------------------------------

  /**
   * Submit budget for approval
   */
  async submitBudgetForApproval(
    companyId: string,
    budgetId: string,
    userId: string
  ): Promise<Budget> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    if (budget.status !== 'draft' && budget.status !== 'rejected') {
      throw new Error('Only draft or rejected budgets can be submitted for approval');
    }
    
    const lines = await this.getBudgetLines(companyId, budgetId);
    if (lines.length === 0) {
      throw new Error('Cannot submit empty budget for approval');
    }
    
    await updateDoc(doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId), {
      status: 'pending_approval',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return { ...budget, status: 'pending_approval' };
  }

  /**
   * Approve or reject a budget
   */
  async processBudgetApproval(
    companyId: string,
    budgetId: string,
    action: 'approve' | 'reject',
    userId: string,
    notes?: string
  ): Promise<Budget> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    if (budget.status !== 'pending_approval') {
      throw new Error('Only pending budgets can be approved or rejected');
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const now = Timestamp.now();
    
    await updateDoc(doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId), {
      status: newStatus,
      approvedBy: action === 'approve' ? userId : undefined,
      approvedAt: action === 'approve' ? now : undefined,
      approvalNotes: notes,
      updatedAt: now,
      updatedBy: userId,
    });
    
    return { ...budget, status: newStatus };
  }

  /**
   * Activate an approved budget
   */
  async activateBudget(
    companyId: string,
    budgetId: string,
    userId: string
  ): Promise<Budget> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    if (budget.status !== 'approved') {
      throw new Error('Only approved budgets can be activated');
    }
    
    await updateDoc(doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId), {
      status: 'active',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return { ...budget, status: 'active' };
  }

  // --------------------------------------------------------------------------
  // BUDGET FORECAST
  // --------------------------------------------------------------------------

  /**
   * Generate budget forecast
   */
  async generateBudgetForecast(
    companyId: string,
    budgetId: string,
    asOfDate?: Date
  ): Promise<BudgetForecast> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    const lines = await this.getBudgetLines(companyId, budgetId);
    const effectiveDate = asOfDate || new Date();
    const currentFiscalMonth = getFiscalMonth(effectiveDate);
    
    // Aggregate period amounts across all lines
    const periodTotals: { budget: number; actual: number }[] = Array(12).fill(null).map(() => ({
      budget: 0,
      actual: 0,
    }));
    
    lines.forEach(line => {
      line.periodAmounts.forEach((period, idx) => {
        periodTotals[idx].budget += period.budgetAmount;
        periodTotals[idx].actual += period.actualAmount;
      });
    });
    
    // Calculate YTD
    const ytdActual = periodTotals
      .slice(0, currentFiscalMonth)
      .reduce((sum, p) => sum + p.actual, 0);
    const ytdBudget = periodTotals
      .slice(0, currentFiscalMonth)
      .reduce((sum, p) => sum + p.budget, 0);
    
    const remainingBudget = budget.totalBudget - ytdActual;
    const remainingPeriods = 12 - currentFiscalMonth;
    
    // Linear forecast
    const avgMonthlyActual = currentFiscalMonth > 0 ? ytdActual / currentFiscalMonth : 0;
    const linearForecast = ytdActual + (avgMonthlyActual * remainingPeriods);
    
    // Trend forecast (simple growth rate)
    const trendForecast = linearForecast * 1.05; // 5% growth assumption
    
    // Seasonal forecast (use budget proportions)
    const remainingBudgetTotal = periodTotals
      .slice(currentFiscalMonth)
      .reduce((sum, p) => sum + p.budget, 0);
    const budgetRatio = budget.totalBudget > 0 
      ? (ytdActual / ytdBudget) 
      : 1;
    const seasonalForecast = ytdActual + (remainingBudgetTotal * budgetRatio);
    
    // Recommended (average of methods)
    const recommendedForecast = (linearForecast + seasonalForecast) / 2;
    
    // Monthly projections
    const monthlyProjections: MonthlyProjection[] = FISCAL_MONTHS.map((fm, idx) => {
      const isActual = idx < currentFiscalMonth;
      const calendarYear = budget.fiscalYear 
        ? (fm.month >= 7 ? budget.fiscalYear - 1 : budget.fiscalYear)
        : new Date().getFullYear();
      
      let cumulativeBudget = 0;
      let cumulativeForecast = 0;
      for (let i = 0; i <= idx; i++) {
        cumulativeBudget += periodTotals[i].budget;
        cumulativeForecast += isActual ? periodTotals[i].actual : periodTotals[i].budget * budgetRatio;
      }
      
      return {
        period: idx + 1,
        fiscalMonth: fm.fiscalMonth,
        calendarMonth: fm.month,
        calendarYear,
        isActual,
        actualAmount: isActual ? periodTotals[idx].actual : undefined,
        budgetAmount: periodTotals[idx].budget,
        forecastAmount: isActual ? periodTotals[idx].actual : periodTotals[idx].budget * budgetRatio,
        cumulativeBudget,
        cumulativeForecast,
      };
    });
    
    return {
      budgetId,
      fiscalYear: budget.fiscalYear,
      asOfDate: effectiveDate,
      ytdActual,
      ytdBudget,
      remainingBudget,
      remainingPeriods,
      linearForecast,
      trendForecast,
      seasonalForecast,
      recommendedForecast,
      forecastConfidence: currentFiscalMonth >= 6 ? 80 : 60,
      projectedVariance: budget.totalBudget - recommendedForecast,
      projectedVariancePercent: budget.totalBudget > 0 
        ? ((budget.totalBudget - recommendedForecast) / budget.totalBudget) * 100 
        : 0,
      monthlyProjections,
    };
  }

  // --------------------------------------------------------------------------
  // BUDGET REVISION
  // --------------------------------------------------------------------------

  /**
   * Create a budget revision
   */
  async createBudgetRevision(
    companyId: string,
    budgetId: string,
    reason: string,
    lineChanges: Array<{ lineId: string; newAmount: number; reason?: string }>,
    userId: string
  ): Promise<BudgetRevision> {
    const budget = await this.getBudget(companyId, budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }
    
    if (budget.status !== 'active' && budget.status !== 'approved') {
      throw new Error('Only active or approved budgets can be revised');
    }
    
    const lines = await this.getBudgetLines(companyId, budgetId);
    const lineMap = new Map(lines.map(l => [l.id, l]));
    
    const changes: BudgetLineChange[] = lineChanges.map(change => {
      const line = lineMap.get(change.lineId);
      if (!line) {
        throw new Error(`Budget line not found: ${change.lineId}`);
      }
      return {
        lineId: change.lineId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        previousAmount: line.annualBudget,
        newAmount: change.newAmount,
        changeAmount: change.newAmount - line.annualBudget,
        reason: change.reason,
      };
    });
    
    const previousTotal = budget.totalBudget;
    const newTotal = previousTotal + changes.reduce((sum, c) => sum + c.changeAmount, 0);
    
    const revisionRef = doc(collection(db, 'companies', companyId, BUDGET_REVISIONS_COLLECTION));
    const now = Timestamp.now();
    
    const revision: BudgetRevision = {
      id: revisionRef.id,
      budgetId,
      companyId,
      revisionNumber: budget.version + 1,
      revisionDate: now,
      reason,
      previousVersion: budget.version,
      newVersion: budget.version + 1,
      previousTotal,
      newTotal,
      changeAmount: newTotal - previousTotal,
      lineChanges: changes,
      status: 'pending',
      createdAt: now,
      createdBy: userId,
    };
    
    await setDoc(revisionRef, revision);
    
    return revision;
  }

  /**
   * Apply a budget revision
   */
  async applyBudgetRevision(
    companyId: string,
    revisionId: string,
    userId: string
  ): Promise<void> {
    const revisionRef = doc(db, 'companies', companyId, BUDGET_REVISIONS_COLLECTION, revisionId);
    const revisionDoc = await getDoc(revisionRef);
    
    if (!revisionDoc.exists()) {
      throw new Error(`Revision not found: ${revisionId}`);
    }
    
    const revision = { id: revisionDoc.id, ...revisionDoc.data() } as BudgetRevision;
    
    if (revision.status !== 'pending') {
      throw new Error('Only pending revisions can be applied');
    }
    
    const batch = writeBatch(db);
    const now = Timestamp.now();
    
    // Update each line
    for (const change of revision.lineChanges) {
      const lineRef = doc(db, 'companies', companyId, BUDGET_LINES_COLLECTION, change.lineId);
      const line = (await getDoc(lineRef)).data() as BudgetLineItem;
      
      const budget = await this.getBudget(companyId, line.budgetId);
      const periodAmounts = this.calculatePeriodAmounts(
        change.newAmount,
        line.allocationMethod,
        undefined,
        budget!.fiscalYear
      );
      
      batch.update(lineRef, {
        annualBudget: change.newAmount,
        annualAvailable: change.newAmount - line.annualActual - line.annualCommitted,
        annualVariance: change.newAmount - line.annualActual,
        variancePercent: change.newAmount > 0 
          ? ((change.newAmount - line.annualActual) / change.newAmount) * 100 
          : 0,
        periodAmounts,
        updatedAt: now,
        updatedBy: userId,
      });
    }
    
    // Update revision status
    batch.update(revisionRef, {
      status: 'approved',
      approvedBy: userId,
      approvedAt: now,
    });
    
    // Update budget version
    const budgetRef = doc(db, 'companies', companyId, BUDGETS_COLLECTION, revision.budgetId);
    batch.update(budgetRef, {
      version: revision.newVersion,
      status: 'revised',
      updatedAt: now,
      updatedBy: userId,
    });
    
    await batch.commit();
    
    // Recalculate totals
    await this.recalculateBudgetTotals(companyId, revision.budgetId, userId);
  }
}

export const budgetService = new BudgetService();
