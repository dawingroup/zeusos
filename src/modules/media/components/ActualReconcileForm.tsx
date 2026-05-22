/**
 * ActualReconcileForm — form to post reconciliation actuals against a buy.
 */

import { useState } from 'react';
import type { MediaBuy } from '../types/media-buy.types';
import type { MediaActual } from '../types/media-actual.types';

interface Props {
  buy: MediaBuy;
  onSave: (values: Omit<MediaActual, 'id' | 'planId' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}

export function ActualReconcileForm({ buy, onSave, onCancel }: Props) {
  const [actualMinor, setActualMinor] = useState(buy.actualMinor);
  const [impressions, setImpressions] = useState<number | ''>('');
  const [reach, setReach] = useState<number | ''>('');
  const [clicks, setClicks] = useState<number | ''>('');
  const [conversions, setConversions] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        buyId: buy.id,
        actualMinor,
        impressions: impressions === '' ? undefined : impressions,
        reach: reach === '' ? undefined : reach,
        clicks: clicks === '' ? undefined : clicks,
        conversions: conversions === '' ? undefined : conversions,
        reportedAt: new Date().toISOString().slice(0, 10),
        reportedBy: 'current-user',
        notes: notes || undefined,
      });
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border p-4">
      <h3 className="font-medium">Reconcile: {buy.vehicleName}</h3>

      <div>
        <label className="block text-sm font-medium mb-1">Actual Spend (minor units)</label>
        <input
          required
          type="number"
          min={0}
          value={actualMinor}
          onChange={(e) => setActualMinor(Number(e.target.value))}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Planned: {buy.plannedMinor.toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['Impressions', impressions, setImpressions],
            ['Reach',       reach,       setReach],
            ['Clicks',      clicks,      setClicks],
            ['Conversions', conversions, setConversions],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label}>
            <label className="block text-sm font-medium mb-1">{label}</label>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setter(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="optional"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Post Actual'}
        </button>
      </div>
    </form>
  );
}
