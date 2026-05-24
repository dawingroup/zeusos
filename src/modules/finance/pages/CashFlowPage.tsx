// ============================================================================
// CASH FLOW ANALYSIS PAGE — Waterfall Chart
// ZeusOS v2.0 - Finance Module
//
// Horizontal waterfall (bridge) chart: each bar starts where the previous
// ended, flowing from Revenue through costs to Net Cash Flow.
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import { getQBOCashFlow, syncQBOCategory } from '../services/qboSyncService';
import type { QBOCashFlow } from '../types/integrations.types';

const COMPANY_ID = 'dawinos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function niceMax(v: number): number {
  if (v <= 0) return 10_000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

function fmtScale(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(0)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function getMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/** Compute scale tick positions (shared between header labels + grid lines) */
function getScaleTicks(scaleMin: number, scaleMax: number): number[] {
  const range = scaleMax - scaleMin;
  if (range <= 0) return [];
  const step = niceMax(range / 4);
  const ticks: number[] = [];
  let t = Math.ceil(scaleMin / step) * step;
  while (t <= scaleMax) {
    ticks.push(t);
    t += step;
  }
  return ticks;
}

// ── Template Definition ───────────────────────────────────────────────────────

type ItemRow = {
  type: 'item';
  field: keyof QBOCashFlow;
  label: string;
  addLabel: 'ADD' | 'LESS';
};
type SubtotalRow = {
  type: 'subtotal';
  field: keyof QBOCashFlow;
  label: string;
};
type TemplateRow = ItemRow | SubtotalRow;

const TEMPLATE: TemplateRow[] = [
  { type: 'item', field: 'revenue', label: 'Revenue', addLabel: 'ADD' },
  { type: 'item', field: 'costOfSales', label: 'Cost of Sales', addLabel: 'LESS' },
  { type: 'item', field: 'expenses', label: 'Expenses', addLabel: 'LESS' },
  { type: 'item', field: 'otherIncome', label: 'Other Income', addLabel: 'ADD' },
  { type: 'item', field: 'cashTaxPaid', label: 'Cash Tax Paid', addLabel: 'LESS' },
  { type: 'item', field: 'changeInAccountsPayable', label: 'Change in Accounts Payable', addLabel: 'ADD' },
  { type: 'item', field: 'changeInOtherCurrentLiabilities', label: 'Change in Other Current Liabilities', addLabel: 'ADD' },
  { type: 'item', field: 'changeInAccountsReceivable', label: 'Change in Accounts Receivable', addLabel: 'LESS' },
  { type: 'item', field: 'changeInInventory', label: 'Change in Inventory', addLabel: 'LESS' },
  { type: 'item', field: 'changeInWorkInProgress', label: 'Change in Work In Progress', addLabel: 'LESS' },
  { type: 'item', field: 'changeInOtherCurrentAssets', label: 'Change in Other Current Assets', addLabel: 'LESS' },
  { type: 'subtotal', field: 'operatingCashFlow', label: 'OPERATING CASH FLOW' },

  { type: 'item', field: 'changeInFixedAssets', label: 'Change in Fixed Assets (ex. Depn & Amortisation)', addLabel: 'LESS' },
  { type: 'item', field: 'changeInIntangibleAssets', label: 'Change in Intangible Assets', addLabel: 'LESS' },
  { type: 'item', field: 'changeInInvestments', label: 'Change in Investments or Other Non-Current Assets', addLabel: 'LESS' },
  { type: 'subtotal', field: 'freeCashFlow', label: 'FREE CASH FLOW' },

  { type: 'item', field: 'netInterest', label: 'Net Interest (after tax)', addLabel: 'LESS' },
  { type: 'item', field: 'changeInOtherNonCurrentLiabilities', label: 'Change in Other Non-Current Liabilities', addLabel: 'ADD' },
  { type: 'item', field: 'dividends', label: 'Dividends', addLabel: 'LESS' },
  { type: 'item', field: 'changeInRetainedEarnings', label: 'Change in Retained Earnings and Other Equity', addLabel: 'ADD' },
  { type: 'item', field: 'adjustments', label: 'Adjustments', addLabel: 'LESS' },
  { type: 'subtotal', field: 'netCashFlow', label: 'NET CASH FLOW' },
];

// ── Waterfall Data Types ──────────────────────────────────────────────────────

interface WFItem {
  type: 'item';
  label: string;
  addLabel: 'ADD' | 'LESS';
  value: number;
  runBefore: number;
  runAfter: number;
}

interface WFSummary {
  type: 'subtotal';
  label: string;
  value: number;
}

type WFRow = WFItem | WFSummary;

// ── Scale Grid Lines (rendered inside every row's bar area) ───────────────────

function ScaleGridLines({
  ticks,
  scaleMin,
  scaleMax,
}: {
  ticks: number[];
  scaleMin: number;
  scaleMax: number;
}) {
  const range = scaleMax - scaleMin;
  if (range <= 0) return null;

  return (
    <>
      {ticks.map((tick) => {
        const pct = ((tick - scaleMin) / range) * 100;
        return (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${pct}%`,
              background: tick === 0 ? '#e5e7eb' : '#f5f5f5',
            }}
          />
        );
      })}
    </>
  );
}

// ── Scale Header Labels (top row only) ────────────────────────────────────────

function ScaleHeader({
  ticks,
  scaleMin,
  scaleMax,
}: {
  ticks: number[];
  scaleMin: number;
  scaleMax: number;
}) {
  const range = scaleMax - scaleMin;
  if (range <= 0) return null;

  return (
    <>
      {ticks.map((tick) => {
        const pct = ((tick - scaleMin) / range) * 100;
        return (
          <div key={tick} className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
            <div className="absolute -top-4 -translate-x-1/2 text-[10px] text-[var(--fg-tertiary)] whitespace-nowrap font-medium">
              {fmtScale(tick)}
            </div>
            <div
              className="h-full w-px"
              style={{ background: tick === 0 ? '#e5e7eb' : '#f5f5f5' }}
            />
          </div>
        );
      })}
    </>
  );
}

// ── Waterfall Item Row ────────────────────────────────────────────────────────

function WaterfallItemRow({
  label,
  addLabel,
  value,
  runBefore,
  runAfter,
  scaleMin,
  scaleMax,
  ticks,
}: {
  label: string;
  addLabel: 'ADD' | 'LESS';
  value: number;
  runBefore: number;
  runAfter: number;
  scaleMin: number;
  scaleMax: number;
  ticks: number[];
}) {
  const range = scaleMax - scaleMin;
  const toPct = (v: number) => (range > 0 ? ((v - scaleMin) / range) * 100 : 50);

  const isZero = value === 0;
  const isPositive = value > 0;

  const barLeftPct = toPct(Math.min(runBefore, runAfter));
  const barRightPct = toPct(Math.max(runBefore, runAfter));
  const barWidthPct = barRightPct - barLeftPct;
  const connPct = toPct(runAfter);
  const insideBar = barWidthPct > 10;

  return (
    <div className="flex items-center py-0.5 hover:bg-[var(--bg-sunken)]/40 transition-colors">
      {/* Label column */}
      <div className="w-[40%] shrink-0 flex items-center gap-2 pl-3 pr-2">
        <span
          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
            addLabel === 'ADD'
              ? 'text-[var(--rag-green)] bg-[var(--rag-green-soft)]'
              : 'text-[var(--fg-tertiary)] bg-[var(--bg-sunken)]'
          }`}
        >
          {addLabel}
        </span>
        <span className="text-xs text-muted-foreground truncate" title={label}>
          {label}
        </span>
      </div>

      {/* Bar area */}
      <div className="flex-1 relative h-6 mr-3 overflow-visible">
        {/* Grid lines running across */}
        <ScaleGridLines ticks={ticks} scaleMin={scaleMin} scaleMax={scaleMax} />

        {/* Connector dashed line at runAfter position */}
        <div
          className="absolute -top-px -bottom-px border-l border-dashed border-[var(--border-default)]/60"
          style={{ left: `${connPct}%` }}
        />

        {isZero ? (
          <div
            className="absolute top-2 bottom-2 w-0.5 bg-[var(--bg-sunken)] rounded"
            style={{ left: `${toPct(runBefore)}%` }}
          />
        ) : (
          <div
            className={`absolute top-0.5 bottom-0.5 rounded-sm ${
              isPositive ? 'bg-[var(--rag-green)]' : 'bg-[var(--rag-red)]'
            }`}
            style={{
              left: `${barLeftPct}%`,
              width: `${Math.max(barWidthPct, 0.3)}%`,
            }}
          >
            {insideBar && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white whitespace-nowrap">
                {fmt(value)}
              </span>
            )}
          </div>
        )}

        {/* Value label outside bar */}
        {!insideBar && !isZero && (
          <span
            className="absolute top-0 bottom-0 flex items-center text-[10px] text-muted-foreground whitespace-nowrap font-medium"
            style={{
              left: isPositive
                ? `${Math.min(barRightPct + 0.5, 97)}%`
                : `${Math.max(barLeftPct - 0.5, 1)}%`,
              transform: !isPositive ? 'translateX(-100%)' : undefined,
            }}
          >
            {fmt(value)}
          </span>
        )}

        {isZero && (
          <span
            className="absolute top-0 bottom-0 flex items-center text-[10px] text-[var(--fg-tertiary)] whitespace-nowrap"
            style={{ left: `${toPct(runBefore) + 0.5}%` }}
          >
            0
          </span>
        )}
      </div>
    </div>
  );
}

// ── Waterfall Summary Row (arrow tip at scale position, amount outside) ───────

function WaterfallSummaryRow({
  label,
  value,
  scaleMin,
  scaleMax,
  ticks,
}: {
  label: string;
  value: number;
  scaleMin: number;
  scaleMax: number;
  ticks: number[];
}) {
  const range = scaleMax - scaleMin;
  const valPctInBar = range > 0 ? ((value - scaleMin) / range) * 100 : 50;

  return (
    <div className="flex items-center my-0.5">
      {/* Label in the left column — aligned with item row labels */}
      <div className="w-[40%] shrink-0 pl-3 pr-2">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
          {label}
        </span>
      </div>

      {/* Bar area: arrow shape + amount */}
      <div className="flex-1 relative h-8 mr-3">
        {/* Grid lines running across */}
        <ScaleGridLines ticks={ticks} scaleMin={scaleMin} scaleMax={scaleMax} />

        {/* Arrow shape from left edge to value position */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-[var(--bg-sunken)]/90"
          style={{
            width: `${Math.max(valPctInBar, 2)}%`,
            clipPath:
              'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
          }}
        />

        {/* Amount right of arrow tip */}
        <span
          className={`absolute top-0 bottom-0 flex items-center text-base font-bold whitespace-nowrap pl-1 ${
            value < 0 ? 'text-[var(--rag-red)]' : 'text-foreground'
          }`}
          style={{ left: `${Math.max(valPctInBar, 2) + 0.5}%` }}
        >
          {fmt(value)}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CashFlowPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [cf, setCf] = useState<QBOCashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQBOCashFlow(COMPANY_ID, startDate, endDate);
      setCf(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash flow data');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncQBOCategory(COMPANY_ID, 'cash_flow', startDate, endDate);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const getValue = (field: keyof QBOCashFlow): number =>
    cf ? ((cf[field] as number) ?? 0) : 0;

  // ── Pre-compute waterfall data with running totals ────────────────────────

  const { wfRows, scaleMin, scaleMax, ticks } = useMemo(() => {
    if (!cf)
      return { wfRows: [] as WFRow[], scaleMin: -50_000, scaleMax: 10_000, ticks: [] as number[] };

    let running = 0;
    const rows: WFRow[] = [];
    const allRunning = [0];

    for (const tmpl of TEMPLATE) {
      const rawVal = (cf[tmpl.field] as number) ?? 0;

      if (tmpl.type === 'item') {
        const before = running;
        running += rawVal;
        rows.push({
          type: 'item',
          label: tmpl.label,
          addLabel: tmpl.addLabel,
          value: rawVal,
          runBefore: before,
          runAfter: running,
        });
        allRunning.push(running);
      } else {
        running = rawVal;
        rows.push({ type: 'subtotal', label: tmpl.label, value: rawVal });
        allRunning.push(running);
      }
    }

    const min = Math.min(...allRunning);
    const max = Math.max(...allRunning);
    const range = max - min || 1;
    const pad = range * 0.12;

    const sMin = Math.min(min - pad, 0);
    const sMax = Math.max(max + pad, 0);

    const computedMin = sMin < 0 ? -niceMax(Math.abs(sMin)) : 0;
    const computedMax = sMax > 0 ? niceMax(sMax) : niceMax(10_000);

    return {
      wfRows: rows,
      scaleMin: computedMin,
      scaleMax: computedMax,
      ticks: getScaleTicks(computedMin, computedMax),
    };
  }, [cf]);

  const hasData = cf !== null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cash Flow</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cash receipts and payments — synced from QuickBooks Online
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-card shadow-sm">
            <button onClick={prevMonth} className="p-1 hover:bg-[var(--bg-sunken)] rounded">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[100px] text-center">
              {getMonthLabel(year, month)}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-[var(--bg-sunken)] rounded">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from QBO'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg p-3 text-sm text-[var(--rag-red)]">
          {error}
        </div>
      )}

      {/* Cash Flow Waterfall */}
      <Card
        className="overflow-hidden"
        style={{ height: 'calc(100vh - 280px)', minHeight: '360px' }}
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 18 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !hasData ? (
          <div className="text-center py-16 text-[var(--fg-tertiary)]">
            <p className="font-medium">No cash flow data for {getMonthLabel(year, month)}</p>
            <p className="text-sm mt-1">Click "Sync from QBO" to pull data from QuickBooks.</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto h-full">
            <div className="min-w-[700px]">
              {/* Legend + Scale Header */}
              <div className="flex items-end border-b border-[var(--border-subtle)] pb-0.5">
                <div className="w-[40%] shrink-0 flex items-center gap-4 pl-3 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-2.5 rounded-sm bg-[var(--rag-green)]" />
                    <span className="text-xs text-[var(--fg-tertiary)]">Cash Received</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-2.5 rounded-sm bg-[var(--rag-red)]" />
                    <span className="text-xs text-[var(--fg-tertiary)]">Cash Spent</span>
                  </div>
                </div>
                <div className="flex-1 relative h-6 mr-3">
                  <ScaleHeader ticks={ticks} scaleMin={scaleMin} scaleMax={scaleMax} />
                </div>
              </div>

              {/* Waterfall rows */}
              {wfRows.map((row, i) => {
                if (row.type === 'subtotal') {
                  return (
                    <WaterfallSummaryRow
                      key={i}
                      label={row.label}
                      value={row.value}
                      scaleMin={scaleMin}
                      scaleMax={scaleMax}
                      ticks={ticks}
                    />
                  );
                }
                return (
                  <WaterfallItemRow
                    key={i}
                    label={row.label}
                    addLabel={row.addLabel}
                    value={row.value}
                    runBefore={row.runBefore}
                    runAfter={row.runAfter}
                    scaleMin={scaleMin}
                    scaleMax={scaleMax}
                    ticks={ticks}
                  />
                );
              })}

              {/* Footer reconciliation */}
              <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
                  Net Cash Flow can also be calculated as:
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Change in Cash on Hand{' '}
                  <span className="font-semibold text-foreground">
                    {fmt(getValue('netCashFlow'))}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default CashFlowPage;
