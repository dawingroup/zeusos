/**
 * Spending Timeline - SVG area chart of cumulative spending over time
 * Pattern adapted from SCurveChart.tsx
 */

import { useMemo } from 'react';
import { BaseCard } from '@/shared/components/cards';
import type { SpendingTimelineEntry } from '../../hooks/useProjectBudgetData';

interface SpendingTimelineProps {
  entries: SpendingTimelineEntry[];
  totalBudget: number;
  currency: string;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

const CHART_HEIGHT = 220;
const CHART_WIDTH = 100; // Percentage-based
const PADDING = { top: 10, right: 10, bottom: 30, left: 0 };

export function SpendingTimeline({
  entries,
  totalBudget,
  currency,
}: SpendingTimelineProps) {
  if (entries.length < 2) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3">Spending Timeline</h3>
        <p className="text-sm text-gray-500 text-center py-8">
          Not enough payment data to display a timeline.
        </p>
      </BaseCard>
    );
  }

  const drawHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Scale and paths
  const { spentPath, spentAreaPath, committedPath, yLabels, xLabels, budgetLineY } = useMemo(() => {
    const maxCumulative = Math.max(
      ...entries.map(e => Math.max(e.cumulativeSpent, e.cumulativeCommitted)),
      totalBudget
    );
    const maxVal = maxCumulative * 1.1; // 10% headroom

    const toX = (i: number) => (i / (entries.length - 1)) * CHART_WIDTH;
    const toY = (val: number) => PADDING.top + drawHeight - (val / maxVal) * drawHeight;

    // Spent line
    const spentPoints = entries.map((e, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(e.cumulativeSpent)}`);
    const spentLine = spentPoints.join(' ');

    // Spent area (fill under curve)
    const areaBottom = toY(0);
    const area = `${spentLine} L ${toX(entries.length - 1)} ${areaBottom} L 0 ${areaBottom} Z`;

    // Committed line
    const committedPoints = entries.map((e, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(e.cumulativeCommitted)}`);
    const committedLine = committedPoints.join(' ');

    // Y-axis labels
    const ySteps = 4;
    const labels = Array.from({ length: ySteps + 1 }, (_, i) => {
      const val = (maxVal / ySteps) * i;
      return { value: val, y: toY(val) };
    });

    // X-axis labels (first, middle, last)
    const xLabelIndices = [0, Math.floor(entries.length / 2), entries.length - 1];
    const xLbls = xLabelIndices.map(idx => ({
      label: entries[idx].date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    }));

    return {
      spentPath: spentLine,
      spentAreaPath: area,
      committedPath: committedLine,
      maxValue: maxVal,
      yLabels: labels,
      xLabels: xLbls,
      budgetLineY: toY(totalBudget),
    };
  }, [entries, totalBudget, drawHeight]);

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900">Spending Timeline</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-500" />
            Cumulative Spent
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-300" />
            Cumulative Committed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-red-400" style={{ borderTop: '1.5px dashed #F87171' }} />
            Budget Ceiling
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 100 ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: CHART_HEIGHT }}
        >
          {/* Y-axis grid lines */}
          {yLabels.map((label, i) => (
            <line
              key={i}
              x1={0}
              y1={label.y}
              x2={100}
              y2={label.y}
              stroke="#E5E7EB"
              strokeWidth={0.3}
            />
          ))}

          {/* Budget ceiling line */}
          <line
            x1={0}
            y1={budgetLineY}
            x2={100}
            y2={budgetLineY}
            stroke="#F87171"
            strokeWidth={0.5}
            strokeDasharray="2 1"
          />

          {/* Spent area fill */}
          <path
            d={spentAreaPath}
            fill="#3B82F6"
            fillOpacity={0.1}
          />

          {/* Committed line */}
          <path
            d={committedPath}
            fill="none"
            stroke="#93C5FD"
            strokeWidth={0.5}
          />

          {/* Spent line */}
          <path
            d={spentPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth={0.7}
          />

          {/* X-axis labels */}
          {xLabels.map((lbl, i) => (
            <text
              key={i}
              x={lbl.x}
              y={CHART_HEIGHT - 5}
              textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
              className="text-[3px] fill-gray-400"
            >
              {lbl.label}
            </text>
          ))}
        </svg>

        {/* Y-axis labels overlaid */}
        <div className="absolute top-0 left-1 flex flex-col justify-between" style={{ height: drawHeight + PADDING.top }}>
          {yLabels.reverse().map((label, i) => (
            <span key={i} className="text-[10px] text-gray-400 leading-none">
              {currency} {formatCompact(label.value)}
            </span>
          ))}
        </div>
      </div>
    </BaseCard>
  );
}
