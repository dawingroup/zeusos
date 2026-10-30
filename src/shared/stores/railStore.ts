/**
 * Context rail state — the shell's single right rail (Actions · Tasks ·
 * Messages · Ask). Ported from DawinOS.
 *
 * Two setters, and the difference between them is the point:
 *
 *   setOpen(open)     never changes the segment
 *   setSeg(seg)       a PERSON picked a segment — also opens the rail
 *
 * `open` / `seg` / `initialised` persist; the assistant prefill and the page's
 * extra grounding are per-session and are partialized out. The transitions are
 * pure so they can be pinned without React (`railStore.test.ts`).
 */
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type RailSeg = 'actions' | 'tasks' | 'messages' | 'ask';

export const RAIL_STORAGE_KEY = 'zeus_rail_v1';
export const RAIL_WIDTH = 340;

/**
 * localStorage that cannot throw. Private mode, a full quota, or no storage at
 * all must cost the rail its memory, never a crash in the shell — the rail is
 * chrome on every page.
 */
const safeStorage: StateStorage = {
  getItem: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* ignore quota / private-mode failures */
    }
  },
  removeItem: (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export interface RailCore {
  open: boolean;
  seg: RailSeg;
  /**
   * False until the first-run default has been applied or the person has
   * touched the rail. The default (open only when something is blocking) is
   * resolved by the shell once the action queue has loaded.
   */
  initialised: boolean;
}

export const RAIL_DEFAULT: RailCore = { open: false, seg: 'actions', initialised: false };

export const railSetOpen = (s: RailCore, open: boolean): RailCore =>
  s.open === open && s.initialised ? s : { ...s, open, initialised: true };

export const railSetSeg = (s: RailCore, seg: RailSeg): RailCore =>
  s.seg === seg && s.open && s.initialised ? s : { ...s, seg, open: true, initialised: true };

/** First load only: open when something is blocking. A no-op ever after. */
export const railApplyFirstRun = (s: RailCore, blockingCount: number): RailCore =>
  s.initialised ? s : { ...s, open: blockingCount > 0, seg: 'actions', initialised: true };

interface RailState extends RailCore {
  /** Text the Ask segment should start with. */
  askPrefill: string | null;
  /** Extra grounding a page hands the assistant on top of the shell's own. */
  askContext: Record<string, unknown> | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setSeg: (seg: RailSeg) => void;
  applyFirstRun: (blockingCount: number) => void;
  openAsk: (prefill?: string) => void;
  clearAskPrefill: () => void;
  setAskContext: (ctx: Record<string, unknown> | null) => void;
}

export const useRailStore = create<RailState>()(
  persist(
    (set) => ({
      ...RAIL_DEFAULT,
      askPrefill: null,
      askContext: null,
      setOpen: (open) => set((s) => railSetOpen(s, open)),
      toggle: () => set((s) => railSetOpen(s, !s.open)),
      setSeg: (seg) => set((s) => railSetSeg(s, seg)),
      applyFirstRun: (blockingCount) => set((s) => railApplyFirstRun(s, blockingCount)),
      openAsk: (prefill) =>
        set((s) => ({ ...railSetSeg(s, 'ask'), askPrefill: prefill?.trim() ? prefill : null })),
      clearAskPrefill: () => set({ askPrefill: null }),
      setAskContext: (askContext) => set({ askContext }),
    }),
    {
      name: RAIL_STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ open: s.open, seg: s.seg, initialised: s.initialised }),
    },
  ),
);
