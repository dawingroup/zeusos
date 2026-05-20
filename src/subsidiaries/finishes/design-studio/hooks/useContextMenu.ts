/**
 * useContextMenu — manages right-click / long-press context menu state.
 *
 * Consumed by `SceneWorkspacePage`: the viewport fires `onContextMenu`
 * with a cabinet id and pointer coordinates, we open at that pointer,
 * and the `ContextMenu` component queries which cabinets are in scope
 * (the payload cabinet plus any currently-selected cabinets when it's
 * part of a multi-selection).
 *
 * The same hook will serve the touch long-press adapter in Phase 6 —
 * the UI surface is identical, only the trigger event differs.
 */
import { useCallback, useState } from 'react';

export interface ContextMenuState {
  /** Screen-space coordinates where the menu should render. */
  x: number;
  y: number;
  /**
   * Cabinet id(s) the menu targets. Single id when right-clicking an
   * unselected cabinet; the full selection when right-clicking a
   * selected cabinet inside a multi-selection.
   */
  cabinetIds: string[];
}

export interface UseContextMenuResult {
  menu: ContextMenuState | null;
  open: (x: number, y: number, cabinetIds: string[]) => void;
  close: () => void;
}

export function useContextMenu(): UseContextMenuResult {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const open = useCallback((x: number, y: number, cabinetIds: string[]) => {
    setMenu({ x, y, cabinetIds });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  return { menu, open, close };
}
