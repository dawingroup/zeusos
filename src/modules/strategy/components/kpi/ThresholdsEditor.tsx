import React, { useState } from 'react';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import type { KPIDefinition, KPIThreshold } from '../../types/kpi.types';
import { KPI_THRESHOLD_TYPE, type KPIThresholdType } from '../../constants/kpi.constants';

interface ThresholdsEditorProps {
  kpi: KPIDefinition;
  onAdd: (threshold: Omit<KPIThreshold, 'id'>) => Promise<void>;
  onUpdate: (thresholdId: string, updates: Partial<KPIThreshold>) => Promise<void>;
  onRemove: (thresholdId: string) => Promise<void>;
  unit?: string;
}

const COMPARISON_LABELS: Record<KPIThreshold['comparison'], string> = {
  above: 'Above',
  below: 'Below',
  equals: 'Equals',
  between: 'Between',
};

const TYPE_LABELS: Record<KPIThresholdType, string> = {
  [KPI_THRESHOLD_TYPE.ABSOLUTE]: 'Absolute',
  [KPI_THRESHOLD_TYPE.PERCENTAGE_OF_TARGET]: '% of target',
  [KPI_THRESHOLD_TYPE.STANDARD_DEVIATION]: 'σ',
};

const DEFAULT_PALETTE = ['#f44336', '#ff9800', '#8bc34a', '#4caf50'];

export const ThresholdsEditor: React.FC<ThresholdsEditorProps> = ({
  kpi,
  onAdd,
  onUpdate,
  onRemove,
  unit,
}) => {
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Draft form for adding a new threshold (inline, not in a modal).
  const [draftName, setDraftName] = useState('Critical');
  const [draftLevel, setDraftLevel] = useState('1');
  const [draftType, setDraftType] = useState<KPIThresholdType>(KPI_THRESHOLD_TYPE.ABSOLUTE);
  const [draftComparison, setDraftComparison] = useState<KPIThreshold['comparison']>('below');
  const [draftValue, setDraftValue] = useState('0');
  const [draftUpperValue, setDraftUpperValue] = useState('');
  const [draftColor, setDraftColor] = useState(DEFAULT_PALETTE[0]);
  const [draftAlertEnabled, setDraftAlertEnabled] = useState(true);

  const resetDraft = () => {
    setDraftName('Critical');
    setDraftLevel(String((kpi.thresholds.length || 0) + 1));
    setDraftType(KPI_THRESHOLD_TYPE.ABSOLUTE);
    setDraftComparison('below');
    setDraftValue('0');
    setDraftUpperValue('');
    setDraftColor(DEFAULT_PALETTE[(kpi.thresholds.length || 0) % DEFAULT_PALETTE.length]);
    setDraftAlertEnabled(true);
  };

  const handleAdd = async () => {
    setError(null);
    const value = parseFloat(draftValue);
    if (Number.isNaN(value)) {
      setError('Threshold value must be a number');
      return;
    }
    const upperValue =
      draftComparison === 'between'
        ? parseFloat(draftUpperValue)
        : undefined;
    if (draftComparison === 'between' && (upperValue === undefined || Number.isNaN(upperValue))) {
      setError('Between comparisons require an upper bound');
      return;
    }
    setBusyId('__draft');
    try {
      await onAdd({
        level: parseInt(draftLevel, 10) || 1,
        name: draftName.trim() || 'Threshold',
        type: draftType,
        value,
        comparison: draftComparison,
        upperValue,
        color: draftColor,
        alertEnabled: draftAlertEnabled,
      });
      setAdding(false);
      resetDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add threshold');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (t: KPIThreshold) => {
    if (!confirm(`Remove threshold "${t.name}"?`)) return;
    setBusyId(t.id);
    try {
      await onRemove(t.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove threshold');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleAlert = async (t: KPIThreshold) => {
    setBusyId(t.id);
    try {
      await onUpdate(t.id, { alertEnabled: !t.alertEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update threshold');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700 inline-flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {kpi.thresholds.length === 0 && !adding && (
        <p className="text-sm text-gray-500">
          No thresholds defined. Add a threshold to color-code performance and (optionally) trigger
          alerts when the KPI crosses it.
        </p>
      )}

      {kpi.thresholds.length > 0 && (
        <ul className="space-y-1.5">
          {[...kpi.thresholds]
            .sort((a, b) => a.level - b.level)
            .map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 p-2.5 rounded border border-gray-200 bg-white"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: t.color }}
                  aria-hidden
                />
                <div className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span className="text-[12.5px] font-medium text-gray-900 truncate">
                    L{t.level} · {t.name}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {COMPARISON_LABELS[t.comparison]} {t.value}
                    {t.comparison === 'between' && t.upperValue !== undefined
                      ? `–${t.upperValue}`
                      : ''}
                    {unit ? ` ${unit}` : ''}
                    <span className="ml-1.5 text-gray-400">({TYPE_LABELS[t.type]})</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAlert(t)}
                  disabled={busyId === t.id}
                  className={`text-[10.5px] px-1.5 py-0.5 rounded border transition-colors ${
                    t.alertEnabled
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  title={t.alertEnabled ? 'Alerts on — click to disable' : 'Alerts off — click to enable'}
                >
                  {t.alertEnabled ? 'Alert' : 'Silent'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(t)}
                  disabled={busyId === t.id}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                  aria-label="Remove threshold"
                >
                  {busyId === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}

      {!adding ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetDraft();
            setAdding(true);
            setError(null);
          }}
          disabled={kpi.thresholds.length >= 4}
        >
          <Plus className="h-3.5 w-3.5" />
          Add threshold
        </Button>
      ) : (
        <div className="rounded-md border border-gray-200 p-3 bg-gray-50/50 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] text-gray-500">Name</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Critical, Warning…"
                className="h-7 text-[12px]"
              />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Level</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={draftLevel}
                onChange={(e) => setDraftLevel(e.target.value)}
                className="h-7 text-[12px]"
              />
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Color</Label>
              <div className="flex items-center gap-1 h-7">
                {DEFAULT_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${
                      draftColor === c ? 'border-gray-700' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-[10px] text-gray-500">Type</Label>
              <Select value={draftType} onValueChange={(v) => setDraftType(v as KPIThresholdType)}>
                <SelectTrigger className="h-7 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Comparison</Label>
              <Select
                value={draftComparison}
                onValueChange={(v) => setDraftComparison(v as KPIThreshold['comparison'])}
              >
                <SelectTrigger className="h-7 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['above', 'below', 'equals', 'between'] as const).map((c) => (
                    <SelectItem key={c} value={c}>
                      {COMPARISON_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-gray-500">Value</Label>
              <Input
                type="number"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                className="h-7 text-[12px]"
              />
            </div>
            {draftComparison === 'between' && (
              <div>
                <Label className="text-[10px] text-gray-500">Upper bound</Label>
                <Input
                  type="number"
                  value={draftUpperValue}
                  onChange={(e) => setDraftUpperValue(e.target.value)}
                  className="h-7 text-[12px]"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="threshold-alert"
              type="checkbox"
              checked={draftAlertEnabled}
              onChange={(e) => setDraftAlertEnabled(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="threshold-alert" className="text-[12px] cursor-pointer">
              Trigger alert when crossed
            </Label>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              disabled={busyId === '__draft'}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={busyId === '__draft' || !draftName.trim()}
            >
              {busyId === '__draft' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save threshold
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
