/**
 * Set / Edit Target Dialog
 * Full target configuration for a tracked KPI: value, stretch, minimum, range,
 * fiscal year, quarter, and baseline.
 */

import { useState, useEffect } from 'react';
import { X, Target, ChevronDown, ChevronUp } from 'lucide-react';
import {
  KPI_DIRECTION,
  KPI_DIRECTION_LABELS,
  formatKPIValue,
} from '../../constants/kpi.constants';
import type { KPITarget, KPIDefinition } from '../../types/kpi.types';

interface SetTargetDialogProps {
  kpi: KPIDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSave: (kpiId: string, target: KPITarget) => Promise<unknown>;
}

// ── Helper ────────────────────────────────────────────────────────────────

function numOrUndefined(v: string): number | undefined {
  if (v === '' || v === undefined) return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function valStr(v: number | undefined | null): string {
  return v != null ? String(v) : '';
}

// Current fiscal year helper (July–June for Uganda)
function currentFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

// ── Component ─────────────────────────────────────────────────────────────

export function SetTargetDialog({ kpi, isOpen, onClose, onSave }: SetTargetDialogProps) {
  // Core target
  const [targetValue, setTargetValue] = useState('');
  const [stretchValue, setStretchValue] = useState('');
  const [minimumValue, setMinimumValue] = useState('');

  // Range (only for range_is_best direction)
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');

  // Period
  const [fiscalYear, setFiscalYear] = useState('');
  const [quarter, setQuarter] = useState('');

  // Baseline
  const [baselineValue, setBaselineValue] = useState('');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Seed form from existing target when KPI changes
  useEffect(() => {
    if (kpi?.target) {
      const t = kpi.target;
      setTargetValue(valStr(t.value));
      setStretchValue(valStr(t.stretchValue));
      setMinimumValue(valStr(t.minimumValue));
      setRangeMin(valStr(t.rangeMin));
      setRangeMax(valStr(t.rangeMax));
      setFiscalYear(valStr(t.fiscalYear));
      setQuarter(valStr(t.quarter));
      setBaselineValue(valStr(t.baselineValue));

      // Show advanced if any optional field has a value
      if (t.stretchValue != null || t.minimumValue != null || t.fiscalYear != null || t.baselineValue != null) {
        setShowAdvanced(true);
      }
    } else {
      setTargetValue('');
      setStretchValue('');
      setMinimumValue('');
      setRangeMin('');
      setRangeMax('');
      setFiscalYear(String(currentFiscalYear()));
      setQuarter('');
      setBaselineValue('');
    }
    setError('');
  }, [kpi]);

  if (!isOpen) return null;

  const isRange = kpi.direction === KPI_DIRECTION.RANGE_IS_BEST;
  const hasExistingTarget = kpi.target?.value != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (isRange) {
      if (!rangeMin || !rangeMax) {
        setError('Both range minimum and maximum are required for range-based KPIs');
        return;
      }
      if (parseFloat(rangeMin) >= parseFloat(rangeMax)) {
        setError('Range minimum must be less than maximum');
        return;
      }
    } else if (!targetValue) {
      setError('Target value is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const target: KPITarget = {
        value: isRange
          ? (parseFloat(rangeMin) + parseFloat(rangeMax)) / 2
          : parseFloat(targetValue),
        stretchValue: numOrUndefined(stretchValue),
        minimumValue: numOrUndefined(minimumValue),
        rangeMin: isRange ? parseFloat(rangeMin) : numOrUndefined(rangeMin),
        rangeMax: isRange ? parseFloat(rangeMax) : numOrUndefined(rangeMax),
        fiscalYear: numOrUndefined(fiscalYear),
        quarter: numOrUndefined(quarter),
        baselineValue: numOrUndefined(baselineValue),
      };

      await onSave(kpi.id, target);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save target');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {hasExistingTarget ? 'Edit Target' : 'Set Target'}
              </h2>
              <p className="text-sm text-gray-500">{kpi.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Context */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-xs text-gray-400">Code</span>
              <p className="font-mono text-gray-700">{kpi.code}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Direction</span>
              <p className="text-gray-700">{KPI_DIRECTION_LABELS[kpi.direction]}</p>
            </div>
            {kpi.currentValue != null && (
              <div>
                <span className="text-xs text-gray-400">Current Value</span>
                <p className="font-semibold text-gray-900">
                  {formatKPIValue(kpi.currentValue, kpi.type, kpi.unit)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Range-based target fields */}
          {isRange ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Range <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Performance is optimal within this range.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    step="any"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                    placeholder="Min"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <span className="text-gray-400 text-sm">to</span>
                <div className="flex-1">
                  <input
                    type="number"
                    step="any"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                    placeholder="Max"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {kpi.unit && (
                  <span className="text-sm text-gray-500 font-medium shrink-0">{kpi.unit}</span>
                )}
              </div>
            </div>
          ) : (
            /* Standard target value */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Value <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="Enter target value"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {kpi.unit && (
                  <span className="text-sm text-gray-500 font-medium">{kpi.unit}</span>
                )}
              </div>
            </div>
          )}

          {/* Stretch & Minimum — inline row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stretch Target
              </label>
              <input
                type="number"
                step="any"
                value={stretchValue}
                onChange={(e) => setStretchValue(e.target.value)}
                placeholder="Aspirational"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Ambitious goal</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Acceptable
              </label>
              <input
                type="number"
                step="any"
                value={minimumValue}
                onChange={(e) => setMinimumValue(e.target.value)}
                placeholder="Floor threshold"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-0.5">Below this = critical</p>
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              {/* Fiscal period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fiscal Year
                  </label>
                  <input
                    type="number"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(e.target.value)}
                    placeholder={String(currentFiscalYear())}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quarter
                  </label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Full Year</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
              </div>

              {/* Baseline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Baseline Value
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={baselineValue}
                    onChange={(e) => setBaselineValue(e.target.value)}
                    placeholder="Starting measurement"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {kpi.unit && (
                    <span className="text-sm text-gray-500 font-medium">{kpi.unit}</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Reference point for measuring improvement
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : hasExistingTarget ? 'Update Target' : 'Set Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
