/**
 * MediaBuyForm — slide-over for adding or editing a media buy row.
 */

import { useState } from 'react';
import type { MediaBuy, MediaVehicleType } from '../types/media-buy.types';

const VEHICLE_TYPES: MediaVehicleType[] = [
  'TV', 'RADIO', 'PRINT', 'OOH', 'DIGITAL', 'SOCIAL', 'SEARCH', 'PROGRAMMATIC',
];

interface Props {
  open: boolean;
  initial?: Partial<MediaBuy>;
  onClose: () => void;
  onSave: (values: Omit<MediaBuy, 'id' | 'planId' | 'actualMinor' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function MediaBuyForm({ open, initial, onClose, onSave }: Props) {
  const [vehicleName, setVehicleName] = useState(initial?.vehicleName ?? '');
  const [vehicleType, setVehicleType] = useState<MediaVehicleType>(initial?.vehicleType ?? 'DIGITAL');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [plannedMinor, setPlannedMinor] = useState(initial?.plannedMinor ?? 0);
  const [bookedMinor, setBookedMinor] = useState(initial?.bookedMinor ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        vehicleName,
        vehicleType,
        startDate,
        endDate,
        plannedMinor,
        bookedMinor,
        notes: notes || undefined,
        createdBy: 'current-user', // replaced by auth context in real implementation
      });
      onClose();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">{initial?.id ? 'Edit Buy' : 'Add Buy'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Name</label>
            <input
              required
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="e.g. NTV Uganda Prime Time"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Type</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as MediaVehicleType)}
              className="w-full rounded border px-2 py-1.5 text-sm"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Planned (minor units)</label>
              <input
                required
                type="number"
                min={0}
                value={plannedMinor}
                onChange={(e) => setPlannedMinor(Number(e.target.value))}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Booked (minor units)</label>
              <input
                type="number"
                min={0}
                value={bookedMinor}
                onChange={(e) => setBookedMinor(Number(e.target.value))}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-1.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Buy'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
