/**
 * Cost Variance Chart
 * Bar chart showing planned vs actual cost by stage
 */

import React from 'react';
import type { StageVariance } from '../../types/variance';

interface CostVarianceChartProps {
  stages: StageVariance[];
}

export const CostVarianceChart: React.FC<CostVarianceChartProps> = ({ stages }) => {
  const maxCost = Math.max(
    ...stages.map(s => Math.max(s.totalPlannedCost, s.totalActualCost))
  );

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toFixed(0);
  };

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No stage data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stages.map(stage => {
        const plannedWidth = maxCost > 0 ? (stage.totalPlannedCost / maxCost) * 100 : 0;
        const actualWidth = maxCost > 0 ? (stage.totalActualCost / maxCost) * 100 : 0;
        const isOverBudget = stage.costVariancePercent > 0;

        return (
          <div key={stage.stageId} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-gray-700 truncate max-w-[150px]" title={stage.stageName}>
                {stage.stageName}
              </span>
              <span className={`text-xs font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                {isOverBudget ? '+' : ''}{stage.costVariancePercent.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1">
              {/* Planned bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Plan</span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div 
                    className="h-full bg-gray-400 rounded transition-all duration-300"
                    style={{ width: `${plannedWidth}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-16 text-right">
                  {formatCurrency(stage.totalPlannedCost)}
                </span>
              </div>
              {/* Actual bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">Actual</span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div 
                    className={`h-full rounded transition-all duration-300 ${
                      isOverBudget ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${actualWidth}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-16 text-right">
                  {formatCurrency(stage.totalActualCost)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-4 justify-center pt-4 border-t border-gray-200">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-3 h-3 bg-gray-400 rounded" />
          Planned
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-3 h-3 bg-green-500 rounded" />
          Under Budget
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <div className="w-3 h-3 bg-red-500 rounded" />
          Over Budget
        </div>
      </div>
    </div>
  );
};

export default CostVarianceChart;
