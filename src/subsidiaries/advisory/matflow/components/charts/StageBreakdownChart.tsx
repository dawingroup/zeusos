/**
 * Stage Breakdown Chart
 * Horizontal bar chart showing fulfillment by stage
 */

import React from 'react';
import type { StageVariance, VarianceStatus } from '../../types/variance';

interface StageBreakdownChartProps {
  stages: StageVariance[];
}

const getStatusColor = (status: VarianceStatus): string => {
  switch (status) {
    case 'on-track':
    case 'cost-savings':
      return 'bg-green-500';
    case 'under-procured':
      return 'bg-amber-500';
    case 'over-procured':
    case 'cost-overrun':
    case 'at-risk':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
};

export const StageBreakdownChart: React.FC<StageBreakdownChartProps> = ({ stages }) => {
  const sortedStages = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);

  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No stage data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedStages.map(stage => (
        <div key={stage.stageId} className="flex items-center gap-3">
          {/* Stage name */}
          <div className="w-32 text-sm text-gray-700 truncate" title={stage.stageName}>
            {stage.stageName}
          </div>
          
          {/* Progress bar */}
          <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getStatusColor(stage.status)}`}
              style={{ width: `${Math.min(stage.fulfillmentPercent, 100)}%` }}
            />
          </div>
          
          {/* Percentage */}
          <div className="w-14 text-sm font-medium text-right">
            {stage.fulfillmentPercent.toFixed(0)}%
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-4 justify-center pt-4 mt-4 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded" />
          On Track
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-amber-500 rounded" />
          Under-Procured
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded" />
          At Risk
        </div>
      </div>
    </div>
  );
};

export default StageBreakdownChart;
