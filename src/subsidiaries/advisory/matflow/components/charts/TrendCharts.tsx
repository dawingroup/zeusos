/**
 * Trend Charts
 * Line charts for cost and quantity trends over time
 */

import React from 'react';
import type { VarianceTrend, CostTrend } from '../../types/variance';

interface CostTrendChartProps {
  data: CostTrend[];
}

interface QuantityTrendChartProps {
  data: VarianceTrend[];
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
};

const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const CostTrendChart: React.FC<CostTrendChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No trend data available
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map(d => Math.max(d.budgetedCumulative, d.actualCumulative))
  );
  const height = 200;

  // Sample data points for display (every 5th point)
  const sampledData = data.filter((_, i) => i % 5 === 0 || i === data.length - 1);

  return (
    <div className="space-y-4">
      {/* Chart area */}
      <div className="relative h-52 flex items-end gap-1">
        {sampledData.map((point, index) => {
          const budgetHeight = maxValue > 0 ? (point.budgetedCumulative / maxValue) * height : 0;
          const actualHeight = maxValue > 0 ? (point.actualCumulative / maxValue) * height : 0;
          
          return (
            <div key={index} className="flex-1 flex gap-0.5 items-end">
              <div 
                className="flex-1 bg-gray-300 rounded-t transition-all duration-300"
                style={{ height: `${budgetHeight}px` }}
                title={`Budget: ${formatCurrency(point.budgetedCumulative)}`}
              />
              <div 
                className={`flex-1 rounded-t transition-all duration-300 ${
                  point.actualCumulative > point.budgetedCumulative ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ height: `${actualHeight}px` }}
                title={`Actual: ${formatCurrency(point.actualCumulative)}`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 px-1">
        {sampledData.length > 0 && (
          <>
            <span>{formatDate(sampledData[0].date)}</span>
            <span>{formatDate(sampledData[sampledData.length - 1].date)}</span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gray-300 rounded" />
          Budget
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded" />
          Actual (On Track)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded" />
          Actual (Over)
        </div>
      </div>
    </div>
  );
};

export const QuantityTrendChart: React.FC<QuantityTrendChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No trend data available
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map(d => Math.max(d.plannedCumulative, d.actualCumulative))
  );
  const height = 200;

  // Sample data points for display
  const sampledData = data.filter((_, i) => i % 5 === 0 || i === data.length - 1);

  return (
    <div className="space-y-4">
      {/* Chart area */}
      <div className="relative h-52 flex items-end gap-1">
        {sampledData.map((point, index) => {
          const plannedHeight = maxValue > 0 ? (point.plannedCumulative / maxValue) * height : 0;
          const actualHeight = maxValue > 0 ? (point.actualCumulative / maxValue) * height : 0;
          
          return (
            <div key={index} className="flex-1 flex gap-0.5 items-end">
              <div 
                className="flex-1 bg-blue-200 rounded-t transition-all duration-300"
                style={{ height: `${plannedHeight}px` }}
                title={`Planned: ${point.plannedCumulative.toFixed(0)}`}
              />
              <div 
                className={`flex-1 rounded-t transition-all duration-300 ${
                  point.actualCumulative < point.plannedCumulative * 0.8 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ height: `${actualHeight}px` }}
                title={`Actual: ${point.actualCumulative.toFixed(0)}`}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 px-1">
        {sampledData.length > 0 && (
          <>
            <span>{formatDate(sampledData[0].date)}</span>
            <span>{formatDate(sampledData[sampledData.length - 1].date)}</span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-200 rounded" />
          Expected
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          Actual
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-amber-500 rounded" />
          Behind
        </div>
      </div>
    </div>
  );
};
