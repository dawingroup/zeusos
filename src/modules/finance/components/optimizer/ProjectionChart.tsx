// ============================================================================
// PROJECTION CHART
// Area chart showing 90-day cash flow projections with confidence bands
// ============================================================================

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import type { DailySnapshot, CashFlowProjection } from '../../types/optimizer.types';

interface ProjectionChartProps {
  projection: CashFlowProjection | null;
  bufferAmount?: number;
  height?: number;
  className?: string;
}

interface ChartDataPoint {
  date: string;
  label: string;
  balance: number;
  inflow: number;
  outflow: number;
  upper: number;
  lower: number;
  isCrisis: boolean;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{formatUGX(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function ProjectionChart({
  projection,
  bufferAmount = 5_000_000,
  height = 400,
  className = '',
}: ProjectionChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!projection?.dailySnapshots?.length) return [];

    return projection.dailySnapshots.map((snap: DailySnapshot) => {
      const confidenceMargin = snap.closingBalance * 0.1;
      return {
        date: snap.date,
        label: new Date(snap.date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' }),
        balance: snap.closingBalance,
        inflow: snap.totalProjectedInflow,
        outflow: snap.totalProjectedOutflow,
        upper: snap.closingBalance + confidenceMargin,
        lower: Math.max(0, snap.closingBalance - confidenceMargin),
        isCrisis: snap.closingBalance < bufferAmount,
      };
    });
  }, [projection, bufferAmount]);

  if (!chartData.length) {
    return (
      <div className={`flex items-center justify-center text-[var(--fg-tertiary)] ${className}`} style={{ height }}>
        No projection data available
      </div>
    );
  }

  return (
    <div className={className} style={{ height }}>
      <SafeResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="crisisGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickLine={false}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickFormatter={formatCompact}
            tickLine={false}
            axisLine={false}
            width={60}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="#DBEAFE"
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="#FFFFFF"
            fillOpacity={1}
          />

          {/* Main balance line */}
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#2563EB"
            strokeWidth={2}
            fill="url(#balanceGradient)"
            name="Closing Balance"
          />

          {/* Buffer line */}
          <ReferenceLine
            y={bufferAmount}
            stroke="#DC2626"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Buffer: ${formatCompact(bufferAmount)}`,
              position: 'right',
              fill: '#DC2626',
              fontSize: 11,
            }}
          />
        </AreaChart>
      </SafeResponsiveContainer>
    </div>
  );
}

export default ProjectionChart;
