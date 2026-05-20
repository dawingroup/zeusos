/**
 * Budget Trends Chart - Per-program budget visualization using custom SVG bars
 */

import { useMemo } from 'react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface BudgetTrendsChartProps {
  programs: Array<{ id: string; name: string }>;
  projects: Project[];
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  return amount.toLocaleString();
}

export function BudgetTrendsChart({ programs, projects }: BudgetTrendsChartProps) {
  const chartData = useMemo(() => {
    return programs.map(program => {
      const programProjects = projects.filter(p => p.programId === program.id);
      const allocated = programProjects.reduce((sum, p) => sum + (p.budget?.totalBudget || 0), 0);
      const spent = programProjects.reduce((sum, p) => sum + (p.budget?.spent || 0), 0);
      const committed = programProjects.reduce((sum, p) => sum + (p.budget?.committed || 0), 0);
      // Derive currency from the first project in this program (all share the same currency)
      const currency = programProjects[0]?.budget?.currency || 'UGX';
      return { name: program.name, allocated, spent, committed, currency };
    }).filter(d => d.allocated > 0);
  }, [programs, projects]);

  const maxValue = useMemo(
    () => Math.max(...chartData.map(d => d.allocated), 1),
    [chartData]
  );

  if (chartData.length === 0) {
    return (
      <BaseCard padding="lg">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Budget by Program</h2>
        <div className="text-center py-8 text-gray-500">No budget data available</div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Budget by Program</h2>

      <div className="space-y-4">
        {chartData.map((item, i) => {
          const allocatedPct = (item.allocated / maxValue) * 100;
          const spentPct = (item.spent / maxValue) * 100;
          const committedPct = (item.committed / maxValue) * 100;
          const variance = item.allocated > 0
            ? (((item.allocated - item.spent - item.committed) / item.allocated) * 100).toFixed(0)
            : '0';

          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
                  {item.name}
                </span>
                <span className="text-xs text-gray-500">
                  {item.currency} {formatCurrency(item.spent)} / {formatCurrency(item.allocated)}
                </span>
              </div>

              {/* Stacked bar */}
              <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                {/* Allocated (full background) */}
                <div
                  className="absolute inset-y-0 left-0 bg-blue-100 rounded"
                  style={{ width: `${allocatedPct}%` }}
                />
                {/* Committed */}
                <div
                  className="absolute inset-y-0 left-0 bg-blue-300 rounded-l"
                  style={{ width: `${Math.min(allocatedPct, spentPct + committedPct)}%` }}
                />
                {/* Spent (solid) */}
                <div
                  className="absolute inset-y-0 left-0 bg-blue-600 rounded-l"
                  style={{ width: `${Math.min(allocatedPct, spentPct)}%` }}
                />
                {/* Variance label */}
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                  <span className={`text-xs font-medium ${
                    Number(variance) < 10 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {variance}% remaining
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-600" />
          <span className="text-xs text-gray-500">Spent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-300" />
          <span className="text-xs text-gray-500">Committed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100" />
          <span className="text-xs text-gray-500">Allocated</span>
        </div>
      </div>
    </BaseCard>
  );
}
