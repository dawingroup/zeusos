// ============================================================================
// CASH FLOW CHART
// ZeusOS v2.0 - Financial Management Module
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
    <div className="bg-card rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#872E5C]" />
            Cash Flow Analysis
          </h3>
          
          {/* Chart Type Toggle */}
          <div className="flex bg-[var(--bg-sunken)] rounded-lg p-1">
            <button
              onClick={() => setChartType('trend')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                chartType === 'trend'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('waterfall')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                chartType === 'waterfall'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('breakdown')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                chartType === 'breakdown'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
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
              <div className="text-center py-12 text-muted-foreground">
                No trend data available
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex justify-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[var(--rag-green)]" />
                    <span className="text-sm text-muted-foreground">Inflows</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[var(--rag-red)]" />
                    <span className="text-sm text-muted-foreground">Outflows</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[var(--rag-blue)]" />
                    <span className="text-sm text-muted-foreground">Net Balance</span>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-64 flex items-end gap-2">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-48 flex items-end justify-center gap-1">
                        {/* Inflows Bar */}
                        <div
                          className="w-1/3 bg-[var(--rag-green)] rounded-t transition-all duration-300 hover:bg-[var(--rag-green)]"
                          style={{ height: getBarHeight(trend.inflows) }}
                          title={`Inflows: ${formatCurrency(trend.inflows, currencyCode)}`}
                        />
                        {/* Outflows Bar */}
                        <div
                          className="w-1/3 bg-[var(--rag-red)] rounded-t transition-all duration-300 hover:bg-[var(--rag-red)]"
                          style={{ height: getBarHeight(trend.outflows) }}
                          title={`Outflows: ${formatCurrency(trend.outflows, currencyCode)}`}
                        />
                        {/* Net Line Point */}
                        <div
                          className="w-1/3 bg-[var(--rag-blue)] rounded-t transition-all duration-300 hover:bg-[var(--rag-blue)]"
                          style={{ height: getBarHeight(Math.abs(trend.netCashFlow)) }}
                          title={`Net: ${formatCurrency(trend.netCashFlow, currencyCode)}`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground truncate w-full text-center">
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
                <div className="w-32 text-sm text-muted-foreground">Opening Balance</div>
                <div className="flex-1 h-8 bg-[var(--bg-sunken)] rounded relative">
                  <div
                    className="h-full bg-[var(--bg-sunken)] rounded"
                    style={{ width: '60%' }}
                  />
                </div>
                <div className="w-32 text-right font-medium">
                  {formatCurrency(summary.openingBalance, currencyCode)}
                </div>
              </div>

              {/* Operating */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-muted-foreground">Operating</div>
                <div className="flex-1 h-8 bg-[var(--bg-sunken)] rounded relative">
                  <div
                    className={`h-full rounded ${summary.operatingCashFlow >= 0 ? 'bg-[var(--rag-green)]' : 'bg-[var(--rag-red)]'}`}
                    style={{ width: `${Math.min(Math.abs(summary.operatingCashFlow) / maxValue * 100, 100)}%` }}
                  />
                </div>
                <div className={`w-32 text-right font-medium ${summary.operatingCashFlow >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
                  {summary.operatingCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.operatingCashFlow, currencyCode)}
                </div>
              </div>

              {/* Investing */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-muted-foreground">Investing</div>
                <div className="flex-1 h-8 bg-[var(--bg-sunken)] rounded relative">
                  <div
                    className={`h-full rounded ${summary.investingCashFlow >= 0 ? 'bg-[var(--rag-green)]' : 'bg-[var(--rag-red)]'}`}
                    style={{ width: `${Math.min(Math.abs(summary.investingCashFlow) / maxValue * 100, 100)}%` }}
                  />
                </div>
                <div className={`w-32 text-right font-medium ${summary.investingCashFlow >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
                  {summary.investingCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.investingCashFlow, currencyCode)}
                </div>
              </div>

              {/* Financing */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm text-muted-foreground">Financing</div>
                <div className="flex-1 h-8 bg-[var(--bg-sunken)] rounded relative">
                  <div
                    className={`h-full rounded ${summary.financingCashFlow >= 0 ? 'bg-[var(--rag-green)]' : 'bg-[var(--rag-red)]'}`}
                    style={{ width: `${Math.min(Math.abs(summary.financingCashFlow) / maxValue * 100, 100)}%` }}
                  />
                </div>
                <div className={`w-32 text-right font-medium ${summary.financingCashFlow >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
                  {summary.financingCashFlow >= 0 ? '+' : ''}{formatCurrency(summary.financingCashFlow, currencyCode)}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-[var(--border-subtle)] my-2" />

              {/* Closing Balance */}
              <div className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-foreground">Closing Balance</div>
                <div className="flex-1 h-8 bg-[var(--bg-sunken)] rounded relative">
                  <div
                    className="h-full bg-[#872E5C] rounded"
                    style={{ width: '70%' }}
                  />
                </div>
                <div className="w-32 text-right font-bold text-foreground">
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
              <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-[var(--rag-green)]" />
                Inflows by Category
              </h4>
              <div className="space-y-3">
                {categoryBreakdown.inflows.slice(0, 5).map((cat, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{cat.label}</span>
                      <span className="font-medium text-[var(--rag-green)]">
                        {formatCurrency(cat.inflows, currencyCode)}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-sunken)] rounded-full">
                      <div
                        className="h-full bg-[var(--rag-green)] rounded-full"
                        style={{ width: `${(cat.inflows / (categoryBreakdown.inflows[0]?.inflows || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {categoryBreakdown.inflows.length === 0 && (
                  <p className="text-sm text-muted-foreground">No inflows in period</p>
                )}
              </div>
            </div>

            {/* Outflows */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-[var(--rag-red)]" />
                Outflows by Category
              </h4>
              <div className="space-y-3">
                {categoryBreakdown.outflows.slice(0, 5).map((cat, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{cat.label}</span>
                      <span className="font-medium text-[var(--rag-red)]">
                        {formatCurrency(cat.outflows, currencyCode)}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-sunken)] rounded-full">
                      <div
                        className="h-full bg-[var(--rag-red)] rounded-full"
                        style={{ width: `${(cat.outflows / (categoryBreakdown.outflows[0]?.outflows || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {categoryBreakdown.outflows.length === 0 && (
                  <p className="text-sm text-muted-foreground">No outflows in period</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No data state */}
        {chartType !== 'trend' && !summary && (
          <div className="text-center py-12 text-muted-foreground">
            No summary data available
          </div>
        )}
      </div>

      {/* Activity Summary Footer */}
      {summary && (
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
          <div className="grid grid-cols-3 gap-4 text-center">
            {activityBreakdown.map((item) => (
              <div key={item.activity}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-sm font-semibold ${item.amount >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
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
