import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import type { CreateDataPointInput, KPIDefinition } from '../../types/kpi.types';

interface DataPointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpi: KPIDefinition;
  onSubmit: (input: Omit<CreateDataPointInput, 'kpiId'>) => Promise<void>;
}

function deriveQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

function toIsoDate(d: Date): string {
  // YYYY-MM-DD for <input type="date">
  return d.toISOString().slice(0, 10);
}

export const DataPointDialog: React.FC<DataPointDialogProps> = ({
  open,
  onOpenChange,
  kpi,
  onSubmit,
}) => {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setDate(toIsoDate(new Date()));
      setNote('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      setError('Enter a valid number');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const d = new Date(date + 'T12:00:00');
      await onSubmit({
        date: d,
        fiscalYear: d.getFullYear(),
        fiscalQuarter: deriveQuarter(d),
        fiscalMonth: d.getMonth() + 1,
        value: parsed,
        note: note.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log measurement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log new measurement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-[12px] text-gray-500">
              <span className="font-mono text-[11px] bg-white border border-gray-200 px-1 py-0 rounded mr-1.5">
                {kpi.code}
              </span>
              {kpi.name}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Target: <span className="font-medium">{kpi.target?.value}</span>
              {kpi.unit ? ` ${kpi.unit}` : ''}
              {kpi.currentValue !== undefined && (
                <>
                  {' · '}
                  Current: <span className="font-medium">{kpi.currentValue}</span>
                  {kpi.unit ? ` ${kpi.unit}` : ''}
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dp-value">Value *</Label>
              <Input
                id="dp-value"
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={kpi.unit ? `Value in ${kpi.unit}` : 'Measurement'}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="dp-date">Date *</Label>
              <Input
                id="dp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dp-note">Note (optional)</Label>
            <Textarea
              id="dp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for this measurement — anomalies, source, etc."
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !value.trim()}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Log measurement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
