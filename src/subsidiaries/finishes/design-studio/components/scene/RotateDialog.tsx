/**
 * RotateDialog — modal to set a selection's rotation (degrees around Y).
 *
 * Single cabinet: the input shows the current rotation, editable.
 * Multi-selection: shows the first cabinet's rotation as a reference;
 * committing sets every target to the same absolute angle (matches the
 * PositioningPanel contract for multi-select rotation).
 *
 * "Snap to 15°" checkbox is on by default — covers 0/15/30/45/60/75/90
 * which are the angles needed for irregular rooms.
 */
import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { SceneCabinet } from '../../types/scene.types';
import { ROTATION_SNAP_DEG } from '../../constants/scene.constants';

interface RotateDialogProps {
  cabinets: SceneCabinet[];
  cabinetIds: string[];
  onCommit: (rotationDeg: number) => Promise<void>;
  onClose: () => void;
}

/** Normalise to (-180, 180] for display and snap-to math. */
function normaliseAngle(deg: number): number {
  let d = deg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

export function RotateDialog({ cabinets, cabinetIds, onCommit, onClose }: RotateDialogProps) {
  const targets = useMemo(
    () => cabinets.filter(c => cabinetIds.includes(c.id)),
    [cabinets, cabinetIds],
  );
  const initialAngle = normaliseAngle(Math.round(targets[0]?.rotation ?? 0));

  const [value, setValue] = useState<string>(String(initialAngle));
  const [snap, setSnap] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setValue(String(initialAngle)); }, [initialAngle]);

  const parsed = Number(value.trim());
  const finalAngle = Number.isFinite(parsed)
    ? (snap
        ? Math.round(parsed / ROTATION_SNAP_DEG) * ROTATION_SNAP_DEG
        : parsed)
    : initialAngle;

  const handleCommit = async () => {
    setSubmitting(true);
    try {
      await onCommit(finalAngle);
      onClose();
    } catch (err) {
      console.warn('[RotateDialog] commit failed:', err);
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card rounded-lg shadow-xl border border-border w-80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Rotate</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            {targets.length > 1
              ? `${targets.length} cabinets will be set to the same angle`
              : targets[0]?.displayName || targets[0]?.cabinetCode || 'Cabinet'}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium w-20">Angle</label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommit();
                else if (e.key === 'Escape') onClose();
              }}
              className="flex-1 px-2 py-1.5 text-sm bg-background border border-border rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-[10px] text-muted-foreground w-5">°</span>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
              className="rounded"
            />
            Snap to {ROTATION_SNAP_DEG}° increments
          </label>
          {snap && Number.isFinite(parsed) && parsed !== finalAngle && (
            <p className="text-[10px] text-muted-foreground">
              Will snap to <span className="font-mono font-semibold">{finalAngle}°</span>.
            </p>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={submitting || !Number.isFinite(parsed)}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
