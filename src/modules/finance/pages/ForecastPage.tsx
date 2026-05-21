// ============================================================================
// FORECAST PAGE — Three-statement sub-tabs, collapsible account groups
// ZeusOS v2.0 - Finance Module
//
// Sub-tabs: P&L | Balance Sheet | Cash Flow
// All tabs: individual QBO accounts, collapsible parent groups
// Table: historical actuals (grey) | forecast months (white), frozen first col
// Click any editable row → AccountForecastDrawer
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Settings2, ChevronRight, ChevronDown } from 'lucide-react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import { AccountForecastDrawer } from '../components/forecast/AccountForecastDrawer';
import { DriverSettingsPanel } from '../components/forecast/DriverSettingsPanel';
import { MicroForecastContent, RoadmapTimeline } from '../components/forecast/MicroForecastPanel';
import type { DrawerAccountData } from '../components/forecast/AccountForecastDrawer';
import type {
  ForecastMetadata,
  ForecastPeriod,
  ValueRule,
  ValueRuleType,
  WorkingCapitalDrivers,
  CashTimingAllocation,
  PLAccountDetail,
  PLSection,
  BSAccountDetail,
  BSSection,
  BSForecast,
  MicroForecastInputs,
} from '../types/forecast.types';
import { periodLabel, offsetPeriod } from '../types/forecast.types';
import {
  listForecasts,
  createForecast,
  getForecastMetadata,
  getForecastPeriods,
  getValueRules,
  saveValueRule,
  deleteValueRule,
  updateDrivers,
  recalculateForecast,
  getDetailedPLHistory,
  getBSAccountDetails,
  loadMicroForecasts,
  saveCapExItem,
  deleteCapExItem,
  saveLoanItem,
  deleteLoanItem,
  saveCapitalEvent,
  deleteCapitalEvent,
  saveDividendSchedule,
  deleteDividendSchedule,
} from '../services/forecastService';
import type { HistoricalPeriodData } from '../services/forecastService';

const COMPANY_ID  = 'dawinos';
const BASELINE    = 'Baseline Forecast';
const HIST_MONTHS = 12;

type ForecastTab = 'pl' | 'bs' | 'cfs' | 'micro' | 'roadmap';

// ── BS Section labels ────────────────────────────────────────────────────────

const BS_SECTION_LABELS: Record<BSSection, string> = {
  currentAssets:          'CURRENT ASSETS',
  nonCurrentAssets:       'NON-CURRENT ASSETS',
  currentLiabilities:     'CURRENT LIABILITIES',
  nonCurrentLiabilities:  'NON-CURRENT LIABILITIES',
  equity:                 'EQUITY',
};

const BS_SECTION_TOTALS: Record<BSSection, { key: string; label: string }> = {
  currentAssets:          { key: 'totalCurrentAssets',          label: 'Total Current Assets' },
  nonCurrentAssets:       { key: 'totalNonCurrentAssets',       label: 'Total Non-Current Assets' },
  currentLiabilities:     { key: 'totalCurrentLiabilities',     label: 'Total Current Liabilities' },
  nonCurrentLiabilities:  { key: 'totalNonCurrentLiabilities',  label: 'Total Non-Current Liabilities' },
  equity:                 { key: 'totalEquity',                  label: 'Total Equity' },
};

const BS_SECTION_ORDER: BSSection[] = [
  'currentAssets', 'nonCurrentAssets', 'currentLiabilities', 'nonCurrentLiabilities', 'equity',
];

// ── CFS Detail line definitions (indirect method) ───────────────────────────

interface CFSLine {
  id: string;
  label: string;
  /**
   * 'pl'       = read from PLForecast
   * 'bs_delta' = compute from consecutive BS
   * 'derived'  = compute from combination of P&L + BS (e.g. dividends)
   */
  source: 'pl' | 'bs_delta' | 'derived';
  plKey?: keyof import('../types/forecast.types').PLForecast;
  bsKey?: keyof BSForecast;
  sign?: 1 | -1;  // for BS delta: +1 = increase is positive, -1 = increase is negative
  /** Identifier for special derived computations */
  derivedKey?: 'dividends_paid';
}

// Each BS field appears EXACTLY ONCE to avoid double-counting.
// Must mirror the engine's calculateCFS() logic precisely.

const CFS_OPERATING_LINES: CFSLine[] = [
  { id: 'cfs_net_income',   label: 'Net Income',                    source: 'pl',       plKey: 'netProfit' },
  { id: 'cfs_depreciation', label: 'Depreciation & Amortisation',   source: 'pl',       plKey: 'depreciation' },
  { id: 'cfs_d_ar',         label: 'Change in Accounts Receivable', source: 'bs_delta', bsKey: 'receivables', sign: -1 },
  { id: 'cfs_d_inv',        label: 'Change in Inventory',           source: 'bs_delta', bsKey: 'inventory',   sign: -1 },
  { id: 'cfs_d_prepaid',    label: 'Change in Prepaid Expenses',    source: 'bs_delta', bsKey: 'prepaid',     sign: -1 },
  { id: 'cfs_d_ap',         label: 'Change in Accounts Payable',    source: 'bs_delta', bsKey: 'payables',    sign: 1 },
  { id: 'cfs_d_accrued',    label: 'Change in Accrued Expenses',    source: 'bs_delta', bsKey: 'accrued',     sign: 1 },
  { id: 'cfs_d_tax',        label: 'Change in Tax Payable',         source: 'bs_delta', bsKey: 'taxPayable',  sign: 1 },
];

const CFS_INVESTING_LINES: CFSLine[] = [
  { id: 'cfs_capex', label: 'Capital Expenditure (Δ PPE)', source: 'bs_delta', bsKey: 'ppe', sign: -1 },
];

const CFS_FINANCING_LINES: CFSLine[] = [
  { id: 'cfs_d_lt_debt',    label: 'Change in Long-Term Debt',  source: 'bs_delta', bsKey: 'ltDebt',       sign: 1 },
  { id: 'cfs_d_equity',     label: 'Change in Share Capital',   source: 'bs_delta', bsKey: 'shareCapital', sign: 1 },
  { id: 'cfs_dividends',    label: 'Dividends Paid',            source: 'derived',  derivedKey: 'dividends_paid' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (v === 0) return '—';
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 ? `(${formatted})` : formatted;
}

// ── Modal helper ────────────────────────────────────────────────────────────

function Modal({ title, children }: {
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          {title && <h3 className="font-semibold text-gray-800">{title}</h3>}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ── Shared: Table column header ─────────────────────────────────────────────

function TableColumnHeaders({
  historicalPeriods,
  forecastMonths,
}: { historicalPeriods: string[]; forecastMonths: string[] }) {
  return (
    <tr>
      <th className="sticky left-0 z-40 bg-gray-50 text-left px-4 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-[10px] border-b border-r border-gray-200 min-w-[240px] whitespace-nowrap">
        Account
      </th>
      {historicalPeriods.map(p => (
        <th key={p} className="px-3 py-2.5 text-center font-medium text-gray-400 text-[10px] border-b border-gray-200 bg-gray-50 min-w-[88px] whitespace-nowrap">
          {periodLabel(p)}
          <div className="text-[8px] font-normal text-gray-300 mt-0.5">actual</div>
        </th>
      ))}
      {forecastMonths.map((p, i) => (
        <th
          key={p}
          className={`px-3 py-2.5 text-center font-medium text-[10px] border-b border-gray-200 bg-white min-w-[88px] whitespace-nowrap ${
            i === 0 ? 'border-l-2 border-l-blue-200 text-blue-500' : 'text-gray-500'
          }`}
        >
          {periodLabel(p)}
          <div className="text-[8px] font-normal text-blue-300 mt-0.5">forecast</div>
        </th>
      ))}
    </tr>
  );
}

// ── Shared: Value cells row ─────────────────────────────────────────────────

function ValueCells({
  historicalPeriods,
  forecastMonths,
  getHistorical,
  getForecast,
  bold = false,
}: {
  historicalPeriods: string[];
  forecastMonths: string[];
  getHistorical: (p: string) => number | null;
  getForecast: (p: string) => number | null;
  bold?: boolean;
}) {
  return (
    <>
      {historicalPeriods.map(p => {
        const val = getHistorical(p);
        return (
          <td key={p} className={`px-3 py-2 text-right border-b border-gray-100 bg-gray-50 tabular-nums ${
            bold ? 'font-semibold text-gray-600' : 'text-gray-400'
          } ${val !== null && val !== undefined && val < 0 ? 'text-red-400' : ''}`}>
            {val !== null && val !== undefined ? fmt(val) : <span className="text-gray-200">—</span>}
          </td>
        );
      })}
      {forecastMonths.map((p, i) => {
        const val = getForecast(p);
        return (
          <td key={p} className={`px-3 py-2 text-right border-b border-gray-100 tabular-nums bg-white ${
            i === 0 ? 'border-l-2 border-l-blue-100' : ''
          } ${bold ? 'font-semibold text-gray-800' : 'text-gray-700'}
          ${val !== null && val !== undefined && val < 0 ? 'text-red-500' : ''}`}>
            {val !== null && val !== undefined ? fmt(val) : '—'}
          </td>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// P&L TABLE — with collapsible parent groups
// ═══════════════════════════════════════════════════════════════════════════

interface PLTableProps {
  accounts: PLAccountDetail[];
  historicalPeriods: string[];
  forecastPeriods: ForecastPeriod[];
  historicalData: Record<string, HistoricalPeriodData>;
  rules: ValueRule[];
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onRowClick: (accountId: string) => void;
}

function PLForecastTable({
  accounts,
  historicalPeriods,
  forecastPeriods,
  historicalData,
  rules,
  expandedGroups,
  onToggleGroup,
  onRowClick,
}: PLTableProps) {
  const forecastMonths = forecastPeriods.map(p => p.period);

  const ruleByAccount = useMemo(() => {
    const m: Record<string, ValueRule> = {};
    rules.forEach(r => { m[r.accountId] = r; });
    return m;
  }, [rules]);

  // Group accounts: section → parentGroup → accounts[]
  const grouped = useMemo(() => {
    const result: Record<string, Record<string, PLAccountDetail[]>> = {};
    for (const acct of accounts) {
      if (!result[acct.section]) result[acct.section] = {};
      const group = acct.parentGroup || '__direct__';
      if (!result[acct.section][group]) result[acct.section][group] = [];
      result[acct.section][group].push(acct);
    }
    for (const sec of Object.values(result)) {
      for (const arr of Object.values(sec)) {
        arr.sort((a, b) => a.label.localeCompare(b.label));
      }
    }
    return result;
  }, [accounts]);

  function getAccountHistorical(acctId: string, p: string): number {
    return historicalData[p]?.plAccounts?.[acctId] ?? accounts.find(a => a.id === acctId)?.values[p] ?? 0;
  }
  function getAccountForecast(acctId: string, p: string): number {
    return forecastPeriods.find(f => f.period === p)?.pl.accountValues?.[acctId] ?? 0;
  }

  function sectionTotal(section: PLSection, p: string, isForecast: boolean): number {
    const sectionAccounts = Object.values(grouped[section] || {}).flat();
    return sectionAccounts.reduce((sum, acct) => {
      return sum + (isForecast ? getAccountForecast(acct.id, p) : getAccountHistorical(acct.id, p));
    }, 0);
  }

  function renderAccountRow(acct: PLAccountDetail, indent = 2) {
    const rule = ruleByAccount[acct.id];
    const hasCustomRule = !!rule;
    const pl = indent === 2 ? 'pl-10' : indent === 3 ? 'pl-14' : 'pl-8';

    return (
      <tr
        key={acct.id}
        className="group cursor-pointer hover:bg-blue-50/40 transition-colors"
        onClick={() => onRowClick(acct.id)}
      >
        <td className={`sticky left-0 z-20 ${pl} pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white text-gray-700`}>
          <div className="flex items-center gap-2">
            <span className="truncate max-w-[180px]" title={acct.label}>{acct.label}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
              hasCustomRule
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100'
            }`}>
              {hasCustomRule
                ? (rule.ruleType === 'smart_prediction' ? 'AI' : rule.ruleType.replace(/_/g, ' '))
                : 'edit'}
            </span>
            <ChevronRight className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
          </div>
        </td>
        <ValueCells
          historicalPeriods={historicalPeriods}
          forecastMonths={forecastMonths}
          getHistorical={p => getAccountHistorical(acct.id, p)}
          getForecast={p => getAccountForecast(acct.id, p)}
        />
      </tr>
    );
  }

  function renderSection(section: PLSection, headerLabel: string, totalLabel: string) {
    const sectionGroups = grouped[section];
    if (!sectionGroups) return null;
    const allAccounts = Object.values(sectionGroups).flat();
    if (allAccounts.length === 0) return null;

    const sectionId = `pl_section_${section}`;
    const isSectionExpanded = !!expandedGroups[sectionId];
    const rows: React.ReactNode[] = [];

    // Section header — COLLAPSIBLE: click to expand/collapse entire section
    rows.push(
      <tr
        key={`_h_${section}`}
        className="bg-gray-100 cursor-pointer hover:bg-gray-200/60 transition-colors"
        onClick={() => onToggleGroup(sectionId)}
      >
        <td className="sticky left-0 z-20 px-4 py-1.5 border-b border-gray-200 bg-gray-100 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {isSectionExpanded
              ? <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
              : <ChevronRight className="h-3 w-3 text-gray-500 shrink-0" />}
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{headerLabel}</span>
            <span className="text-[9px] text-gray-400 ml-1">({allAccounts.length})</span>
          </div>
        </td>
        {/* When collapsed, show section total inline */}
        {!isSectionExpanded ? (
          <ValueCells
            historicalPeriods={historicalPeriods}
            forecastMonths={forecastMonths}
            getHistorical={p => sectionTotal(section, p, false)}
            getForecast={p => sectionTotal(section, p, true)}
            bold
          />
        ) : (
          <>
            {historicalPeriods.map(p => <td key={p} className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />)}
            {forecastMonths.map((p, i) => <td key={p} className={`px-3 py-1.5 border-b border-gray-200 bg-gray-100 ${i === 0 ? 'border-l-2 border-l-blue-100' : ''}`} />)}
          </>
        )}
      </tr>
    );

    // Only show accounts and groups when section is expanded
    if (isSectionExpanded) {
      const groupNames = Object.keys(sectionGroups).sort((a, b) => {
        if (a === '__direct__') return -1;
        if (b === '__direct__') return 1;
        return a.localeCompare(b);
      });

      for (const groupName of groupNames) {
        const groupAccounts = sectionGroups[groupName];
        if (groupName === '__direct__') {
          groupAccounts.forEach(acct => rows.push(renderAccountRow(acct)));
        } else if (groupAccounts.length === 1) {
          rows.push(renderAccountRow(groupAccounts[0]));
        } else {
          // Collapsible sub-group
          const groupId = `pl_${section}_${groupName}`;
          const isExpanded = !!expandedGroups[groupId];

          function groupHistTotal(p: string): number {
            return groupAccounts.reduce((s, a) => s + getAccountHistorical(a.id, p), 0);
          }
          function groupForeTotal(p: string): number {
            return groupAccounts.reduce((s, a) => s + getAccountForecast(a.id, p), 0);
          }

          rows.push(
            <tr
              key={groupId}
              className="cursor-pointer hover:bg-blue-50/30 transition-colors"
              onClick={() => onToggleGroup(groupId)}
            >
              <td className="sticky left-0 z-20 pl-6 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white">
                <div className="flex items-center gap-1.5">
                  {isExpanded
                    ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                    : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
                  <span className="font-medium text-gray-700 truncate max-w-[180px]" title={groupName}>{groupName}</span>
                  <span className="text-[9px] text-gray-400 ml-1">({groupAccounts.length})</span>
                </div>
              </td>
              {!isExpanded ? (
                <ValueCells
                  historicalPeriods={historicalPeriods}
                  forecastMonths={forecastMonths}
                  getHistorical={p => groupHistTotal(p)}
                  getForecast={p => groupForeTotal(p)}
                  bold
                />
              ) : (
                <>
                  {historicalPeriods.map(p => <td key={p} className="px-3 py-2 border-b border-gray-100 bg-gray-50" />)}
                  {forecastMonths.map((p, i) => <td key={p} className={`px-3 py-2 border-b border-gray-100 bg-white ${i === 0 ? 'border-l-2 border-l-blue-100' : ''}`} />)}
                </>
              )}
            </tr>
          );

          if (isExpanded) {
            groupAccounts.forEach(acct => rows.push(renderAccountRow(acct, 3)));
            rows.push(
              <tr key={`${groupId}_total`} className="bg-gray-50/60">
                <td className="sticky left-0 z-20 pl-10 pr-4 py-1.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-medium text-gray-600 text-[10px]">
                  Total {groupName}
                </td>
                <ValueCells
                  historicalPeriods={historicalPeriods}
                  forecastMonths={forecastMonths}
                  getHistorical={p => groupHistTotal(p)}
                  getForecast={p => groupForeTotal(p)}
                  bold
                />
              </tr>
            );
          }
        }
      }

      // Section total row (only when expanded)
      rows.push(
        <tr key={`total_${section}`} className="bg-gray-50/80">
          <td className="sticky left-0 z-20 px-4 py-2 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-semibold text-gray-700 text-[11px]">
            {totalLabel}
          </td>
          <ValueCells
            historicalPeriods={historicalPeriods}
            forecastMonths={forecastMonths}
            getHistorical={p => sectionTotal(section, p, false)}
            getForecast={p => sectionTotal(section, p, true)}
            bold
          />
        </tr>
      );
    }

    return rows;
  }

  function computedRow(label: string, key: string, fn: (p: string, isForecast: boolean) => number) {
    return (
      <tr key={key} className="bg-gray-50/80">
        <td className="sticky left-0 z-20 px-4 py-2.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-bold text-gray-900 text-[11px]">
          {label}
        </td>
        <ValueCells
          historicalPeriods={historicalPeriods}
          forecastMonths={forecastMonths}
          getHistorical={p => fn(p, false)}
          getForecast={p => fn(p, true)}
          bold
        />
      </tr>
    );
  }

  const totalIncome = (p: string, isF: boolean) => sectionTotal('income', p, isF) + sectionTotal('otherIncome', p, isF);
  const totalCOGS   = (p: string, isF: boolean) => sectionTotal('costOfGoodsSold', p, isF);
  const totalExpenses = (p: string, isF: boolean) => sectionTotal('expenses', p, isF) + sectionTotal('otherExpenses', p, isF);

  return (
    <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
      <table className="text-xs border-separate border-spacing-0" style={{ minWidth: 'max-content', width: '100%' }}>
        <thead className="sticky top-0 z-30">
          <TableColumnHeaders historicalPeriods={historicalPeriods} forecastMonths={forecastMonths} />
        </thead>
        <tbody>
          {renderSection('income', 'INCOME', 'Total Income')}
          {renderSection('costOfGoodsSold', 'COST OF GOODS SOLD', 'Total Cost of Goods Sold')}
          {computedRow('GROSS PROFIT', '_gross_profit', (p, isF) => totalIncome(p, isF) - totalCOGS(p, isF))}
          {renderSection('expenses', 'OPERATING EXPENSES', 'Total Operating Expenses')}
          {computedRow('EBITDA', '_ebitda', (p, isF) => totalIncome(p, isF) - totalCOGS(p, isF) - totalExpenses(p, isF))}
          {renderSection('otherIncome', 'OTHER INCOME', 'Total Other Income')}
          {renderSection('otherExpenses', 'OTHER EXPENSES', 'Total Other Expenses')}
          {computedRow('NET PROFIT', '_net_profit', (p, isF) => {
            if (isF) return forecastPeriods.find(f => f.period === p)?.pl.netProfit ?? 0;
            return (historicalData[p]?.pl.revenue ?? 0) - (historicalData[p]?.pl.cogs ?? 0) - (historicalData[p]?.pl.opex ?? 0);
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BS TABLE — dynamic QBO accounts, collapsible by accountType
// ═══════════════════════════════════════════════════════════════════════════

interface BSTableProps {
  bsAccounts: BSAccountDetail[];
  historicalPeriods: string[];
  forecastPeriods: ForecastPeriod[];
  historicalData: Record<string, HistoricalPeriodData>;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
}

function BSForecastTable({
  bsAccounts,
  historicalPeriods,
  forecastPeriods,
  historicalData,
  expandedGroups,
  onToggleGroup,
}: BSTableProps) {
  const forecastMonths = forecastPeriods.map(p => p.period);

  // Group accounts: section → accountType → accounts[]
  const grouped = useMemo(() => {
    const result: Record<BSSection, Record<string, BSAccountDetail[]>> = {
      currentAssets: {}, nonCurrentAssets: {}, currentLiabilities: {},
      nonCurrentLiabilities: {}, equity: {},
    };
    for (const acct of bsAccounts) {
      if (!result[acct.section][acct.accountType]) result[acct.section][acct.accountType] = [];
      result[acct.section][acct.accountType].push(acct);
    }
    for (const sec of Object.values(result)) {
      for (const arr of Object.values(sec)) {
        arr.sort((a, b) => a.label.localeCompare(b.label));
      }
    }
    return result;
  }, [bsAccounts]);

  // Proportional distribution: for a given bsEngineKey, what share does this account have?
  const proportions = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const acct of bsAccounts) {
      totals[acct.bsEngineKey] = (totals[acct.bsEngineKey] || 0) + acct.currentBalance;
    }
    const props: Record<string, number> = {};
    for (const acct of bsAccounts) {
      const total = totals[acct.bsEngineKey] || 1;
      props[acct.id] = total > 0 ? acct.currentBalance / total : 0;
    }
    return props;
  }, [bsAccounts]);

  function getAccountForecast(acct: BSAccountDetail, period: string): number {
    const fp = forecastPeriods.find(p => p.period === period);
    if (!fp) return 0;
    const engineVal = (fp.bs as unknown as Record<string, number>)[acct.bsEngineKey] ?? 0;
    return engineVal * (proportions[acct.id] || 0);
  }

  function getAccountHistorical(acct: BSAccountDetail, period: string): number {
    // Use actual monthly BS data if available, otherwise fall back to currentBalance
    const bsActuals = historicalData[period]?.bs;
    if (bsActuals) {
      const engineVal = (bsActuals as unknown as Record<string, number>)[acct.bsEngineKey] ?? 0;
      // Proportional distribution among accounts sharing the same bsEngineKey
      return engineVal * (proportions[acct.id] || 0);
    }
    return acct.currentBalance;
  }

  function getGroupTotal(accounts: BSAccountDetail[], period: string, isForecast: boolean): number {
    return accounts.reduce((sum, acct) => {
      return sum + (isForecast ? getAccountForecast(acct, period) : getAccountHistorical(acct, period));
    }, 0);
  }

  function renderAccountRow(acct: BSAccountDetail) {
    return (
      <tr key={acct.id} className="hover:bg-blue-50/20 transition-colors">
        <td className="sticky left-0 z-20 pl-14 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white text-gray-700">
          <span className="truncate max-w-[170px]" title={acct.label}>{acct.label}</span>
        </td>
        <ValueCells
          historicalPeriods={historicalPeriods}
          forecastMonths={forecastMonths}
          getHistorical={p => getAccountHistorical(acct, p)}
          getForecast={p => getAccountForecast(acct, p)}
        />
      </tr>
    );
  }

  function renderSection(section: BSSection) {
    const sectionGroups = grouped[section];
    const groupNames = Object.keys(sectionGroups).sort();
    if (groupNames.length === 0) return null;

    const rows: React.ReactNode[] = [];

    // Section header
    rows.push(
      <tr key={`_h_${section}`} className="bg-gray-100">
        <td
          colSpan={1 + historicalPeriods.length + forecastMonths.length}
          className="sticky left-0 z-20 px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 bg-gray-100"
        >
          {BS_SECTION_LABELS[section]}
        </td>
      </tr>
    );

    for (const accountType of groupNames) {
      const groupAccounts = sectionGroups[accountType];
      const groupId = `bs_${section}_${accountType}`;
      const isExpanded = !!expandedGroups[groupId];

      if (groupAccounts.length === 1) {
        // Single account — show directly, no collapsible wrapper
        rows.push(
          <tr key={groupAccounts[0].id} className="hover:bg-blue-50/20 transition-colors">
            <td className="sticky left-0 z-20 pl-8 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white text-gray-700">
              <span className="truncate max-w-[180px]" title={groupAccounts[0].label}>{groupAccounts[0].label}</span>
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => getAccountHistorical(groupAccounts[0], p)}
              getForecast={p => getAccountForecast(groupAccounts[0], p)}
            />
          </tr>
        );
      } else {
        // Collapsible group
        rows.push(
          <tr
            key={groupId}
            className="cursor-pointer hover:bg-blue-50/30 transition-colors"
            onClick={() => onToggleGroup(groupId)}
          >
            <td className="sticky left-0 z-20 pl-6 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white">
              <div className="flex items-center gap-1.5">
                {isExpanded
                  ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                  : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
                <span className="font-medium text-gray-700">{accountType}</span>
                <span className="text-[9px] text-gray-400 ml-1">({groupAccounts.length})</span>
              </div>
            </td>
            {!isExpanded ? (
              <ValueCells
                historicalPeriods={historicalPeriods}
                forecastMonths={forecastMonths}
                getHistorical={p => getGroupTotal(groupAccounts, p, false)}
                getForecast={p => getGroupTotal(groupAccounts, p, true)}
                bold
              />
            ) : (
              <>
                {historicalPeriods.map(p => <td key={p} className="px-3 py-2 border-b border-gray-100 bg-gray-50" />)}
                {forecastMonths.map((p, i) => <td key={p} className={`px-3 py-2 border-b border-gray-100 bg-white ${i === 0 ? 'border-l-2 border-l-blue-100' : ''}`} />)}
              </>
            )}
          </tr>
        );

        if (isExpanded) {
          groupAccounts.forEach(acct => rows.push(renderAccountRow(acct)));
          // Subtotal
          rows.push(
            <tr key={`${groupId}_total`} className="bg-gray-50/60">
              <td className="sticky left-0 z-20 pl-10 pr-4 py-1.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-medium text-gray-600 text-[10px]">
                Total {accountType}
              </td>
              <ValueCells
                historicalPeriods={historicalPeriods}
                forecastMonths={forecastMonths}
                getHistorical={p => getGroupTotal(groupAccounts, p, false)}
                getForecast={p => getGroupTotal(groupAccounts, p, true)}
                bold
              />
            </tr>
          );
        }
      }
    }

    // Section total from engine
    const totalDef = BS_SECTION_TOTALS[section];
    rows.push(
      <tr key={`total_${section}`} className="bg-gray-50/80">
        <td className="sticky left-0 z-20 px-4 py-2 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-semibold text-gray-700 text-[11px]">
          {totalDef.label}
        </td>
        <ValueCells
          historicalPeriods={historicalPeriods}
          forecastMonths={forecastMonths}
          getHistorical={p => {
            const pd = historicalData[p];
            return pd?.bs ? (pd.bs as unknown as Record<string, number>)[totalDef.key] ?? null : null;
          }}
          getForecast={p => {
            const fp = forecastPeriods.find(f => f.period === p);
            return fp ? (fp.bs as unknown as Record<string, number>)[totalDef.key] ?? null : null;
          }}
          bold
        />
      </tr>
    );

    return rows;
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
      <table className="text-xs border-separate border-spacing-0" style={{ minWidth: 'max-content', width: '100%' }}>
        <thead className="sticky top-0 z-30">
          <TableColumnHeaders historicalPeriods={historicalPeriods} forecastMonths={forecastMonths} />
        </thead>
        <tbody>
          {BS_SECTION_ORDER.map(section => renderSection(section))}

          {/* TOTAL ASSETS */}
          <tr className="bg-gray-100">
            <td className="sticky left-0 z-20 px-4 py-2.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 font-bold text-gray-900 text-[11px]">
              TOTAL ASSETS
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => historicalData[p]?.bs ? (historicalData[p].bs as unknown as Record<string, number>).totalAssets ?? null : null}
              getForecast={p => forecastPeriods.find(f => f.period === p)?.bs.totalAssets ?? null}
              bold
            />
          </tr>

          {/* TOTAL LIABILITIES + EQUITY */}
          <tr className="bg-gray-100">
            <td className="sticky left-0 z-20 px-4 py-2.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 font-bold text-gray-900 text-[11px]">
              TOTAL LIABILITIES + EQUITY
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => {
                const pd = historicalData[p]?.bs as unknown as Record<string, number> | null;
                return pd ? ((pd.totalLiabilities ?? 0) + (pd.totalEquity ?? 0)) : null;
              }}
              getForecast={p => {
                const fp = forecastPeriods.find(f => f.period === p);
                return fp ? fp.bs.totalLiabilities + fp.bs.totalEquity : null;
              }}
              bold
            />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CFS TABLE — detailed indirect method, collapsible sections
// ═══════════════════════════════════════════════════════════════════════════

interface CFSTableProps {
  forecastPeriods: ForecastPeriod[];
  historicalPeriods: string[];
  historicalData: Record<string, HistoricalPeriodData>;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
}

function CFSForecastTable({
  forecastPeriods,
  historicalPeriods,
  historicalData,
  expandedGroups,
  onToggleGroup,
}: CFSTableProps) {
  const forecastMonths = forecastPeriods.map(p => p.period);

  // Compute CFS line item value for a forecast period
  function getCFSLineValue(line: CFSLine, periodIdx: number): number {
    const fp = forecastPeriods[periodIdx];
    if (!fp) return 0;

    if (line.source === 'pl' && line.plKey) {
      return (fp.pl as unknown as Record<string, number>)[line.plKey] ?? 0;
    }

    if (line.source === 'bs_delta' && line.bsKey) {
      const currentVal = (fp.bs as unknown as Record<string, number>)[line.bsKey] ?? 0;
      const prevVal = periodIdx > 0
        ? (forecastPeriods[periodIdx - 1].bs as unknown as Record<string, number>)[line.bsKey] ?? 0
        : 0;
      return (currentVal - prevVal) * (line.sign ?? 1);
    }

    // Derived: dividends = netProfit - Δ retainedEarnings (shown as negative outflow)
    if (line.source === 'derived' && line.derivedKey === 'dividends_paid') {
      const prevRE = periodIdx > 0 ? forecastPeriods[periodIdx - 1].bs.retainedEarnings : 0;
      const deltaRE = fp.bs.retainedEarnings - prevRE;
      const dividendsPaid = fp.pl.netProfit - deltaRE;
      return dividendsPaid > 0 ? -dividendsPaid : 0; // negative = cash outflow
    }

    return 0;
  }

  function renderCFSSection(
    sectionId: string,
    sectionLabel: string,
    lines: CFSLine[],
    totalKey: 'operating' | 'investing' | 'financing',
    totalLabel: string
  ) {
    const groupId = `cfs_${sectionId}`;
    const isExpanded = !!expandedGroups[groupId];

    const rows: React.ReactNode[] = [];

    // Section toggle row
    rows.push(
      <tr
        key={groupId}
        className="cursor-pointer hover:bg-blue-50/30 transition-colors bg-gray-100"
        onClick={() => onToggleGroup(groupId)}
      >
        <td className="sticky left-0 z-20 px-4 py-1.5 border-b border-gray-200 bg-gray-100 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {isExpanded
              ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
              : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{sectionLabel}</span>
          </div>
        </td>
        {!isExpanded ? (
          <ValueCells
            historicalPeriods={historicalPeriods}
            forecastMonths={forecastMonths}
            getHistorical={p => historicalData[p]?.cfs ? (historicalData[p].cfs as unknown as Record<string, number>)[totalKey] ?? null : null}
            getForecast={p => {
              const fp = forecastPeriods.find(f => f.period === p);
              return fp ? (fp.cfs as unknown as Record<string, number>)[totalKey] ?? null : null;
            }}
            bold
          />
        ) : (
          <>
            {historicalPeriods.map(p => <td key={p} className="px-3 py-1.5 border-b border-gray-200 bg-gray-100" />)}
            {forecastMonths.map((p, i) => <td key={p} className={`px-3 py-1.5 border-b border-gray-200 bg-gray-100 ${i === 0 ? 'border-l-2 border-l-blue-100' : ''}`} />)}
          </>
        )}
      </tr>
    );

    // Expanded: individual lines
    if (isExpanded) {
      for (const line of lines) {
        rows.push(
          <tr key={line.id} className="hover:bg-blue-50/20 transition-colors">
            <td className="sticky left-0 z-20 pl-10 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white text-gray-700">
              <span className="truncate max-w-[180px]" title={line.label}>{line.label}</span>
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => {
                const hd = historicalData[p];
                if (!hd) return null;
                const cfs = hd.cfs as Record<string, unknown> | null;

                // Map CFS line IDs to QBO CF detail fields
                const cfFieldMap: Record<string, string> = {
                  // Operating
                  cfs_net_income:  'netIncome',
                  cfs_depreciation: 'depreciation',
                  cfs_d_ar:        'changeInAccountsReceivable',
                  cfs_d_inv:       'changeInInventory',
                  cfs_d_prepaid:   'changeInOtherCurrentAssets',
                  cfs_d_ap:        'changeInAccountsPayable',
                  cfs_d_accrued:   'changeInOtherCurrentLiabilities',
                  cfs_d_tax:       'cashTaxPaid',
                  // Investing
                  cfs_capex:       'changeInFixedAssets',
                  // Financing
                  cfs_d_lt_debt:   'changeInNonCurrentLiabilities',
                  cfs_d_equity:    'changeInRetainedEarnings',
                  cfs_dividends:   'dividends',
                };

                // Try QBO CF detail field first
                if (cfs) {
                  const cfField = cfFieldMap[line.id];
                  if (cfField) {
                    const val = cfs[cfField];
                    if (typeof val === 'number' && val !== 0) return val;
                  }
                }

                // Fallback: P&L values
                if (line.source === 'pl' && line.plKey) {
                  if (line.plKey === 'netProfit') return hd.pl.revenue - hd.pl.cogs - hd.pl.opex - hd.pl.depreciation - hd.pl.interest - hd.pl.tax;
                  if (line.plKey === 'depreciation') return hd.pl.depreciation;
                  return (hd.pl as unknown as Record<string, number>)[line.plKey] ?? null;
                }

                // Fallback: BS delta
                if (line.source === 'bs_delta' && line.bsKey && hd.bs) {
                  const pIdx = historicalPeriods.indexOf(p);
                  const prevP = pIdx > 0 ? historicalPeriods[pIdx - 1] : null;
                  const prevBS = prevP ? historicalData[prevP]?.bs : null;
                  const currentVal = (hd.bs as unknown as Record<string, number>)[line.bsKey] ?? 0;
                  const prevVal = prevBS ? (prevBS as unknown as Record<string, number>)[line.bsKey] ?? 0 : 0;
                  const delta = (currentVal - prevVal) * (line.sign ?? 1);
                  if (delta !== 0) return delta;
                }

                // Derived: dividends from historical data
                if (line.source === 'derived' && line.derivedKey === 'dividends_paid') {
                  // Try QBO dividends field
                  if (cfs) {
                    const val = cfs['dividends'];
                    if (typeof val === 'number' && val !== 0) return val;
                  }
                  return null;
                }

                return null;
              }}
              getForecast={p => {
                const idx = forecastPeriods.findIndex(f => f.period === p);
                return idx >= 0 ? getCFSLineValue(line, idx) : null;
              }}
            />
          </tr>
        );
      }

      // Section subtotal
      rows.push(
        <tr key={`${groupId}_total`} className="bg-gray-50/80">
          <td className="sticky left-0 z-20 pl-8 pr-4 py-2 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-semibold text-gray-700 text-[11px]">
            {totalLabel}
          </td>
          <ValueCells
            historicalPeriods={historicalPeriods}
            forecastMonths={forecastMonths}
            getHistorical={p => historicalData[p]?.cfs ? (historicalData[p].cfs as unknown as Record<string, number>)[totalKey] ?? null : null}
            getForecast={p => {
              const fp = forecastPeriods.find(f => f.period === p);
              return fp ? (fp.cfs as unknown as Record<string, number>)[totalKey] ?? null : null;
            }}
            bold
          />
        </tr>
      );
    }

    return rows;
  }

  return (
    <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
      <table className="text-xs border-separate border-spacing-0" style={{ minWidth: 'max-content', width: '100%' }}>
        <thead className="sticky top-0 z-30">
          <TableColumnHeaders historicalPeriods={historicalPeriods} forecastMonths={forecastMonths} />
        </thead>
        <tbody>
          {renderCFSSection('operating', 'OPERATING ACTIVITIES', CFS_OPERATING_LINES, 'operating', 'Cash Flow from Operating Activities')}
          {renderCFSSection('investing', 'INVESTING ACTIVITIES', CFS_INVESTING_LINES, 'investing', 'Cash Flow from Investing Activities')}
          {renderCFSSection('financing', 'FINANCING ACTIVITIES', CFS_FINANCING_LINES, 'financing', 'Cash Flow from Financing Activities')}

          {/* Change in Cash & Equivalents */}
          <tr className="bg-gray-50/80">
            <td className="sticky left-0 z-20 px-4 py-2.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-50 font-bold text-gray-900 text-[11px]">
              Change in Cash & Equivalents
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => historicalData[p]?.cfs?.netChange ?? null}
              getForecast={p => forecastPeriods.find(f => f.period === p)?.cfs.netChange ?? null}
              bold
            />
          </tr>

          {/* Cash & Equivalents, Opening Balance */}
          <tr>
            <td className="sticky left-0 z-20 pl-8 pr-4 py-2 border-b border-r border-gray-100 whitespace-nowrap bg-white text-gray-700">
              Cash & Equivalents, Opening Balance
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => historicalData[p]?.cfs?.openingCash ?? null}
              getForecast={p => forecastPeriods.find(f => f.period === p)?.cfs.openingCash ?? null}
            />
          </tr>

          {/* Cash & Equivalents, Closing Balance */}
          <tr className="bg-gray-100">
            <td className="sticky left-0 z-20 px-4 py-2.5 border-b border-r border-gray-200 whitespace-nowrap bg-gray-100 font-bold text-gray-900 text-[11px]">
              Cash & Equivalents, Closing Balance
            </td>
            <ValueCells
              historicalPeriods={historicalPeriods}
              forecastMonths={forecastMonths}
              getHistorical={p => historicalData[p]?.cfs?.closingCash ?? null}
              getForecast={p => forecastPeriods.find(f => f.period === p)?.cfs.closingCash ?? null}
              bold
            />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Tab Pills ───────────────────────────────────────────────────────────────

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export function ForecastPage() {
  const [forecastId, setForecastId]   = useState<string | null>(null);
  const [metadata, setMetadata]       = useState<ForecastMetadata | null>(null);
  const [periods, setPeriods]         = useState<ForecastPeriod[]>([]);
  const [rules, setRules]             = useState<ValueRule[]>([]);
  const [historicalData, setHistoricalData] = useState<Record<string, HistoricalPeriodData>>({});
  const [historicalPeriods, setHistoricalPeriods] = useState<string[]>([]);
  const [plAccounts, setPlAccounts]   = useState<PLAccountDetail[]>([]);
  const [bsAccounts, setBsAccounts]   = useState<BSAccountDetail[]>([]);

  const [loading, setLoading]             = useState(true);
  const [initialising, setInitialising]   = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<ForecastTab>('pl');

  const [drawerAccountId, setDrawerAccountId] = useState<string | null>(null);
  const [savingRule, setSavingRule]           = useState(false);
  const [showDrivers, setShowDrivers]         = useState(false);
  const [savingDrivers, setSavingDrivers]     = useState(false);

  // ── Micro Forecasts state ──
  const [microForecasts, setMicroForecasts] = useState<MicroForecastInputs>({
    capex: [], loans: [], capitalEvents: [], dividends: [],
  });
  const [savingMicro, setSavingMicro]         = useState(false);

  // Collapse/expand state for groups across all tabs
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  // ── Load or auto-create baseline forecast ──────────────────────────────────
  const loadForecast = useCallback(async (id: string, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const [meta, fp, r] = await Promise.all([
        getForecastMetadata(COMPANY_ID, id),
        getForecastPeriods(COMPANY_ID, id, force),
        getValueRules(COMPANY_ID, id),
      ]);
      setMetadata(meta);
      setPeriods(fp);
      setRules(r);

      if (meta) {
        const hist: string[] = [];
        for (let i = HIST_MONTHS; i >= 1; i--) {
          hist.push(offsetPeriod(meta.firstForecastPeriod, -i));
        }
        setHistoricalPeriods(hist);

        // Fetch P&L accounts, BS accounts, historical data, and micro forecasts in parallel
        // Micro forecast loading is non-critical — fallback to empty if it fails
        const [{ accounts, periodData }, bsAccts, micro] = await Promise.all([
          getDetailedPLHistory(COMPANY_ID, HIST_MONTHS, meta.firstForecastPeriod),
          getBSAccountDetails(COMPANY_ID),
          loadMicroForecasts(COMPANY_ID, id).catch(err => {
            console.warn('[ForecastPage] Micro forecasts could not be loaded:', err?.message ?? err);
            return { capex: [], loans: [], capitalEvents: [], dividends: [] } as MicroForecastInputs;
          }),
        ]);
        setPlAccounts(accounts);
        setHistoricalData(periodData);
        setBsAccounts(bsAccts);
        setMicroForecasts(micro);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const list = await listForecasts(COMPANY_ID);
        if (list.length > 0) {
          setForecastId(list[0].id);
          await loadForecast(list[0].id);
        } else {
          setInitialising(true);
          const id = await createForecast(COMPANY_ID, BASELINE);
          setForecastId(id);
          await loadForecast(id, true);
          setInitialising(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialise forecast');
        setLoading(false);
        setInitialising(false);
      }
    }
    init();
  }, [loadForecast]);

  // ── Recalculate ────────────────────────────────────────────────────────────
  const handleRecalculate = async () => {
    if (!forecastId) return;
    setRecalculating(true);
    try {
      const updated = await recalculateForecast(COMPANY_ID, forecastId);
      setPeriods(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  // ── Drawer data ────────────────────────────────────────────────────────────
  const drawerData: DrawerAccountData | null = useMemo(() => {
    if (!drawerAccountId) return null;
    const acct = plAccounts.find(a => a.id === drawerAccountId);
    if (!acct) return null;

    const historical = historicalPeriods
      .map(p => ({
        period: p,
        value: historicalData[p]?.plAccounts?.[acct.id] ?? acct.values[p] ?? 0,
      }));

    const forecast = periods.map(fp => {
      const av = fp.pl.accountValues;
      const v = av ? av[acct.id] : undefined;
      return { period: fp.period, value: typeof v === 'number' ? v : 0 };
    });

    return {
      accountId:    acct.id,
      label:        acct.label,
      historicalData: historical,
      forecastData:   forecast,
      currentRule:  rules.find(r => r.accountId === acct.id) ?? null,
    };
  }, [drawerAccountId, plAccounts, historicalPeriods, historicalData, periods, rules]);

  // ── Save rule ─────────────────────────────────────────────────────────────
  const handleSaveRule = async (ruleType: ValueRuleType, params: object, cashTiming: CashTimingAllocation) => {
    if (!forecastId || !drawerAccountId) return;
    setSavingRule(true);
    try {
      await saveValueRule(COMPANY_ID, forecastId, {
        accountId: drawerAccountId,
        ruleType,
        params: params as ValueRule['params'],
        cashTiming,
        startPeriod: metadata?.firstForecastPeriod ?? '',
        endPeriod: null,
      });
      const [updatedRules, updatedPeriods] = await Promise.all([
        getValueRules(COMPANY_ID, forecastId),
        recalculateForecast(COMPANY_ID, forecastId),
      ]);
      setRules(updatedRules);
      setPeriods(updatedPeriods);
      setDrawerAccountId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!forecastId || !drawerData?.currentRule) return;
    setSavingRule(true);
    try {
      await deleteValueRule(COMPANY_ID, forecastId, drawerData.currentRule.id);
      const [updatedRules, updatedPeriods] = await Promise.all([
        getValueRules(COMPANY_ID, forecastId),
        recalculateForecast(COMPANY_ID, forecastId),
      ]);
      setRules(updatedRules);
      setPeriods(updatedPeriods);
      setDrawerAccountId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    } finally {
      setSavingRule(false);
    }
  };

  // ── Driver save ────────────────────────────────────────────────────────────
  const handleSaveDrivers = async (drivers: WorkingCapitalDrivers) => {
    if (!forecastId) return;
    setSavingDrivers(true);
    try {
      await updateDrivers(COMPANY_ID, forecastId, drivers);
      const updated = await recalculateForecast(COMPANY_ID, forecastId);
      setPeriods(updated);
      setMetadata(prev => prev ? { ...prev, drivers } : prev);
      setShowDrivers(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update drivers');
    } finally {
      setSavingDrivers(false);
    }
  };

  // ── Micro Forecast handlers ────────────────────────────────────────────────
  // Helper: save item → reload micros → recalculate
  const microRecalc = useCallback(async () => {
    if (!forecastId) return;
    const [micro, updated] = await Promise.all([
      loadMicroForecasts(COMPANY_ID, forecastId),
      recalculateForecast(COMPANY_ID, forecastId),
    ]);
    setMicroForecasts(micro);
    setPeriods(updated);
  }, [forecastId]);

  const handleSaveCapEx = async (item: Parameters<typeof saveCapExItem>[2]) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await saveCapExItem(COMPANY_ID, forecastId, item); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save CapEx'); }
    finally { setSavingMicro(false); }
  };
  const handleDeleteCapEx = async (id: string) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await deleteCapExItem(COMPANY_ID, forecastId, id); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete CapEx'); }
    finally { setSavingMicro(false); }
  };
  const handleSaveLoan = async (item: Parameters<typeof saveLoanItem>[2]) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await saveLoanItem(COMPANY_ID, forecastId, item); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save loan'); }
    finally { setSavingMicro(false); }
  };
  const handleDeleteLoan = async (id: string) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await deleteLoanItem(COMPANY_ID, forecastId, id); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete loan'); }
    finally { setSavingMicro(false); }
  };
  const handleSaveCapitalEvent = async (item: Parameters<typeof saveCapitalEvent>[2]) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await saveCapitalEvent(COMPANY_ID, forecastId, item); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save capital event'); }
    finally { setSavingMicro(false); }
  };
  const handleDeleteCapitalEvent = async (id: string) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await deleteCapitalEvent(COMPANY_ID, forecastId, id); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete capital event'); }
    finally { setSavingMicro(false); }
  };
  const handleSaveDividend = async (item: Parameters<typeof saveDividendSchedule>[2]) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await saveDividendSchedule(COMPANY_ID, forecastId, item); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save dividend'); }
    finally { setSavingMicro(false); }
  };
  const handleDeleteDividend = async (id: string) => {
    if (!forecastId) return;
    setSavingMicro(true);
    try { await deleteDividendSchedule(COMPANY_ID, forecastId, id); await microRecalc(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete dividend'); }
    finally { setSavingMicro(false); }
  };

  // ── Loading / initialising ─────────────────────────────────────────────────
  if (initialising || (loading && !metadata)) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Forecast</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {initialising ? 'Setting up your baseline forecast…' : 'Loading forecast…'}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      </div>
    );
  }

  const tabLabels: Record<ForecastTab, string> = {
    pl:      'Profit & Loss',
    bs:      'Balance Sheet',
    cfs:     'Cash Flow',
    micro:   'Micro Forecasts',
    roadmap: 'Business Roadmap',
  };

  const accountCount = activeTab === 'pl'
    ? plAccounts.length
    : activeTab === 'bs'
      ? bsAccounts.length
      : 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Forecast</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Three-way integrated model · P&L → Balance Sheet → Cash Flow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDrivers(true)} disabled={loading}>
            <Settings2 className="h-4 w-4 mr-1.5" />
            Drivers
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating…' : 'Recalculate'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {metadata && periods.length > 0 && (
        <p className="text-xs text-gray-400">
          {periodLabel(periods[0].period)} — {periodLabel(periods[periods.length - 1].period)}
          {' · '}{metadata.horizon} months · {metadata.currency}
          {accountCount > 0 && (
            <span className="text-blue-400"> · {accountCount} QBO accounts · Click to expand groups</span>
          )}
        </p>
      )}

      {/* ── Financial Statement Card ── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            {(['pl', 'bs', 'cfs', 'micro', 'roadmap'] as ForecastTab[]).map(t => (
              <TabPill key={t} active={activeTab === t} onClick={() => setActiveTab(t)}>
                {tabLabels[t]}
              </TabPill>
            ))}
          </div>
          {(activeTab === 'pl' || activeTab === 'bs' || activeTab === 'cfs') && (
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2.5 rounded-sm bg-gray-100 border border-gray-200" />
                Actuals
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-2.5 rounded-sm bg-white border border-blue-200" />
                Forecast
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : periods.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-medium">No forecast data yet</p>
            <p className="text-sm mt-1 mb-4">Click Recalculate to run the forecast engine against your QBO data.</p>
            <Button onClick={handleRecalculate} disabled={recalculating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Calculating…' : 'Run Forecast'}
            </Button>
          </div>
        ) : activeTab === 'pl' ? (
          <PLForecastTable
            accounts={plAccounts}
            historicalPeriods={historicalPeriods}
            forecastPeriods={periods}
            historicalData={historicalData}
            rules={rules}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            onRowClick={setDrawerAccountId}
          />
        ) : activeTab === 'bs' ? (
          <BSForecastTable
            bsAccounts={bsAccounts}
            historicalPeriods={historicalPeriods}
            forecastPeriods={periods}
            historicalData={historicalData}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
          />
        ) : activeTab === 'cfs' ? (
          <CFSForecastTable
            forecastPeriods={periods}
            historicalPeriods={historicalPeriods}
            historicalData={historicalData}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
          />
        ) : activeTab === 'micro' ? (
          metadata ? (
            <MicroForecastContent
              micro={microForecasts}
              firstForecastPeriod={metadata.firstForecastPeriod}
              horizon={metadata.horizon}
              onSaveCapEx={handleSaveCapEx}
              onDeleteCapEx={handleDeleteCapEx}
              onSaveLoan={handleSaveLoan}
              onDeleteLoan={handleDeleteLoan}
              onSaveCapitalEvent={handleSaveCapitalEvent}
              onDeleteCapitalEvent={handleDeleteCapitalEvent}
              onSaveDividend={handleSaveDividend}
              onDeleteDividend={handleDeleteDividend}
              saving={savingMicro}
            />
          ) : null
        ) : activeTab === 'roadmap' ? (
          metadata ? (
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Business Roadmap</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visual timeline of all planned financial events across the forecast horizon
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <RoadmapTimeline
                  micro={microForecasts}
                  firstForecastPeriod={metadata.firstForecastPeriod}
                  horizon={metadata.horizon}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'CapEx Items', count: microForecasts.capex.length, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                  { label: 'Loans', count: microForecasts.loans.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { label: 'Capital Events', count: microForecasts.capitalEvents.length, color: 'bg-green-50 text-green-700 border-green-200' },
                  { label: 'Dividends', count: microForecasts.dividends.length, color: 'bg-purple-50 text-purple-700 border-purple-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-lg border p-3 ${s.color}`}>
                    <p className="text-lg font-bold">{s.count}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        ) : null}
      </Card>

      {/* ── Account Forecast Drawer ── */}
      {drawerData && (
        <AccountForecastDrawer
          data={drawerData}
          forecastPeriods={periods.map(p => p.period)}
          budgets={[]}
          onSave={handleSaveRule}
          onDelete={handleDeleteRule}
          onClose={() => setDrawerAccountId(null)}
          saving={savingRule}
        />
      )}

      {/* ── Working Capital Drivers Modal ── */}
      {showDrivers && metadata && (
        <Modal title="Working Capital Drivers" onClose={() => setShowDrivers(false)}>
          <DriverSettingsPanel
            drivers={metadata.drivers}
            onSave={handleSaveDrivers}
            onCancel={() => setShowDrivers(false)}
            saving={savingDrivers}
          />
        </Modal>
      )}

    </div>
  );
}

export default ForecastPage;
