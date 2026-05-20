// ============================================================================
// CASH FLOW CHART
// DawinOS v2.0 - Financial Management Module
// Visualizes cash flow trends and breakdown
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { CashFlowTrend, CashFlowSummary } from '../../types/cashflow.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import { CASH_FLOW_ACTIVITY_LABELS, CashFlowActivity } from '../../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CashFlowChartProps {
  trends?: CashFlowTrend[];
  summary?: CashFlowSummary;
  currency?: string;
}

type ChartType = 'trend' | 'waterfall' | 'breakdown';

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const CashFlowChart: React.FC<CashFlowChartProps> = ({
  trends = [],
  summary,
  currency = 'UGX',
}) => {
  const [chartType, setChartType] = useState<ChartType>('trend');
  const currencyCode = currency as CurrencyCode;

  // Calculate max value for scaling
  const maxValue = useMemo(() => {
    if (trends.length === 0) return 100;
    const allValues = trends.flatMap(t => [t.inflows, t.outflows, Math.abs(t.closingBalance)]);
    return Math.max(...allValues, 1);
  }, [trends]);

  // Calculate activity breakdown
  const activityBreakdown = useMemo(() => {
    if (!summary) return [];
    return [
      { activity: 'operating' as CashFlowActivity, amount: summary.operatingCashFlow, label: CASH_FLOW_ACTIVITY_LABELS.operating },
      { activity: 'investing' as CashFlowActivity, amount: summary.investingCashFlow, label: CASH_FLOW_ACTIVITY_LABELS.investing },
      { activity: 'financing' as CashFlowActivity, amount: summary.financingCashFlow, label: CASH_FLOW_ACTIVITY_LABELS.financing },
    ];
  }, [summary]);

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    if (!summary) return { inflows: [], outflows: [] };
    const inflows = summary.categoryBreakdown.filter(c => c.inflows > 0).sort((a, b) => b.inflows - a.inflows);
    const outflows = summary.categoryBreakdown.filter(c => c.outflows > 0).sort((a, b) => b.outflows - a.outflows);
    return { inflows, outflows };
  }, [summary]);

  const getBarHeight = (value: number) => {
    return `${Math.max((value / maxValue) * 100, 2)}%`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#872E5C]" />
            Cash Flow Analysis
          </h3>
          
          {/* Chart Type Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setChartType('trend')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                chartType === 'trend'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('waterfall')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                chartType === 'waterfall'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('breakdown')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                chartType === 'breakdown'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PieChart className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {/* Trend Chart */}
        {chartType === 'trend' && (
          <div>
            {trends.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No trend data available
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex justify-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-600">Inflows</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-600">Outflows</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-gray-600">Net Balance</span>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-64 flex items-end gap-2">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-48 flex items-end justify-center gap-1">
                        {/* Inflows Bar */}
                        <div
                          className="w-1/3 bg-green-500 rounded-t transition-all duration-300 hover:bg-green-600"
                          style={{ height: getBarHeight(trend.inflows) }}
                          title={`Inflows: ${formatCurrency(trend.inflows, currencyCode)}`}
                        />
                        {/* Outflows Bar */}
                        <div
                          className="w-1/3 bg-red-500 rounded-t transition-all duration-300 hover:bg-red-600"
                          style={{ height: getBarHeight(trend.outflows) }}
                          title={`Outflows: ${formatCurrency(trend.outflows, currencyCode)}`}
                        />
                        {/* Net Line Point */}
                        <div
                          className="w-1/3 bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                          style={{ height: getBarHeight(Math.abs(trend.netCashFlow)) }}
                          title={`Net: ${formatCurrency(trend.netCashFlow, currencyCode)}`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 truncate w-full text-center">
                        {trend.period}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Waterfall Chart */}
        {chartType === 'waterfall' && summary && (
          <div>
            <div className="space-y-4">
              {/* Opening Balance */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">Opening Balance</div>
                <div className="flex-1 h-8 bg-gray-100 rounded relative">
                  <div
                    className="h-full bg-gray-400 rounded"
                    style={{ width: '60%' }}
                  />
                </div>
                <div className="w-32 text-right font-medium">
                  {formatCurrency(summary.openingBalance, currencyCode)}
                </div>
              </div>

              {/* Operating */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">Operating</div>
                <div className="flex-1 h-8 bg-gray-100 rounded relative">
                  <div
                    className={`h-full rounded ${summary.operatingCashFlow >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.abs(summary.operatingCashFlow) / maxValue * 100, 100)}%` }}
                  />
                </div>
                <div className={`w-32 text-right font-medium ${summary.operatingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.operatingCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.operatingCashFlow, currencyCode)}
                </div>
              </div>

              {/* Investing */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">Investing</div>
                <div className="flex-1 h-8 bg-gray-100 rounded relative">
                  <div
                    className={`h-full rounded ${summary.investingCashFlow >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.abs(summary.investingCashFlow) / maxValue * 100, 100)}%` }}
                  />
                </div>
                <div className={`w-32 text-right font-medium ${summary.investingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.investingCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.investingCashFlow, currencyCode)}
                </div>
              </div>

              {/* Financing */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">Financing</div>
                <div className="flex-1 h-8 bg-gray-100 rounded relative">
                  <div
                    className={`h-full rounded ${summary.financingCashFlow >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.abs(summary.financingCashFlow) / maxValue * 100, 100)}%` }}
                  />
                </div>
                <div className={`w-32 text-right font-medium ${summary.financingCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.financingCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.financingCashFlow, currencyCode)}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-2" />

              {/* Closing Balance */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-900">Closing Balance</div>
                <div className="flex-1 h-8 bg-gray-100 rounded relative">
                  <div
                    className="h-full bg-[#872E5C] rounded"
                    style={{ width: '70%' }}
                  />
                </div>
                <div className="w-32 text-right font-bold text-gray-900">
                  {formatCurrency(summary.closingBalance, currencyCode)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Chart */}
        {chartType === 'breakdown' && summary && (
          <div className="grid grid-cols-2 gap-6">
            {/* Inflows */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-green-600" />
                Inflows by Category
              </h4>
              <div className="space-y-3">
                {categoryBreakdown.inflows.slice(0, 5).map((cat, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{cat.label}</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(cat.inflows, currencyCode)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${(cat.inflows / (categoryBreakdown.inflows[0]?.inflows || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {categoryBreakdown.inflows.length === 0 && (
                  <p className="text-sm text-gray-500">No inflows in period</p>
                )}
              </div>
            </div>

            {/* Outflows */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                Outflows by Category
              </h4>
              <div className="space-y-3">
                {categoryBreakdown.outflows.slice(0, 5).map((cat, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{cat.label}</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(cat.outflows, currencyCode)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(cat.outflows / (categoryBreakdown.outflows[0]?.outflows || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {categoryBreakdown.outflows.length === 0 && (
                  <p className="text-sm text-gray-500">No outflows in period</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No data state */}
        {chartType !== 'trend' && !summary && (
          <div className="text-center py-12 text-gray-500">
            No summary data available
          </div>
        )}
      </div>

      {/* Activity Summary Footer */}
      {summary && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            {activityBreakdown.map((item) => (
              <div key={item.activity}>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={`text-sm font-semibold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount, currencyCode)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlowChart;
