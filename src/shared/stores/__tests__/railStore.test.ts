/**
 * Context rail state — the two setters, and why they differ.
 *   setOpen  never changes the segment
 *   setSeg   a PERSON picked a segment: also opens the rail
 */
import { describe, it, expect } from 'vitest';
import { RAIL_DEFAULT, railApplyFirstRun, railSetOpen, railSetSeg, type RailCore } from '../railStore';

const closed: RailCore = { open: false, seg: 'ask', initialised: true };
const opened: RailCore = { open: true, seg: 'ask', initialised: true };

describe('setOpen', () => {
  it('never changes the segment', () => {
    expect(railSetOpen(closed, true).seg).toBe('ask');
    expect(railSetOpen(opened, false).seg).toBe('ask');
  });

  it('counts as the person touching the rail', () => {
    expect(railSetOpen(RAIL_DEFAULT, false).initialised).toBe(true);
  });
});

describe('setSeg', () => {
  it('opens the rail on that segment', () => {
    expect(railSetSeg(closed, 'actions')).toEqual({ open: true, seg: 'actions', initialised: true });
  });
});

describe('the first-run default', () => {
  it('opens on Actions only when something is blocking', () => {
    expect(railApplyFirstRun(RAIL_DEFAULT, 2)).toEqual({ open: true, seg: 'actions', initialised: true });
    expect(railApplyFirstRun(RAIL_DEFAULT, 0)).toEqual({ open: false, seg: 'actions', initialised: true });
  });

  it('is spent after one use — a later blocker never pops the rail open', () => {
    const once = railApplyFirstRun(RAIL_DEFAULT, 0);
    expect(railApplyFirstRun(once, 5).open).toBe(false);
  });

  it('never overrides a rail the person already touched', () => {
    expect(railApplyFirstRun(closed, 3)).toBe(closed);
  });
});
