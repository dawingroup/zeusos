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
    <div className="bg-card rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#872E5C]" />
              {forecast.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {forecast.startDate.toLocaleDateString()} - {forecast.endDate.toLocaleDateString()}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            forecast.status === 'active' ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' :
            forecast.status === 'draft' ? 'bg-[var(--bg-sunken)] text-foreground' :
            'bg-[var(--bg-sunken)] text-muted-foreground'
          }`}>
            {forecast.status.charAt(0).toUpperCase() + forecast.status.slice(1)}
          </span>
        </div>

        {/* Cash Gap Warning */}
        {forecast.cashGapPeriods.length > 0 && (
          <div className="mt-4 p-3 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg">
            <div className="flex items-center gap-2 text-[var(--rag-red)]">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium text-sm">
                Cash Shortfall Detected in {forecast.cashGapPeriods.length} Period(s)
              </span>
            </div>
            <p className="text-sm text-[var(--rag-red)] mt-1">
              Minimum balance drops to {formatCurrency(forecast.minimumCashBalance, currency)} on{' '}
              {forecast.minimumBalanceDate.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-sticky-first-col">
          <thead className="bg-[var(--bg-sunken)]">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Opening</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Inflows</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Outflows</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Flow</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Closing</th>
              {!readonly && <th className="w-20 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {forecast.periods.map((period) => (
              <React.Fragment key={period.periodIndex}>
                {/* Main Row */}
                <tr className={`hover:bg-[var(--bg-sunken)] ${isLowBalance(period.closingBalance) ? 'bg-[var(--rag-red-soft)]' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleExpand(period.periodIndex)}
                      className="p-1 hover:bg-[var(--bg-sunken)] rounded"
                    >
                      {expandedPeriod === period.periodIndex ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{period.periodLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {period.startDate.toLocaleDateString()} - {period.endDate.toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {formatCurrency(period.openingBalance, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--rag-green)]">
                    +{formatCurrency(period.totalInflows, currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--rag-red)]">
                    -{formatCurrency(period.totalOutflows, currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-medium ${period.netCashFlow >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}>
                      {period.netCashFlow >= 0 ? '+' : ''}{formatCurrency(period.netCashFlow, currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isLowBalance(period.closingBalance) && (
                        <AlertTriangle className="w-4 h-4 text-[var(--rag-red)]" />
                      )}
                      <span className="font-mono font-semibold text-foreground">
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
                            className="p-1 text-[var(--rag-green)] hover:bg-[var(--rag-green-soft)] rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-1 text-muted-foreground hover:bg-[var(--bg-sunken)] rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(period.periodIndex, period)}
                          className="p-1 text-muted-foreground hover:bg-[var(--bg-sunken)] rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>

                {/* Expanded Details */}
                {expandedPeriod === period.periodIndex && (
                  <tr className="bg-[var(--bg-sunken)]">
                    <td colSpan={readonly ? 7 : 8} className="px-8 py-4">
                      <div className="grid grid-cols-2 gap-8">
                        {/* Inflows */}
                        <div>
                          <h4 className="text-sm font-medium text-[var(--rag-green)] mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Inflows
                          </h4>
                          <div className="space-y-2">
                            {period.inflows.map((item, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  {CASH_FLOW_CATEGORY_LABELS[item.category] || item.label}
                                  {item.isRecurring && (
                                    <span className="ml-1 text-xs text-[var(--fg-tertiary)]">(recurring)</span>
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
                                    className="w-32 px-2 py-1 text-right text-sm border border-[var(--border-default)] rounded"
                                  />
                                ) : (
                                  <span className="text-sm font-mono text-[var(--rag-green)]">
                                    {formatCurrency(item.amount, currency)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {period.inflows.length === 0 && (
                              <p className="text-sm text-[var(--fg-tertiary)]">No inflows</p>
                            )}
                          </div>
                        </div>

                        {/* Outflows */}
                        <div>
                          <h4 className="text-sm font-medium text-[var(--rag-red)] mb-3 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            Outflows
                          </h4>
                          <div className="space-y-2">
                            {period.outflows.map((item, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  {CASH_FLOW_CATEGORY_LABELS[item.category] || item.label}
                                  {item.isRecurring && (
                                    <span className="ml-1 text-xs text-[var(--fg-tertiary)]">(recurring)</span>
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
                                    className="w-32 px-2 py-1 text-right text-sm border border-[var(--border-default)] rounded"
                                  />
                                ) : (
                                  <span className="text-sm font-mono text-[var(--rag-red)]">
                                    {formatCurrency(item.amount, currency)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {period.outflows.length === 0 && (
                              <p className="text-sm text-[var(--fg-tertiary)]">No outflows</p>
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
      <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Min Balance</p>
            <p className={`font-semibold ${isLowBalance(forecast.minimumCashBalance) ? 'text-[var(--rag-red)]' : 'text-foreground'}`}>
              {formatCurrency(forecast.minimumCashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Max Balance</p>
            <p className="font-semibold text-foreground">
              {formatCurrency(forecast.maximumCashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg Balance</p>
            <p className="font-semibold text-foreground">
              {formatCurrency(forecast.averageCashBalance, currency)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Cash Gaps</p>
            <p className={`font-semibold ${forecast.cashGapPeriods.length > 0 ? 'text-[var(--rag-red)]' : 'text-[var(--rag-green)]'}`}>
              {forecast.cashGapPeriods.length} periods
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashForecastTable;
