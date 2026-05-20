/**
 * ProjectBudgetRollup
 *
 * Sortable table showing per-project budget figures. Toggle between USD view
 * (dual Local + USD columns) and UGX view (all amounts in UGX equivalent).
 * Footer row with program totals. Over-budget rows receive a red left border.
 */

import { useState, useMemo } from 'react';
import { ArrowUpDown, AlertTriangle, Landmark, ArrowDownLeft, ArrowUpRight, Clock, Wallet } from 'lucide-react';
import type { ExchangeRateEntry } from '../../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ProjectBudgetRollupItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  budgetCurrency: string;
  budgetAmount: number;
  budgetAmountUSD: number;
  spentAmount: number;
  spentAmountUSD: number;
  committedAmount: number;
  committedAmountUSD: number;
  remainingAmount: number;   // always USD
  utilizationPercent: number;
}

interface TreasuryBalance {
  locationName: string;
  currency: string;
  totalReceived: number;
  totalDisbursed: number;
  totalPending: number;
  availableBalance: number;
}

interface ProjectBudgetRollupProps {
  rollup: ProjectBudgetRollupItem[];
  latestRate: ExchangeRateEntry | null;
  treasuryBalance?: TreasuryBalance | null;
}

type SortField =
  | 'projectName'
  | 'budgetAmount'
  | 'budgetAmountUSD'
  | 'spentAmount'
  | 'spentAmountUSD'
  | 'remainingAmount'
  | 'utilizationPercent';

type SortDirection = 'asc' | 'desc';
type ViewMode = 'USD' | 'UGX';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function fmtAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const fmtUGX = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0,
});

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ProjectBudgetRollup({ rollup, latestRate, treasuryBalance }: ProjectBudgetRollupProps) {
  const [sortField, setSortField] = useState<SortField>('projectName');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('USD');

  const rate = latestRate?.rate ?? 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const items = [...rollup];
    items.sort((a, b) => {
      let cmp: number;
      if (sortField === 'projectName') {
        cmp = a.projectName.localeCompare(b.projectName);
      } else {
        cmp = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [rollup, sortField, sortDir]);

  // Program totals (always USD internally)
  const totals = useMemo(() => {
    return rollup.reduce(
      (acc, row) => ({
        budgetAmountUSD: acc.budgetAmountUSD + row.budgetAmountUSD,
        spentAmountUSD: acc.spentAmountUSD + row.spentAmountUSD,
        committedAmountUSD: acc.committedAmountUSD + row.committedAmountUSD,
        remainingAmount: acc.remainingAmount + row.remainingAmount,
      }),
      { budgetAmountUSD: 0, spentAmountUSD: 0, committedAmountUSD: 0, remainingAmount: 0 },
    );
  }, [rollup]);

  const totalUtilization =
    totals.budgetAmountUSD > 0
      ? ((totals.spentAmountUSD + totals.committedAmountUSD) / totals.budgetAmountUSD) * 100
      : 0;

  // ── UGX helper: returns UGX amount for a row field ──────────
  // For UGX-denominated projects use native amount; USD projects convert via rate.
  function toUGX(row: ProjectBudgetRollupItem, field: 'budget' | 'spent' | 'committed' | 'remaining'): number {
    if (field === 'remaining') return row.remainingAmount * rate;
    const nativeMap = { budget: row.budgetAmount, spent: row.spentAmount, committed: row.committedAmount };
    const usdMap    = { budget: row.budgetAmountUSD, spent: row.spentAmountUSD, committed: row.committedAmountUSD };
    if (row.budgetCurrency === 'UGX') return nativeMap[field];
    return usdMap[field] * rate;
  }

  if (rollup.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No project budget data available.
      </div>
    );
  }

  const isUGX = viewMode === 'UGX';

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-gray-900">Project Budget Rollup</h3>
        <div className="flex items-center gap-3">
          {latestRate && (
            <span className="text-xs text-gray-500">
              Rate: 1 {latestRate.fromCurrency} ={' '}
              {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(latestRate.rate)}{' '}
              {latestRate.toCurrency}
            </span>
          )}
          {/* Currency view toggle — only useful when exchange rate is available */}
          {latestRate && (
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              {(['USD', 'UGX'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 transition-colors ${
                    viewMode === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Treasury Balance Banner */}
      {treasuryBalance && (
        <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">{treasuryBalance.locationName}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Treasury</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-2">
              <ArrowDownLeft className="w-4 h-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Total Received</p>
                <p className="text-sm font-semibold text-green-700">
                  {fmtAmount(treasuryBalance.totalReceived, treasuryBalance.currency)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ArrowUpRight className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Total Disbursed</p>
                <p className="text-sm font-semibold text-red-600">
                  {fmtAmount(treasuryBalance.totalDisbursed, treasuryBalance.currency)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-500 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-sm font-semibold text-amber-600">
                  {fmtAmount(treasuryBalance.totalPending, treasuryBalance.currency)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Wallet className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Available Balance</p>
                <p className={`text-sm font-bold ${treasuryBalance.availableBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {fmtAmount(treasuryBalance.availableBalance, treasuryBalance.currency)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        {isUGX ? (
          /* ── UGX MODE: single set of columns, all amounts in UGX ── */
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-amber-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Project</th>
                {['Budget (UGX)', 'Spent (UGX)', 'Committed (UGX)', 'Remaining (UGX)', 'Utilization'].map((label) => (
                  <th key={label} className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((row) => {
                const budgetUGX    = toUGX(row, 'budget');
                const spentUGX     = toUGX(row, 'spent');
                const committedUGX = toUGX(row, 'committed');
                const remainingUGX = toUGX(row, 'remaining');
                const isOver = remainingUGX < 0;
                return (
                  <tr key={row.projectId} className={`hover:bg-gray-50 transition-colors ${isOver ? 'border-l-4 border-l-red-500' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOver && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{row.projectName}</p>
                          <p className="text-xs text-gray-500">{row.projectCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700">{fmtUGX.format(budgetUGX)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700">{fmtUGX.format(spentUGX)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-amber-700">{fmtUGX.format(committedUGX)}</td>
                    <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${isOver ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtUGX.format(remainingUGX)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.utilizationPercent > 100 ? 'bg-red-500' : row.utilizationPercent > 90 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(row.utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${row.utilizationPercent > 100 ? 'text-red-600' : row.utilizationPercent > 90 ? 'text-amber-600' : 'text-gray-700'}`}>
                          {row.utilizationPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold text-gray-900">
                <td className="px-4 py-3">Program Total</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{fmtUGX.format(totals.budgetAmountUSD * rate)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{fmtUGX.format(totals.spentAmountUSD * rate)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap text-amber-700">{fmtUGX.format(totals.committedAmountUSD * rate)}</td>
                <td className={`px-4 py-3 text-right whitespace-nowrap ${totals.remainingAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmtUGX.format(totals.remainingAmount * rate)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{totalUtilization.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          /* ── USD MODE: existing dual Local + USD columns ── */
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { label: 'Project', align: 'left' },
                  { label: 'Budget (Local)', align: 'right' },
                  { label: 'Budget (USD)', align: 'right' },
                  { label: 'Spent (Local)', align: 'right' },
                  { label: 'Spent (USD)', align: 'right' },
                  { label: 'Remaining (USD)', align: 'right' },
                  { label: 'Utilization', align: 'right' },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={`px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    onClick={() => {
                      const fieldMap: Record<string, SortField> = {
                        'Project': 'projectName',
                        'Budget (Local)': 'budgetAmount',
                        'Budget (USD)': 'budgetAmountUSD',
                        'Spent (Local)': 'spentAmount',
                        'Spent (USD)': 'spentAmountUSD',
                        'Remaining (USD)': 'remainingAmount',
                        'Utilization': 'utilizationPercent',
                      };
                      const f = fieldMap[col.label];
                      if (f) handleSort(f);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((row) => {
                const isOverBudget = row.remainingAmount < 0;
                return (
                  <tr
                    key={row.projectId}
                    className={`hover:bg-gray-50 transition-colors ${isOverBudget ? 'border-l-4 border-l-red-500' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isOverBudget && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{row.projectName}</p>
                          <p className="text-xs text-gray-500">{row.projectCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700">
                      {fmtAmount(row.budgetAmount, row.budgetCurrency)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700">
                      {fmtUSD.format(row.budgetAmountUSD)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700">
                      {fmtAmount(row.spentAmount, row.budgetCurrency)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-gray-700">
                      {fmtUSD.format(row.spentAmountUSD)}
                    </td>
                    <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                      {fmtUSD.format(row.remainingAmount)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.utilizationPercent > 100 ? 'bg-red-500' : row.utilizationPercent > 90 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(row.utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${row.utilizationPercent > 100 ? 'text-red-600' : row.utilizationPercent > 90 ? 'text-amber-600' : 'text-gray-700'}`}>
                          {row.utilizationPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold text-gray-900">
                <td className="px-4 py-3">Program Total</td>
                <td className="px-4 py-3 text-right">--</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{fmtUSD.format(totals.budgetAmountUSD)}</td>
                <td className="px-4 py-3 text-right">--</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{fmtUSD.format(totals.spentAmountUSD)}</td>
                <td className={`px-4 py-3 text-right whitespace-nowrap ${totals.remainingAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmtUSD.format(totals.remainingAmount)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{totalUtilization.toFixed(1)}%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
