import { describe, expect, it } from 'vitest';
import {
  currencyMinorUnits,
  dominantCurrency,
  formatMinor,
  formatMoney,
  HOME_CURRENCY,
  normalizeCurrencyCode,
} from '../money';

describe('formatMoney — currency and minor units', () => {
  it('defaults to the home currency with the code as a prefix and no decimals', () => {
    expect(formatMoney(1234567)).toBe(`${HOME_CURRENCY} 1,234,567`);
    expect(formatMoney(1234567.6)).toBe(`${HOME_CURRENCY} 1,234,568`);
  });

  it('shows two decimals for USD / EUR / GBP', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('USD 1,234.50');
    expect(formatMoney(1234, 'EUR')).toBe('EUR 1,234.00');
    expect(formatMoney(0.1 + 0.2, 'GBP')).toBe('GBP 0.30');
  });

  it('shows no decimals for the East African shillings and francs', () => {
    expect(formatMoney(1234.5, 'KES')).toBe('KES 1,235');
    expect(formatMoney(1234.5, 'TZS')).toBe('TZS 1,235');
    expect(formatMoney(1234.5, 'RWF')).toBe('RWF 1,235');
  });

  it('uses Intl minor units for any other ISO code — never shilling rules', () => {
    expect(formatMoney(1234.5, 'AED')).toBe('AED 1,234.50');
    expect(formatMoney(1234.5, 'JPY')).toBe('JPY 1,235');
    expect(formatMoney(1234.5, 'KWD')).toBe('KWD 1,234.500');
    expect(currencyMinorUnits('ZAR')).toBe(2);
  });

  it('keeps an unrecognisable code visible instead of relabelling it', () => {
    expect(formatMoney(1234.5, 'US DOLLAR')).toBe('US DOLLAR 1,234.50');
  });

  it('normalises case/whitespace and treats a missing currency as the home currency', () => {
    expect(formatMoney(10, ' usd ')).toBe('USD 10.00');
    expect(formatMoney(10, null)).toBe(`${HOME_CURRENCY} 10`);
    expect(normalizeCurrencyCode(undefined)).toBe(HOME_CURRENCY);
  });
});

describe('formatMoney — null safety', () => {
  it('renders null / undefined / NaN / Infinity as zero by default, or as `empty`', () => {
    expect(formatMoney(null)).toBe(`${HOME_CURRENCY} 0`);
    expect(formatMoney(undefined, 'USD')).toBe('USD 0.00');
    expect(formatMoney(Number.NaN, 'UGX', { empty: '—' })).toBe('—');
    expect(formatMoney(0, 'UGX', { empty: '—' })).toBe('UGX 0');
  });

  it('accepts a numeric string from an untyped document', () => {
    expect(formatMoney('2500' as unknown as number, 'UGX')).toBe('UGX 2,500');
  });

  it('renders zero (or anything that rounds to it) as `zero` when given', () => {
    expect(formatMoney(0.4, 'UGX', { zero: '—' })).toBe('—');
    expect(formatMoney(0.4, 'USD', { zero: '—' })).toBe('USD 0.40');
  });
});

describe('formatMoney — code display, signs, compact', () => {
  it('none / foreign', () => {
    expect(formatMoney(1234567, 'UGX', { code: 'none' })).toBe('1,234,567');
    expect(formatMoney(1234567, HOME_CURRENCY, { code: 'foreign' })).toBe('1,234,567');
    expect(formatMoney(1234.5, 'USD', { code: 'foreign' })).toBe('USD 1,234.50');
  });

  it('symbol is byte-identical to Intl style:currency and falls back for an unknown code', () => {
    const intl = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(formatMoney(1234.5, 'USD', { code: 'symbol' })).toBe(intl.format(1234.5));
    expect(formatMoney(5, 'NOT A CODE', { code: 'symbol' })).toBe('NOT A CODE 5.00');
  });

  it('puts the minus after the code and never prints a negative zero', () => {
    expect(formatMoney(-1234, 'UGX')).toBe('UGX -1,234');
    expect(formatMoney(-0.4, 'UGX')).toBe('UGX 0');
    expect(formatMoney(-2_000_000, 'UGX', { minusSign: '−' })).toBe('UGX −2,000,000');
  });

  it('signDisplay and accounting', () => {
    expect(formatMoney(500, 'UGX', { signDisplay: 'always' })).toBe('UGX +500');
    expect(formatMoney(0, 'UGX', { signDisplay: 'exceptZero' })).toBe('UGX 0');
    expect(formatMoney(-1234.5, 'USD', { accounting: true })).toBe('(USD 1,234.50)');
  });

  it('compact scales to B / M (one decimal) and K (whole)', () => {
    expect(formatMoney(1_234_567, 'UGX', { compact: true })).toBe('UGX 1.2M');
    expect(formatMoney(2_500_000_000, 'UGX', { compact: true })).toBe('UGX 2.5B');
    expect(formatMoney(12_345, 'UGX', { compact: true })).toBe('UGX 12K');
    expect(formatMoney(-1_500_000, 'UGX', { compact: true })).toBe('UGX -1.5M');
    expect(formatMoney(1_234_567, 'UGX', { compact: true, fractionDigits: 2 })).toBe('UGX 1.23M');
  });
});

describe('formatMinor / dominantCurrency', () => {
  it('scales minor units by the currency, not a fixed 100', () => {
    expect(formatMinor(123450, 'USD')).toBe('USD 1,234.50');
    expect(formatMinor(123450, 'KES')).toBe('KES 123,450');
    expect(formatMinor(null, 'USD', { empty: '—' })).toBe('—');
  });
  it('labels a list by its most common currency, missing codes counting as home', () => {
    expect(dominantCurrency(['USD', 'USD', 'KES'])).toBe('USD');
    expect(dominantCurrency([null, undefined, 'USD'])).toBe(HOME_CURRENCY);
  });
});
