import React, { useState } from 'react';
import { BarChart3, PieChart, Table2, Download, RefreshCw } from 'lucide-react';
import { CrossModuleReport } from '../types/cross-module';

interface CrossModuleReportViewerProps {
  report: CrossModuleReport;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'pdf' | 'excel') => void;
}

type ViewMode = 'summary' | 'table' | 'charts';

export const CrossModuleReportViewer: React.FC<CrossModuleReportViewerProps> = ({
  report,
  onRefresh,
  onExport
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  const formatValue = (value: number, format?: string) => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-US').format(value);
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{report.config.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{report.config.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onExport?.('csv')}
              className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-4 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'table'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table2 className="w-4 h-4" />
            Data
          </button>
          <button
            onClick={() => setViewMode('charts')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'charts'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Charts
          </button>
        </div>
      </div>

      <div className="p-4">
        {viewMode === 'summary' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {report.config.metrics.map(metric => (
              <div key={metric.id} className="p-4 bg-gray-50 rounded-lg border">
                <div className="text-sm text-gray-500 mb-1">{metric.name}</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {formatValue(report.summary[metric.id] || 0, metric.format)}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {report.config.dimensions.map(dim => (
                    <th key={dim.id} className="text-left py-2 px-3 font-medium text-gray-700">
                      {dim.name}
                    </th>
                  ))}
                  {report.config.metrics.map(metric => (
                    <th key={metric.id} className="text-right py-2 px-3 font-medium text-gray-700">
                      {metric.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.data.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    {report.config.dimensions.map(dim => (
                      <td key={dim.id} className="py-2 px-3 text-gray-600">
                        {(row[dim.field] as string) || '-'}
                      </td>
                    ))}
                    {report.config.metrics.map(metric => (
                      <td key={metric.id} className="py-2 px-3 text-right text-gray-900">
                        {formatValue((row[metric.field] as number) || 0, metric.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {report.data.length > 20 && (
              <div className="mt-2 text-center text-sm text-gray-500">
                Showing 20 of {report.data.length} rows
              </div>
            )}
          </div>
        )}

        {viewMode === 'charts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {report.charts.map(chart => (
              <div key={chart.id} className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-4">{chart.title}</h4>
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                  {chart.type === 'bar' && (
                    <div className="w-full h-full p-4">
                      <div className="flex items-end justify-around h-full gap-2">
                        {(chart.data as { name: string; value: number }[]).slice(0, 8).map((item, i) => (
                          <div key={i} className="flex flex-col items-center flex-1">
                            <div
                              className="w-full bg-blue-500 rounded-t"
                              style={{
                                height: `${Math.min(
                                  (item.value / Math.max(...(chart.data as { value: number }[]).map(d => d.value))) * 100,
                                  100
                                )}%`,
                                minHeight: '4px'
                              }}
                            />
                            <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                              {item.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {chart.type === 'pie' && (
                    <div className="text-center">
                      <PieChart className="w-24 h-24 text-gray-300 mx-auto" />
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {(chart.data as { name: string; value: number }[]).slice(0, 5).map((item, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {item.name}: {item.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
        Generated: {report.generatedAt.toDate().toLocaleString()} • 
        Modules: {report.config.modules.join(', ')} • 
        {report.data.length} records
      </div>
    </div>
  );
};

export default CrossModuleReportViewer;
