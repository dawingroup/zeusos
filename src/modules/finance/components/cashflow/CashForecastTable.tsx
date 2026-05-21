// ============================================================================
// CASH FORECAST TABLE
// ZeusOS v2.0 - Financial Management Module
// Displays and edits cash flow forecast periods
// ============================================================================

import React, { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Edit2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { CashForecast, CashForecastPeriod } from '../../types/cashflow.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import { CASH_FLOW_CATEGORY_LABELS, CASH_POSITION_THRESHOLDS } from '../../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface CashForecastTableProps {
  forecast: CashForecast;
  onUpdatePeriod?: (periodIndex: number, updates: Partial<CashForecastPeriod>) => void;
  readonly?: boolean;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const CashForecastTable: React.FC<CashForecastTableProps> = ({
  forecast,
  onUpdatePeriod,
  readonly = false,
}) => {
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});

  const currency = forecast.currency as CurrencyCode;

  const isLowBalance = (balance: number) => {
    return balance < CASH_POSITION_THRESHOLDS.MINIMUM_BALANCE;
  };

  const handleExpand = (periodIndex: number) => {
    setExpandedPeriod(expandedPeriod === periodIndex ? null : periodIndex);
  };

  const handleEdit = (periodIndex: number, period: CashForecastPeriod) => {
    setEditingPeriod(periodIndex);
    // Initialize edit values
    const values: Record<string, number> = {};
    period.inflows.forEach((item, i) => {
      values[`inflow_${i}`] = item.amount;
    });
    period.outflows.forEach((item, i) => {
      values[`outflow_${i}`] = item.amount;
    });
    setEditValues(values);
  };

  const handleSave = (periodIndex: number) => {
    const period = forecast.periods.find(p => p.periodIndex === periodIndex);
    if (!period || !onUpdatePeriod) return;

    // Calculate new totals
    const newInflows = period.inflows.map((item, i) => ({
      ...item,
      amount: editValues[`inflow_${i}`] ?? item.amount,
    }));
    const newOutflows = period.outflows.map((item, i) => ({
      ...item,
      amount: editValues[`outflow_${i}`] ?? item.amount,
    }));

    const totalInflows = newInflows.reduce((sum, i) => sum + i.amount, 0);
    const totalOutflows = newOutflows.reduce((sum, i) => sum + i.amount, 0);

    onUpdatePeriod(periodIndex, {
      inflows: newInflows,
      outflows: newOutflows,
      totalInflows,
      totalOutflows,
      netCashFlow: totalInflows - totalOutflows,
    });

    setEditingPeriod(null);
    setEditValues({});
  };

  const handleCancel = () => {
    setEditingPeriod(null);
    setEditValues({});
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#872E5C]" />
              {forecast.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {forecast.startDate.toLocaleDateString()} - {forecast.endDate.toLocaleDateString()}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            forecast.status === 'active' ? 'bg-green-100 text-green-800' :
            forecast.status === 'draft' ? 'bg-gray-100 text-gray-800' :
            'bg-gray-100 text-gray-600'
          }`}>
            {forecast.status.charAt(0).toUpperCase() + forecast.status.slice(1)}
          </span>
        </div>

        {/* Cash Gap Warning */}
        {forecast.cashGapPeriods.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium text-sm">
                Cash Shortfall Detected in {forecast.cashGapPeriods.length} Period(s)
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              Minimum balance drops to {formatCurrency(forecast.minimumCashBalance, currency)} on{' '}
              {forecast.minimumBalanceDate.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-sticky-first-col">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left font-medium text-gray-700">Period</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Opening</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Inflows</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Outflows</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Net Flow</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Closing</th>
              {!readonly && <th className="w-20 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {forecast.periods.map((period) => (
              <React.Fragment key={period.periodIndex}>
                {/* Main Row */}
                <tr className={`hover:bg-gray-50 ${isLowBalance(period.closingBalance) ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleExpand(period.periodIndex)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {expandedPeriod === period.periodIndex ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{period.periodLabel}</div>
                    <div className="text-xs text-gray-500">
                      {period.startDate.toLocaleDateString()} - {period.endDate.toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">
                    {formatCurrency(period.openingBalance, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-600">
                    +{formatCurrency(period.totalInflows, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    -{formatCurrency(period.totalOutflows, currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-medium ${period.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {period.netCashFlow >= 0 ? '+' : ''}{formatCurrency(period.netCashFlow, currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isLowBalance(period.closingBalance) && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-mono font-semibold text-gray-900">
                        {formatCurrency(period.closingBalance, currency)}
                      </span>
                    </div>
                  </td>
                  {!readonly && (
                    <td className="px-4 py-3">
                      {editingPeriod === period.periodIndex ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSave(period.periodIndex)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(period.periodIndex, period)}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>

                {/* Expanded Details */}
                {expandedPeriod === period.periodIndex && (
                  <tr className="bg-gray-50">
                    <td colSpan={readonly ? 7 : 8} className="px-8 py-4">
                      <div className="grid grid-cols-2 gap-8">
                        {/* Inflows */}
                        <div>
                          <h4 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Inflows
                          </h4>
                          <div className="space-y-2">
                            {period.inflows.map((item, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">
                                  {CASH_FLOW_CATEGORY_LABELS[item.category] || item.label}
                                  {item.isRecurring && (
                                    <span className="ml-1 text-xs text-gray-400">(recurring)</span>
                                  )}
                                </span>
                                {editingPeriod === period.periodIndex ? (
                                  <input
                                    type="number"
                                    value={editValues[`inflow_${i}`] ?? item.amount}
                                    onChange={(e) => setEditValues({
                                      ...editValues,
                                      [`inflow_${i}`]: Number(e.target.value),
                                    })}
                                    className="w-32 px-2 py-1 text-right text-sm border border-gray-300 rounded"
                                  />
                                ) : (
                                  <span className="text-sm font-mono text-green-600">
                                    {formatCurrency(item.amount, currency)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {period.inflows.length === 0 && (
                              <p className="text-sm text-gray-400">No inflows</p>
                            )}
                          </div>
                        </div>

                        {/* Outflows */}
                        <div>
                          <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            Outflows
                          </h4>
                          <div className="space-y-2">
                            {period.outflows.map((item, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">
                                  {CASH_FLOW_CATEGORY_LABELS[item.category] || item.label}
                                  {item.isRecurring && (
                                    <span className="ml-1 text-xs text-gray-400">(recurring)</span>
                                  )}
                                </span>
                                {editingPeriod === period.periodIndex ? (
                                  <input
                                    type="number"
                                    value={editValues[`outflow_${i}`] ?? item.amount}
                                    onChange={(e) => setEditValues({
                                      ...editValues,
                                      [`outflow_${i}`]: Number(e.target.value),
                                    })}
                                    className="w-32 px-2 py-1 text-right text-sm border border-gray-300 rounded"
                                  />
                                ) : (
                                  <span className="text-sm font-mono text-red-600">
                                    {formatCurrency(item.amount, currency)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {period.outflows.length === 0 && (
                              <p className="text-sm text-gray-400">No outflows</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Min Balance</p>
            <p className={`font-semibold ${isLowBalance(forecast.minimumCashBalance) ? 'text-red-600' : 'text-gray-900'}`}>
              {formatCurrency(forecast.minimumCashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Max Balance</p>
            <p className="font-semibold text-gray-900">
              {formatCurrency(forecast.maximumCashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Avg Balance</p>
            <p className="font-semibold text-gray-900">
              {formatCurrency(forecast.averageCashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Cash Gaps</p>
            <p className={`font-semibold ${forecast.cashGapPeriods.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {forecast.cashGapPeriods.length} periods
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashForecastTable;
