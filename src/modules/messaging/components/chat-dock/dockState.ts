/**
 * Chat-dock window state, as a pure reducer.
 *
 * The layout rules (how many windows fit, what happens to the overflow, what
 * a competing panel does to them) are the part most likely to break, and they
 * are pure arithmetic over a list of ids — so they live here, testable without
 * a DOM or a Firestore mock. `ChatDock` renders whatever this returns.
 *
 * The right edge is not always free: the shell's context rail holds 340px
 * there whenever it is open — as a column in push mode, over the canvas in
 * overlay mode. Windows sit at z-index 50, above the rail's 45, so they lay
 * out leftward from a reserved lane (`reservedRight`) rather than from the
 * viewport edge and never land on the rail's footer.
 */

import { RAIL_WIDTH } from '@/shared/stores/railStore';

/** Width of the lane the context rail holds on the right: its own, while open. */
export function dockReservedRight(railOpen: boolean): number {
  return railOpen ? RAIL_WIDTH : 0;
}
export const WINDOW_WIDTH = 320;
export const WINDOW_GAP = 12;
/** Never more than this, however wide the screen. Each open window holds a
 *  Firestore message listener, and past four the dock owns the whole screen. */
export const MAX_WINDOWS = 4;
/** Below this the multi-window layout cannot work; the dock shows one sheet. */
export const MOBILE_BREAKPOINT = 768;

export interface DockWindow {
  channelId: string;
  collapsed: boolean;
}

export interface DockState {
  /** Most-recently-opened FIRST. Rendered right-to-left, so the newest window
   *  is nearest the corner where the user's attention already is. */
  windows: DockWindow[];
}

export const EMPTY_DOCK: DockState = { windows: [] };

export type DockAction =
  | { type: 'open'; channelId: string }
  | { type: 'close'; channelId: string }
  | { type: 'toggleCollapse'; channelId: string }
  | { type: 'setCollapsed'; channelId: string; collapsed: boolean }
  /** The context rail slid over the canvas (overlay mode) — fold every
   *  window to its title bar rather than closing it, so nothing is lost. */
  | { type: 'collapseAll' }
  | { type: 'closeAll' }
  | { type: 'hydrate'; state: DockState };

export function dockReducer(state: DockState, action: DockAction): DockState {
  switch (action.type) {
    case 'open': {
      const rest = state.windows.filter((w) => w.channelId !== action.channelId);
      // Re-opening an already-open window promotes it to the front and expands
      // it — clicking a thread you already have docked should surface it, not
      // silently do nothing.
      return { windows: [{ channelId: action.channelId, collapsed: false }, ...rest] };
    }
    case 'close':
      return { windows: state.windows.filter((w) => w.channelId !== action.channelId) };
    case 'toggleCollapse':
      return {
        windows: state.windows.map((w) =>
          w.channelId === action.channelId ? { ...w, collapsed: !w.collapsed } : w,
        ),
      };
    case 'setCollapsed':
      return {
        windows: state.windows.map((w) =>
          w.channelId === action.channelId ? { ...w, collapsed: action.collapsed } : w,
        ),
      };
    case 'collapseAll':
      return { windows: state.windows.map((w) => ({ ...w, collapsed: true })) };
    case 'closeAll':
      return EMPTY_DOCK;
    case 'hydrate':
      return action.state;
    default:
      return state;
  }
}

/**
 * How many windows fit beside the reserved lane.
 *
 * Always at least one: a window narrower than the viewport is still better
 * than a dock that renders nothing on a small screen.
 */
export function windowCapacity(viewportWidth: number, reservedRight = 0): number {
  const lane = viewportWidth - reservedRight - WINDOW_GAP * 2;
  const fits = Math.floor((lane + WINDOW_GAP) / (WINDOW_WIDTH + WINDOW_GAP));
  return Math.max(1, Math.min(MAX_WINDOWS, fits));
}

export interface DockLayout {
  /** Windows to render, newest first (rendered right-to-left). */
  visible: DockWindow[];
  /** Windows that did not fit — represented by a "+N" chip. */
  overflow: DockWindow[];
  /** One full-width sheet instead of a row of windows. */
  isMobile: boolean;
}

/**
 * Split the open windows into what renders and what folds into the overflow
 * chip. On a narrow viewport only the front window shows, as a sheet.
 */
export function layoutWindows(state: DockState, viewportWidth: number, reservedRight = 0): DockLayout {
  if (viewportWidth < MOBILE_BREAKPOINT) {
    return {
      visible: state.windows.slice(0, 1),
      overflow: state.windows.slice(1),
      isMobile: true,
    };
  }
  const capacity = windowCapacity(viewportWidth, reservedRight);
  return {
    visible: state.windows.slice(0, capacity),
    overflow: state.windows.slice(capacity),
    isMobile: false,
  };
}

/** Right offset, in px, of the nth visible window (0 = nearest the corner). */
export function windowRightOffset(index: number, reservedRight = 0): number {
  return reservedRight + WINDOW_GAP + index * (WINDOW_WIDTH + WINDOW_GAP);
}

// ── Persistence ────────────────────────────────────────────────────────────
// Which threads you had docked should survive a route change (the dock lives
// in AppShell, so that is free) and a reload (it is not). Survives the way the rail's
// own state does.

export const DOCK_STORAGE_KEY = 'zeus_chat_dock_v1';

export function loadDockState(): DockState {
  try {
    const raw = localStorage.getItem(DOCK_STORAGE_KEY);
    if (!raw) return EMPTY_DOCK;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return EMPTY_DOCK;
    const windows = (parsed as DockState).windows;
    if (!Array.isArray(windows)) return EMPTY_DOCK;
    return {
      windows: windows
        .filter((w): w is DockWindow => !!w && typeof w.channelId === 'string' && w.channelId.length > 0)
        .slice(0, MAX_WINDOWS)
        .map((w) => ({ channelId: w.channelId, collapsed: !!w.collapsed })),
    };
  } catch {
    return EMPTY_DOCK;
  }
}

export function saveDockState(state: DockState): void {
  try {
    localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private-mode failures */
  }
}
