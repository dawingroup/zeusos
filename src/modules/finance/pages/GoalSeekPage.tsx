// ============================================================================
// GOAL SEEK PAGE — Interactive Sensitivity Analysis
// DawinOS v2.0 - Finance Module
//
// Select a target metric → see what levers need to change to hit the goal
// Interactive sliders for Price, Volume, Fixed Expenses, Variable COS
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { Info } from 'lucide-react';
import { getDetailedPLHistory } from '../services/forecastService';
import type { HistoricalPeriodData } from '../services/forecastService';
import {
  GOAL_METRICS,
  solveGoalSeek,
  computeMetricWithLevers,
} from '../services/profitabilityEngine';
import type { GoalMetricId, SensitivityResult } from '../services/profitabilityEngine';
import { periodLabel } from '../types/forecast.types';

const COMPANY_ID = 'dawinos';
const HIST_MONTHS = 12;

function fmtPct(v: number, decimals = 2): string {
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

// ── Lever Row ────────────────────────────────────────────────────────────────

interface LeverRowProps {
  result: SensitivityResult;
  value: number;
  onChange: (val: number) => void;
  scaleMin: number;
  scaleMax: number;
}

function LeverRow({ result, value, onChange, scaleMin, scaleMax }: LeverRowProps) {
  const reqPct = result.requiredChangePct;
  const isInf = !isFinite(reqPct);
  const reqLabel = isInf ? 'N/A' : fmtPct(reqPct);
  const changeLabel = fmtPct(value);

  // Position of the "required" marker on the scale (0-100%)
  const range = scaleMax - scaleMin;
  const reqPos = isInf ? -1 : Math.max(0, Math.min(100, ((reqPct - scaleMin) / range) * 100));

  // Color for the required marker
  const markerColor = isInf ? 'bg-gray-300' : reqPct >= 0 ? 'bg-blue-500' : 'bg-blue-500';

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{result.label}</span>
          <div className="group relative">
            <Info className="h-3.5 w-3.5 text-gray-400" />
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
              {result.leverId === 'price' && 'Change revenue via pricing (COGS unchanged)'}
              {result.leverId === 'volume' && 'Change revenue & COGS proportionally'}
              {result.leverId === 'fixedExpenses' && 'Change operating expenses'}
              {result.leverId === 'variableCOS' && 'Change cost of sales'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-gray-500">To achieve goal</span>
            <span className={`ml-2 font-bold ${isInf ? 'text-gray-400' : 'text-gray-900'}`}>{reqLabel}</span>
          </div>
          <div className="text-right min-w-[60px]">
            <span className="text-gray-500">Change</span>
            <span className="ml-2 font-bold text-blue-600">{changeLabel}</span>
          </div>
        </div>
      </div>

      {/* Scale bar + slider */}
      <div className="relative">
        {/* Scale labels */}
        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
          {Array.from({ length: 9 }, (_, i) => {
            const pct = scaleMin + (range / 8) * i;
            return <span key={i}>{(pct * 100).toFixed(0)}%</span>;
          })}
        </div>

        {/* Bar background */}
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
          {/* Fill from 0% to current value */}
          {(() => {
            const zeroPos = ((0 - scaleMin) / range) * 100;
            const valPos = ((value - scaleMin) / range) * 100;
            const left = Math.min(zeroPos, valPos);
            const width = Math.abs(valPos - zeroPos);
            const color = value >= 0 ? 'bg-blue-100' : 'bg-blue-100';
            return (
              <div
                className={`absolute top-0 bottom-0 ${color}`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })()}

          {/* Required change marker */}
          {reqPos >= 0 && reqPos <= 100 && (
            <div
              className={`absolute top-0 bottom-0 w-0.5 ${markerColor}`}
              style={{ left: `${reqPos}%` }}
            />
          )}

          {/* Slider thumb circle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-blue-500 shadow-md cursor-grab z-10"
            style={{ left: `calc(${((value - scaleMin) / range) * 100}% - 10px)` }}
          />
        </div>

        {/* Native range input (invisible, on top for interaction) */}
        <input
          type="range"
          min={scaleMin * 1000}
          max={scaleMax * 1000}
          step={10}
          value={value * 1000}
          onChange={e => onChange(Number(e.target.value) / 1000)}
          className="absolute inset-0 w-full h-8 opacity-0 cursor-pointer"
          style={{ top: '16px' }}
        />
      </div>
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

function GoalProgressBar({ current, target, isPercentage }: { current: number; target: number; isPercentage: boolean }) {
  const fmt = isPercentage ? fmtPct : fmtCurrency;

  // Normalise to 0-100% along the range
  const min = Math.min(current, target);
  const max = Math.max(current, target);
  const range = max - min || 1;
  const currentPos = ((current - min) / range) * 100;
  const isBelow = current < target;

  return (
    <div className="mt-4 mb-2">
      <div className="flex justify-between items-end mb-2">
        <div>
          <span className="inline-block bg-gray-100 border border-gray-200 rounded-md px-3 py-1 text-sm font-bold text-gray-700">
            {fmt(current)}
          </span>
        </div>
      </div>

      <div className="relative h-10 bg-gray-100 rounded-lg flex items-center">
        {/* Start label */}
        <div className="absolute left-3 text-xs font-bold text-gray-700">START</div>
        {/* Goal label */}
        <div className="absolute right-3 text-xs font-bold text-gray-700">GOAL</div>

        {/* Progress fill */}
        {isBelow && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-gray-200 rounded-l-lg"
            style={{ width: `${currentPos}%` }}
          />
        )}
      </div>

      <div className="flex justify-between mt-1.5 text-xs text-gray-500">
        <span>{fmt(current)}</span>
        <span>{fmt(target)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export function GoalSeekPage() {
  const [periodData, setPeriodData] = useState<Record<string, HistoricalPeriodData>>({});
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metricId, setMetricId] = useState<GoalMetricId>('profitabilityRatio');
  const [targetInput, setTargetInput] = useState('15');
  const [leverValues, setLeverValues] = useState<Record<string, number>>({
    price: 0, volume: 0, fixedExpenses: 0, variableCOS: 0,
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const now = new Date();
        const firstFP = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const { periodData: pd } = await getDetailedPLHistory(COMPANY_ID, HIST_MONTHS, firstFP);
        setPeriodData(pd);
        const sorted = Object.keys(pd).sort();
        setPeriods(sorted);
        setSelectedPeriod(sorted[sorted.length - 1] ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const actuals = useMemo(() => periodData[selectedPeriod]?.pl ?? null, [periodData, selectedPeriod]);
  const metricDef = GOAL_METRICS.find(m => m.id === metricId)!;
  const currentValue = useMemo(() => actuals ? metricDef.compute(actuals) : 0, [actuals, metricDef]);

  const targetValue = useMemo(() => {
    const n = parseFloat(targetInput);
    if (isNaN(n)) return 0;
    return metricDef.isPercentage ? n / 100 : n;
  }, [targetInput, metricDef]);

  const sensitivity = useMemo(() => {
    if (!actuals) return [];
    return solveGoalSeek(actuals, metricId, targetValue);
  }, [actuals, metricId, targetValue]);

  const projectedValue = useMemo(() => {
    if (!actuals) return 0;
    return computeMetricWithLevers(
      actuals, metricId,
      leverValues.price, leverValues.volume,
      leverValues.fixedExpenses, leverValues.variableCOS,
    );
  }, [actuals, metricId, leverValues]);

  // Reset levers when metric or period changes
  useEffect(() => {
    setLeverValues({ price: 0, volume: 0, fixedExpenses: 0, variableCOS: 0 });
  }, [metricId, selectedPeriod]);

  // Update target input when metric changes
  useEffect(() => {
    if (actuals) {
      const curr = metricDef.compute(actuals);
      const display = metricDef.isPercentage ? (curr * 100).toFixed(2) : curr.toFixed(0);
      setTargetInput(display);
    }
  }, [metricId, actuals, metricDef]);

  const handleLeverChange = (leverId: string, value: number) => {
    setLeverValues(prev => ({ ...prev, [leverId]: value }));
  };

  // Group sensitivity by level
  const highSensitivity = sensitivity.filter(s => s.sensitivity === 'HIGH');
  const mediumSensitivity = sensitivity.filter(s => s.sensitivity === 'MEDIUM');
  const lowSensitivity = sensitivity.filter(s => s.sensitivity === 'LOW');

  // Determine scale ranges based on sensitivity
  function getScaleForSensitivity(level: 'HIGH' | 'MEDIUM' | 'LOW'): [number, number] {
    switch (level) {
      case 'HIGH': return [-2, 2];
      case 'MEDIUM': return [-3, 3];
      case 'LOW': return [-4, 4];
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Goal Seek</h2>
          <p className="text-sm text-gray-500 mt-0.5">Loading...</p>
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Goal Seek</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Changes required to achieve your target metric
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">For the Month of</span>
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white font-medium"
          >
            {periods.map(p => (
              <option key={p} value={p}>{periodLabel(p)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      {actuals && (
        <>
          {/* Metric Selection + Target */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Target Metric</label>
                <select
                  value={metricId}
                  onChange={e => setMetricId(e.target.value as GoalMetricId)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white font-medium"
                >
                  {GOAL_METRICS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-center sm:pt-5">
                <p className="text-xs text-gray-500">Changes required to increase</p>
                <p className="text-sm font-semibold">
                  <span className="underline decoration-dotted">{metricDef.label}</span>
                  {' from '}
                  <span className="font-bold">{metricDef.isPercentage ? fmtPct(currentValue) : fmtCurrency(currentValue)}</span>
                  {' to '}
                  <span className="font-bold text-blue-600">{metricDef.isPercentage ? `${targetInput}%` : targetInput}</span>
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Target {metricDef.isPercentage ? '(%)' : '(Amount)'}
                </label>
                <input
                  type="number"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  step={metricDef.isPercentage ? '0.5' : '1000'}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-bold text-blue-600"
                />
              </div>
            </div>

            <GoalProgressBar
              current={currentValue}
              target={targetValue}
              isPercentage={metricDef.isPercentage}
            />
          </Card>

          {/* Sensitivity Levers */}
          <Card className="p-5">
            {highSensitivity.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">High Sensitivity</p>
                <div className="divide-y divide-gray-100">
                  {highSensitivity.map(s => {
                    const [min, max] = getScaleForSensitivity('HIGH');
                    return (
                      <LeverRow
                        key={s.leverId}
                        result={s}
                        value={leverValues[s.leverId] ?? 0}
                        onChange={v => handleLeverChange(s.leverId, v)}
                        scaleMin={min}
                        scaleMax={max}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {mediumSensitivity.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Medium Sensitivity</p>
                <div className="divide-y divide-gray-100">
                  {mediumSensitivity.map(s => {
                    const [min, max] = getScaleForSensitivity('MEDIUM');
                    return (
                      <LeverRow
                        key={s.leverId}
                        result={s}
                        value={leverValues[s.leverId] ?? 0}
                        onChange={v => handleLeverChange(s.leverId, v)}
                        scaleMin={min}
                        scaleMax={max}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {lowSensitivity.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Low Sensitivity</p>
                <div className="divide-y divide-gray-100">
                  {lowSensitivity.map(s => {
                    const [min, max] = getScaleForSensitivity('LOW');
                    return (
                      <LeverRow
                        key={s.leverId}
                        result={s}
                        value={leverValues[s.leverId] ?? 0}
                        onChange={v => handleLeverChange(s.leverId, v)}
                        scaleMin={min}
                        scaleMax={max}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Projected outcome */}
            <div className="border-t pt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Projected {metricDef.label} with adjustments:</span>
              <span className={`text-lg font-bold ${
                (metricDef.isPercentage ? projectedValue >= targetValue : projectedValue >= targetValue)
                  ? 'text-green-600'
                  : 'text-gray-900'
              }`}>
                {metricDef.isPercentage ? fmtPct(projectedValue) : fmtCurrency(projectedValue)}
              </span>
            </div>
          </Card>
        </>
      )}

      {!actuals && !loading && (
        <Card className="p-8 text-center text-gray-500">
          <p className="font-medium">No P&L data for the selected period</p>
          <p className="text-sm mt-1">Select a different month or sync QBO data from Integrations.</p>
        </Card>
      )}
    </div>
  );
}

export default GoalSeekPage;
