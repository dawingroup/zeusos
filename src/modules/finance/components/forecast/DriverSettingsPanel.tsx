/**
 * DriverSettingsPanel
 * Side panel / modal for editing Working Capital Drivers
 */

import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { DEFAULT_WC_DRIVERS } from '../../types/forecast.types';
import type { WorkingCapitalDrivers } from '../../types/forecast.types';

interface Props {
  drivers: WorkingCapitalDrivers;
  onSave: (drivers: WorkingCapitalDrivers) => void;
  onCancel: () => void;
  saving?: boolean;
}

interface FieldDef {
  key: keyof WorkingCapitalDrivers;
  label: string;
  description: string;
  unit: 'days' | 'pct' | 'months';
  min: number;
  max: number;
  step: number;
}

const FIELDS: FieldDef[] = [
  { key: 'receivableDays',      label: 'Receivable Days (DSO)',         description: 'AR as days of revenue',              unit: 'days',   min: 0,    max: 180, step: 1 },
  { key: 'payableDays',         label: 'Payable Days (DPO)',            description: 'AP as days of COGS + OpEx',          unit: 'days',   min: 0,    max: 180, step: 1 },
  { key: 'inventoryDays',       label: 'Inventory Days (DIO)',          description: 'Inventory as days of COGS',          unit: 'days',   min: 0,    max: 365, step: 1 },
  { key: 'prepaidPctOfOpex',    label: 'Prepaid % of OpEx',            description: 'Prepaid expenses as % of OpEx',      unit: 'pct',    min: 0,    max: 0.5, step: 0.01 },
  { key: 'accruedPctOfOpex',    label: 'Accrued Expenses % of OpEx',   description: 'Accrued liabilities as % of OpEx',   unit: 'pct',    min: 0,    max: 0.5, step: 0.01 },
  { key: 'taxPaymentLagMonths', label: 'Tax Payment Lag (months)',      description: 'Months between tax expense & cash payment', unit: 'months', min: 0, max: 12, step: 1 },
];

function displayValue(value: number, unit: FieldDef['unit']): string {
  if (unit === 'pct') return `${(value * 100).toFixed(0)}%`;
  if (unit === 'months') return `${value} mo`;
  return `${value} days`;
}

export function DriverSettingsPanel({ drivers, onSave, onCancel, saving }: Props) {
  const [local, setLocal] = useState<WorkingCapitalDrivers>({ ...drivers });

  const set = (key: keyof WorkingCapitalDrivers, raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    setLocal(prev => ({ ...prev, [key]: num }));
  };

  const reset = () => setLocal({ ...DEFAULT_WC_DRIVERS });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">Working Capital Drivers</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          These ratios determine how Balance Sheet accounts are derived from your P&L forecast.
          Changes trigger an automatic three-way recalculation.
        </p>
      </div>

      <div className="space-y-4">
        {FIELDS.map(f => (
          <div key={f.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">{f.label}</label>
              <span className="text-sm font-semibold text-[var(--rag-blue)]">
                {displayValue(local[f.key], f.unit)}
              </span>
            </div>
            <input
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={local[f.key]}
              onChange={e => set(f.key, e.target.value)}
              className="w-full h-2 bg-[var(--bg-sunken)] rounded-lg appearance-none cursor-pointer accent-[var(--rag-blue)]"
            />
            <p className="text-xs text-[var(--fg-tertiary)]">{f.description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <button
          onClick={reset}
          className="text-xs text-[var(--fg-tertiary)] hover:text-muted-foreground underline"
        >
          Reset to defaults
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(local)} disabled={saving}>
            {saving ? 'Saving…' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
