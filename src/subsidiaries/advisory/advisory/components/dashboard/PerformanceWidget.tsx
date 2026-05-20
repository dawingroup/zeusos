/**
 * Performance Widget
 * 
 * Shows performance metrics and chart on the dashboard.
 */

import { TrendingUp } from 'lucide-react';

interface PerformanceWidgetProps {
  timeframe: 'mtd' | 'qtd' | 'ytd' | '1y';
}

export function PerformanceWidget({ timeframe }: PerformanceWidgetProps) {
  // Mock performance data - would come from hooks in production
  const performanceData = {
    irr: 0.156,
    irrChange: 0.02,
    tvpi: 1.42,
    dpi: 0.35,
    rvpi: 1.07,
    moic: 1.38,
  };
  
  const metrics = [
    { label: 'IRR', value: formatPercent(performanceData.irr), positive: performanceData.irr >= 0 },
    { label: 'TVPI', value: `${performanceData.tvpi.toFixed(2)}x`, positive: performanceData.tvpi >= 1 },
    { label: 'DPI', value: `${performanceData.dpi.toFixed(2)}x`, positive: true },
    { label: 'RVPI', value: `${performanceData.rvpi.toFixed(2)}x`, positive: performanceData.rvpi >= 1 },
    { label: 'MOIC', value: `${performanceData.moic.toFixed(2)}x`, positive: performanceData.moic >= 1 },
  ];
  
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Performance Overview</h3>
        <span className="text-sm text-gray-500">{timeframe.toUpperCase()}</span>
      </div>
      
      <div className="p-4">
        {/* Performance Chart Placeholder */}
        <div className="h-48 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center mb-4">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-blue-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Performance Chart</p>
            <p className="text-2xl font-bold text-blue-600">{formatPercent(performanceData.irr)}</p>
            <p className="text-sm text-gray-500">Net IRR ({timeframe.toUpperCase()})</p>
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-5 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="text-center">
              <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
              <p
                className={`font-semibold ${
                  metric.positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default PerformanceWidget;
