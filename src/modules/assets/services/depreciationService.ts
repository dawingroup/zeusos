/**
 * Depreciation Service
 * Pure computation functions for asset depreciation.
 * No database access — all calculations are deterministic.
 *
 * Supports: Straight-Line, Declining Balance, Sum-of-Years-Digits, Units-of-Production
 */

import type { AssetFinancials, AssetCategory } from '@/shared/types';
import type { DepreciationSummary, DepreciationPeriod } from '../types';

// ============================================================================
// CATEGORY DEFAULTS
// ============================================================================

/** Default useful life in years by asset category */
export const DEFAULT_USEFUL_LIFE: Record<AssetCategory, number> = {
  CNC: 10,
  STATIONARY_MACHINE: 10,
  POWER_TOOL: 5,
  HAND_TOOL: 10,
  JIG: 7,
  DUST_COLLECTION: 8,
  SPRAY_EQUIPMENT: 7,
  SEWING_MACHINE: 8,
};

/** Default salvage value as fraction of purchase price by category */
export const DEFAULT_SALVAGE_PERCENT: Record<AssetCategory, number> = {
  CNC: 0.05,
  STATIONARY_MACHINE: 0.05,
  POWER_TOOL: 0.0,
  HAND_TOOL: 0.0,
  JIG: 0.0,
  DUST_COLLECTION: 0.05,
  SPRAY_EQUIPMENT: 0.05,
  SEWING_MACHINE: 0.05,
};

// ============================================================================
// HELPERS
// ============================================================================

/** Elapsed fractional years from purchase date to reference date */
function getElapsedYears(purchaseDate: string, asOfDate: Date = new Date()): number {
  const purchase = new Date(purchaseDate);
  const diffMs = asOfDate.getTime() - purchase.getTime();
  return Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

// ============================================================================
// DEPRECIATION METHODS (per-year calculations)
// ============================================================================

function straightLineAnnual(cost: number, salvage: number, usefulLife: number): number {
  if (usefulLife <= 0) return 0;
  return (cost - salvage) / usefulLife;
}

function decliningBalanceExpense(
  cost: number,
  salvage: number,
  usefulLife: number,
  _yearIndex: number,
  previousAccumulated: number
): number {
  if (usefulLife <= 0) return 0;
  const rate = 2 / usefulLife; // double declining balance
  const bookValue = cost - previousAccumulated;
  if (bookValue <= salvage) return 0;

  const expense = bookValue * rate;
  // Don't depreciate below salvage
  return Math.min(expense, bookValue - salvage);
}

function sumOfYearsDigitsExpense(
  cost: number,
  salvage: number,
  usefulLife: number,
  year: number
): number {
  if (usefulLife <= 0 || year > usefulLife) return 0;
  const sumOfYears = (usefulLife * (usefulLife + 1)) / 2;
  const remainingLife = usefulLife - year + 1;
  return ((cost - salvage) * remainingLife) / sumOfYears;
}

function unitsOfProductionAnnual(
  cost: number,
  salvage: number,
  totalExpectedHours: number,
  hoursPerYear: number
): number {
  if (totalExpectedHours <= 0) return 0;
  return ((cost - salvage) / totalExpectedHours) * hoursPerYear;
}

// ============================================================================
// SCHEDULE GENERATION
// ============================================================================

/**
 * Generate a full depreciation schedule for an asset.
 */
export function generateDepreciationSchedule(
  financials: AssetFinancials,
  totalHoursUsed?: number
): DepreciationPeriod[] {
  const { purchasePrice, salvageValue, usefulLifeYears, depreciationMethod } = financials;
  const depreciableAmount = purchasePrice - salvageValue;
  if (depreciableAmount <= 0 || usefulLifeYears <= 0) return [];

  const schedule: DepreciationPeriod[] = [];
  let accumulated = 0;

  const purchaseYear = new Date(financials.purchaseDate).getFullYear();

  for (let year = 1; year <= usefulLifeYears; year++) {
    let expense = 0;

    switch (depreciationMethod) {
      case 'STRAIGHT_LINE':
        expense = straightLineAnnual(purchasePrice, salvageValue, usefulLifeYears);
        break;
      case 'DECLINING_BALANCE':
        expense = decliningBalanceExpense(
          purchasePrice, salvageValue, usefulLifeYears, year, accumulated
        );
        break;
      case 'SUM_OF_YEARS_DIGITS':
        expense = sumOfYearsDigitsExpense(purchasePrice, salvageValue, usefulLifeYears, year);
        break;
      case 'UNITS_OF_PRODUCTION': {
        const estTotalHours = financials.totalExpectedHours || usefulLifeYears * 2000;
        const avgHoursPerYear = (totalHoursUsed || estTotalHours) / usefulLifeYears;
        expense = unitsOfProductionAnnual(purchasePrice, salvageValue, estTotalHours, avgHoursPerYear);
        break;
      }
    }

    // Clamp: never depreciate below salvage value
    const maxRemaining = depreciableAmount - accumulated;
    expense = Math.min(Math.round(expense), Math.max(0, maxRemaining));
    accumulated += expense;

    schedule.push({
      year,
      periodLabel: `FY${purchaseYear + year - 1}`,
      openingBookValue: purchasePrice - (accumulated - expense),
      depreciationExpense: expense,
      accumulatedDepreciation: accumulated,
      closingBookValue: purchasePrice - accumulated,
    });

    if (accumulated >= depreciableAmount) break;
  }

  return schedule;
}

// ============================================================================
// MAIN CALCULATION
// ============================================================================

/**
 * Calculate current book value and depreciation summary for an asset.
 * This is the primary function used by the UI.
 */
export function calculateDepreciationSummary(
  financials: AssetFinancials,
  totalHoursUsed?: number,
  asOfDate: Date = new Date()
): DepreciationSummary {
  const schedule = generateDepreciationSchedule(financials, totalHoursUsed);
  const depreciableAmount = financials.purchasePrice - financials.salvageValue;

  if (schedule.length === 0) {
    return {
      purchasePrice: financials.purchasePrice,
      currentBookValue: financials.purchasePrice,
      totalDepreciation: depreciableAmount,
      accumulatedDepreciation: 0,
      annualDepreciation: 0,
      percentDepreciated: 0,
      remainingLifeYears: financials.usefulLifeYears,
      isFullyDepreciated: false,
      schedule: [],
    };
  }

  const elapsedYears = getElapsedYears(financials.purchaseDate, asOfDate);
  const completedYears = Math.floor(elapsedYears);
  const fractionalYear = elapsedYears - completedYears;

  // Sum full completed years
  let accumulatedToDate = 0;
  for (let i = 0; i < Math.min(completedYears, schedule.length); i++) {
    accumulatedToDate += schedule[i].depreciationExpense;
  }

  // Pro-rata current partial year
  if (completedYears < schedule.length) {
    accumulatedToDate += schedule[completedYears].depreciationExpense * fractionalYear;
  } else {
    // Past the schedule — fully depreciated
    accumulatedToDate = depreciableAmount;
  }

  accumulatedToDate = Math.round(Math.min(accumulatedToDate, depreciableAmount));

  const currentBookValue = financials.purchasePrice - accumulatedToDate;
  const currentYearIndex = Math.min(completedYears, schedule.length - 1);
  const annualDepreciation = schedule[currentYearIndex]?.depreciationExpense || 0;
  const remainingLife = Math.max(0, financials.usefulLifeYears - elapsedYears);
  const isFullyDepreciated = accumulatedToDate >= depreciableAmount;

  return {
    purchasePrice: financials.purchasePrice,
    currentBookValue,
    totalDepreciation: depreciableAmount,
    accumulatedDepreciation: accumulatedToDate,
    annualDepreciation,
    percentDepreciated: depreciableAmount > 0
      ? Math.round((accumulatedToDate / depreciableAmount) * 100)
      : 0,
    remainingLifeYears: Math.round(remainingLife * 10) / 10,
    isFullyDepreciated,
    schedule,
  };
}
