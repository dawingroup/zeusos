/**
 * S-Curve Chart - Planned vs Actual progress visualization
 */

import { useMemo } from 'react';
import { WeeklyProgress } from '../../types/progress-tracking';

interface SCurveChartProps {
  data: WeeklyProgress[];
  currentWeek: number;
  height?: number;
}

export function SCurveChart({ data, currentWeek, height = 300 }: SCurveChartProps) {
  const chartData = useMemo(() => {
    return data.map(w => ({
      week: w.weekNumber,
      planned: w.plannedCumulative,
      actual: w.actualCumulative ?? null,
      isCurrent: w.weekNumber === currentWeek,
    }));
  }, [data, currentWeek]);

  // Find max values for scaling
  const maxValue = 100;
  const width = 100;

  // Generate path for planned line
  const plannedPath = useMemo(() => {
    if (chartData.length === 0) return '';
    const points = chartData.map((d, i) => {
      const x = (i / (chartData.length - 1)) * width;
      const y = height - (d.planned / maxValue) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return points.join(' ');
  }, [chartData, height, width]);

  // Generate path for actual line
  const actualPath = useMemo(() => {
    const actualData = chartData.filter(d => d.actual !== null);
    if (actualData.length === 0) return '';
    const points = actualData.map((d, i) => {
      const originalIndex = chartData.findIndex(c => c.week === d.week);
      const x = (originalIndex / (chartData.length - 1)) * width;
      const y = height - ((d.actual || 0) / maxValue) * height;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return points.join(' ');
  }, [chartData, height, width]);

  // Current week marker position
  const currentWeekX = useMemo(() => {
    const idx = chartData.findIndex(d => d.isCurrent);
    if (idx === -1) return null;
    return (idx / (chartData.length - 1)) * width;
  }, [chartData, width]);

  // Get variance at current week
  const variance = useMemo(() => {
    const current = chartData.find(d => d.isCurrent);
    if (!current || current.actual === null) return null;
    return current.actual - current.planned;
  }, [chartData]);

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Progress S-Curve</h3>
        {variance !== null && (
          <span className={`text-sm font-medium ${variance >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
            {variance >= 0 ? '+' : ''}{variance.toFixed(1)}% variance
          </span>
        )}
      </div>
      
      <div className="relative" style={{ height }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(pct => (
            <g key={pct}>
              <line
                x1="0"
                y1={height - (pct / 100) * height}
                x2={width}
                y2={height - (pct / 100) * height}
                stroke="#E5E7EB"
                strokeDasharray="2,2"
              />
              <text
                x="-2"
                y={height - (pct / 100) * height + 3}
                fontSize="3"
                fill="#9CA3AF"
                textAnchor="end"
              >
                {pct}%
              </text>
            </g>
          ))}

          {/* Current week marker */}
          {currentWeekX !== null && (
            <line
              x1={currentWeekX}
              y1="0"
              x2={currentWeekX}
              y2={height}
              stroke="#6366F1"
              strokeDasharray="2,2"
              strokeWidth="0.5"
            />
          )}

          {/* Planned line */}
          <path
            d={plannedPath}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="1"
          />

          {/* Actual line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="#059669"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 -ml-8">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-gray-400"></div>
          <span className="text-gray-600">Planned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-green-600"></div>
          <span className="text-gray-600">Actual</span>
        </div>
      </div>
    </div>
  );
}
