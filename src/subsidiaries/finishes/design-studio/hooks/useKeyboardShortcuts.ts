/**
 * useKeyboardShortcuts — arrow-key nudging + future shortcut registry
 * for the Cabinet Alignment System.
 *
 * Arrow keys translate the current selection in the XZ plane by
 * `NUDGE_STEP_MM` (10mm). Modifiers:
 *   - `Shift` → fine (1mm), for precision placement
 *   - `Ctrl`/`Meta` → coarse (100mm)
 *   - `Alt` is NOT used here — it's reserved for the drag-time snap
 *     bypass in `useCabinetGizmo`
 *
 * Keybindings are disabled while any form input is focused so typing
 * values into `PositioningPanel` or `RotateDialog` doesn't also move
 * the cabinet. The keydown handler mounts on `window`, so the
 * viewport doesn't need explicit focus.
 *
 * Per-axis `position.axisLocks` are respected — a pinned X will skip
 * left/right nudge deltas for that cabinet.
 */
import { useEffect } from 'react';
import type { SceneCabinet, CabinetPosition } from '../types/scene.types';
import { NUDGE_STEP_MM, POSITION_GRID_MM } from '../constants/scene.constants';
import type { GizmoMode } from './useCabinetGizmo';

/** Round to the persistence grid (1mm). */
const quantise = (v: number) => Math.round(v / POSITION_GRID_MM) * POSITION_GRID_MM;

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  cabinets: SceneCabinet[];
  selectedIds: string[];
  onMove: (cabinetId: string, position: CabinetPosition, rotation?: number) => Promise<void>;
  /** Optional — when provided, `G` and `R` toggle translate/rotate. */
  onGizmoModeChange?: (mode: GizmoMode) => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts({
  enabled, cabinets, selectedIds, onMove, onGizmoModeChange,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (selectedIds.length === 0) return;

      // G / R toggle gizmo mode. Bare keys only — avoid clashes with
      // Cmd/Ctrl+G (Find Next etc.). Shortcut doesn't do anything when
      // the caller hasn't wired the handler (viewports without a gizmo).
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && onGizmoModeChange) {
        if (e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          onGizmoModeChange('translate');
          return;
        }
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          onGizmoModeChange('rotate');
          return;
        }
      }

      const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' || e.key === 'ArrowDown';
      if (!isArrow) return;

      e.preventDefault();

      // Step: Shift → 1mm (fine), Ctrl/Meta → 100mm (coarse), else 10mm.
      const step = e.shiftKey
        ? 1
        : (e.ctrlKey || e.metaKey)
          ? NUDGE_STEP_MM * 10
          : NUDGE_STEP_MM;

      // ArrowLeft/Right move X; ArrowUp/Down move Z. The scene's Y
      // axis (height) is only moved via numeric input and wall-anchor
      // mode, never arrow keys — users overwhelmingly work in the
      // floor plan.
      let dx = 0, dz = 0;
      if (e.key === 'ArrowLeft')  dx = -step;
      if (e.key === 'ArrowRight') dx =  step;
      if (e.key === 'ArrowUp')    dz = -step;
      if (e.key === 'ArrowDown')  dz =  step;

      const targets = cabinets.filter(c => selectedIds.includes(c.id));
      for (const c of targets) {
        if (c.isLocked) continue;
        const locks = c.position?.axisLocks ?? {};
        const next: CabinetPosition = {
          ...(c.position ?? { x: 0, y: 0, z: 0 }),
          x: quantise((c.position?.x ?? 0) + (locks.x ? 0 : dx)),
          z: quantise((c.position?.z ?? 0) + (locks.z ? 0 : dz)),
        };
        onMove(c.id, next, c.rotation).catch(err => {
          console.warn('[useKeyboardShortcuts] nudge failed:', err);
        });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, cabinets, selectedIds, onMove, onGizmoModeChange]);
}
