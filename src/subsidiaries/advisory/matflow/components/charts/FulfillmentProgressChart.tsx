/**
 * Fulfillment Progress Chart
 * Donut chart showing material procurement status distribution
 */

import React from 'react';
import type { ProjectVarianceSummary } from '../../types/variance';

interface FulfillmentProgressChartProps {
  summary: ProjectVarianceSummary;
}

export const FulfillmentProgressChart: React.FC<FulfillmentProgressChartProps> = ({ summary }) => {
  const segments = [
    { label: 'Fully Procured', value: summary.materialsFullyProcured, color: '#22c55e' },
    { label: 'Partially Procured', value: summary.materialsPartiallyProcured, color: '#eab308' },
    { label: 'Not Started', value: summary.materialsNotStarted, color: '#d1d5db' },
    { label: 'Over Procured', value: summary.materialsOverProcured, color: '#ef4444' },
  ].filter(s => s.value > 0);

  const total = summary.totalMaterialsPlanned;
  const fulfillmentPercent = summary.overallFulfillmentPercent;

  // Calculate SVG paths for donut chart
  const size = 200;
  const strokeWidth = 30;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativePercent = 0;
  const arcs = segments.map(segment => {
    const percent = total > 0 ? (segment.value / total) * 100 : 0;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const rotation = (cumulativePercent / 100) * 360 - 90;
    cumulativePercent += percent;
    
    return {
      ...segment,
      percent,
      strokeDasharray,
      rotation,
    };
  });

  return (
    <div className="flex flex-col items-center">
      {/* Donut Chart */}
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={arc.strokeDasharray}
              strokeLinecap="butt"
              style={{
                transform: `rotate(${arc.rotation}deg)`,
                transformOrigin: 'center',
              }}
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">
            {fulfillmentPercent.toFixed(0)}%
          </span>
          <span className="text-sm text-gray-500">Fulfilled</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-3 mt-6 w-full max-w-xs">
        {segments.map(segment => (
          <div key={segment.label} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 truncate">{segment.label}</div>
              <div className="text-sm font-medium">{segment.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FulfillmentProgressChart;
