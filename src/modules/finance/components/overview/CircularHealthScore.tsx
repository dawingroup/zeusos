// ============================================================================
// CIRCULAR HEALTH SCORE — Reusable compact version
// Extracted from FinancialHealthPage for use on the Overview dashboard
// ============================================================================

import { useMemo } from 'react';
import type { ProfitabilityMetrics } from '../../services/profitabilityEngine';

// ── Score Calculation ────────────────────────────────────────────────────────

interface HealthRatio {
  id: string;
  label: string;
  compute: (m: ProfitabilityMetrics) => number;
  thresholds: { red: number; amber: number; green: number };
  weight: number;
}

const HEALTH_RATIOS: HealthRatio[] = [
  {
    id: 'grossMargin',
    label: 'Gross Margin',
    compute: (m) => (m.revenue !== 0 ? m.grossProfit / m.revenue : 0),
    thresholds: { red: 0.15, amber: 0.30, green: 0.30 },
    weight: 0.20,
  },
  {
    id: 'operatingMargin',
    label: 'Operating Margin',
    compute: (m) => (m.revenue !== 0 ? m.operatingProfit / m.revenue : 0),
    thresholds: { red: 0.05, amber: 0.15, green: 0.15 },
    weight: 0.20,
  },
  {
    id: 'netMargin',
    label: 'Net Margin',
    compute: (m) => (m.revenue !== 0 ? m.netProfit / m.revenue : 0),
    thresholds: { red: 0.03, amber: 0.10, green: 0.10 },
    weight: 0.20,
  },
  {
    id: 'ebitdaMargin',
    label: 'EBITDA Margin',
    compute: (m) => (m.revenue !== 0 ? m.ebitda / m.revenue : 0),
    thresholds: { red: 0.10, amber: 0.20, green: 0.20 },
    weight: 0.15,
  },
  {
    id: 'interestCoverage',
    label: 'Interest Coverage',
    compute: (m) => (m.interest !== 0 ? m.ebit / m.interest : m.ebit > 0 ? 100 : 0),
    thresholds: { red: 1.5, amber: 3, green: 3 },
    weight: 0.10,
  },
  {
    id: 'costEfficiency',
    label: 'Cost Efficiency',
    compute: (m) => (m.revenue !== 0 ? 1 - m.opex / m.revenue : 0),
    thresholds: { red: 0.50, amber: 0.70, green: 0.70 },
    weight: 0.15,
  },
];

function ratioToScore(value: number, thresholds: HealthRatio['thresholds']): number {
  if (value >= thresholds.green) return 100;
  if (value >= thresholds.red) {
    const range = thresholds.green - thresholds.red;
    if (range === 0) return 65;
    const progress = (value - thresholds.red) / range;
    return 30 + progress * 70;
  }
  if (thresholds.red === 0) return 0;
  const progress = Math.max(0, value / thresholds.red);
  return progress * 30;
}

export function computeHealthScore(metrics: ProfitabilityMetrics): number {
  const totalWeight = HEALTH_RATIOS.reduce((sum, r) => sum + r.weight, 0);
  const weightedSum = HEALTH_RATIOS.reduce((sum, ratio) => {
    const value = ratio.compute(metrics);
    const score = ratioToScore(value, ratio.thresholds);
    return sum + score * ratio.weight;
  }, 0);
  return Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);
}

// ── Score Color ──────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score > 70) return '#16a34a';
  if (score >= 40) return '#d97706';
  return '#dc2626';
}

function getScoreLabel(score: number): string {
  if (score > 80) return 'Excellent';
  if (score > 70) return 'Good';
  if (score > 55) return 'Moderate';
  if (score >= 40) return 'Below Average';
  if (score >= 20) return 'Poor';
  return 'Critical';
}

// ── Component ────────────────────────────────────────────────────────────────

interface CircularHealthScoreProps {
  score: number;
  size?: number;
}

export function CircularHealthScore({ score, size = 120 }: CircularHealthScoreProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const radius = (size / 2) - 8;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] text-[var(--fg-tertiary)]">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Hook for convenience ─────────────────────────────────────────────────────

export function useHealthScore(metrics: ProfitabilityMetrics | null) {
  return useMemo(() => {
    if (!metrics) return 0;
    return computeHealthScore(metrics);
  }, [metrics]);
}
