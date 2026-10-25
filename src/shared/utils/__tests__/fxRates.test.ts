import { describe, it, expect } from 'vitest';
import {
  amountToFunctional,
  convertToFunctional,
  crossRateViaFunctional,
  DEFAULT_USD_RATE,
  defaultRateToFunctional,
  FUNCTIONAL_CURRENCY,
  isRateInBounds,
  resolveRateToFunctional,
} from '../fxRates';

describe('fxRates — never multiply by 1', () => {
  it('refuses an unknown currency and a missing currency instead of defaulting the rate', () => {
    expect(resolveRateToFunctional('XYZ')).toMatchObject({ ok: false, reason: 'unknown-currency' });
    expect(resolveRateToFunctional('')).toMatchObject({ ok: false, reason: 'missing-currency' });
    expect(amountToFunctional(1000, 'XYZ')).toMatchObject({ ok: false, reason: 'unknown-currency' });
    expect(convertToFunctional(1000, 'USD', null)).toMatchObject({ ok: false, reason: 'missing-rate' });
  });

  it('the functional currency passes through at exactly 1', () => {
    expect(resolveRateToFunctional(FUNCTIONAL_CURRENCY)).toMatchObject({ ok: true, rate: 1, source: 'functional' });
    expect(convertToFunctional(500, FUNCTIONAL_CURRENCY, 1)).toMatchObject({ ok: true, amountFunctional: 500 });
  });

  it('a known currency falls back to its static default; an explicit or configured rate wins when sane', () => {
    expect(resolveRateToFunctional('usd')).toMatchObject({ ok: true, rate: DEFAULT_USD_RATE, source: 'default', currency: 'USD' });
    expect(resolveRateToFunctional('USD', { usdRate: 3800 })).toMatchObject({ ok: true, rate: 3800, source: 'config' });
    expect(resolveRateToFunctional('USD', { explicitRate: 3650, usdRate: 3800 })).toMatchObject({ ok: true, rate: 3650, source: 'explicit' });
    expect(amountToFunctional(10, 'USD', { usdRate: 3800 })).toMatchObject({ ok: true, amountFunctional: 38_000 });
  });

  it('refuses a rate outside the currency\'s sane band — a dropped digit, an inversion, a 1', () => {
    expect(isRateInBounds('USD', 370)).toBe(false);
    expect(isRateInBounds('USD', 1)).toBe(false);
    expect(isRateInBounds('USD', 3700)).toBe(true);
    expect(isRateInBounds('KES', 1)).toBe(false);
    expect(isRateInBounds('KES', 29)).toBe(true);
    expect(resolveRateToFunctional('USD', { explicitRate: 37 })).toMatchObject({ ok: false, reason: 'rate-out-of-bounds' });
    expect(resolveRateToFunctional('USD', { usdRate: 99_999 })).toMatchObject({ ok: false, reason: 'rate-out-of-bounds' });
    expect(convertToFunctional(100, 'EUR', 1)).toMatchObject({ ok: false, reason: 'rate-out-of-bounds' });
  });

  it('crosses two foreign currencies through the functional currency, refusing an unknown side', () => {
    const usdKes = crossRateViaFunctional('USD', 'KES');
    expect(usdKes.ok && usdKes.rate).toBeCloseTo(3700 / 29, 6);
    expect(crossRateViaFunctional('KES', 'KES')).toMatchObject({ ok: true, rate: 1 });
    expect(crossRateViaFunctional('USD', FUNCTIONAL_CURRENCY)).toMatchObject({ ok: true, rate: 3700 });
    expect(crossRateViaFunctional('USD', 'XYZ')).toMatchObject({ ok: false, reason: 'unknown-currency', currency: 'XYZ' });
    expect(crossRateViaFunctional('USD', 'KES', { USD: 3800, KES: 30 })).toMatchObject({ ok: true, rate: 3800 / 30 });
  });

  it('exposes a prefill default only for a known currency', () => {
    expect(defaultRateToFunctional('GBP')).toBe(4600);
    expect(defaultRateToFunctional('XYZ')).toBeNull();
  });
});
