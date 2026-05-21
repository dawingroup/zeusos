// ============================================================================
// KPIs PAGE — Financial KPI Dashboard
// ZeusOS v2.0 - Finance Module
//
// Shows 6 core financial KPIs with sparklines and MoM change indicators.
// Data: QBO historical P&L via usePLHistory hook.
// ============================================================================

import { useMemo } from 'react';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard as SharedKPICard } from '@/shared/components/data-display';
import { usePLHistory } from '../hooks/usePLHistory';
import { computeProfitability } from '../services/profitabilityEngine';
import type { ProfitabilityMetrics } from '../services/profitabilityEngine';
import { periodLabel } from '../types/forecast.types';

// ── KPI Definitions ──────────────────────────────────────────────────────────

interface KPIDefinition {
  id: string;
  label: string;
  isPercentage: boolean;
  compute: (m: ProfitabilityMetrics) => number;
}

const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    id: 'grossMargin',
    label: 'Gross Margin',
    isPercentage: true,
    compute: (m) => m.revenue !== 0 ? m.grossProfit / m.revenue : 0,
  },
  {
    id: 'operatingMargin',
    label: 'Operating Margin',
    isPercentage: true,
    compute: (m) => m.revenue !== 0 ? m.operatingProfit / m.revenue : 0,
  },
  {
    id: 'netMargin',
    label: 'Net Margin',
    isPercentage: true,
    compute: (m) => m.revenue !== 0 ? m.netProfit / m.revenue : 0,
  },
  {
    id: 'ebitdaMargin',
    label: 'EBITDA Margin',
    isPercentage: true,
    compute: (m) => m.revenue !== 0 ? m.ebitda / m.revenue : 0,
  },
  {
    id: 'revenue',
    label: 'Revenue',
    isPercentage: false,
    compute: (m) => m.revenue,
  },
  {
    id: 'cogsRatio',
    label: 'COGS Ratio',
    isPercentage: true,
    compute: (m) => m.revenue !== 0 ? m.cogs / m.revenue : 0,
  },
];

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function fmtChange(current: number, previous: number, isPercentage: boolean): { label: string; color: string } {
  if (previous === 0) return { label: 'N/A', color: 'text-gray-400' };
  const diff = current - previous;
  const pctChange = diff / Math.abs(previous);
  const sign = diff >= 0 ? '+' : '';
  const color = diff >= 0 ? 'text-green-600' : 'text-red-600';

  if (isPercentage) {
    return { label: `${sign}${(diff * 100).toFixed(1)}pp`, color };
  }
  return { label: `${sign}${(pctChange * 100).toFixed(1)}%`, color };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  definition: KPIDefinition;
  sparklineData: { value: number }[];
  currentValue: number;
  previousValue: number | null;
}

function KPICard({ definition, sparklineData, currentValue, previousValue }: KPICardProps) {
  const formattedValue = definition.isPercentage
    ? fmtPct(currentValue)
    : fmtCurrency(currentValue);

  const change = previousValue !== null
    ? fmtChange(currentValue, previousValue, definition.isPercentage)
    : null;

  // Determine sparkline color based on trend direction
  const first = sparklineData[0]?.value ?? 0;
  const last = sparklineData[sparklineData.length - 1]?.value ?? 0;
  const trendUp = last >= first;
  // For COGS ratio, up is bad
  const isInverse = definition.id === 'cogsRatio';
  const lineColor = (trendUp && !isInverse) || (!trendUp && isInverse)
    ? '#16a34a'
    : '#dc2626';

  // Map to shared KPICard trend prop
  const trend = change
    ? (change.color.includes('green') ? 'up' : change.color.includes('red') ? 'down' : 'flat')
    : undefined;

  return (
    <SharedKPICard
      label={definition.label}
      value={formattedValue}
      delta={change ? `MoM: ${change.label}` : undefined}
      trend={trend}
      spark={sparklineData.length > 1 ? sparklineData.map((d) => d.value) : undefined}
      sparkColor={lineColor}
    />
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-5 w-24 mb-3" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function KPIsPage() {
  const { periodData, periods, loading, error } = usePLHistory(12);

  // Compute profitability metrics for each period
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

  // Build KPI data for each definition
  const kpiData = useMemo(() => {
    return KPI_DEFINITIONS.map((def) => {
      const sparklineData = periods.map((p) => ({
        value: metricsPerPeriod[p] ? def.compute(metricsPerPeriod[p]) : 0,
      }));

      const latestPeriod = periods[periods.length - 1];
      const previousPeriod = periods.length >= 2 ? periods[periods.length - 2] : null;

      const currentValue = latestPeriod && metricsPerPeriod[latestPeriod]
        ? def.compute(metricsPerPeriod[latestPeriod])
        : 0;

      const previousValue = previousPeriod && metricsPerPeriod[previousPeriod]
        ? def.compute(metricsPerPeriod[previousPeriod])
        : null;

      return { definition: def, sparklineData, currentValue, previousValue };
    });
  }, [metricsPerPeriod, periods]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Financial KPIs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Key financial ratios and performance metrics
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

      {/* KPI Grid */}
      {periods.length > 0 ? (
        <KPIGrid cols={3}>
          {kpiData.map((kpi) => (
            <KPICard
              key={kpi.definition.id}
              definition={kpi.definition}
              sparklineData={kpi.sparklineData}
              currentValue={kpi.currentValue}
              previousValue={kpi.previousValue}
            />
          ))}
        </KPIGrid>
      ) : (
        <Card className="p-8 text-center text-gray-500">
          <p className="font-medium">No P&L data available</p>
          <p className="text-sm mt-1">Sync QBO data from Finance &gt; Settings &gt; Integrations.</p>
        </Card>
      )}
    </div>
  );
}

export default KPIsPage;
