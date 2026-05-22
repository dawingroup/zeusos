/**
 * FX-rate pure-function tests.
 *
 * `getEffectiveRate` does Firestore I/O when from !== to; we only test
 * the same-currency short-circuit and the minor-unit converter here.
 * The end-to-end FX path is exercised by the lifecycle test in Phase 3.B.
 */

import { describe, expect, it } from 'vitest';
import { convertMinor, getEffectiveRate } from '../fx-rate.service';

describe('convertMinor', () => {
  it('rounds to the nearest minor unit', () => {
    expect(convertMinor(100, 1.5)).toBe(150);
    expect(convertMinor(100, 1.234)).toBe(123);
    expect(convertMinor(100, 1.235)).toBe(124); // Math.round half-away
    expect(convertMinor(0, 5)).toBe(0);
  });

  it('preserves negative amounts', () => {
    expect(convertMinor(-100, 2)).toBe(-200);
  });
});

describe('getEffectiveRate same-currency short-circuit', () => {
  it('returns rate=1 without touching Firestore', async () => {
    const rate = await getEffectiveRate('UGX', 'UGX', { effectiveDate: '2026-05-22' });
    expect(rate.rate).toBe(1);
    expect(rate.effectiveDate).toBe('2026-05-22');
    expect(rate.from).toBe('UGX');
    expect(rate.to).toBe('UGX');
  });
});
