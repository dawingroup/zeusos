/**
 * AccountForecastDrawer
 * Right-side slide-in drawer for a single forecast account row.
 *  - Line chart: historical actuals (solid) + forecast (dotted) via Recharts
 *  - Prediction method selector + lookback window
 *  - Cash timing allocation (same month / +1 / +2 / +3)
 */

import { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { Button } from '@/core/components/ui/button';
import type {
  ValueRule,
  ValueRuleType,
  SmartPredictionParams,
  ConstantGrowingParams,
  DirectEntryParams,
  LinkToBudgetParams,
  CashTimingAllocation,
} from '../../types/forecast.types';
import { periodLabel } from '../../types/forecast.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DrawerAccountData {
  accountId: string;
  label: string;
  /** Historical actuals: { period: 'YYYY-MM', value: number }[] — sorted ascending */
  historicalData: Array<{ period: string; value: number }>;
  /** Forecast values: { period: 'YYYY-MM', value: number }[] — sorted ascending */
  forecastData: Array<{ period: string; value: number }>;
  currentRule: ValueRule | null;
}

interface Props {
  data: DrawerAccountData;
  forecastPeriods: string[];
  budgets: Array<{ id: string; name: string }>;
  onSave: (ruleType: ValueRuleType, params: object, cashTiming: CashTimingAllocation) => void;
  onDelete: () => void;
  onClose: () => void;
  saving?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500 capitalize">{p.name}:</span>
          <span className="font-semibold text-gray-800">{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function AccountForecastDrawer({
  data,
  forecastPeriods,
  budgets,
  onSave,
  onDelete,
  onClose,
  saving,
}: Props) {
  const { accountId, label, historicalData, forecastData, currentRule } = data;

  // ── Rule type state ──
  const [ruleType, setRuleType] = useState<ValueRuleType>(
    currentRule?.ruleType ?? 'smart_prediction'
  );

  // ── Smart Prediction state ──
  const spDefault = currentRule?.ruleType === 'smart_prediction'
    ? (currentRule.params as SmartPredictionParams)
    : { method: 'linear_regression' as const, lookbackMonths: 12 as const };

  const [spMethod, setSpMethod] = useState<'linear_regression' | 'rolling_average'>(
    spDefault.method ?? 'linear_regression'
  );
  const [spLookback, setSpLookback] = useState<3 | 6 | 12 | 24>(
    (spDefault.lookbackMonths ?? 12) as 3 | 6 | 12 | 24
  );

  // ── Constant/Growing state ──
  const cgDefault = currentRule?.ruleType === 'constant_growing'
    ? (currentRule.params as ConstantGrowingParams)
    : { baseAmount: 0, annualGrowthRate: 0, startPeriod: forecastPeriods[0] ?? '' };
  const [cgBase, setCgBase] = useState(cgDefault.baseAmount);
  const [cgRate, setCgRate] = useState(cgDefault.annualGrowthRate * 100);

  // ── Direct Entry state ──
  const deDefault = currentRule?.ruleType === 'direct_entry'
    ? (currentRule.params as DirectEntryParams).values
    : {};
  const [deValues, setDeValues] = useState<Record<string, number>>(deDefault);

  // ── Link to Budget state ──
  const lbDefault = currentRule?.ruleType === 'link_to_budget'
    ? (currentRule.params as LinkToBudgetParams)
    : { budgetId: budgets[0]?.id ?? '', adjustmentPct: 0 };
  const [lbBudgetId, setLbBudgetId] = useState(lbDefault.budgetId);
  const [lbAdjPct, setLbAdjPct]     = useState(lbDefault.adjustmentPct * 100);

  // ── Cash timing state ──
  const [lagMonths, setLagMonths] = useState<0 | 1 | 2 | 3>(
    (currentRule?.cashTiming?.lagMonths ?? 0) as 0 | 1 | 2 | 3
  );

  // ── Build chart data ──────────────────────────────────────────────────────
  // Combine historical + forecast into a single series, marking the boundary
  const firstForecastPeriod = forecastData[0]?.period;

  const chartData: Array<{ period: string; label: string; actual?: number; forecast?: number }> = [
    ...historicalData.map(d => ({
      period: d.period,
      label: periodLabel(d.period),
      actual: d.value,
    })),
    ...forecastData.map(d => ({
      period: d.period,
      label: periodLabel(d.period),
      forecast: d.value,
    })),
  ];

  // Overlap the last actual point with the first forecast point for a continuous line
  if (historicalData.length > 0 && forecastData.length > 0) {
    const lastActual = historicalData[historicalData.length - 1];
    const firstForecast = chartData.find(d => d.period === forecastData[0].period);
    if (firstForecast) {
      firstForecast.actual = lastActual.value;
    }
  }

  // ── Handle save ──────────────────────────────────────────────────────────
  const handleSave = () => {
    let params: object;
    switch (ruleType) {
      case 'smart_prediction':
        params = { method: spMethod, lookbackMonths: spLookback } satisfies SmartPredictionParams;
        break;
      case 'constant_growing':
        params = {
          baseAmount: cgBase,
          annualGrowthRate: cgRate / 100,
          startPeriod: forecastPeriods[0] ?? '',
        } satisfies ConstantGrowingParams;
        break;
      case 'direct_entry':
        params = { values: deValues } satisfies DirectEntryParams;
        break;
      case 'link_to_budget':
        params = {
          budgetId: lbBudgetId,
          adjustmentPct: lbAdjPct / 100,
        } satisfies LinkToBudgetParams;
        break;
      default:
        params = {};
    }
    onSave(ruleType, params, { lagMonths });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="relative ml-auto w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">{label}</h3>
              <p className="text-xs text-gray-400 font-mono">{accountId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Chart ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Historical vs Forecast
            </p>
            <div className="h-52 w-full">
              <SafeResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={v => fmtK(v)}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {firstForecastPeriod && (
                    <ReferenceLine
                      x={periodLabel(firstForecastPeriod)}
                      stroke="#d1d5db"
                      strokeDasharray="4 2"
                      label={{ value: 'Forecast →', position: 'insideTopRight', fontSize: 9, fill: '#9ca3af' }}
                    />
                  )}
                  {/* Actuals — solid blue */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="actual"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  {/* Forecast — dotted green */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="forecast"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </SafeResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 bg-blue-500 rounded" />
                <span className="text-xs text-gray-500">Actuals</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 rounded" style={{ background: 'repeating-linear-gradient(90deg, #10b981 0, #10b981 5px, transparent 5px, transparent 8px)' }} />
                <span className="text-xs text-gray-500">Forecast</span>
              </div>
            </div>
          </div>

          {/* ── Prediction Method ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Prediction Method
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { value: 'smart_prediction', label: 'Smart Prediction', desc: 'Linear regression or rolling average of QBO actuals' },
                { value: 'constant_growing', label: 'Constant / Growing', desc: 'Fixed base with optional annual growth rate' },
                { value: 'direct_entry',     label: 'Direct Entry',     desc: 'Manually enter amounts per month' },
                { value: 'link_to_budget',   label: 'Link to Budget',   desc: 'Pull from an approved DawinOS budget' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRuleType(opt.value as ValueRuleType)}
                  className={`text-left border rounded-lg px-3 py-2.5 transition-colors ${
                    ruleType === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p className={`text-xs font-medium ${ruleType === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Smart Prediction params */}
            {ruleType === 'smart_prediction' && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Algorithm</label>
                  <div className="flex gap-2 mt-1">
                    {(['linear_regression', 'rolling_average'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setSpMethod(m)}
                        className={`flex-1 text-xs py-1.5 px-2 rounded border transition-colors ${
                          spMethod === m
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {m === 'linear_regression' ? 'Linear Regression' : 'Rolling Average'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Lookback Window</label>
                  <select
                    value={spLookback}
                    onChange={e => setSpLookback(Number(e.target.value) as 3 | 6 | 12 | 24)}
                    className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                    <option value={24}>24 months</option>
                  </select>
                </div>
              </div>
            )}

            {/* Constant/Growing params */}
            {ruleType === 'constant_growing' && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700">Base Monthly Amount</label>
                  <input
                    type="number"
                    value={cgBase}
                    onChange={e => setCgBase(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
                    placeholder="e.g. 50000"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700">Annual Growth Rate (%)</label>
                  <input
                    type="number"
                    value={cgRate}
                    onChange={e => setCgRate(parseFloat(e.target.value) || 0)}
                    step={0.1}
                    className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
                    placeholder="0 = flat"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">0 = flat amount. Compounded monthly.</p>
                </div>
              </div>
            )}

            {/* Direct Entry params */}
            {ruleType === 'direct_entry' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Monthly Amounts</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {forecastPeriods.map(p => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="w-16 text-[10px] text-gray-500 shrink-0">{periodLabel(p)}</span>
                      <input
                        type="number"
                        value={deValues[p] ?? ''}
                        onChange={e => setDeValues(prev => ({ ...prev, [p]: parseFloat(e.target.value) || 0 }))}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link to Budget params */}
            {ruleType === 'link_to_budget' && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {budgets.length === 0 ? (
                  <p className="text-xs text-yellow-600">No budgets found. Create one in the Budgets tab first.</p>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-gray-700">Budget</label>
                    <select
                      value={lbBudgetId}
                      onChange={e => setLbBudgetId(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
                    >
                      {budgets.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-700">Adjustment (%)</label>
                  <input
                    type="number"
                    value={lbAdjPct}
                    onChange={e => setLbAdjPct(parseFloat(e.target.value) || 0)}
                    step={0.5}
                    className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs"
                    placeholder="0 = no adjustment"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">+5 = 5% over budget.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Cash Timing Allocation ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Cash Timing Allocation
            </p>
            <p className="text-[10px] text-gray-400 mb-3">
              When does the cash actually leave/enter the bank account?
            </p>
            <div className="grid grid-cols-4 gap-2">
              {([0, 1, 2, 3] as const).map(lag => (
                <button
                  key={lag}
                  onClick={() => setLagMonths(lag)}
                  className={`text-center border rounded-lg py-2 transition-colors ${
                    lagMonths === lag
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <p className="text-xs font-semibold">{lag === 0 ? 'Same' : `+${lag}`}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{lag === 0 ? 'month' : lag === 1 ? 'month' : 'months'}</p>
                </button>
              ))}
            </div>
            {lagMonths > 0 && (
              <p className="text-[10px] text-gray-400 mt-2">
                Cash for this line item will flow {lagMonths} month{lagMonths > 1 ? 's' : ''} after it's recognised in P&amp;L.
              </p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t bg-gray-50 shrink-0">
          {currentRule ? (
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600 underline"
              disabled={saving}
            >
              Remove rule
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || (ruleType === 'link_to_budget' && budgets.length === 0)}
            >
              {saving ? 'Applying…' : 'Apply Rule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
