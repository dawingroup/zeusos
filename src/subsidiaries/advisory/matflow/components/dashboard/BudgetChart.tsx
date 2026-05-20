/**
 * Budget Chart Component
 * Visualizes budget allocation and spending
 */

import React from 'react';
import { cn } from '@/core/lib/utils';

interface BudgetSummary {
  budgetAmount: number;
  requisitionedAmount: number;
  orderedAmount: number;
  deliveredAmount: number;
  utilizationPercentage?: number;
}

interface BudgetChartProps {
  data?: BudgetSummary | null;
  loading?: boolean;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCurrencyCompact = (amount: number): string => {
  if (amount >= 1e9) {
    return `UGX ${(amount / 1e9).toFixed(1)}B`;
  }
  if (amount >= 1e6) {
    return `UGX ${(amount / 1e6).toFixed(1)}M`;
  }
  if (amount >= 1e3) {
    return `UGX ${(amount / 1e3).toFixed(0)}K`;
  }
  return formatCurrency(amount);
};

export const BudgetChart: React.FC<BudgetChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-72 animate-pulse">
        <div className="h-48 bg-gray-200 rounded mb-4" />
        <div className="h-8 bg-gray-200 rounded w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-72 flex items-center justify-center text-gray-500">
        No budget data available
      </div>
    );
  }

  const chartData = [
    { name: 'Budget', amount: data.budgetAmount, color: 'bg-blue-500' },
    { name: 'Requisitioned', amount: data.requisitionedAmount, color: 'bg-yellow-500' },
    { name: 'Ordered', amount: data.orderedAmount, color: 'bg-purple-500' },
    { name: 'Delivered', amount: data.deliveredAmount, color: 'bg-green-500' },
  ];

  const maxAmount = Math.max(...chartData.map(d => d.amount));

  return (
    <div>
      {/* Bar Chart */}
      <div className="h-48 flex items-end justify-around gap-4 mb-6">
        {chartData.map((item) => {
          const height = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          return (
            <div key={item.name} className="flex flex-col items-center flex-1">
              <div className="w-full flex flex-col items-center">
                <span className="text-xs text-gray-600 mb-1">
                  {formatCurrencyCompact(item.amount)}
                </span>
                <div
                  className={cn('w-full max-w-16 rounded-t transition-all duration-500', item.color)}
                  style={{ height: `${Math.max(height, 5)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 mt-2 text-center">{item.name}</span>
            </div>
          );
        })}
      </div>

      {/* Budget Utilization Bar */}
      <div className="mt-6 px-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-500">Budget Utilization</span>
          <span className="text-sm font-medium">
            {data.utilizationPercentage?.toFixed(1) || 0}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              (data.utilizationPercentage || 0) > 90
                ? 'bg-red-500'
                : (data.utilizationPercentage || 0) > 75
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
            )}
            style={{ width: `${Math.min(data.utilizationPercentage || 0, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">
            Spent: {formatCurrency(data.orderedAmount)}
          </span>
          <span className="text-xs text-gray-400">
            Remaining: {formatCurrency(data.budgetAmount - data.orderedAmount)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BudgetChart;
