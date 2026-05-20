// ============================================================================
// CASH FLOW DASHBOARD
// DawinOS v2.0 - Financial Management Module
// Main dashboard for cash flow management
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  FileText,
  Building2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { CashPositionCard } from './CashPositionCard';
import { CashFlowChart } from './CashFlowChart';
import { CashTransactionList } from './CashTransactionList';
import { CashForecastTable } from './CashForecastTable';
import { useCashFlow } from '../../hooks/useCashFlow';
import { useCashForecast } from '../../hooks/useCashForecast';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CashFlowDashboardProps {
  companyId: string;
}

type TabValue = 'overview' | 'transactions' | 'forecast' | 'reconciliation';

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const CashFlowDashboard: React.FC<CashFlowDashboardProps> = ({
  companyId,
}) => {
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [periodFilter, setPeriodFilter] = useState<string>('30');

  // Calculate date range based on period filter
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(periodFilter));
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  // Cash flow hook
  const {
    transactions,
    position,
    summary,
    trends,
    analysis,
    isLoading: isLoadingCashFlow,
    error: cashFlowError,
    loadPosition,
    loadSummary,
    loadTrends,
    loadAnalysis,
    refresh: refreshCashFlow,
  } = useCashFlow({
    companyId,
    autoLoad: true,
    defaultFilters: { startDate, endDate },
  });

  // Forecast hook
  const {
    forecasts,
    currentForecast,
    isLoading: isLoadingForecast,
    error: forecastError,
    loadForecast,
    updatePeriod,
  } = useCashForecast({
    companyId,
    autoLoad: true,
  });

  // Load data when period changes
  useEffect(() => {
    const { startDate, endDate } = getDateRange();
    loadSummary(startDate, endDate);
    loadTrends(startDate, endDate, 'monthly');
    loadAnalysis(startDate, endDate);
  }, [periodFilter]);

  // Load active forecast
  useEffect(() => {
    const activeForecast = forecasts.find(f => f.status === 'active');
    if (activeForecast) {
      loadForecast(activeForecast.id);
    }
  }, [forecasts]);

  const isLoading = isLoadingCashFlow || isLoadingForecast;
  const error = cashFlowError || forecastError;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'transactions', label: 'Transactions', icon: FileText },
    { id: 'forecast', label: 'Forecast', icon: TrendingUp },
    { id: 'reconciliation', label: 'Reconciliation', icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Cash Flow Management</h1>
        <div className="flex items-center gap-3">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C]"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 6 Months</option>
            <option value="365">Last Year</option>
          </select>
          <button
            onClick={refreshCashFlow}
            disabled={isLoading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6b2449]">
            <Plus className="w-4 h-4" />
            New Transaction
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabValue)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[#872E5C] border-[#872E5C]'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#872E5C] animate-spin" />
        </div>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && !isLoading && (
        <div className="space-y-6">
          {/* Top Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Position */}
            <div className="lg:col-span-1">
              {position && (
                <CashPositionCard
                  position={position}
                  onRefresh={() => loadPosition()}
                  isLoading={isLoadingCashFlow}
                />
              )}
            </div>

            {/* Quick Stats */}
            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Total Inflows</p>
                <p className="text-xl font-bold text-green-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {summary ? formatCurrency(
                    summary.categoryBreakdown.reduce((sum, c) => sum + c.inflows, 0),
                    'UGX' as CurrencyCode
                  ) : '-'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Total Outflows</p>
                <p className="text-xl font-bold text-red-600 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {summary ? formatCurrency(
                    summary.categoryBreakdown.reduce((sum, c) => sum + c.outflows, 0),
                    'UGX' as CurrencyCode
                  ) : '-'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Net Cash Flow</p>
                <p className={`text-xl font-bold ${summary && summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary ? formatCurrency(summary.netChange, 'UGX' as CurrencyCode) : '-'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Runway</p>
                <p className="text-xl font-bold text-gray-900 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {analysis ? `${analysis.runwayMonths.toFixed(1)} mo` : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Cash Flow Chart */}
          <CashFlowChart
            trends={trends}
            summary={summary || undefined}
            currency="UGX"
          />

          {/* Recent Transactions */}
          <CashTransactionList
            transactions={transactions.slice(0, 10)}
          />
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && !isLoading && (
        <CashTransactionList transactions={transactions} />
      )}

      {/* Forecast Tab */}
      {activeTab === 'forecast' && !isLoading && (
        <div>
          {currentForecast ? (
            <CashForecastTable
              forecast={currentForecast}
              onUpdatePeriod={(periodIndex, updates) =>
                updatePeriod(currentForecast.id, periodIndex, updates)
              }
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Forecast</h3>
              <p className="text-gray-500 mb-4">
                Create a cash flow forecast to plan ahead
              </p>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6b2449]">
                <Plus className="w-4 h-4" />
                Create Forecast
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Tab */}
      {activeTab === 'reconciliation' && !isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Bank Reconciliation</h3>
          <p className="text-gray-500 mb-4">
            Match bank statements with your book records
          </p>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-lg hover:bg-[#6b2449]">
            <Plus className="w-4 h-4" />
            Start New Reconciliation
          </button>
        </div>
      )}
    </div>
  );
};

export default CashFlowDashboard;
