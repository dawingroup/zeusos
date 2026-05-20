/**
 * Budget Bar Chart - Budget allocation and spending visualization
 */

import { useMemo } from 'react';

interface BudgetCategory {
  name: string;
  allocated: number;
  spent: number;
  color: string;
}

interface BudgetBarChartProps {
  categories: BudgetCategory[];
  currency: string;
  showLegend?: boolean;
}

export function BudgetBarChart({ 
  categories, 
  currency,
  showLegend = true 
}: BudgetBarChartProps) {
  const totals = useMemo(() => {
    const allocated = categories.reduce((sum, c) => sum + c.allocated, 0);
    const spent = categories.reduce((sum, c) => sum + c.spent, 0);
    return { allocated, spent, remaining: allocated - spent };
  }, [categories]);

  const formatAmount = (amount: number) => {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`;
    }
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-lg font-medium mb-4">Budget Overview</h3>
      
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-sm text-gray-500">Total Budget</div>
          <div className="text-lg font-semibold">
            {currency} {formatAmount(totals.allocated)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500">Spent</div>
          <div className="text-lg font-semibold text-blue-600">
            {currency} {formatAmount(totals.spent)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-gray-500">Remaining</div>
          <div className="text-lg font-semibold text-green-600">
            {currency} {formatAmount(totals.remaining)}
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Overall Utilization</span>
          <span className="font-medium">
            {((totals.spent / totals.allocated) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (totals.spent / totals.allocated) * 100)}%` }}
          />
        </div>
      </div>

      {/* Category bars */}
      <div className="space-y-4">
        {categories.map((category, index) => {
          const percentage = category.allocated > 0 
            ? (category.spent / category.allocated) * 100 
            : 0;
          
          return (
            <div key={index}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{category.name}</span>
                <span className="text-gray-500">
                  {formatAmount(category.spent)} / {formatAmount(category.allocated)}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, percentage)}%`,
                    backgroundColor: category.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          {categories.map((category, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: category.color }}
              />
              <span className="text-sm text-gray-600">{category.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SimpleBudgetBarProps {
  allocated: number;
  spent: number;
  committed?: number;
  currency: string;
  compact?: boolean;
}

export function SimpleBudgetBar({
  allocated,
  spent,
  committed = 0,
  currency,
  compact = false,
}: SimpleBudgetBarProps) {
  const spentPercent = allocated > 0 ? (spent / allocated) * 100 : 0;
  const committedPercent = allocated > 0 ? (committed / allocated) * 100 : 0;

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    return amount.toLocaleString();
  };

  return (
    <div className={compact ? '' : 'bg-white rounded-lg border p-4'}>
      {!compact && (
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Budget Utilization</span>
          <span className="font-medium">
            {currency} {formatAmount(spent)} / {formatAmount(allocated)}
          </span>
        </div>
      )}
      
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative">
        {/* Committed (background) */}
        {committed > 0 && (
          <div
            className="absolute h-full bg-blue-200 rounded-full"
            style={{ width: `${Math.min(100, spentPercent + committedPercent)}%` }}
          />
        )}
        {/* Spent (foreground) */}
        <div
          className="relative h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, spentPercent)}%` }}
        />
      </div>
      
      {!compact && committed > 0 && (
        <div className="flex gap-4 mt-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">Spent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
            <span className="text-gray-600">Committed</span>
          </div>
        </div>
      )}
    </div>
  );
}
