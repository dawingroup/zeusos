/**
 * Chat-dock window layout.
 *
 * The dock shares the right edge with the shell's context rail, which holds
 * 340px there whenever it is open. Windows therefore lay out leftward from a
 * reserved lane, and the arithmetic that decides how many fit, which ones fold
 * into the "+N" chip, and what an overlaying rail does to them is pure — so it
 * is tested here rather than through a rendered dock.
 *
 * The rule worth pinning hardest: an overlaying rail COLLAPSES windows, it does
 * not close them. Closing would silently discard the threads someone chose to
 * keep open, and re-opening the rail would quietly clear their dock.
 */

import { describe, it, expect } from 'vitest';
import {
  dockReducer,
  layoutWindows,
  windowCapacity,
  windowRightOffset,
  EMPTY_DOCK,
  dockReservedRight,
  WINDOW_WIDTH,
  WINDOW_GAP,
  MAX_WINDOWS,
  MOBILE_BREAKPOINT,
  type DockState,
} from '../dockState';
import { RAIL_WIDTH } from '@/shared/stores/railStore';

const openAll = (...ids: string[]): DockState =>
  ids.reduce((s, channelId) => dockReducer(s, { type: 'open', channelId }), EMPTY_DOCK);

describe('dockReducer', () => {
  it('puts the newest window first', () => {
    expect(openAll('a', 'b', 'c').windows.map((w) => w.channelId)).toEqual(['c', 'b', 'a']);
  });

  it('re-opening a docked thread surfaces it instead of duplicating it', () => {
    const state = dockReducer(openAll('a', 'b', 'c'), { type: 'open', channelId: 'a' });
    expect(state.windows.map((w) => w.channelId)).toEqual(['a', 'c', 'b']);
    expect(state.windows.filter((w) => w.channelId === 'a')).toHaveLength(1);
  });

  it('re-opening a collapsed thread expands it', () => {
    const collapsed = dockReducer(openAll('a'), { type: 'toggleCollapse', channelId: 'a' });
    expect(collapsed.windows[0].collapsed).toBe(true);
    const reopened = dockReducer(collapsed, { type: 'open', channelId: 'a' });
    expect(reopened.windows[0].collapsed).toBe(false);
  });

  it('collapseAll folds every window but closes none', () => {
    const state = dockReducer(openAll('a', 'b'), { type: 'collapseAll' });
    // The whole point: an expanding assistant panel must not discard the
    // conversations someone deliberately docked.
    expect(state.windows.map((w) => w.channelId)).toEqual(['b', 'a']);
    expect(state.windows.every((w) => w.collapsed)).toBe(true);
  });

  it('closes only the named window', () => {
    const state = dockReducer(openAll('a', 'b', 'c'), { type: 'close', channelId: 'b' });
    expect(state.windows.map((w) => w.channelId)).toEqual(['c', 'a']);
  });
});

// The lane the context rail holds on the right: nothing while it is closed,
// its own 340px while it is open (pushed OR overlaying — windows sit above the
// rail's z-index, so they must never land on it).
const RAIL = dockReservedRight(true);

describe('dockReservedRight', () => {
  it('reserves the rail width only while the rail is open', () => {
    expect(dockReservedRight(false)).toBe(0);
    expect(RAIL).toBe(RAIL_WIDTH);
  });
});

describe('windowCapacity', () => {
  it.each([0, RAIL])('leaves a %ipx lane clear on the right', (reserved) => {
    // Exactly enough room for one window beside the reserved lane.
    const oneFits = reserved + WINDOW_GAP * 2 + WINDOW_WIDTH;
    expect(windowCapacity(oneFits, reserved)).toBe(1);
    expect(windowCapacity(oneFits + WINDOW_WIDTH + WINDOW_GAP, reserved)).toBe(2);
  });

  it('fits fewer windows once the rail opens', () => {
    expect(windowCapacity(1440, RAIL)).toBeLessThan(windowCapacity(1440));
  });

  it('never exceeds the hard cap, however wide the screen', () => {
    // Each open window holds its own Firestore message listener.
    expect(windowCapacity(6000)).toBe(MAX_WINDOWS);
    expect(windowCapacity(6000, RAIL)).toBe(MAX_WINDOWS);
  });

  it('always allows at least one window', () => {
    expect(windowCapacity(320)).toBe(1);
    expect(windowCapacity(0)).toBe(1);
    expect(windowCapacity(320, RAIL)).toBe(1);
  });
});

describe('layoutWindows', () => {
  it.each([0, RAIL])('folds what does not fit beside a %ipx lane into the overflow chip', (reserved) => {
    const state = openAll('a', 'b', 'c', 'd', 'e');
    // Room for exactly two — but never narrower than the single-sheet
    // breakpoint, which a 0px lane would otherwise fall under.
    const twoFit = Math.max(MOBILE_BREAKPOINT, reserved + WINDOW_GAP * 2 + WINDOW_WIDTH * 2 + WINDOW_GAP);
    const { visible, overflow } = layoutWindows(state, twoFit, reserved);
    expect(visible.map((w) => w.channelId)).toEqual(['e', 'd']);
    expect(overflow).toHaveLength(3);
  });

  it('shows a single sheet on a narrow viewport', () => {
    const { visible, overflow, isMobile } = layoutWindows(openAll('a', 'b'), 420);
    expect(isMobile).toBe(true);
    expect(visible.map((w) => w.channelId)).toEqual(['b']);
    expect(overflow).toHaveLength(1);
  });

  it('is empty when nothing is docked', () => {
    const { visible, overflow } = layoutWindows(EMPTY_DOCK, 1440);
    expect(visible).toHaveLength(0);
    expect(overflow).toHaveLength(0);
  });
});

describe('windowRightOffset', () => {
  it('starts at the viewport edge while the rail is closed, and steps left', () => {
    expect(windowRightOffset(0)).toBe(WINDOW_GAP);
    expect(windowRightOffset(1)).toBe(WINDOW_GAP + WINDOW_WIDTH + WINDOW_GAP);
  });

  it('starts clear of the rail while it is open', () => {
    expect(windowRightOffset(0, RAIL)).toBe(RAIL + WINDOW_GAP);
    expect(windowRightOffset(1, RAIL)).toBe(RAIL + WINDOW_GAP + WINDOW_WIDTH + WINDOW_GAP);
    // No window may reach back over the rail.
    expect(windowRightOffset(0, RAIL)).toBeGreaterThan(RAIL);
  });
});
