/**
 * ThreeWayTable
 * Tabbed table showing P&L / Balance Sheet / Cash Flow forecast
 * with columns = forecast months and rows = line items
 */

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Skeleton } from '@/core/components/ui/skeleton';
import type { ForecastPeriod, ValueRule } from '../../types/forecast.types';
import { periodLabel } from '../../types/forecast.types';
import { fmtUSD } from '../../services/forecastEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'pl' | 'bs' | 'cfs';

interface RowDef {
  key: string;
  label: string;
  accountId?: string;     // if set, show rule indicator + edit button
  indent?: boolean;
  subtotal?: boolean;
  bold?: boolean;
  sign?: 1 | -1;          // -1 renders negative stored values as positive (COGS etc.)
}

// ── Row definitions ───────────────────────────────────────────────────────────

const PL_ROWS: RowDef[] = [
  { key: 'revenue',      label: 'Revenue',         accountId: '__revenue__', bold: true },
  { key: 'cogs',         label: 'Cost of Sales',   accountId: '__cogs__',    indent: true, sign: -1 },
  { key: 'grossProfit',  label: 'Gross Profit',    subtotal: true, bold: true },
  { key: 'opex',         label: 'Operating Expenses', accountId: '__opex__', indent: true, sign: -1 },
  { key: 'ebitda',       label: 'EBITDA',          subtotal: true, bold: true },
  { key: 'depreciation', label: 'Depreciation',    accountId: '__depreciation__', indent: true, sign: -1 },
  { key: 'ebit',         label: 'EBIT',            subtotal: true },
  { key: 'interest',     label: 'Interest',        accountId: '__interest__', indent: true, sign: -1 },
  { key: 'tax',          label: 'Tax',             accountId: '__tax__',    indent: true, sign: -1 },
  { key: 'netProfit',    label: 'Net Profit',      subtotal: true, bold: true },
];

const BS_ROWS: RowDef[] = [
  { key: '_ca_header',             label: 'CURRENT ASSETS',          bold: true },
  { key: 'cash',                   label: 'Cash',                    indent: true },
  { key: 'receivables',            label: 'Accounts Receivable',     indent: true },
  { key: 'inventory',              label: 'Inventory',               indent: true },
  { key: 'prepaid',                label: 'Prepaid Expenses',        indent: true },
  { key: 'totalCurrentAssets',     label: 'Total Current Assets',    subtotal: true, bold: true },
  { key: '_nca_header',            label: 'NON-CURRENT ASSETS',      bold: true },
  { key: 'ppe',                    label: 'Property, Plant & Equipment (Gross)', indent: true },
  { key: '_accDep',                label: 'Accumulated Depreciation', indent: true },
  { key: 'totalNonCurrentAssets',  label: 'Total Non-Current Assets', subtotal: true },
  { key: 'totalAssets',            label: 'TOTAL ASSETS',            subtotal: true, bold: true },
  { key: '_cl_header',             label: 'CURRENT LIABILITIES',     bold: true },
  { key: 'payables',               label: 'Accounts Payable',        indent: true },
  { key: 'accrued',                label: 'Accrued Expenses',        indent: true },
  { key: 'taxPayable',             label: 'Tax Payable',             indent: true },
  { key: 'totalCurrentLiabilities', label: 'Total Current Liabilities', subtotal: true, bold: true },
  { key: '_ncl_header',            label: 'NON-CURRENT LIABILITIES', bold: true },
  { key: 'ltDebt',                 label: 'Long-term Debt',          indent: true },
  { key: 'totalNonCurrentLiabilities', label: 'Total Non-Current Liabilities', subtotal: true },
  { key: 'totalLiabilities',       label: 'TOTAL LIABILITIES',       subtotal: true, bold: true },
  { key: '_eq_header',             label: 'EQUITY',                  bold: true },
  { key: 'shareCapital',           label: 'Share Capital',           indent: true },
  { key: 'retainedEarnings',       label: 'Retained Earnings',       indent: true },
  { key: 'totalEquity',            label: 'TOTAL EQUITY',            subtotal: true, bold: true },
  { key: 'totalLiabEquity',        label: 'TOTAL LIAB. + EQUITY',    subtotal: true, bold: true },
];

const CFS_ROWS: RowDef[] = [
  { key: 'openingCash',  label: 'Opening Cash Balance',             bold: true },
  { key: '_op_header',   label: 'OPERATING ACTIVITIES',             bold: true },
  { key: 'operating',    label: 'Net Cash from Operating Activities', indent: true, subtotal: true },
  { key: '_inv_header',  label: 'INVESTING ACTIVITIES',             bold: true },
  { key: 'investing',    label: 'Net Cash from Investing Activities', indent: true, subtotal: true },
  { key: '_fin_header',  label: 'FINANCING ACTIVITIES',             bold: true },
  { key: 'financing',    label: 'Net Cash from Financing Activities', indent: true, subtotal: true },
  { key: 'netChange',    label: 'Net Change in Cash',               subtotal: true, bold: true },
  { key: 'closingCash',  label: 'Closing Cash Balance',             subtotal: true, bold: true },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function getVal(period: ForecastPeriod, tab: Tab, key: string): number | null {
  if (key.startsWith('_')) {
    // Computed display values
    if (key === '_accDep') return -(period.bs.accDepreciation);
    if (key === 'totalLiabEquity') return period.bs.totalLiabilities + period.bs.totalEquity;
    return null; // header row
  }
  if (tab === 'pl') return (period.pl as unknown as Record<string, number>)[key] ?? null;
  if (tab === 'bs') return (period.bs as unknown as Record<string, number>)[key] ?? null;
  if (tab === 'cfs') return (period.cfs as unknown as Record<string, number>)[key] ?? null;
  return null;
}

function getRuleLabel(rules: ValueRule[], accountId: string): string {
  const rule = rules.find(r => r.accountId === accountId);
  if (!rule) return 'Auto';
  const labels: Record<string, string> = {
    smart_prediction: 'Avg',
    constant_growing: 'Grow',
    direct_entry: 'Manual',
    link_to_budget: 'Budget',
  };
  return labels[rule.ruleType] ?? rule.ruleType;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  periods: ForecastPeriod[];
  rules: ValueRule[];
  loading: boolean;
  onEditRule?: (accountId: string, rule: ValueRule | null) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'pl', label: 'Profit & Loss' },
  { id: 'bs', label: 'Balance Sheet' },
  { id: 'cfs', label: 'Cash Flow' },
];

export function ThreeWayTable({ periods, rules, loading, onEditRule }: Props) {
  const [tab, setTab] = useState<Tab>('pl');

  const rows = tab === 'pl' ? PL_ROWS : tab === 'bs' ? BS_ROWS : CFS_ROWS;

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-0 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm table-sticky-first-col">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 bg-gray-50 text-left px-3 py-2 font-medium text-gray-600 min-w-[220px]">
                Account
              </th>
              {tab === 'pl' && (
                <th className="text-center px-2 py-2 font-medium text-gray-400 text-xs w-16">Rule</th>
              )}
              {loading
                ? Array.from({ length: 4 }, (_, i) => (
                    <th key={i} className="text-right px-3 py-2 text-gray-400 min-w-[90px]">
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </th>
                  ))
                : periods.map(p => (
                    <th key={p.period} className="text-right px-3 py-2 font-medium text-gray-600 min-w-[90px] whitespace-nowrap">
                      {periodLabel(p.period)}
                    </th>
                  ))
              }
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isHeader = row.key.startsWith('_') && !row.subtotal && row.key !== '_accDep';
              const activeRule = row.accountId
                ? rules.find(r => r.accountId === row.accountId) ?? null
                : null;

              return (
                <tr
                  key={row.key + ri}
                  className={`border-b border-gray-100 ${
                    isHeader ? 'bg-gray-800' :
                    row.subtotal ? 'bg-gray-50 border-t-2 border-gray-300' :
                    'hover:bg-gray-50'
                  } transition-colors`}
                >
                  {/* Label column */}
                  <td
                    className={`sticky left-0 px-3 py-1.5 font-${row.bold ? 'semibold' : 'normal'} ${
                      isHeader ? 'bg-gray-800 text-white text-xs uppercase tracking-wider' :
                      row.subtotal ? 'bg-gray-50 text-gray-800' :
                      row.indent ? 'pl-6 text-gray-600 bg-white' : 'text-gray-700 bg-white'
                    }`}
                  >
                    {row.label}
                  </td>

                  {/* Rule badge (P&L only) */}
                  {tab === 'pl' && (
                    <td className="text-center px-2 py-1.5">
                      {row.accountId ? (
                        <button
                          onClick={() => onEditRule?.(row.accountId!, activeRule)}
                          title="Edit value rule"
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-400 transition-colors"
                        >
                          <Settings2 className="h-3 w-3" />
                          {getRuleLabel(rules, row.accountId)}
                        </button>
                      ) : null}
                    </td>
                  )}
                  {/* Spacer for rule column on non-PL tabs — NOT needed (no column) */}

                  {/* Data columns */}
                  {loading
                    ? Array.from({ length: 4 }, (_, i) => (
                        <td key={i} className="text-right px-3 py-1.5">
                          <Skeleton className="h-4 w-16 ml-auto" />
                        </td>
                      ))
                    : periods.map(p => {
                        const rawVal = getVal(p, tab, row.key);
                        const displayVal = rawVal === null
                          ? null
                          : (row.sign === -1 ? -rawVal : rawVal);
                        const isNeg = displayVal !== null && displayVal < 0;

                        return (
                          <td
                            key={p.period}
                            className={`text-right px-3 py-1.5 tabular-nums ${
                              isHeader ? 'text-white' :
                              isNeg ? 'text-red-500' : 'text-gray-700'
                            } ${row.bold ? 'font-semibold' : ''}`}
                          >
                            {displayVal === null ? '' : fmtUSD(displayVal)}
                          </td>
                        );
                      })
                  }
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
