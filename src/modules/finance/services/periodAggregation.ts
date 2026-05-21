// ============================================================================
// PERIOD AGGREGATION UTILITY
// ZeusOS v2.0 - Finance Module
// Aggregates monthly financial data into quarterly and yearly views.
// P&L and CF: sum values across months in the period.
// BS: use end-of-period snapshot (last month's values).
// ============================================================================

import type {
  QBOProfitAndLoss,
  QBOBalanceSheet,
  QBOCashFlow,
  QBOReportRow,
} from '../types/integrations.types';

export type AggregationPeriod = 'monthly' | 'quarterly' | 'yearly';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Group YYYY-MM period keys by quarter.
 * Uses fiscal year starting at fiscalYearStartMonth (1-indexed, default 7 = July).
 * Returns Map<quarterLabel, sortedMonthKeys[]>.
 */
export function groupByQuarter(
  monthKeys: string[],
  fiscalYearStartMonth = 7
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const key of monthKeys) {
    const [y, m] = key.split('-').map(Number);
    // Determine fiscal year and quarter
    const fiscalYear = m >= fiscalYearStartMonth ? y + 1 : y;
    const monthsIntoFY = m >= fiscalYearStartMonth
      ? m - fiscalYearStartMonth
      : m + (12 - fiscalYearStartMonth);
    const quarter = Math.floor(monthsIntoFY / 3) + 1;

    const label = `Q${quarter} FY${String(fiscalYear).slice(-2)}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(key);
  }

  // Sort months within each quarter
  for (const months of groups.values()) {
    months.sort();
  }

  return groups;
}

/**
 * Group YYYY-MM period keys by fiscal year.
 */
export function groupByYear(
  monthKeys: string[],
  fiscalYearStartMonth = 7
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const key of monthKeys) {
    const [y, m] = key.split('-').map(Number);
    const fiscalYear = m >= fiscalYearStartMonth ? y + 1 : y;
    const label = `FY ${fiscalYear}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(key);
  }

  for (const months of groups.values()) {
    months.sort();
  }

  return groups;
}

// ============================================================================
// P&L AGGREGATION (sum across months)
// ============================================================================

function sumReportRows(allRows: QBOReportRow[][]): QBOReportRow[] {
  // Merge rows by label, summing values
  const merged = new Map<string, QBOReportRow>();
  for (const rows of allRows) {
    for (const row of rows) {
      const existing = merged.get(row.label);
      if (existing) {
        existing.value += row.value;
      } else {
        merged.set(row.label, { ...row, value: row.value });
      }
    }
  }
  return Array.from(merged.values());
}

export function aggregatePLPeriods(
  monthlyData: Map<string, QBOProfitAndLoss>,
  aggregation: AggregationPeriod,
  fiscalYearStartMonth = 7
): Map<string, QBOProfitAndLoss> {
  if (aggregation === 'monthly') return monthlyData;

  const monthKeys = Array.from(monthlyData.keys()).sort();
  const groups = aggregation === 'quarterly'
    ? groupByQuarter(monthKeys, fiscalYearStartMonth)
    : groupByYear(monthKeys, fiscalYearStartMonth);

  const result = new Map<string, QBOProfitAndLoss>();

  for (const [label, months] of groups) {
    const reports = months
      .map(m => monthlyData.get(m))
      .filter((r): r is QBOProfitAndLoss => r != null);

    if (reports.length === 0) continue;

    result.set(label, {
      id: label,
      companyId: reports[0].companyId,
      startDate: reports[0].startDate,
      endDate: reports[reports.length - 1].endDate,
      currency: reports[0].currency,
      income: sumReportRows(reports.map(r => r.income || [])),
      costOfGoodsSold: sumReportRows(reports.map(r => r.costOfGoodsSold || [])),
      grossProfit: reports.reduce((s, r) => s + (r.grossProfit || 0), 0),
      expenses: sumReportRows(reports.map(r => r.expenses || [])),
      netOperatingIncome: reports.reduce((s, r) => s + (r.netOperatingIncome || 0), 0),
      otherIncome: sumReportRows(reports.map(r => r.otherIncome || [])),
      otherExpenses: sumReportRows(reports.map(r => r.otherExpenses || [])),
      netIncome: reports.reduce((s, r) => s + (r.netIncome || 0), 0),
      syncedAt: reports[reports.length - 1].syncedAt,
    });
  }

  return result;
}

// ============================================================================
// BS AGGREGATION (use end-of-period snapshot)
// ============================================================================

export function aggregateBSPeriods(
  monthlyData: Map<string, QBOBalanceSheet>,
  aggregation: AggregationPeriod,
  fiscalYearStartMonth = 7
): Map<string, QBOBalanceSheet> {
  if (aggregation === 'monthly') return monthlyData;

  const monthKeys = Array.from(monthlyData.keys()).sort();
  const groups = aggregation === 'quarterly'
    ? groupByQuarter(monthKeys, fiscalYearStartMonth)
    : groupByYear(monthKeys, fiscalYearStartMonth);

  const result = new Map<string, QBOBalanceSheet>();

  for (const [label, months] of groups) {
    // Use the last month's BS as the period-end snapshot
    const lastMonth = months[months.length - 1];
    const bs = monthlyData.get(lastMonth);
    if (bs) {
      result.set(label, { ...bs, id: label });
    }
  }

  return result;
}

// ============================================================================
// CF AGGREGATION (sum across months)
// ============================================================================

export function aggregateCFPeriods(
  monthlyData: Map<string, QBOCashFlow>,
  aggregation: AggregationPeriod,
  fiscalYearStartMonth = 7
): Map<string, QBOCashFlow> {
  if (aggregation === 'monthly') return monthlyData;

  const monthKeys = Array.from(monthlyData.keys()).sort();
  const groups = aggregation === 'quarterly'
    ? groupByQuarter(monthKeys, fiscalYearStartMonth)
    : groupByYear(monthKeys, fiscalYearStartMonth);

  const result = new Map<string, QBOCashFlow>();

  for (const [label, months] of groups) {
    const reports = months
      .map(m => monthlyData.get(m))
      .filter((r): r is QBOCashFlow => r != null);

    if (reports.length === 0) continue;

    const sum = (fn: (r: QBOCashFlow) => number) =>
      reports.reduce((s, r) => s + fn(r), 0);

    result.set(label, {
      companyId: reports[0].companyId,
      startDate: reports[0].startDate,
      endDate: reports[reports.length - 1].endDate,
      currency: reports[0].currency,
      // Operating
      revenue: sum(r => r.revenue),
      costOfSales: sum(r => r.costOfSales),
      expenses: sum(r => r.expenses),
      otherIncome: sum(r => r.otherIncome),
      cashTaxPaid: sum(r => r.cashTaxPaid),
      changeInAccountsPayable: sum(r => r.changeInAccountsPayable),
      changeInOtherCurrentLiabilities: sum(r => r.changeInOtherCurrentLiabilities),
      changeInAccountsReceivable: sum(r => r.changeInAccountsReceivable),
      changeInInventory: sum(r => r.changeInInventory),
      changeInWorkInProgress: sum(r => r.changeInWorkInProgress),
      changeInOtherCurrentAssets: sum(r => r.changeInOtherCurrentAssets),
      operatingCashFlow: sum(r => r.operatingCashFlow),
      // Investing
      changeInFixedAssets: sum(r => r.changeInFixedAssets),
      changeInIntangibleAssets: sum(r => r.changeInIntangibleAssets),
      changeInInvestments: sum(r => r.changeInInvestments),
      freeCashFlow: sum(r => r.freeCashFlow),
      // Financing
      netInterest: sum(r => r.netInterest),
      changeInOtherNonCurrentLiabilities: sum(r => r.changeInOtherNonCurrentLiabilities),
      dividends: sum(r => r.dividends),
      changeInRetainedEarnings: sum(r => r.changeInRetainedEarnings),
      adjustments: sum(r => r.adjustments),
      netCashFlow: sum(r => r.netCashFlow),
      syncedAt: reports[reports.length - 1].syncedAt,
    });
  }

  return result;
}
