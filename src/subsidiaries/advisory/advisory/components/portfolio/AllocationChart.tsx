/**
 * Allocation Chart
 * 
 * Displays portfolio allocation breakdown as a donut chart.
 */

import { useMemo } from 'react';

interface Holding {
  id: string;
  name: string;
  value: number;
  sector: string;
  type: string;
}

interface AllocationChartProps {
  holdings: Holding[];
  groupBy: 'sector' | 'type';
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

export function AllocationChart({ holdings, groupBy }: AllocationChartProps) {
  const allocations = useMemo(() => {
    const groups: Record<string, number> = {};
    let total = 0;
    
    holdings.forEach((holding) => {
      const key = groupBy === 'sector' ? holding.sector : holding.type;
      groups[key] = (groups[key] || 0) + holding.value;
      total += holding.value;
    });
    
    return Object.entries(groups)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, groupBy]);
  
  const total = allocations.reduce((sum, a) => sum + a.value, 0);
  
  // Calculate SVG arc paths for donut chart
  const chartData = useMemo(() => {
    const paths: { path: string; color: string; name: string; percentage: number }[] = [];
    let currentAngle = -90; // Start from top
    
    allocations.forEach((allocation) => {
      const angle = (allocation.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
      const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
      const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
      const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      paths.push({
        path,
        color: allocation.color,
        name: allocation.name,
        percentage: allocation.percentage,
      });
      
      currentAngle = endAngle;
    });
    
    return paths;
  }, [allocations]);
  
  if (holdings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No holdings to display
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-8">
      {/* Donut Chart */}
      <div className="relative w-48 h-48 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {chartData.map((segment, index) => (
            <path
              key={index}
              d={segment.path}
              fill={segment.color}
              className="transition-opacity hover:opacity-80"
            />
          ))}
          {/* Center hole */}
          <circle cx="50" cy="50" r="25" fill="white" />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{formatCurrency(total)}</span>
          <span className="text-xs text-gray-500">Total</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex-1 space-y-2">
        {allocations.map((allocation, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: allocation.color }}
              />
              <span className="text-sm text-gray-700">{allocation.name}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">{allocation.percentage.toFixed(1)}%</span>
              <span className="text-xs text-gray-500 ml-2">
                {formatCurrency(allocation.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export default AllocationChart;
