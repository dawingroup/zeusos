/**
 * Frontend IC markup helper tests — ADR-2026-05-25 §2.Q3.
 * Mirrors the backend `functions/__tests__/billing/ic-markup.test.js`.
 */

import { describe, expect, it } from 'vitest';
import { applyMarkup, DEFAULT_IC_MARKUP_PCT } from '../ic-markup';

describe('applyMarkup', () => {
  it('default 15% on 100 cost → 115', () => {
    expect(applyMarkup(100, DEFAULT_IC_MARKUP_PCT)).toBe(115);
  });

  it('default 15% on 1000 cost → 1150', () => {
    expect(applyMarkup(1000, 15)).toBe(1150);
  });

  it('0 cost → 0', () => {
    expect(applyMarkup(0, 15)).toBe(0);
  });

  it('0 markup returns cost unchanged', () => {
    expect(applyMarkup(500, 0)).toBe(500);
  });

  it('negative markup returns cost unchanged (defensive)', () => {
    expect(applyMarkup(500, -5)).toBe(500);
  });

  it('rounds half-up', () => {
    // 333 * 1.15 = 382.95 → 383
    expect(applyMarkup(333, 15)).toBe(383);
  });

  it('DEFAULT_IC_MARKUP_PCT is 15 (matches backend)', () => {
    expect(DEFAULT_IC_MARKUP_PCT).toBe(15);
  });
});
