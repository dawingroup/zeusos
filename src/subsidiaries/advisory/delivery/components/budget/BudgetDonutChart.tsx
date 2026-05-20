/**
 * Budget Donut Chart - Multi-segment SVG donut showing budget allocation
 * Pattern adapted from ProgressDonut.tsx
 */

import { useMemo } from 'react';
import { BaseCard } from '@/shared/components/cards';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface BudgetDonutChartProps {
  segments: DonutSegment[];
  totalBudget: number;
  currency: string;
  size?: number;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

export function BudgetDonutChart({
  segments,
  totalBudget,
  currency,
  size = 200,
}: BudgetDonutChartProps) {
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate arcs
  const arcs = useMemo(() => {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return [];

    let cumulativeOffset = 0;
    return segments
      .filter(seg => seg.value > 0)
      .map(seg => {
        const fraction = seg.value / total;
        const dashLength = circumference * fraction;
        const dashGap = circumference - dashLength;
        const offset = circumference * cumulativeOffset;
        cumulativeOffset += fraction;
        return {
          ...seg,
          fraction,
          strokeDasharray: `${dashLength} ${dashGap}`,
          strokeDashoffset: -offset,
          percentage: (fraction * 100).toFixed(1),
        };
      });
  }, [segments, circumference]);

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <BaseCard padding="lg">
      <h3 className="text-base font-medium text-gray-900 mb-4">Budget Allocation</h3>

      <div className="flex flex-col items-center gap-4">
        {/* SVG Donut */}
        <div className="relative inline-flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Segments */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={arc.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={arc.strokeDasharray}
                strokeDashoffset={arc.strokeDashoffset}
                className="transition-all duration-500"
              />
            ))}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900">
              {currency} {formatCompact(totalBudget)}
            </span>
            {total > 0 && total !== totalBudget && (
              <span className="text-[10px] text-gray-400">
                of {formatCompact(total)} tracked
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full max-w-xs">
          {arcs.map((arc, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: arc.color }}
              />
              <div className="min-w-0">
                <div className="text-xs text-gray-700 truncate">{arc.label}</div>
                <div className="text-xs text-gray-500">
                  {currency} {formatCompact(arc.value)} ({arc.percentage}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseCard>
  );
}
