// ============================================================================
// PROFITABILITY PAGE — Breakeven Analysis
// ZeusOS v2.0 - Finance Module
//
// Shows: KPI cards (GP, Op Profit, EBIT) + Breakeven chart + Summary sidebar
// Data: QBO historical P&L via getDetailedPLHistory()
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Customized,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { getDetailedPLHistory } from '../services/forecastService';
import type { HistoricalPeriodData } from '../services/forecastService';
import { computeBreakeven, computeProfitability } from '../services/profitabilityEngine';
import type { BreakevenResult, ProfitabilityMetrics } from '../services/profitabilityEngine';
import { periodLabel } from '../types/forecast.types';
import type { PLAccountDetail } from '../types/forecast.types';

const COMPANY_ID = 'dawinos';
const HIST_MONTHS = 12;

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function fmtFull(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

// ── Top Accounts Expandable List ─────────────────────────────────────────────

function TopAccountsList({ items, color }: {
  items: { label: string; amount: number }[];
  color: string;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs font-medium ${color} hover:underline mt-1 flex items-center gap-1`}
      >
        {open ? 'Hide' : 'View'} top {items.length} accounts
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 pl-1">
          {items.map((a, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-600 truncate mr-2">{a.label}</span>
              <span className="font-medium text-gray-900 whitespace-nowrap">{fmtFull(Math.abs(a.amount))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Breakeven Summary Sidebar ────────────────────────────────────────────────

function BreakevenSummary({ be, prof, topRevenue, topCosts }: {
  be: BreakevenResult;
  prof: ProfitabilityMetrics;
  topRevenue: { label: string; amount: number }[];
  topCosts: { label: string; amount: number }[];
}) {
  const isNegSafety = be.marginOfSafety < 0;

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold text-gray-900">Breakeven</h3>

      {/* Revenue */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">REVENUE</span>
        </div>
        <p className="text-xl font-bold text-gray-900 mt-1">{fmtFull(prof.revenue)}</p>
        <TopAccountsList items={topRevenue} color="text-green-600" />
      </div>

      {/* Total Costs */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TOTAL COSTS</span>
        </div>
        <p className="text-xl font-bold text-gray-900 mt-1">{fmtFull(be.totalCosts)}</p>
        <TopAccountsList items={topCosts} color="text-red-600" />
      </div>

      {/* Breakeven Point */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">BREAKEVEN POINT</span>
        </div>
        <p className="text-xl font-bold text-gray-900 mt-1">
          {isFinite(be.breakevenRevenue) ? fmtFull(be.breakevenRevenue) : 'N/A'}
        </p>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">MARGIN OF SAFETY</p>
        <p className={`text-xl font-bold mt-1 ${isNegSafety ? 'text-red-600' : 'text-green-600'}`}>
          {isNegSafety ? '-' : ''}{fmtFull(Math.abs(be.marginOfSafety))}
        </p>
      </div>

      <div className="border-t pt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
            VARIABLE COSTS
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {fmtPct(be.variableCostRatio)} per unit of Revenue
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            FIXED COSTS
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {fmtFull(be.fixedCosts)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold">{fmtCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Chart Markers (SVG) — dots + pill labels via Customized ─────────────────

interface MarkerDef {
  dataX: number;
  dataY: number;
  label: string;
  fill: string;
  r: number;
}

function ChartMarkers({ xAxisMap, yAxisMap, markers }: {
  xAxisMap?: Record<string, { scale: (v: number) => number }>;
  yAxisMap?: Record<string, { scale: (v: number) => number }>;
  markers: MarkerDef[];
}) {
  const xAxis = xAxisMap && (Object.values(xAxisMap)[0] as { scale: (v: number) => number } | undefined);
  const yAxis = yAxisMap && (Object.values(yAxisMap)[0] as { scale: (v: number) => number } | undefined);
  if (!xAxis?.scale || !yAxis?.scale) return null;

  return (
    <g>
      {markers.map((m, i) => {
        const cx = xAxis.scale(m.dataX);
        const cy = yAxis.scale(m.dataY);
        if (isNaN(cx) || isNaN(cy)) return null;
        const pillW = m.label.length * 6.5 + 18;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={m.r} fill={m.fill} stroke="#fff" strokeWidth={2.5} />
            <rect x={cx - pillW / 2} y={cy - 30} width={pillW} height={20} rx={10} fill={m.fill} />
            <text x={cx} y={cy - 17} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700} fontFamily="system-ui">
              {m.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function ProfitabilityPage() {
  const [periodData, setPeriodData] = useState<Record<string, HistoricalPeriodData>>({});
  const [accounts, setAccounts] = useState<PLAccountDetail[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const now = new Date();
        const firstFP = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const { periodData: pd, accounts: accts } = await getDetailedPLHistory(COMPANY_ID, HIST_MONTHS, firstFP);
        setPeriodData(pd);
        setAccounts(accts);
        const sorted = Object.keys(pd).sort();
        setPeriods(sorted);
        setSelectedPeriod(sorted[sorted.length - 1] ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const actuals = useMemo(() => periodData[selectedPeriod]?.pl ?? null, [periodData, selectedPeriod]);
  const prof = useMemo(() => actuals ? computeProfitability(actuals) : null, [actuals]);
  const be = useMemo(() => actuals ? computeBreakeven(actuals) : null, [actuals]);

  const topRevenue = useMemo(() => {
    if (!selectedPeriod || !accounts.length) return [];
    return accounts
      .filter(a => a.classification === 'revenue')
      .map(a => ({ label: a.label, amount: a.values[selectedPeriod] ?? 0 }))
      .filter(a => a.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 10);
  }, [accounts, selectedPeriod]);

  const topCosts = useMemo(() => {
    if (!selectedPeriod || !accounts.length) return [];
    return accounts
      .filter(a => a.classification === 'cogs' || a.classification === 'opex')
      .map(a => ({ label: a.label, amount: a.values[selectedPeriod] ?? 0 }))
      .filter(a => a.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 10);
  }, [accounts, selectedPeriod]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Profitability</h2>
          <p className="text-sm text-gray-500 mt-0.5">Loading analysis...</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Profitability</h2>
          <p className="text-sm text-gray-500 mt-0.5">Breakeven analysis & cost structure</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">For the Month of</span>
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white font-medium"
          >
            {periods.map(p => (
              <option key={p} value={p}>{periodLabel(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {prof && be && (
        <>
          {/* KPI Cards */}
          <KPIGrid cols={3}>
            <KPICard
              label="Gross Profit"
              value={`${prof.grossProfit < 0 ? '-' : ''}${fmtCurrency(Math.abs(prof.grossProfit))}`}
              trend={prof.grossProfit >= 0 ? 'up' : 'down'}
            />
            <KPICard
              label="Operating Profit"
              value={`${prof.operatingProfit < 0 ? '-' : ''}${fmtCurrency(Math.abs(prof.operatingProfit))}`}
              trend={prof.operatingProfit >= 0 ? 'up' : 'down'}
            />
            <KPICard
              label="EBIT"
              value={`${prof.ebit < 0 ? '-' : ''}${fmtCurrency(Math.abs(prof.ebit))}`}
              trend={prof.ebit >= 0 ? 'up' : 'down'}
            />
          </KPIGrid>

          {/* Chart + Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Chart — square aspect ratio */}
            <Card className="lg:col-span-3 p-5">
              <div className="w-full" style={{ height: 'calc(100vh - 380px)', minHeight: '360px' }}>
              <SafeResponsiveContainer width="100%" height="100%">
                <ComposedChart data={be.chartData} margin={{ top: 30, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="revenue"
                    tickFormatter={fmtCurrency}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tickFormatter={fmtCurrency}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip content={<ChartTooltip />} />

                  {/* Loss zone: area between totalCosts and revenueLine up to breakeven */}
                  <Area
                    dataKey="totalCosts"
                    fill="#fecaca"
                    fillOpacity={0.3}
                    stroke="none"
                    name="Loss Zone"
                  />

                  {/* Revenue line (green) */}
                  <Line
                    dataKey="revenueLine"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={false}
                    name="Revenue"
                  />

                  {/* Total Costs line (red) */}
                  <Line
                    dataKey="totalCosts"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    dot={false}
                    name="Total Costs"
                  />

                  {/* Variable Costs line */}
                  <Line
                    dataKey="variableCosts"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Variable Costs"
                  />

                  {/* Fixed Costs line (horizontal) */}
                  <Line
                    dataKey="fixedCosts"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="8 4"
                    dot={false}
                    name="Fixed Costs"
                  />

                  {/* Dot + pill markers rendered via Customized for reliable positioning */}
                  <Customized
                    component={
                      <ChartMarkers markers={[
                        ...(isFinite(be.breakevenRevenue) ? [{
                          dataX: be.breakevenRevenue,
                          dataY: be.breakevenRevenue,
                          label: `BEP ${fmtCurrency(be.breakevenRevenue)}`,
                          fill: '#374151',
                          r: 8,
                        }] : []),
                        {
                          dataX: prof.revenue,
                          dataY: prof.revenue,
                          label: `REVENUE ${fmtCurrency(prof.revenue)}`,
                          fill: '#22c55e',
                          r: 6,
                        },
                        {
                          dataX: prof.revenue,
                          dataY: be.fixedCosts + be.variableCostRatio * prof.revenue,
                          label: `COSTS ${fmtCurrency(be.totalCosts)}`,
                          fill: '#ef4444',
                          r: 5,
                        },
                        {
                          dataX: prof.revenue * 0.5,
                          dataY: be.fixedCosts,
                          label: `FIXED ${fmtCurrency(be.fixedCosts)}`,
                          fill: '#f59e0b',
                          r: 4,
                        },
                      ]} />
                    }
                  />
                </ComposedChart>
              </SafeResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-3 justify-center text-[10px]">
                {[
                  { color: 'bg-green-500', label: 'REVENUE' },
                  { color: 'bg-red-500', label: 'TOTAL COSTS' },
                  { color: 'bg-orange-500', label: 'VARIABLE COSTS' },
                  { color: 'bg-amber-500', label: 'FIXED COSTS' },
                ].map(l => (
                  <span key={l.label} className="flex items-center gap-1.5 text-gray-500">
                    <span className={`w-3 h-1.5 rounded-sm ${l.color}`} />
                    {l.label}
                  </span>
                ))}
              </div>
            </Card>

            {/* Summary Sidebar */}
            <Card className="p-5">
              <BreakevenSummary be={be} prof={prof} topRevenue={topRevenue} topCosts={topCosts} />
            </Card>
          </div>
        </>
      )}

      {!prof && !loading && (
        <Card className="p-8 text-center text-gray-500">
          <p className="font-medium">No P&L data for the selected period</p>
          <p className="text-sm mt-1">Select a different month or sync QBO data from Integrations.</p>
        </Card>
      )}
    </div>
  );
}

export default ProfitabilityPage;
