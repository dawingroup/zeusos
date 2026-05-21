/**
 * ValueRuleEditor
 * Modal for configuring a value rule on a forecast account row.
 * Supports: smart_prediction, constant_growing, direct_entry, link_to_budget
 */

import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import type {
  ValueRule,
  ValueRuleType,
  SmartPredictionParams,
  ConstantGrowingParams,
  DirectEntryParams,
  LinkToBudgetParams,
} from '../../types/forecast.types';
import { periodLabel } from '../../types/forecast.types';

interface Props {
  accountLabel: string;
  currentRule: ValueRule | null;
  periods: string[];            // YYYY-MM array for direct entry
  budgets: Array<{ id: string; name: string }>;
  onSave: (ruleType: ValueRuleType, params: object) => void;
  onDelete: () => void;
  onCancel: () => void;
  saving?: boolean;
}

const RULE_OPTIONS: Array<{ value: ValueRuleType; label: string; description: string }> = [
  {
    value: 'smart_prediction',
    label: 'Smart Prediction',
    description: 'Rolling average of recent QBO actuals. Best for stable accounts.',
  },
  {
    value: 'constant_growing',
    label: 'Constant / Growing',
    description: 'Start from a base amount and grow at a fixed annual rate.',
  },
  {
    value: 'direct_entry',
    label: 'Direct Entry',
    description: 'Manually enter amounts for each forecast month.',
  },
  {
    value: 'link_to_budget',
    label: 'Link to Budget',
    description: 'Pull amounts from an approved ZeusOS budget.',
  },
];

export function ValueRuleEditor({
  accountLabel,
  currentRule,
  periods,
  budgets,
  onSave,
  onDelete,
  onCancel,
  saving,
}: Props) {
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
  const [lookback, setLookback] = useState<3 | 6 | 12 | 24>(
    (spDefault.lookbackMonths ?? 12) as 3 | 6 | 12 | 24
  );

  // ── Constant/Growing state ──
  const cgDefault = currentRule?.ruleType === 'constant_growing'
    ? currentRule.params as ConstantGrowingParams
    : { baseAmount: 0, annualGrowthRate: 0, startPeriod: periods[0] ?? '' };
  const [cgBase, setCgBase]   = useState(cgDefault.baseAmount);
  const [cgRate, setCgRate]   = useState(cgDefault.annualGrowthRate * 100); // display as %

  // ── Direct Entry state ──
  const deDefault = currentRule?.ruleType === 'direct_entry'
    ? (currentRule.params as DirectEntryParams).values
    : {};
  const [deValues, setDeValues] = useState<Record<string, number>>(deDefault);

  // ── Link to Budget state ──
  const lbDefault = currentRule?.ruleType === 'link_to_budget'
    ? currentRule.params as LinkToBudgetParams
    : { budgetId: budgets[0]?.id ?? '', adjustmentPct: 0 };
  const [lbBudgetId, setLbBudgetId]   = useState(lbDefault.budgetId);
  const [lbAdjPct, setLbAdjPct]       = useState(lbDefault.adjustmentPct * 100);

  const handleSave = () => {
    let params: object;
    switch (ruleType) {
      case 'smart_prediction':
        params = { method: spMethod, lookbackMonths: lookback } satisfies SmartPredictionParams;
        break;
      case 'constant_growing':
        params = {
          baseAmount: cgBase,
          annualGrowthRate: cgRate / 100,
          startPeriod: periods[0] ?? '',
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
    }
    onSave(ruleType, params);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Value Rule</h3>
        <p className="text-sm text-gray-500 mt-0.5 font-mono">{accountLabel}</p>
      </div>

      {/* Rule type selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Rule Type</label>
        <div className="grid grid-cols-1 gap-2">
          {RULE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRuleType(opt.value)}
              className={`text-left border rounded-lg px-3 py-2 transition-colors ${
                ruleType === opt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <p className={`text-sm font-medium ${ruleType === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Rule parameters */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Parameters</p>

        {ruleType === 'smart_prediction' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Algorithm</label>
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
              <label className="text-sm font-medium text-gray-700">Lookback Window</label>
              <select
                value={lookback}
                onChange={e => setLookback(Number(e.target.value) as 3 | 6 | 12 | 24)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white mt-1"
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {spMethod === 'linear_regression'
                  ? 'OLS linear regression fit over the last N months of QBO actuals.'
                  : 'Rolling average of the last N months of QBO actuals.'}
              </p>
            </div>
          </div>
        )}

        {ruleType === 'constant_growing' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Base Monthly Amount</label>
              <input
                type="number"
                value={cgBase}
                onChange={e => setCgBase(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. 50000"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Annual Growth Rate (%)</label>
              <input
                type="number"
                value={cgRate}
                onChange={e => setCgRate(parseFloat(e.target.value) || 0)}
                step={0.1}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="e.g. 5 for 5%"
              />
              <p className="text-xs text-gray-400 mt-1">0 = flat. Compound growth applied monthly.</p>
            </div>
          </div>
        )}

        {ruleType === 'direct_entry' && (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {periods.map(p => (
              <div key={p} className="flex items-center gap-3">
                <span className="w-20 text-xs text-gray-500 shrink-0">{periodLabel(p)}</span>
                <input
                  type="number"
                  value={deValues[p] ?? ''}
                  onChange={e => setDeValues(prev => ({
                    ...prev,
                    [p]: parseFloat(e.target.value) || 0,
                  }))}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        )}

        {ruleType === 'link_to_budget' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Budget</label>
              {budgets.length === 0 ? (
                <p className="text-sm text-yellow-600 mt-1">No budgets available. Create a budget first in the Budgets tab.</p>
              ) : (
                <select
                  value={lbBudgetId}
                  onChange={e => setLbBudgetId(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  {budgets.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Adjustment (%)</label>
              <input
                type="number"
                value={lbAdjPct}
                onChange={e => setLbAdjPct(parseFloat(e.target.value) || 0)}
                step={0.5}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="0 = no adjustment"
              />
              <p className="text-xs text-gray-400 mt-1">+5 = 5% over budget. 0 = use budget as-is.</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
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
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || (ruleType === 'link_to_budget' && budgets.length === 0)}>
            {saving ? 'Saving…' : 'Apply Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
