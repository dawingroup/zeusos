import { describe, it, expect } from 'vitest';
import {
  grossFromNet,
  moneyDecimals,
  netFromGross,
  normalizeRate,
  roundMoney,
  splitAmount,
  STANDARD_VAT_RATE,
  vatFromGross,
  vatOnNet,
  vatRateFor,
  whtOn,
  whtRateFor,
} from '../taxMath';

describe('taxMath — one rate table, one rounding rule', () => {
  it('rates come from the jurisdiction table', () => {
    expect(vatRateFor('UG')).toBe(0.18);
    expect(vatRateFor('KE')).toBe(0.16);
    expect(vatRateFor('US')).toBe(0);
    expect(whtRateFor('UG')).toBe(0.06);
    expect(whtRateFor('KE')).toBe(0.05);
    expect(whtRateFor('OTHER')).toBe(0);
    expect(STANDARD_VAT_RATE).toBe(vatRateFor());
  });

  it('accepts a fraction or a percent, and refuses nonsense', () => {
    expect(normalizeRate(0.16)).toBe(0.16);
    expect(normalizeRate(16)).toBe(0.16);
    expect(normalizeRate(1, 'percent')).toBe(0.01);
    expect(() => normalizeRate(160)).toThrow(RangeError);
    expect(() => normalizeRate(-1)).toThrow(RangeError);
    expect(() => normalizeRate(Number.NaN)).toThrow(RangeError);
  });

  it('rounds only the tax, to the currency precision, half away from zero', () => {
    expect(moneyDecimals('KES')).toBe(0);
    expect(moneyDecimals('USD')).toBe(2);
    expect(roundMoney(1.005, 'USD')).toBe(1.01);
    expect(roundMoney(-0.004, 'USD')).toBe(0);
    expect(vatOnNet(100_000, 0.16, { currency: 'KES' })).toBe(16_000);
    expect(vatOnNet(333, 0.18)).toBe(60); // 59.94 → whole shillings
    expect(vatOnNet(99.99, 0.16, { currency: 'USD' })).toBe(16);
  });

  it('net + vat === gross for whole-unit amounts, both directions', () => {
    expect(splitAmount(100_000, { rate: 18, mode: 'exclusive' })).toEqual({ net: 100_000, vat: 18_000, gross: 118_000, rate: 0.18 });
    expect(splitAmount(118_000, { rate: 0.18, mode: 'inclusive' })).toEqual({ net: 100_000, vat: 18_000, gross: 118_000, rate: 0.18 });
    expect(grossFromNet(50_000, 0.16, { currency: 'KES' })).toBe(58_000);
    expect(netFromGross(58_000, 0.16, { currency: 'KES' })).toBe(50_000);
    expect(vatFromGross(1160, 0.16, { currency: 'KES' })).toBe(160);
    // @ts-expect-error — a missing mode is a programming error, not a default
    expect(() => splitAmount(100, { rate: 0.16 })).toThrow(RangeError);
  });

  it('WHT is computed on the VAT-exclusive amount unless told the base is gross', () => {
    expect(whtOn(1_000_000)).toBe(60_000);
    expect(whtOn(1_000_000, { rate: whtRateFor('KE'), currency: 'KES' })).toBe(50_000);
    expect(whtOn(1_180_000, { base: 'gross', vatRate: 0.18 })).toBe(60_000);
    expect(whtOn(1_180_000, { base: 'gross', vatRate: 0 })).toBe(70_800);
  });
});
