import { describe, it, expect } from 'vitest';
import { countActiveSnoozes } from '../designManagerSnooze';

describe('countActiveSnoozes', () => {
  it('counts entries strictly after now', () => {
    const now = 1_000_000;
    const m = new Map<string, number>([
      ['a', now + 1],
      ['b', now - 1],
      ['c', now],
    ]);
    expect(countActiveSnoozes(m, now)).toBe(1);
  });

  it('empty map is zero', () => {
    expect(countActiveSnoozes(new Map(), Date.now())).toBe(0);
  });
});
