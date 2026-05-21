// ============================================================================
// TREND PAGE — Time-Series Trend Analysis
// ZeusOS v2.0 - Finance Module
//
// Shows: Multi-line chart (revenue, cogs, opex, net profit) + sparkline table
//        for every PLAccountDetail with non-zero values.
// Data: QBO historical P&L via usePLHistory hook
// ============================================================================

import { useMemo } from 'react';
import {
  LineChart,
  Line,
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
import { periodLabel } from '../types/forecast.types';
import type { PLAccountDetail } from '../types/forecast.types';

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtCompact(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

// ── Classification Colors ────────────────────────────────────────────────────

const CLASS_BADGE_COLORS: Record<string, string> = {
  revenue: 'bg-green-100 text-green-700',
  cogs: 'bg-red-100 text-red-700',
  opex: 'bg-orange-100 text-orange-700',
  depreciation: 'bg-purple-100 text-purple-700',
  interest: 'bg-blue-100 text-blue-700',
  tax: 'bg-gray-100 text-gray-700',
};

const CLASS_SORT_ORDER: Record<string, number> = {
  revenue: 0,
  cogs: 1,
  opex: 2,
  depreciation: 3,
  interest: 4,
  tax: 5,
};

// ── Chart Tooltip ────────────────────────────────────────────────────────────

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; stroke: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold">{fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Mini Sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ data, color }: { data: { value: number }[]; color: string }) {
  if (data.length < 2) return <span className="text-gray-300 text-xs">--</span>;

  return (
    <div style={{ width: 80, height: 24 }}>
      <SafeResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </SafeResponsiveContainer>
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-[400px] w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function TrendPage() {
  const { accounts, periodData, periods, loading, error } = usePLHistory(12);

  // Build main chart data: revenue, cogs, opex, netProfit per period
  const mainChartData = useMemo(() => {
    return periods.map((p) => {
      const pl = periodData[p]?.pl;
      if (!pl) {
        return { label: periodLabel(p), revenue: 0, cogs: 0, opex: 0, netProfit: 0 };
      }
      const metrics = computeProfitability(pl);
      return {
        label: periodLabel(p),
        revenue: metrics.revenue,
        cogs: metrics.cogs,
        opex: metrics.opex,
        netProfit: metrics.netProfit,
      };
    });
  }, [periodData, periods]);

  // Build sparkline table data: sorted by classification, then label
  const sparklineRows = useMemo(() => {
    return accounts
      .filter((acct: PLAccountDetail) => {
        // Include accounts with at least one non-zero value
        return Object.values(acct.values).some((v) => v !== 0);
      })
      .map((acct: PLAccountDetail) => {
        const sparkData = periods.map((p) => ({
          value: acct.values[p] ?? 0,
        }));
        const total = periods.reduce((sum, p) => sum + (acct.values[p] ?? 0), 0);

        // Sparkline color based on classification
        const colorMap: Record<string, string> = {
          revenue: '#16a34a',
          cogs: '#dc2626',
          opex: '#ea580c',
          depreciation: '#9333ea',
          interest: '#2563eb',
          tax: '#6b7280',
        };

        return {
          id: acct.id,
          label: acct.label,
          classification: acct.classification,
          sparkData,
          total,
          lineColor: colorMap[acct.classification] ?? '#6b7280',
        };
      })
      .sort((a, b) => {
        const classSort =
          (CLASS_SORT_ORDER[a.classification] ?? 99) -
          (CLASS_SORT_ORDER[b.classification] ?? 99);
        if (classSort !== 0) return classSort;
        return a.label.localeCompare(b.label);
      });
  }, [accounts, periods]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Trend Analysis</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Time-series trends across all P&L accounts
          {periods.length > 0 && (
            <span className="ml-1">
              ({periodLabel(periods[0])} &ndash; {periodLabel(periods[periods.length - 1])})
            </span>
          )}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {periods.length > 0 ? (
        <>
          {/* Main Multi-Line Chart */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Revenue, COGS, OpEx &amp; Net Profit
            </h3>
            <div style={{ height: 400 }}>
              <SafeResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mainChartData}
                  margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tickFormatter={fmtCompact}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cogs"
                    name="COGS"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="opex"
                    name="OpEx"
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="Net Profit"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                  />
                </LineChart>
              </SafeResponsiveContainer>
            </div>
          </Card>

          {/* Sparkline Table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">
                Per-Account Trends
                <span className="text-gray-400 font-normal ml-1">
                  ({sparklineRows.length} accounts)
                </span>
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
                    <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                      12-Month Trend
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sparklineRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-1.5 px-4 text-gray-700 truncate max-w-[240px]">
                        {row.label}
                      </td>
                      <td className="py-1.5 px-4">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            CLASS_BADGE_COLORS[row.classification] ??
                            'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {row.classification}
                        </span>
                      </td>
                      <td className="py-1.5 px-4 flex justify-center">
                        <MiniSparkline data={row.sparkData} color={row.lineColor} />
                      </td>
                      <td className="py-1.5 px-4 text-right font-medium text-gray-900">
                        {fmtCurrency(row.total)}
                      </td>
                    </tr>
                  ))}
                  {sparklineRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        No account data available.
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
          <p className="font-medium">No P&L data available</p>
          <p className="text-sm mt-1">Sync QBO data from Finance &gt; Settings &gt; Integrations.</p>
        </Card>
      )}
    </div>
  );
}

export default TrendPage;
