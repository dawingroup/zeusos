/**
 * VAT / WHT arithmetic — ONE helper for every money path.
 *
 * - Rates come from `src/shared/constants/tax.ts` by jurisdiction
 *   (`vatRateFor('KE')` → 0.16). The bare `STANDARD_*` constants are the
 *   default jurisdiction's, for a document that records none.
 * - Rates are accepted as a fraction (0.16) or a percent (16): above 1 reads as
 *   a percent. 1 means 100%, so a call site that KNOWS its unit says so with
 *   `normalizeRate(pct, 'percent')`. Negative / non-finite / >100% rates throw.
 * - ONE rounding rule: only the TAX is rounded — whole units for the
 *   zero-decimal shillings and francs (and when no currency is given), 2
 *   decimals for any other currency, half AWAY from zero — and the other side
 *   is DERIVED from the amount you passed and the rounded tax, so
 *   net + vat === gross exactly for whole-unit amounts.
 * - `splitAmount` REQUIRES a mode: 'exclusive' (amount is net, VAT on top) or
 *   'inclusive' (amount is gross, VAT extracted).
 *
 * Amounts here are MAJOR units. For the `amountMinor` fields the commercial
 * collections store, convert at the boundary.
 */
import { FUNCTIONAL_CURRENCY } from '@/shared/constants/functionalCurrency';
import { VAT_RATE_BPS, WHT_RATE_BPS, DEFAULT_TAX_JURISDICTION, bpsToRate, type TaxJurisdiction } from '@/shared/constants/tax';

export const DEFAULT_TAX_CURRENCY = FUNCTIONAL_CURRENCY;

/** Standard-rate VAT for a jurisdiction, as a fraction. */
export function vatRateFor(jurisdiction: TaxJurisdiction = DEFAULT_TAX_JURISDICTION): number {
  return bpsToRate(VAT_RATE_BPS[jurisdiction]);
}

/** Withholding tax on qualifying supplier payments for a jurisdiction, as a fraction (0 where none is held). */
export function whtRateFor(jurisdiction: TaxJurisdiction = DEFAULT_TAX_JURISDICTION): number {
  return bpsToRate(WHT_RATE_BPS[jurisdiction] ?? 0);
}

export const STANDARD_VAT_RATE = vatRateFor();
export const STANDARD_WHT_RATE = whtRateFor();

export type TaxMode = 'inclusive' | 'exclusive';
export type RateUnit = 'fraction' | 'percent';
export type WhtBase = 'net' | 'gross';

export interface TaxRoundingOptions {
  /** ISO code; decides the rounding precision (shillings → whole units, else 2dp). */
  currency?: string;
}

export interface TaxSplit {
  net: number;
  vat: number;
  gross: number;
  /** The normalised rate (fraction) the split was computed at. */
  rate: number;
}

/** Currencies whose money has no minor unit in practice (kept in step with money.ts). */
const ZERO_DECIMAL_CURRENCIES = ['UGX', 'KES', 'TZS', 'RWF'];

/** Decimal places the tax is rounded to for a currency. */
export function moneyDecimals(currency?: string): number {
  const code = String(currency || DEFAULT_TAX_CURRENCY).trim().toUpperCase();
  return ZERO_DECIMAL_CURRENCIES.includes(code) ? 0 : 2;
}

function assertFiniteAmount(amount: unknown, what: string): asserts amount is number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TypeError(`${what} must be a finite number (got ${String(amount)})`);
  }
}

/**
 * Round half away from zero to the currency's precision. `toPrecision(15)`
 * strips binary dust first, so 1.005 → 1.01 and 180.00000000000003 → 180.
 */
export function roundMoney(amount: number, currency?: string): number {
  assertFiniteAmount(amount, 'amount');
  const factor = 10 ** moneyDecimals(currency);
  const scaled = Number((Math.abs(amount) * factor).toPrecision(15));
  const rounded = Math.round(scaled) / factor;
  if (rounded === 0) return 0; // never -0
  return amount < 0 ? -rounded : rounded;
}

function isAtPrecision(amount: number, currency?: string): boolean {
  return roundMoney(amount, currency) === amount;
}

/**
 * A tax rate as a fraction in [0, 1].
 * @param rate 0.16 or 16
 * @param unit force the reading; omit to infer (> 1 ⇒ percent)
 */
export function normalizeRate(rate: number, unit?: RateUnit): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    throw new RangeError(`Tax rate must be a finite number (got ${String(rate)})`);
  }
  if (rate < 0) throw new RangeError(`Tax rate cannot be negative (got ${rate})`);
  if (unit !== undefined && unit !== 'fraction' && unit !== 'percent') {
    throw new RangeError(`Tax rate unit must be 'fraction' or 'percent' (got ${String(unit)})`);
  }
  const asPercent = unit === 'percent' || (unit === undefined && rate > 1);
  const fraction = asPercent ? Number((rate / 100).toPrecision(15)) : rate;
  if (fraction > 1) {
    throw new RangeError(`Tax rate ${rate}${asPercent ? '%' : ''} is above 100%`);
  }
  return fraction;
}

/** VAT on a VAT-EXCLUSIVE amount (VAT added on top). */
export function vatOnNet(net: number, rate: number, opts: TaxRoundingOptions = {}): number {
  assertFiniteAmount(net, 'net');
  return roundMoney(net * normalizeRate(rate), opts.currency);
}

/** The VAT inside a VAT-INCLUSIVE amount. */
export function vatFromGross(gross: number, rate: number, opts: TaxRoundingOptions = {}): number {
  assertFiniteAmount(gross, 'gross');
  const r = normalizeRate(rate);
  return roundMoney((gross * r) / (1 + r), opts.currency);
}

function derive(value: number, from: number, currency?: string): number {
  return isAtPrecision(from, currency) ? roundMoney(value, currency) : value;
}

/** VAT-inclusive amount for a VAT-exclusive one: net + vatOnNet(net). */
export function grossFromNet(net: number, rate: number, opts: TaxRoundingOptions = {}): number {
  const vat = vatOnNet(net, rate, opts);
  return derive(net + vat, net, opts.currency);
}

/** VAT-exclusive amount inside a VAT-inclusive one: gross − vatFromGross(gross). */
export function netFromGross(gross: number, rate: number, opts: TaxRoundingOptions = {}): number {
  const vat = vatFromGross(gross, rate, opts);
  return derive(gross - vat, gross, opts.currency);
}

/**
 * Split an amount into { net, vat, gross }. `mode` is REQUIRED:
 *   'exclusive' — `amount` is the NET; VAT is added on top.
 *   'inclusive' — `amount` is the GROSS; VAT is extracted from it.
 */
export function splitAmount(
  amount: number,
  { rate, mode, currency }: { rate: number; mode: TaxMode; currency?: string },
): TaxSplit {
  assertFiniteAmount(amount, 'amount');
  const r = normalizeRate(rate);
  if (mode === 'exclusive') {
    const vat = vatOnNet(amount, r, { currency });
    return { net: amount, vat, gross: derive(amount + vat, amount, currency), rate: r };
  }
  if (mode === 'inclusive') {
    const vat = vatFromGross(amount, r, { currency });
    return { net: derive(amount - vat, amount, currency), vat, gross: amount, rate: r };
  }
  throw new RangeError(`splitAmount needs mode 'inclusive' or 'exclusive' (got ${String(mode)})`);
}

/**
 * Withholding tax on a payment.
 *   base 'net'   (default) — `amount` is VAT-EXCLUSIVE: WHT = rate × amount.
 *   base 'gross'           — `amount` is VAT-INCLUSIVE at `vatRate`; the VAT is
 *                            stripped first. With vatRate 0 (supplier not
 *                            VAT-registered) the gross IS the base.
 */
export function whtOn(
  amount: number,
  {
    rate = STANDARD_WHT_RATE,
    base = 'net',
    vatRate = 0,
    currency,
  }: { rate?: number; base?: WhtBase; vatRate?: number; currency?: string } = {},
): number {
  assertFiniteAmount(amount, 'amount');
  const r = normalizeRate(rate);
  let taxable: number;
  if (base === 'net') taxable = amount;
  else if (base === 'gross') taxable = amount - vatFromGross(amount, vatRate, { currency });
  else throw new RangeError(`whtOn base must be 'net' or 'gross' (got ${String(base)})`);
  return roundMoney(taxable * r, currency);
}
