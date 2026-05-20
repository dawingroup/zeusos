// ============================================================================
// GROWTH PAGE — Revenue & Expense Growth Analysis
// DawinOS v2.0 - Finance Module
//
// Shows: MoM revenue vs cost growth bar chart + top accounts by absolute growth
// Data: QBO historical P&L via usePLHistory hook
// ============================================================================

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { usePLHistory } from '../hooks/usePLHistory';
import { computeProfitability } from '../services/profitabilityEngine';
import type { ProfitabilityMetrics } from '../services/profitabilityEngine';
import { periodLabel } from '../types/forecast.types';
import type { PLAccountDetail } from '../types/forecast.types';

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number): string {
  if (!isFinite(v)) return 'N/A';
  return `${(v * 100).toFixed(1)}%`;
}

// ── Chart Tooltip ────────────────────────────────────────────────────────────

function GrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold">{fmtPct(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Classification Badge ─────────────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  revenue: 'bg-green-100 text-green-700',
  cogs: 'bg-red-100 text-red-700',
  opex: 'bg-orange-100 text-orange-700',
  depreciation: 'bg-purple-100 text-purple-700',
  interest: 'bg-blue-100 text-blue-700',
  tax: 'bg-gray-100 text-gray-700',
};

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-[360px] w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function GrowthPage() {
  const { accounts, periodData, periods, loading, error } = usePLHistory(12);
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number | null>(null);

  // Use the latest period by default
  const periodIdx = selectedPeriodIdx ?? (periods.length > 0 ? periods.length - 1 : 0);

  // Compute profitability per period
  const metricsPerPeriod = useMemo(() => {
    const result: Record<string, ProfitabilityMetrics> = {};
    for (const period of periods) {
      const pl = periodData[period]?.pl;
      if (pl) {
        result[period] = computeProfitability(pl);
      }
    }
    return result;
  }, [periodData, periods]);

  // Build bar chart data: revenue growth vs cost growth (MoM) for each month
  const barChartData = useMemo(() => {
    return periods.map((p, idx) => {
      const current = metricsPerPeriod[p];
      const prevPeriod = idx > 0 ? periods[idx - 1] : null;
      const previous = prevPeriod ? metricsPerPeriod[prevPeriod] : null;

      let revenueGrowth = 0;
      let costGrowth = 0;

      if (current && previous) {
        if (previous.revenue !== 0) {
          revenueGrowth = (current.revenue - previous.revenue) / Math.abs(previous.revenue);
        }
        const prevCosts = previous.cogs + previous.opex;
        const currCosts = current.cogs + current.opex;
        if (prevCosts !== 0) {
          costGrowth = (currCosts - prevCosts) / Math.abs(prevCosts);
        }
      }

      return {
        period: periodLabel(p),
        revenueGrowth,
        costGrowth,
      };
    }).slice(1); // Remove first period (no previous to compare against)
  }, [periods, metricsPerPeriod]);

  // Build top accounts by absolute growth
  const topAccounts = useMemo(() => {
    if (periods.length < 2) return [];
    const currentPeriod = periods[periodIdx];
    const previousPeriod = periodIdx > 0 ? periods[periodIdx - 1] : null;

    if (!currentPeriod || !previousPeriod) return [];

    return accounts
      .map((acct: PLAccountDetail) => {
        const thisMonth = acct.values[currentPeriod] ?? 0;
        const lastMonth = acct.values[previousPeriod] ?? 0;
        const momChange = thisMonth - lastMonth;
        const momPct = lastMonth !== 0 ? momChange / Math.abs(lastMonth) : null;

        return {
          label: acct.label,
          classification: acct.classification,
          thisMonth,
          lastMonth,
          momChange,
          momPct,
        };
      })
      .filter((a) => a.momChange !== 0)
      .sort((a, b) => Math.abs(b.momChange) - Math.abs(a.momChange))
      .slice(0, 20);
  }, [accounts, periods, periodIdx]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Growth Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Revenue and expense growth rates over time
          </p>
        </div>
        {periods.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Period</span>
            <select
              value={periodIdx}
              onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white font-medium"
            >
              {periods.map((p, i) => (
                <option key={p} value={i}>
                  {periodLabel(p)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {periods.length > 1 ? (
        <>
          {/* Bar Chart: Revenue vs Cost Growth */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              MoM Growth: Revenue vs Costs
            </h3>
            <div style={{ height: 360 }}>
              <SafeResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip content={<GrowthTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar
                    dataKey="revenueGrowth"
                    fill="#16a34a"
                    name="Revenue Growth"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="costGrowth"
                    fill="#dc2626"
                    name="Cost Growth"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </SafeResponsiveContainer>
            </div>
          </Card>

          {/* Top Accounts Table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">
                Top Accounts by Absolute Growth
                {periods[periodIdx] && (
                  <span className="text-gray-400 font-normal ml-1">
                    &mdash; {periodLabel(periods[periodIdx])}
                  </span>
                )}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Account
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Classification
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      This Month
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Last Month
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      MoM Change
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      MoM %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topAccounts.map((row, i) => {
                    const rowColor =
                      row.classification === 'revenue'
                        ? 'text-green-600'
                        : 'text-red-600';

                    return (
                      <tr
                        key={i}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-4 text-gray-700 font-medium truncate max-w-[200px]">
                          {row.label}
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              CLASS_COLORS[row.classification] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.classification}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right font-medium text-gray-900">
                          {fmtCurrency(row.thisMonth)}
                        </td>
                        <td className="py-2 px-4 text-right text-gray-500">
                          {fmtCurrency(row.lastMonth)}
                        </td>
                        <td className={`py-2 px-4 text-right font-semibold ${rowColor}`}>
                          {row.momChange >= 0 ? '+' : ''}
                          {fmtCurrency(row.momChange)}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {row.momPct !== null ? (
                            <span className={row.momPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {row.momPct >= 0 ? '+' : ''}
                              {fmtPct(row.momPct)}
                            </span>
                          ) : (
                            <span className="text-gray-300">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {topAccounts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No account growth data for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-gray-500">
          <p className="font-medium">Insufficient data for growth analysis</p>
          <p className="text-sm mt-1">At least 2 months of P&L data are needed.</p>
        </Card>
      )}
    </div>
  );
}

export default GrowthPage;
