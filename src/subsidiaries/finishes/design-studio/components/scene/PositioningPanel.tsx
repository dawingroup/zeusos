/**
 * PositioningPanel — Numeric coordinates editor for the Cabinet
 * Alignment System (Mechanism 3 from the spec).
 *
 * Drawer panel that binds to the current scene selection. For a single
 * cabinet, the inputs show and edit its world-space X/Y/Z (mm) plus
 * rotation around Y (degrees). For a multi-selection, inputs show the
 * centroid and behave as deltas — typing X=500 moves the centroid to
 * x=500 while preserving inter-cabinet offsets.
 *
 * Persistence is routed through `useScene.moveCabinet` (same path as
 * drag) so CAS / revision handling is consistent across interaction
 * modes. Writes commit on blur / Enter; Esc reverts to the live value.
 *
 * Per-axis pin toggles set `position.axisLocks.{x,y,z}`. The drag/snap
 * pipelines read these and skip updates on locked axes — so a user can
 * lock Y while snapping X/Z, for instance.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pin, PinOff } from 'lucide-react';
import type { SceneCabinet, CabinetPosition } from '../../types/scene.types';
import { POSITION_GRID_MM } from '../../constants/scene.constants';

interface PositioningPanelProps {
  cabinets: SceneCabinet[];
  selectedIds: string[];
  onMove: (cabinetId: string, position: CabinetPosition, rotation?: number) => Promise<void>;
}

type Axis = 'x' | 'y' | 'z';
type Field = Axis | 'rotation';

/** Round to the persistence grid (1mm) with half-up semantics. */
function quantiseMm(v: number): number {
  return Math.round(v / POSITION_GRID_MM) * POSITION_GRID_MM;
}

/** Parse a user-typed value; falls back to the previous value on junk input. */
function parseNumericInput(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Compute the centroid (arithmetic mean) of the selection's positions. */
function centroidOf(cabinets: SceneCabinet[]): { x: number; y: number; z: number } {
  if (cabinets.length === 0) return { x: 0, y: 0, z: 0 };
  let sx = 0, sy = 0, sz = 0;
  for (const c of cabinets) {
    sx += c.position?.x ?? 0;
    sy += c.position?.y ?? 0;
    sz += c.position?.z ?? 0;
  }
  const n = cabinets.length;
  return { x: sx / n, y: sy / n, z: sz / n };
}

export function PositioningPanel({ cabinets, selectedIds, onMove }: PositioningPanelProps) {
  const selected = useMemo(
    () => cabinets.filter(c => selectedIds.includes(c.id)),
    [cabinets, selectedIds],
  );

  const isMulti = selected.length > 1;
  const centroid = useMemo(() => centroidOf(selected), [selected]);
  const firstRotation = selected[0]?.rotation ?? 0;
  const firstPosition = selected[0]?.position ?? { x: 0, y: 0, z: 0 };

  // Axis locks are read from the first selected cabinet. For multi-select
  // we show "mixed" iff members disagree; toggling sets all members.
  const axisLocks = firstPosition.axisLocks ?? {};

  // Editable draft state — reflects in-flight user input; committed on
  // blur/Enter. Separate from the underlying cabinet so we don't fight
  // the user's keystrokes.
  const [draft, setDraft] = useState<Record<Field, string>>({
    x: '0',
    y: '0',
    z: '0',
    rotation: '0',
  });

  // Keep the draft in sync with the selection whenever it changes or the
  // underlying data updates (external move, snapshot).
  useEffect(() => {
    if (selected.length === 0) return;
    const pos = isMulti ? centroid : firstPosition;
    setDraft({
      x: String(Math.round(pos.x)),
      y: String(Math.round(pos.y)),
      z: String(Math.round(pos.z)),
      rotation: String(Math.round(firstRotation)),
    });
  }, [selected.length, isMulti, centroid, firstPosition, firstRotation]);

  const commitField = useCallback(async (field: Field, raw: string) => {
    if (selected.length === 0) return;

    if (field === 'rotation') {
      const target = parseNumericInput(raw, firstRotation);
      // Rotation is per-cabinet — multi-select sets every member to the
      // same absolute angle (spec: multi-select rotation is a group op;
      // for the numeric panel we apply uniformly as the simplest contract).
      await Promise.all(selected.map(c =>
        onMove(c.id, c.position ?? { x: 0, y: 0, z: 0 }, target),
      ));
      return;
    }

    const axis: Axis = field;
    const current = isMulti ? centroid[axis] : (firstPosition[axis] ?? 0);
    const target = quantiseMm(parseNumericInput(raw, current));
    if (target === current) return;
    const delta = target - current;

    // Apply delta (multi-select preserves inter-cabinet offsets) OR set
    // absolute (single select). Both paths use the same moveCabinet write
    // so CAS / revision handling stays consistent.
    await Promise.all(selected.map(c => {
      const pos = c.position ?? { x: 0, y: 0, z: 0 };
      const nextPos: CabinetPosition = { ...pos, [axis]: quantiseMm((pos[axis] ?? 0) + delta) };
      return onMove(c.id, nextPos, c.rotation);
    }));
  }, [selected, isMulti, centroid, firstPosition, firstRotation, onMove]);

  const toggleAxisLock = useCallback(async (axis: Axis) => {
    if (selected.length === 0) return;
    const currentlyLocked = axisLocks[axis] === true;
    const next = !currentlyLocked;
    await Promise.all(selected.map(c => {
      const pos = c.position ?? { x: 0, y: 0, z: 0 };
      const nextPos: CabinetPosition = {
        ...pos,
        axisLocks: { ...(pos.axisLocks ?? {}), [axis]: next },
      };
      return onMove(c.id, nextPos, c.rotation);
    }));
  }, [selected, axisLocks, onMove]);

  if (selected.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground leading-relaxed">
        Select a cabinet to edit its position.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Positioning
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isMulti
            ? `${selected.length} cabinets — values show centroid; typing applies as delta`
            : selected[0]?.displayName || selected[0]?.cabinetCode || 'Cabinet'}
        </p>
      </div>

      <div className="space-y-2">
        <CoordField
          label="X"
          unit="mm"
          value={draft.x}
          onChange={(v) => setDraft(d => ({ ...d, x: v }))}
          onCommit={(v) => commitField('x', v)}
          onRevert={() =>
            setDraft(d => ({ ...d, x: String(Math.round(isMulti ? centroid.x : firstPosition.x ?? 0)) }))
          }
          pinned={axisLocks.x === true}
          onTogglePin={() => toggleAxisLock('x')}
        />
        <CoordField
          label="Y"
          unit="mm"
          value={draft.y}
          onChange={(v) => setDraft(d => ({ ...d, y: v }))}
          onCommit={(v) => commitField('y', v)}
          onRevert={() =>
            setDraft(d => ({ ...d, y: String(Math.round(isMulti ? centroid.y : firstPosition.y ?? 0)) }))
          }
          pinned={axisLocks.y === true}
          onTogglePin={() => toggleAxisLock('y')}
        />
        <CoordField
          label="Z"
          unit="mm"
          value={draft.z}
          onChange={(v) => setDraft(d => ({ ...d, z: v }))}
          onCommit={(v) => commitField('z', v)}
          onRevert={() =>
            setDraft(d => ({ ...d, z: String(Math.round(isMulti ? centroid.z : firstPosition.z ?? 0)) }))
          }
          pinned={axisLocks.z === true}
          onTogglePin={() => toggleAxisLock('z')}
        />
      </div>

      <div className="pt-2 border-t border-border">
        <CoordField
          label="Rotation"
          unit="°"
          value={draft.rotation}
          onChange={(v) => setDraft(d => ({ ...d, rotation: v }))}
          onCommit={(v) => commitField('rotation', v)}
          onRevert={() => setDraft(d => ({ ...d, rotation: String(Math.round(firstRotation)) }))}
        />
      </div>

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed pt-2 border-t border-border">
        Commit on Enter or blur. Press Esc to revert. Pin icon locks that axis during drag and snap.
      </p>
    </div>
  );
}

interface CoordFieldProps {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onRevert: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}

function CoordField({ label, unit, value, onChange, onCommit, onRevert, pinned, onTogglePin }: CoordFieldProps) {
  const pinnable = onTogglePin !== undefined;
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] font-medium text-muted-foreground w-16 shrink-0">
        {label}
      </label>
      <div className="flex-1 flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onRevert();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={(e) => onCommit(e.target.value)}
          className={`flex-1 px-2 py-1 text-xs bg-background border border-border rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary ${pinned ? 'opacity-50' : ''}`}
          disabled={pinned}
        />
        <span className="text-[10px] text-muted-foreground w-5 shrink-0">{unit}</span>
        {pinnable && (
          <button
            type="button"
            onClick={onTogglePin}
            title={pinned ? `Unlock ${label}` : `Lock ${label} during drag and snap`}
            className={`w-5 h-5 flex items-center justify-center rounded shrink-0 transition-colors ${
              pinned
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-accent'
            }`}
          >
            {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
