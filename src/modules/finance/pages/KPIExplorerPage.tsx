// ============================================================================
// KPI EXPLORER PAGE — Radial KPI Overview + Deep-Dive
// ZeusOS v2.0 - Finance Module
//
// Radial SVG visualization of all KPIs with on-track/off-track status.
// Click a tile to drill into time-series chart + account breakdown.
// ============================================================================

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { usePLHistory } from '../hooks/usePLHistory';
import { computeProfitability } from '../services/profitabilityEngine';
import type { ProfitabilityMetrics } from '../services/profitabilityEngine';
import { periodLabel } from '../types/forecast.types';
import type { PLAccountDetail } from '../types/forecast.types';

// ── KPI Definitions ──────────────────────────────────────────────────────────

interface KPIDefinition {
  id: string;
  label: string;
  shortLabel: string;
  isPercentage: boolean;
  /** true = higher is better; false = lower is better (e.g. COGS ratio) */
  higherIsBetter: boolean;
  compute: (m: ProfitabilityMetrics) => number;
  relevantClassifications: PLAccountDetail['classification'][];
}

const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    id: 'grossMargin',
    label: 'Gross Margin',
    shortLabel: 'Gross Margin',
    isPercentage: true,
    higherIsBetter: true,
    compute: (m) => (m.revenue !== 0 ? m.grossProfit / m.revenue : 0),
    relevantClassifications: ['revenue', 'cogs'],
  },
  {
    id: 'operatingMargin',
    label: 'Operating Margin',
    shortLabel: 'Op. Margin',
    isPercentage: true,
    higherIsBetter: true,
    compute: (m) => (m.revenue !== 0 ? m.operatingProfit / m.revenue : 0),
    relevantClassifications: ['revenue', 'cogs', 'opex'],
  },
  {
    id: 'netMargin',
    label: 'Net Margin',
    shortLabel: 'Net Margin',
    isPercentage: true,
    higherIsBetter: true,
    compute: (m) => (m.revenue !== 0 ? m.netProfit / m.revenue : 0),
    relevantClassifications: ['revenue', 'cogs', 'opex', 'depreciation', 'interest', 'tax'],
  },
  {
    id: 'ebitdaMargin',
    label: 'EBITDA Margin',
    shortLabel: 'EBITDA',
    isPercentage: true,
    higherIsBetter: true,
    compute: (m) => (m.revenue !== 0 ? m.ebitda / m.revenue : 0),
    relevantClassifications: ['revenue', 'cogs', 'opex'],
  },
  {
    id: 'revenue',
    label: 'Revenue',
    shortLabel: 'Revenue',
    isPercentage: false,
    higherIsBetter: true,
    compute: (m) => m.revenue,
    relevantClassifications: ['revenue'],
  },
  {
    id: 'cogsRatio',
    label: 'COGS Ratio',
    shortLabel: 'COGS Ratio',
    isPercentage: true,
    higherIsBetter: false,
    compute: (m) => (m.revenue !== 0 ? m.cogs / m.revenue : 0),
    relevantClassifications: ['revenue', 'cogs'],
  },
];

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function fmtPctShort(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function fmtCompact(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

// ── Radial KPI Visualization ─────────────────────────────────────────────────

interface KPIStatus {
  def: KPIDefinition;
  currentValue: number;
  previousValue: number | null;
  onTrack: boolean;
}

const CX = 200;
const CY = 200;
const RADIUS = 135;
const TILE_W = 64;
const TILE_H = 44;

function RadialKPIExplorer({
  kpis,
  selectedId,
  onSelect,
  latestPeriod,
  onTrackCount,
}: {
  kpis: KPIStatus[];
  selectedId: string;
  onSelect: (id: string) => void;
  latestPeriod: string;
  onTrackCount: number;
}) {
  const totalKpis = kpis.length;
  const onTrackPct = totalKpis > 0 ? Math.round((onTrackCount / totalKpis) * 100) : 0;

  // Arc for the center donut
  const arcAngle = (onTrackPct / 100) * 360;
  const arcRad = (arcAngle * Math.PI) / 180;
  const arcR = 42;
  const arcEndX = CX + arcR * Math.sin(arcRad);
  const arcEndY = CY - arcR * Math.cos(arcRad);
  const largeArc = arcAngle > 180 ? 1 : 0;

  return (
    <div className="flex items-center justify-center">
      <svg width="400" height="400" viewBox="0 0 400 400" className="overflow-visible">
        {/* Background track circle */}
        <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth="1.5" />

        {/* Connecting lines from center to tiles */}
        {kpis.map((kpi, i) => {
          const angle = (i / totalKpis) * 2 * Math.PI - Math.PI / 2;
          const tx = CX + RADIUS * Math.cos(angle);
          const ty = CY + RADIUS * Math.sin(angle);
          return (
            <line
              key={`line-${kpi.def.id}`}
              x1={CX}
              y1={CY}
              x2={tx}
              y2={ty}
              stroke="#f3f4f6"
              strokeWidth="1"
            />
          );
        })}

        {/* Center donut */}
        <circle cx={CX} cy={CY} r={arcR} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        {onTrackPct > 0 && (
          <path
            d={`M ${CX} ${CY - arcR} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEndX} ${arcEndY}`}
            fill="none"
            stroke={onTrackCount > totalKpis / 2 ? '#22c55e' : '#ef4444'}
            strokeWidth="6"
            strokeLinecap="round"
          />
        )}

        {/* Center text */}
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">
          {onTrackPct}%
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fontWeight="600" fill="#9ca3af">
          ON TRACK
        </text>
        <text x={CX} y={CY + 23} textAnchor="middle" fontSize="8" fill="#d1d5db">
          {periodLabel(latestPeriod)}
        </text>

        {/* KPI Tiles */}
        {kpis.map((kpi, i) => {
          const angle = (i / totalKpis) * 2 * Math.PI - Math.PI / 2;
          const tx = CX + RADIUS * Math.cos(angle);
          const ty = CY + RADIUS * Math.sin(angle);
          const isSelected = selectedId === kpi.def.id;
          const fillColor = kpi.onTrack ? '#22c55e' : '#ef4444';
          const valueStr = kpi.def.isPercentage
            ? fmtPctShort(kpi.currentValue)
            : fmtCompact(kpi.currentValue);

          // Label position: push outward from tile
          const labelDist = RADIUS + 52;
          const lx = CX + labelDist * Math.cos(angle);
          const ly = CY + labelDist * Math.sin(angle);
          const isRight = Math.cos(angle) >= 0;

          return (
            <g
              key={kpi.def.id}
              className="cursor-pointer"
              onClick={() => onSelect(kpi.def.id)}
            >
              {/* Selection ring */}
              {isSelected && (
                <rect
                  x={tx - TILE_W / 2 - 3}
                  y={ty - TILE_H / 2 - 3}
                  width={TILE_W + 6}
                  height={TILE_H + 6}
                  rx={8}
                  fill="none"
                  stroke={fillColor}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              )}

              {/* Tile background */}
              <rect
                x={tx - TILE_W / 2}
                y={ty - TILE_H / 2}
                width={TILE_W}
                height={TILE_H}
                rx={6}
                fill={fillColor}
                className="transition-opacity hover:opacity-90"
              />

              {/* Value inside tile */}
              <text
                x={tx}
                y={ty + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="700"
                fill="white"
              >
                {valueStr}
              </text>

              {/* Status indicator */}
              <text
                x={tx}
                y={ty + 14}
                textAnchor="middle"
                fontSize="7"
                fontWeight="600"
                fill="rgba(255,255,255,0.8)"
              >
                {kpi.onTrack ? 'ON TRACK' : 'OFF TRACK'}
              </text>

              {/* Radiating label */}
              <text
                x={lx}
                y={ly}
                textAnchor={isRight ? 'start' : 'end'}
                dominantBaseline="middle"
                fontSize="10"
                fontWeight="600"
                fill="#6b7280"
                className="select-none"
              >
                {kpi.def.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  isPercentage,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  isPercentage: boolean;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-lg shadow-lg p-2 text-xs">
      <span className="font-semibold">{isPercentage ? fmtPct(v) : fmtCurrency(v)}</span>
    </div>
  );
}

// ── Account Breakdown Panel ──────────────────────────────────────────────────

function AccountBreakdownPanel({
  accounts,
  period,
  classifications,
}: {
  accounts: PLAccountDetail[];
  period: string;
  classifications: PLAccountDetail['classification'][];
}) {
  const filtered = useMemo(() => {
    return accounts
      .filter((a) => classifications.includes(a.classification))
      .map((a) => ({
        label: a.label,
        classification: a.classification,
        value: a.values[period] ?? 0,
      }))
      .filter((a) => a.value !== 0)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [accounts, period, classifications]);

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-[var(--fg-tertiary)] py-4 text-center">
        No account detail for this period.
      </p>
    );
  }

  const classColors: Record<string, string> = {
    revenue: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
    cogs: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
    opex: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
    depreciation: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
    interest: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
    tax: 'bg-[var(--bg-sunken)] text-muted-foreground',
  };

  return (
    <div className="divide-y divide-[var(--border-subtle)] max-h-64 overflow-y-auto">
      {filtered.map((a, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 px-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${classColors[a.classification] ?? 'bg-[var(--bg-sunken)] text-muted-foreground'}`}
            >
              {a.classification}
            </span>
            <span className="text-muted-foreground truncate">{a.label}</span>
          </div>
          <span className="font-medium text-foreground whitespace-nowrap ml-2">
            {fmtCurrency(a.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-7 w-48" />
      <div className="flex justify-center">
        <Skeleton className="h-[400px] w-[400px] rounded-full" />
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function KPIExplorerPage() {
  const { accounts, periodData, periods, loading, error } = usePLHistory(12);
  const [selectedKPI, setSelectedKPI] = useState(KPI_DEFINITIONS[0].id);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const kpiDef = KPI_DEFINITIONS.find((d) => d.id === selectedKPI)!;

  // Compute profitability metrics per period
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

  // KPI status for radial visualization
  const { kpiStatuses, onTrackCount } = useMemo(() => {
    const latestPeriod = periods[periods.length - 1];
    const prevPeriod = periods.length >= 2 ? periods[periods.length - 2] : null;
    const latestMetrics = latestPeriod ? metricsPerPeriod[latestPeriod] : null;
    const prevMetrics = prevPeriod ? metricsPerPeriod[prevPeriod] : null;

    const statuses: KPIStatus[] = KPI_DEFINITIONS.map((def) => {
      const currentValue = latestMetrics ? def.compute(latestMetrics) : 0;
      const previousValue = prevMetrics ? def.compute(prevMetrics) : null;

      // On track: improving or positive (depending on KPI type)
      let onTrack = false;
      if (previousValue !== null) {
        const delta = currentValue - previousValue;
        onTrack = def.higherIsBetter ? delta >= 0 : delta <= 0;
      } else {
        onTrack = def.higherIsBetter ? currentValue > 0 : currentValue < 0.5;
      }

      return { def, currentValue, previousValue, onTrack };
    });

    return {
      kpiStatuses: statuses,
      onTrackCount: statuses.filter((s) => s.onTrack).length,
    };
  }, [metricsPerPeriod, periods]);

  // Build chart data for selected KPI
  const chartData = useMemo(() => {
    return periods.map((p) => ({
      period: p,
      label: periodLabel(p),
      value: metricsPerPeriod[p] ? kpiDef.compute(metricsPerPeriod[p]) : 0,
    }));
  }, [periods, metricsPerPeriod, kpiDef]);

  // Build detail table data
  const tableData = useMemo(() => {
    return periods.map((p, idx) => {
      const current = metricsPerPeriod[p] ? kpiDef.compute(metricsPerPeriod[p]) : 0;
      const prevPeriod = idx > 0 ? periods[idx - 1] : null;
      const previous =
        prevPeriod && metricsPerPeriod[prevPeriod]
          ? kpiDef.compute(metricsPerPeriod[prevPeriod])
          : null;

      const momChange = previous !== null ? current - previous : null;
      const momPct =
        previous !== null && previous !== 0
          ? (current - previous) / Math.abs(previous)
          : null;

      return { period: p, value: current, momChange, momPct };
    });
  }, [periods, metricsPerPeriod, kpiDef]);

  if (loading) return <LoadingSkeleton />;

  const latestPeriod = periods[periods.length - 1] ?? '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">KPI Explorer</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Click a KPI tile to explore its trend and account breakdown
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg p-3 text-sm text-[var(--rag-red)]">
          {error}
        </div>
      )}

      {periods.length > 0 ? (
        <>
          {/* Radial KPI Overview */}
          <Card className="py-6 px-4">
            <RadialKPIExplorer
              kpis={kpiStatuses}
              selectedId={selectedKPI}
              onSelect={(id) => {
                setSelectedKPI(id);
                setSelectedRow(null);
              }}
              latestPeriod={latestPeriod}
              onTrackCount={onTrackCount}
            />
          </Card>

          {/* Selected KPI Detail: Chart + Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Line Chart */}
            <Card className="lg:col-span-2 p-5">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {kpiDef.label} Over Time
              </h3>
              <div style={{ height: 260 }}>
                <SafeResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      tickFormatter={(v: number) =>
                        kpiDef.isPercentage ? `${(v * 100).toFixed(0)}%` : fmtCompact(v)
                      }
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip
                      content={<ChartTooltipContent isPercentage={kpiDef.isPercentage} />}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#16a34a' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </SafeResponsiveContainer>
              </div>
            </Card>

            {/* Account Breakdown */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Account Breakdown
                {selectedRow && (
                  <span className="text-[var(--fg-tertiary)] font-normal ml-1">
                    &mdash; {periodLabel(selectedRow)}
                  </span>
                )}
              </h3>
              {selectedRow ? (
                <AccountBreakdownPanel
                  accounts={accounts}
                  period={selectedRow}
                  classifications={kpiDef.relevantClassifications}
                />
              ) : (
                <p className="text-sm text-[var(--fg-tertiary)] py-8 text-center">
                  Click a row in the table to see the account-level breakdown.
                </p>
              )}
            </Card>
          </div>

          {/* Detail Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Period
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Value
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      MoM Change
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      MoM %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row) => {
                    const isSelected = selectedRow === row.period;
                    return (
                      <tr
                        key={row.period}
                        onClick={() => setSelectedRow(isSelected ? null : row.period)}
                        className={`border-b border-[var(--border-subtle)] cursor-pointer transition-colors ${
                          isSelected ? 'bg-[var(--rag-green-soft)]' : 'hover:bg-[var(--bg-sunken)]'
                        }`}
                      >
                        <td className="py-2 px-4 text-muted-foreground font-medium">
                          {periodLabel(row.period)}
                        </td>
                        <td className="py-2 px-4 text-right font-semibold text-foreground">
                          {kpiDef.isPercentage ? fmtPct(row.value) : fmtCurrency(row.value)}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {row.momChange !== null ? (
                            <span
                              className={
                                row.momChange >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
                              }
                            >
                              {row.momChange >= 0 ? '+' : ''}
                              {kpiDef.isPercentage
                                ? `${(row.momChange * 100).toFixed(2)}pp`
                                : fmtCurrency(row.momChange)}
                            </span>
                          ) : (
                            <span className="text-[var(--fg-tertiary)]">&mdash;</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {row.momPct !== null ? (
                            <span
                              className={
                                row.momPct >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
                              }
                            >
                              {row.momPct >= 0 ? '+' : ''}
                              {(row.momPct * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[var(--fg-tertiary)]">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="font-medium">No P&L data available</p>
          <p className="text-sm mt-1">
            Sync QBO data from Finance &gt; Settings &gt; Integrations.
          </p>
        </Card>
      )}
    </div>
  );
}

export default KPIExplorerPage;
