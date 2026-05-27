/**
 * Time-tracking service unit tests — Phase 5.D.
 *
 * The Firestore subscription is intentionally not under test here (it's
 * a thin wrapper around `onSnapshot` and the existing collection-group
 * query + index combo are validated by Firestore itself). What this
 * file covers is the date math + roll-up helpers that the page uses
 * to slice entries into the weekly view.
 */

import { describe, expect, it } from 'vitest';
import {
  weekRange,
  totalMinutes,
  groupByIwo,
  dayKey,
  formatMinutes,
} from '../services/time-tracking.service';
import type { TimeEntry } from '@/modules/delivery';

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'te_1',
    iwoId: 'iwo_a',
    userId: 'u_1',
    minutes: 60,
    costMinor: 10_000,
    currency: 'USD',
    entryDate: '2026-05-27T09:00:00Z',
    createdAt: '2026-05-27T09:00:00Z',
    ...over,
  } as TimeEntry;
}

describe('weekRange', () => {
  it('Wednesday → Monday 00:00 of that week → next Monday 00:00', () => {
    // 2026-05-27 is a Wednesday.
    const now = new Date('2026-05-27T15:30:00');
    const { from, to } = weekRange(now);
    expect(from.getDay()).toBe(1); // Monday
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('Sunday treats the previous Monday as the start (not the upcoming one)', () => {
    // 2026-05-31 is a Sunday.
    const now = new Date('2026-05-31T15:00:00');
    const { from } = weekRange(now);
    expect(from.getDay()).toBe(1);
    // It must be the Monday BEFORE — five days ago in calendar terms.
    expect(now.getTime() - from.getTime()).toBeGreaterThan(5 * 24 * 60 * 60 * 1000);
    expect(now.getTime() - from.getTime()).toBeLessThan(7 * 24 * 60 * 60 * 1000);
  });

  it('weekOffset shifts by exactly 7 days', () => {
    const now = new Date('2026-05-27T15:30:00');
    const { from: w0 } = weekRange(now, 0);
    const { from: wPrev } = weekRange(now, -1);
    const { from: wNext } = weekRange(now, 1);
    expect(w0.getTime() - wPrev.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(wNext.getTime() - w0.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('totalMinutes', () => {
  it('sums minutes across entries', () => {
    expect(totalMinutes([entry({ minutes: 30 }), entry({ minutes: 90 }), entry({ minutes: 15 })])).toBe(135);
  });
  it('handles an empty list', () => {
    expect(totalMinutes([])).toBe(0);
  });
  it('ignores missing/NaN minutes', () => {
    expect(totalMinutes([entry({ minutes: undefined as never }), entry({ minutes: 45 })])).toBe(45);
  });
});

describe('groupByIwo', () => {
  it('emits one bucket per IWO with totals + entries', () => {
    const buckets = groupByIwo([
      entry({ id: '1', iwoId: 'iwo_a', minutes: 30 }),
      entry({ id: '2', iwoId: 'iwo_b', minutes: 120 }),
      entry({ id: '3', iwoId: 'iwo_a', minutes: 45 }),
    ]);
    expect(buckets).toHaveLength(2);
    const a = buckets.find(b => b.iwoId === 'iwo_a');
    const b = buckets.find(b => b.iwoId === 'iwo_b');
    expect(a?.totalMinutes).toBe(75);
    expect(a?.entries).toHaveLength(2);
    expect(b?.totalMinutes).toBe(120);
  });

  it('sorts buckets by total minutes desc (highest first)', () => {
    const buckets = groupByIwo([
      entry({ id: '1', iwoId: 'iwo_low', minutes: 15 }),
      entry({ id: '2', iwoId: 'iwo_high', minutes: 240 }),
      entry({ id: '3', iwoId: 'iwo_mid', minutes: 60 }),
    ]);
    expect(buckets.map(b => b.iwoId)).toEqual(['iwo_high', 'iwo_mid', 'iwo_low']);
  });

  it('preserves entry order within a bucket', () => {
    const buckets = groupByIwo([
      entry({ id: 'first', iwoId: 'x', minutes: 10 }),
      entry({ id: 'second', iwoId: 'x', minutes: 20 }),
    ]);
    expect(buckets[0].entries.map(e => e.id)).toEqual(['first', 'second']);
  });

  it('returns [] on an empty list', () => {
    expect(groupByIwo([])).toEqual([]);
  });
});

describe('dayKey', () => {
  it('takes the YYYY-MM-DD prefix of an ISO string', () => {
    expect(dayKey('2026-05-27T15:30:00Z')).toBe('2026-05-27');
  });

  it('reads a Firestore Timestamp via toDate()', () => {
    const ts = { toDate: () => new Date('2026-05-27T15:30:00Z') } as never;
    expect(dayKey(ts)).toBe('2026-05-27');
  });

  it('falls back to em-dash on a missing/bad value', () => {
    expect(dayKey(undefined as never)).toBe('—');
  });
});

describe('formatMinutes', () => {
  it('renders hours + minutes', () => {
    expect(formatMinutes(0)).toBe('0h 0m');
    expect(formatMinutes(30)).toBe('0h 30m');
    expect(formatMinutes(60)).toBe('1h 0m');
    expect(formatMinutes(95)).toBe('1h 35m');
    expect(formatMinutes(480)).toBe('8h 0m');
  });

  it('clamps negative or NaN inputs to "0h 0m"', () => {
    expect(formatMinutes(-5)).toBe('0h 0m');
    expect(formatMinutes(Number.NaN)).toBe('0h 0m');
  });
});
