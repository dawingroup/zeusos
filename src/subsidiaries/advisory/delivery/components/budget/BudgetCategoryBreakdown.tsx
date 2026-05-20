/**
 * Budget Category Breakdown - Stacked bars per BOQ bill/category
 * Pattern adapted from BudgetTrendsChart.tsx
 */

import { BaseCard } from '@/shared/components/cards';
import type { CategoryBreakdownItem } from '../../hooks/useProjectBudgetData';

interface BudgetCategoryBreakdownProps {
  categories: CategoryBreakdownItem[];
  currency: string;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

export function BudgetCategoryBreakdown({
  categories,
  currency,
}: BudgetCategoryBreakdownProps) {
  if (categories.length === 0) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3">Budget by Category</h3>
        <p className="text-sm text-gray-500 text-center py-6">
          No BOQ data imported yet — import a Control BOQ to see budget categories.
        </p>
      </BaseCard>
    );
  }

  const maxAllocated = Math.max(...categories.map(c => c.allocated));

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900">Budget by Category</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-blue-500 opacity-30" />
            Allocated
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-blue-300" />
            Committed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-blue-600" />
            Spent
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {categories.map(cat => {
          const barWidthPct = maxAllocated > 0 ? (cat.allocated / maxAllocated) * 100 : 0;
          const spentPct = cat.allocated > 0 ? (cat.spent / cat.allocated) * 100 : 0;
          const committedPct = cat.allocated > 0 ? (cat.committed / cat.allocated) * 100 : 0;
          const isOverBudget = spentPct + committedPct > 100;

          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-gray-700 font-medium">{cat.label}</span>
                </div>
                <div className="text-xs text-gray-500">
                  <span className={isOverBudget ? 'text-red-600 font-medium' : ''}>
                    {currency} {formatCompact(cat.spent + cat.committed)}
                  </span>
                  {' / '}
                  {currency} {formatCompact(cat.allocated)}
                  <span className="ml-2 text-gray-400">
                    ({cat.percentUsed.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Stacked bar */}
              <div className="relative" style={{ width: `${Math.max(20, barWidthPct)}%` }}>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                  {/* Committed layer (background) */}
                  {cat.committed > 0 && (
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-200 rounded-full"
                      style={{ width: `${Math.min(100, spentPct + committedPct)}%` }}
                    />
                  )}
                  {/* Spent layer (foreground) */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, spentPct)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
                {/* Over-budget indicator */}
                {isOverBudget && (
                  <div className="absolute -right-1 top-0 bottom-0 w-0.5 bg-red-500 rounded-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </BaseCard>
  );
}
