// ============================================================================
// FINANCIAL HEALTH PAGE — Composite Health Score
// ZeusOS v2.0 - Finance Module
//
// Shows: Large circular score (0-100), 6 ratio cards with traffic lights.
// P&L-derived ratios only (no BS data dependency).
// Data: QBO historical P&L via usePLHistory hook
// ============================================================================

import { useMemo } from 'react';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { usePLHistory } from '../hooks/usePLHistory';
import { computeProfitability } from '../services/profitabilityEngine';
import type { ProfitabilityMetrics } from '../services/profitabilityEngine';
import { periodLabel } from '../types/forecast.types';

// ── Ratio Definitions ────────────────────────────────────────────────────────

interface HealthRatio {
  id: string;
  label: string;
  description: string;
  compute: (m: ProfitabilityMetrics) => number;
  isPercentage: boolean;
  /** Thresholds: [red_below, amber_below, green_at_or_above] */
  thresholds: { red: number; amber: number; green: number };
  /** Weight in the composite score (0-1, should sum to 1.0) */
  weight: number;
  healthyLabel: string;
}

const HEALTH_RATIOS: HealthRatio[] = [
  {
    id: 'grossMargin',
    label: 'Gross Margin',
    description: 'Revenue remaining after COGS',
    compute: (m) => (m.revenue !== 0 ? m.grossProfit / m.revenue : 0),
    isPercentage: true,
    thresholds: { red: 0.15, amber: 0.30, green: 0.30 },
    weight: 0.20,
    healthyLabel: 'Healthy: > 30%',
  },
  {
    id: 'operatingMargin',
    label: 'Operating Margin',
    description: 'Profit from core operations',
    compute: (m) => (m.revenue !== 0 ? m.operatingProfit / m.revenue : 0),
    isPercentage: true,
    thresholds: { red: 0.05, amber: 0.15, green: 0.15 },
    weight: 0.20,
    healthyLabel: 'Healthy: > 15%',
  },
  {
    id: 'netMargin',
    label: 'Net Margin',
    description: 'Bottom-line profitability',
    compute: (m) => (m.revenue !== 0 ? m.netProfit / m.revenue : 0),
    isPercentage: true,
    thresholds: { red: 0.03, amber: 0.10, green: 0.10 },
    weight: 0.20,
    healthyLabel: 'Healthy: > 10%',
  },
  {
    id: 'ebitdaMargin',
    label: 'EBITDA Margin',
    description: 'Cash-generating ability',
    compute: (m) => (m.revenue !== 0 ? m.ebitda / m.revenue : 0),
    isPercentage: true,
    thresholds: { red: 0.10, amber: 0.20, green: 0.20 },
    weight: 0.15,
    healthyLabel: 'Healthy: > 20%',
  },
  {
    id: 'interestCoverage',
    label: 'Interest Coverage',
    description: 'EBIT / Interest expense',
    compute: (m) => (m.interest !== 0 ? m.ebit / m.interest : m.ebit > 0 ? 100 : 0),
    isPercentage: false,
    thresholds: { red: 1.5, amber: 3, green: 3 },
    weight: 0.10,
    healthyLabel: 'Healthy: > 3x',
  },
  {
    id: 'costEfficiency',
    label: 'Cost Efficiency',
    description: '1 - (OpEx / Revenue)',
    compute: (m) => (m.revenue !== 0 ? 1 - m.opex / m.revenue : 0),
    isPercentage: true,
    thresholds: { red: 0.50, amber: 0.70, green: 0.70 },
    weight: 0.15,
    healthyLabel: 'Healthy: > 70%',
  },
];

// ── Score Calculation ────────────────────────────────────────────────────────

type TrafficLight = 'green' | 'amber' | 'red';

function getTrafficLight(value: number, thresholds: HealthRatio['thresholds']): TrafficLight {
  if (value >= thresholds.green) return 'green';
  if (value >= thresholds.red) return 'amber';
  return 'red';
}

/**
 * Map a ratio value to a 0-100 score based on thresholds.
 * - At or above green threshold: 100
 * - Between red and green: linear interpolation 30-100
 * - Below red: linear interpolation 0-30
 */
function ratioToScore(value: number, thresholds: HealthRatio['thresholds']): number {
  if (value >= thresholds.green) return 100;
  if (value >= thresholds.red) {
    const range = thresholds.green - thresholds.red;
    if (range === 0) return 65;
    const progress = (value - thresholds.red) / range;
    return 30 + progress * 70;
  }
  // Below red threshold
  if (thresholds.red === 0) return 0;
  const progress = Math.max(0, value / thresholds.red);
  return progress * 30;
}

function computeCompositeScore(metrics: ProfitabilityMetrics): {
  score: number;
  ratioScores: Array<{
    ratio: HealthRatio;
    value: number;
    score: number;
    light: TrafficLight;
  }>;
} {
  const ratioScores = HEALTH_RATIOS.map((ratio) => {
    const value = ratio.compute(metrics);
    const score = ratioToScore(value, ratio.thresholds);
    const light = getTrafficLight(value, ratio.thresholds);
    return { ratio, value, score, light };
  });

  const totalWeight = HEALTH_RATIOS.reduce((sum, r) => sum + r.weight, 0);
  const weightedSum = ratioScores.reduce(
    (sum, rs) => sum + rs.score * rs.ratio.weight,
    0
  );
  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);

  return { score, ratioScores };
}

// ── Score Color ──────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score > 70) return '#16a34a'; // green-600
  if (score >= 40) return '#d97706'; // amber-600
  return '#dc2626'; // red-600
}

function getScoreBgClass(score: number): string {
  if (score > 70) return 'bg-green-50 border-green-200';
  if (score >= 40) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getScoreLabel(score: number): string {
  if (score > 80) return 'Excellent financial health';
  if (score > 70) return 'Good financial health';
  if (score > 55) return 'Moderate financial health';
  if (score >= 40) return 'Below-average financial health';
  if (score >= 20) return 'Poor financial health';
  return 'Critical financial health';
}

// ── Traffic Light Indicator ──────────────────────────────────────────────────

const LIGHT_COLORS: Record<TrafficLight, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtRatio(v: number): string {
  return `${v.toFixed(1)}x`;
}

// ── Circular Score Display ───────────────────────────────────────────────────

function CircularScore({ score }: { score: number }) {
  const color = getScoreColor(score);
  const radius = 80;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200">
        {/* Background circle */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 100 100)"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Score number */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-gray-400 font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Ratio Card ───────────────────────────────────────────────────────────────

function RatioCard({
  ratio,
  value,
  light,
  score,
}: {
  ratio: HealthRatio;
  value: number;
  light: TrafficLight;
  score: number;
}) {
  const formattedValue = ratio.isPercentage ? fmtPct(value) : fmtRatio(value);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {ratio.label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formattedValue}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{ratio.description}</p>
        </div>
        <div className="flex flex-col items-center gap-1 ml-3">
          <div className={`w-4 h-4 rounded-full ${LIGHT_COLORS[light]}`} />
          <span className="text-[10px] text-gray-400">{score}</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 border-t border-gray-100 pt-2">
        {ratio.healthyLabel}
      </p>
    </Card>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-7 w-48" />
      <div className="flex justify-center">
        <Skeleton className="h-[200px] w-[200px] rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function FinancialHealthPage() {
  const { periodData, periods, loading, error } = usePLHistory(12);

  // Compute metrics for the latest period
  const healthData = useMemo(() => {
    if (periods.length === 0) return null;
    const latestPeriod = periods[periods.length - 1];
    const pl = periodData[latestPeriod]?.pl;
    if (!pl) return null;

    const metrics = computeProfitability(pl);
    return {
      period: latestPeriod,
      ...computeCompositeScore(metrics),
    };
  }, [periodData, periods]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Financial Health</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Composite health score derived from P&L ratios
          {healthData && (
            <span className="ml-1">
              &mdash; {periodLabel(healthData.period)}
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

      {healthData ? (
        <>
          {/* Score Display */}
          <Card
            className={`p-8 flex flex-col items-center border ${getScoreBgClass(healthData.score)}`}
          >
            <CircularScore score={healthData.score} />
            <p className="mt-4 text-sm font-semibold text-gray-700">
              {getScoreLabel(healthData.score)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Weighted average of {HEALTH_RATIOS.length} financial ratios
            </p>
          </Card>

          {/* Ratio Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthData.ratioScores.map((rs) => (
              <RatioCard
                key={rs.ratio.id}
                ratio={rs.ratio}
                value={rs.value}
                light={rs.light}
                score={Math.round(rs.score)}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-gray-400 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Healthy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Caution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Needs Attention</span>
            </div>
          </div>
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

export default FinancialHealthPage;
