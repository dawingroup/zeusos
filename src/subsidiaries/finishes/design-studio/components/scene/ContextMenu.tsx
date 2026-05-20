/**
 * ContextMenu — floating menu for right-click / long-press cabinet actions.
 *
 * Actions (Phase 4 scope):
 *   - Move (nudge via keyboard)  — closes menu; arrow-key nudging is
 *     always available via `useKeyboardShortcuts`, the menu just teaches
 *     the user it exists.
 *   - Rotate…                    — opens `RotateDialog`.
 *   - Turn Round                 — toggles `position.mirrored`.
 *   - Group                      — only when ≥2 cabinets targeted.
 *   - Ungroup                    — only when at least one target is
 *     already in a group (visibility wired in Phase 5).
 *   - Lock / Unlock              — toggles `isLocked` (Phase 7).
 *   - Duplicate                  — (Phase 7).
 *   - Delete                     — removeCabinet.
 *
 * Positioning: fixed-positioned at `{x, y}` in screen space. If the
 * menu would clip the right/bottom edge, we flip to open leftward /
 * upward. `Escape` or an outside click closes it.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Move, RotateCcw, FlipHorizontal, Group as GroupIcon, Ungroup,
  Lock, Unlock, Copy, Trash2,
} from 'lucide-react';
import type { SceneCabinet } from '../../types/scene.types';

export interface ContextMenuAction {
  label: string;
  icon: typeof Move;
  onSelect: () => void;
  /** When true, item renders but is disabled + greyed out. */
  disabled?: boolean;
  /** Visual divider drawn *above* this item. */
  separator?: boolean;
  /** Optional destructive style (red). */
  destructive?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  cabinetIds: string[];
  cabinets: SceneCabinet[];
  onClose: () => void;
  onRotate: (cabinetIds: string[]) => void;
  onTurnRound: (cabinetIds: string[]) => void;
  onGroup: (cabinetIds: string[]) => void;
  onUngroup: (cabinetIds: string[]) => void;
  onLock: (cabinetIds: string[], locked: boolean) => void;
  onDuplicate: (cabinetIds: string[]) => void;
  onDelete: (cabinetIds: string[]) => void;
}

export function ContextMenu({
  x, y, cabinetIds, cabinets, onClose,
  onRotate, onTurnRound, onGroup, onUngroup, onLock, onDuplicate, onDelete,
}: ContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture = true so we see the click before React's bubble phase
    // hands it to whatever (viewport raycast, another menu) might
    // swallow it.
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const targets = cabinets.filter(c => cabinetIds.includes(c.id));
  const anyLocked = targets.some(c => c.isLocked);
  const allMirrored = targets.length > 0 && targets.every(c => !!c.position?.mirrored);
  const anyGrouped = targets.some(c => !!c.groupId);
  const isMulti = targets.length > 1;

  const run = (fn: () => void) => { fn(); onClose(); };

  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const safeBottom = 8;
    const w = el.offsetWidth || 240;
    const h = el.offsetHeight || 320;
    const nextLeft = Math.max(pad, Math.min(x, vw - w - pad));
    const nextTop = Math.max(pad, Math.min(y, vh - h - safeBottom));
    setMenuPos({ left: nextLeft, top: nextTop });
  }, [x, y, cabinetIds.length]);

  const items: ContextMenuAction[] = [
    {
      label: 'Rotate…',
      icon: RotateCcw,
      onSelect: () => run(() => onRotate(cabinetIds)),
      disabled: anyLocked,
    },
    {
      label: allMirrored ? 'Un-Turn Round' : 'Turn Round',
      icon: FlipHorizontal,
      onSelect: () => run(() => onTurnRound(cabinetIds)),
      disabled: anyLocked,
    },
    {
      label: 'Group',
      icon: GroupIcon,
      onSelect: () => run(() => onGroup(cabinetIds)),
      disabled: !isMulti,
      separator: true,
    },
    {
      label: 'Ungroup',
      icon: Ungroup,
      onSelect: () => run(() => onUngroup(cabinetIds)),
      disabled: !anyGrouped,
    },
    {
      label: anyLocked ? 'Unlock' : 'Lock',
      icon: anyLocked ? Unlock : Lock,
      onSelect: () => run(() => onLock(cabinetIds, !anyLocked)),
      separator: true,
    },
    {
      label: 'Duplicate',
      icon: Copy,
      onSelect: () => run(() => onDuplicate(cabinetIds)),
      disabled: anyLocked,
    },
    {
      label: 'Delete',
      icon: Trash2,
      onSelect: () => run(() => onDelete(cabinetIds)),
      disabled: anyLocked,
      separator: true,
      destructive: true,
    },
  ];

  return (
    <div
      ref={rootRef}
      role="menu"
      style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, width: 'min(240px, calc(100vw - 16px))', zIndex: 1000 }}
      className="rounded-md border border-border bg-card shadow-lg py-1 text-xs"
    >
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
        {isMulti
          ? `${targets.length} cabinets`
          : (targets[0]?.displayName || targets[0]?.cabinetCode || 'Cabinet')}
      </div>
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border">
        <kbd className="px-1 py-0.5 rounded bg-accent text-foreground font-mono text-[9px]">←↑→↓</kbd>
        <span className="ml-1.5">nudge · <kbd className="px-1 py-0.5 rounded bg-accent text-foreground font-mono text-[9px]">Shift</kbd> fine · <kbd className="px-1 py-0.5 rounded bg-accent text-foreground font-mono text-[9px]">Ctrl</kbd> coarse</span>
      </div>
      {items.map((it, idx) => (
        <div key={it.label}>
          {it.separator && idx > 0 && <div className="my-1 border-t border-border" />}
          <button
            type="button"
            onClick={it.onSelect}
            disabled={it.disabled}
            role="menuitem"
            className={`w-full px-3 py-1.5 flex items-center gap-2 text-left transition-colors ${
              it.disabled
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : it.destructive
                  ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                  : 'text-foreground hover:bg-accent'
            }`}
          >
            <it.icon className="h-3.5 w-3.5 shrink-0" />
            <span>{it.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
