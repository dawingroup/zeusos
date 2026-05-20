// ============================================================================
// BUDGET ↔ FORECAST BRIDGE SERVICE
// Bi-directional integration between Budget and 3-Way Forecast modules.
// Also handles Procurement → Budget imports.
// ============================================================================

import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { budgetService } from './budgetService';
import {
  getForecastPeriods,
  saveValueRule,
  recalculateForecast,
  listForecasts,
} from './forecastService';
import type { ForecastMetadata } from '../types/forecast.types';
import type { BudgetLineItem, BudgetLineInput } from '../types/budget.types';
import { FISCAL_MONTHS } from '../constants/budget.constants';

// ============================================================================
// TYPES
// ============================================================================

export interface ForecastToBudgetImport {
  forecastId: string;
  accountIds: string[];
  targetBudgetId: string;
  adjustmentPct: number;
}

export interface ProcurementRequirementItem {
  id: string;
  description: string;
  estimatedCost: number;
  expectedDate: string;
  category: string;
  status: string;
  sourceRef?: string;
}

// ============================================================================
// FORECAST → BUDGET
// Import forecast account values as budget line items
// ============================================================================

/**
 * Import forecast row values into budget line items.
 * Reads forecast periods, maps to fiscal months, creates budget lines.
 */
export async function importForecastRowsToBudget(
  companyId: string,
  params: ForecastToBudgetImport,
  userId: string
): Promise<BudgetLineItem[]> {
  const { forecastId, accountIds, targetBudgetId, adjustmentPct } = params;

  // Get the budget to know the fiscal year
  const budget = await budgetService.getBudget(companyId, targetBudgetId);
  if (!budget) throw new Error('Budget not found');

  // Get forecast periods
  const periods = await getForecastPeriods(companyId, forecastId);
  if (!periods.length) throw new Error('No forecast periods found');

  // Build period → fiscal month mapping for this fiscal year
  const fiscalYearMonths = FISCAL_MONTHS.map(fm => {
    const calYear = fm.month >= 7 ? budget.fiscalYear - 1 : budget.fiscalYear;
    return {
      periodKey: `${calYear}-${String(fm.month).padStart(2, '0')}`,
      fiscalMonth: fm.fiscalMonth,
    };
  });

  const createdLines: BudgetLineItem[] = [];

  for (const accountId of accountIds) {
    // Extract forecast values for this account across periods
    const periodAmounts: number[] = fiscalYearMonths.map(({ periodKey }) => {
      const fp = periods.find(p => p.period === periodKey);
      if (!fp) return 0;
      // Get the account value from P&L forecast
      const rawValue = fp.pl?.accountValues?.[accountId] ?? 0;
      return Math.round(rawValue * (1 + adjustmentPct));
    });

    const annualBudget = periodAmounts.reduce((s, v) => s + v, 0);
    if (annualBudget === 0) continue;

    const input: BudgetLineInput = {
      accountId,
      annualBudget,
      allocationMethod: 'custom',
      periodAmounts,
      description: `Imported from forecast (adj: ${(adjustmentPct * 100).toFixed(0)}%)`,
    };

    const line = await budgetService.addBudgetLine(companyId, targetBudgetId, input, userId);

    // Tag source (update the line with source info)
    // The addBudgetLine doesn't set source fields, so we update
    const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
    await updateDoc(
      firestoreDoc(db, 'companies', companyId, 'budgetLines', line.id),
      {
        sourceType: 'forecast',
        sourceForecastId: forecastId,
      }
    );

    createdLines.push({
      ...line,
      sourceType: 'forecast',
      sourceForecastId: forecastId,
    });
  }

  return createdLines;
}

// ============================================================================
// BUDGET → FORECAST
// Push budget line amounts into forecast via link_to_budget value rule
// ============================================================================

/**
 * Create/update a link_to_budget value rule in the forecast for a budget line's account.
 * This makes the forecast pull amounts from the budget.
 */
export async function pushBudgetLineToForecast(
  companyId: string,
  line: BudgetLineItem,
  forecastId: string,
  adjustmentPct: number = 0
): Promise<void> {
  // Build the start period from the budget's fiscal year
  const startMonth = `${line.periodAmounts[0]?.calendarYear || new Date().getFullYear()}-${String(line.periodAmounts[0]?.calendarMonth || 7).padStart(2, '0')}`;

  // Save the value rule
  await saveValueRule(companyId, forecastId, {
    accountId: line.accountId,
    ruleType: 'link_to_budget',
    params: {
      budgetId: line.budgetId,
      adjustmentPct,
    },
    startPeriod: startMonth,
    endPeriod: null,
  });

  // Recalculate forecast with the new rule
  await recalculateForecast(companyId, forecastId);
}

/**
 * Get available forecasts for the push-to-forecast action.
 */
export async function getAvailableForecasts(
  companyId: string
): Promise<ForecastMetadata[]> {
  return listForecasts(companyId);
}

// ============================================================================
// PROCUREMENT → BUDGET
// Import procurement requirements as budget line items
// ============================================================================

/**
 * Fetch pending procurement requirements that can be imported into a budget.
 */
export async function getPendingProcurementRequirements(
  companyId: string
): Promise<ProcurementRequirementItem[]> {
  try {
    const q = query(
      collection(db, 'companies', companyId, 'procurementRequirements'),
      where('status', 'in', ['pending', 'approved', 'open'])
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        description: data.description || data.itemName || 'Unnamed requirement',
        estimatedCost: data.estimatedCost || data.totalCost || data.unitPrice * (data.quantity || 1) || 0,
        expectedDate: data.expectedDate || data.requiredDate || '',
        category: data.category || data.type || 'general',
        status: data.status || 'pending',
        sourceRef: data.sourceRef || data.moId || undefined,
      };
    });
  } catch {
    // Collection may not exist
    return [];
  }
}

/**
 * Import procurement requirements into budget as line items.
 * Maps each requirement to an expense account (provided by caller).
 */
export async function importProcurementToBudget(
  companyId: string,
  budgetId: string,
  items: Array<{
    requirementId: string;
    accountId: string;
    amount: number;
    description: string;
  }>,
  userId: string
): Promise<BudgetLineItem[]> {
  const budget = await budgetService.getBudget(companyId, budgetId);
  if (!budget) throw new Error('Budget not found');

  const createdLines: BudgetLineItem[] = [];

  for (const item of items) {
    const input: BudgetLineInput = {
      accountId: item.accountId,
      annualBudget: item.amount,
      allocationMethod: 'equal',
      description: item.description,
    };

    const line = await budgetService.addBudgetLine(companyId, budgetId, input, userId);

    // Tag source
    const { doc: firestoreDoc, updateDoc } = await import('firebase/firestore');
    await updateDoc(
      firestoreDoc(db, 'companies', companyId, 'budgetLines', line.id),
      {
        sourceType: 'procurement',
        sourceProcurementReqId: item.requirementId,
      }
    );

    createdLines.push({
      ...line,
      sourceType: 'procurement',
      sourceProcurementReqId: item.requirementId,
    });
  }

  return createdLines;
}
