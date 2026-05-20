/**
 * Tests for getCabinetRequiredQuantity — single source of truth for the
 * implicit-1 default. Every rollup depends on this returning a sane
 * positive integer regardless of what's on the cabinet doc.
 */
import { describe, it, expect } from 'vitest';
import { getCabinetRequiredQuantity, sumRequiredQuantity } from '../cabinetQuantity';

describe('getCabinetRequiredQuantity', () => {
  it('defaults to 1 for undefined / null / missing', () => {
    expect(getCabinetRequiredQuantity(undefined)).toBe(1);
    expect(getCabinetRequiredQuantity(null)).toBe(1);
    expect(getCabinetRequiredQuantity({} as never)).toBe(1);
    expect(getCabinetRequiredQuantity({ requiredQuantity: undefined })).toBe(1);
  });

  it('returns the exact integer when valid', () => {
    expect(getCabinetRequiredQuantity({ requiredQuantity: 1 })).toBe(1);
    expect(getCabinetRequiredQuantity({ requiredQuantity: 4 })).toBe(4);
    expect(getCabinetRequiredQuantity({ requiredQuantity: 12 })).toBe(12);
  });

  it('floors fractional values (no half-cabinets)', () => {
    expect(getCabinetRequiredQuantity({ requiredQuantity: 2.9 })).toBe(2);
    expect(getCabinetRequiredQuantity({ requiredQuantity: 3.1 })).toBe(3);
  });

  it('clamps non-finite / NaN / negative / zero to 1', () => {
    expect(getCabinetRequiredQuantity({ requiredQuantity: 0 })).toBe(1);
    expect(getCabinetRequiredQuantity({ requiredQuantity: -5 })).toBe(1);
    expect(getCabinetRequiredQuantity({ requiredQuantity: NaN })).toBe(1);
    expect(getCabinetRequiredQuantity({ requiredQuantity: Infinity })).toBe(1);
  });
});

describe('sumRequiredQuantity', () => {
  it('sums across a mixed cabinet set', () => {
    expect(sumRequiredQuantity([
      { requiredQuantity: 1 },
      { requiredQuantity: 4 },
      {},
      { requiredQuantity: undefined },
      { requiredQuantity: 2 },
    ])).toBe(1 + 4 + 1 + 1 + 2);
  });

  it('returns 0 for an empty array', () => {
    expect(sumRequiredQuantity([])).toBe(0);
  });
});
