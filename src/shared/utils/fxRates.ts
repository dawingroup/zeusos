// ============================================================================
// FX RATES — ONE static table, with bounds (pure)
//
// Why: a conversion that defaults an unknown currency or a missing rate to
// `?? 1` books USD 1,000 as UGX 1,000. Conversions here REFUSE
// (`{ ok: false, reason }`) instead of multiplying by 1, and a rate outside
// its sane band (a dropped or extra digit, an inverted rate) is refused too.
//
// Keep this file PURE: no Firebase, no services. The Firestore-backed lookup
// is src/modules/billing/services/fx-rate.service.ts, which builds on this and
// falls back to this table when no dated snapshot exists.
// ============================================================================
import { FUNCTIONAL_CURRENCY } from '@/shared/constants/functionalCurrency';

export { FUNCTIONAL_CURRENCY };

/** The ONE static USD→functional fallback. */
export const DEFAULT_USD_RATE = 3700;

/** Static fallback rates to the functional currency. A currency absent from this table is UNKNOWN. */
export const DEFAULT_RATES_TO_FUNCTIONAL: Readonly<Record<string, number>> = Object.freeze({
  [FUNCTIONAL_CURRENCY]: 1,
  USD: DEFAULT_USD_RATE,
  EUR: 4000,
  GBP: 4600,
  AED: 1000,
  CNY: 510,
  KES: 29,
  ZAR: 205,
});

export interface FxBounds {
  min: number;
  max: number;
}

/**
 * USD 2,500–6,000 against the shilling (it traded ~3,550–3,950 through
 * 2019–2026; the floor catches a dropped digit, a wrong-currency rate and an
 * inverted rate, the ceiling an extra digit). Other known currencies: half to
 * double their static default — refuses a rate of 1 or an order-of-magnitude slip.
 */
const USD_BOUNDS: FxBounds = { min: 2500, max: 6000 };
const RELATIVE_BAND = { low: 0.5, high: 2 } as const;

export const FX_BOUNDS: Readonly<Record<string, Readonly<FxBounds>>> = Object.freeze(
  Object.fromEntries(
    Object.entries(DEFAULT_RATES_TO_FUNCTIONAL)
      .filter(([code]) => code !== FUNCTIONAL_CURRENCY)
      .map(([code, rate]) => [
        code,
        Object.freeze(code === 'USD'
          ? { ...USD_BOUNDS }
          : { min: rate * RELATIVE_BAND.low, max: rate * RELATIVE_BAND.high }),
      ]),
  ),
);

export type FxRefusalReason =
  | 'missing-currency'
  | 'unknown-currency'
  | 'rate-out-of-bounds'
  | 'missing-rate'
  | 'invalid-amount';

export interface FxRefusal {
  ok: false;
  reason: FxRefusalReason;
  message: string;
  currency: string | null;
}

export type FxRateSource = 'functional' | 'explicit' | 'config' | 'default';

export type ResolvedRate =
  | { ok: true; rate: number; source: FxRateSource; currency: string }
  | FxRefusal;

export type ConvertedAmount =
  | { ok: true; amountFunctional: number; rate: number; currency: string; source?: FxRateSource }
  | FxRefusal;

export type CrossRate =
  | { ok: true; rate: number; from: string; to: string }
  | FxRefusal;

/** 'usd ' → 'USD'; empty / non-string → null. */
export function normalizeCurrency(currency: unknown): string | null {
  if (typeof currency !== 'string') return null;
  const code = currency.trim().toUpperCase();
  return code || null;
}

export function isKnownCurrency(currency: unknown): boolean {
  const code = normalizeCurrency(currency);
  return !!code && Object.prototype.hasOwnProperty.call(DEFAULT_RATES_TO_FUNCTIONAL, code);
}

/** A finite, positive rate inside the currency's bounds (functional currency: exactly 1). */
export function isRateInBounds(currency: unknown, rate: unknown): boolean {
  const code = normalizeCurrency(currency);
  const r = Number(rate);
  if (!code || !Number.isFinite(r) || r <= 0) return false;
  if (code === FUNCTIONAL_CURRENCY) return r === 1;
  const b = FX_BOUNDS[code];
  return !!b && r >= b.min && r <= b.max;
}

function describeBounds(code: string): string {
  const b = FX_BOUNDS[code];
  return b ? `${b.min}–${b.max}` : 'none (unknown currency)';
}

function unknown(code: string): FxRefusal {
  return {
    ok: false,
    reason: 'unknown-currency',
    message: `No ${code}→${FUNCTIONAL_CURRENCY} rate is held — add ${code} to the FX table (src/shared/utils/fxRates.ts) before converting`,
    currency: code,
  };
}

/**
 * The rate to convert `currency` to the functional currency at: functional →
 * 1; a document's own `explicitRate` (refused if out of bounds, never
 * replaced); USD → a configured `usdRate`; a known currency's static default;
 * anything else refused. Never 1 for a foreign currency.
 */
export function resolveRateToFunctional(
  currency: unknown,
  { explicitRate = null, usdRate = null }: { explicitRate?: unknown; usdRate?: unknown } = {},
): ResolvedRate {
  const code = normalizeCurrency(currency);
  if (!code) {
    return { ok: false, reason: 'missing-currency', message: 'No currency to convert from', currency: null };
  }
  if (code === FUNCTIONAL_CURRENCY) return { ok: true, rate: 1, source: 'functional', currency: code };
  if (!isKnownCurrency(code)) return unknown(code);

  const hasExplicit = explicitRate !== null && explicitRate !== undefined && explicitRate !== '' && Number(explicitRate) !== 0;
  if (hasExplicit) {
    const r = Number(explicitRate);
    if (!isRateInBounds(code, r)) {
      return {
        ok: false,
        reason: 'rate-out-of-bounds',
        message: `${code}→${FUNCTIONAL_CURRENCY} rate ${String(explicitRate)} is outside the sane range ${describeBounds(code)}`,
        currency: code,
      };
    }
    return { ok: true, rate: r, source: 'explicit', currency: code };
  }

  if (code === 'USD' && usdRate !== null && usdRate !== undefined) {
    const r = Number(usdRate);
    if (!isRateInBounds('USD', r)) {
      return {
        ok: false,
        reason: 'rate-out-of-bounds',
        message: `USD→${FUNCTIONAL_CURRENCY} rate ${String(usdRate)} is outside the sane range ${describeBounds('USD')}`,
        currency: code,
      };
    }
    return { ok: true, rate: r, source: 'config', currency: code };
  }

  return { ok: true, rate: DEFAULT_RATES_TO_FUNCTIONAL[code], source: 'default', currency: code };
}

/**
 * amount in `currency` → functional currency at `rate` (unrounded). The
 * functional currency passes through; any other currency needs a rate inside
 * its bounds; unknown currency / missing rate / out-of-range rate is refused.
 */
export function convertToFunctional(amount: unknown, currency: unknown, rate: unknown): ConvertedAmount {
  const code = normalizeCurrency(currency);
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: 'invalid-amount', message: `Amount "${String(amount)}" is not a number`, currency: code };
  }
  if (!code) {
    return { ok: false, reason: 'missing-currency', message: 'No currency to convert from', currency: null };
  }
  if (code === FUNCTIONAL_CURRENCY) return { ok: true, amountFunctional: n, rate: 1, currency: code };
  if (!isKnownCurrency(code)) return unknown(code);
  const r = Number(rate);
  if (rate === null || rate === undefined || !Number.isFinite(r) || r <= 0) {
    return { ok: false, reason: 'missing-rate', message: `No ${code}→${FUNCTIONAL_CURRENCY} rate given`, currency: code };
  }
  if (!isRateInBounds(code, r)) {
    return {
      ok: false,
      reason: 'rate-out-of-bounds',
      message: `${code}→${FUNCTIONAL_CURRENCY} rate ${String(rate)} is outside the sane range ${describeBounds(code)}`,
      currency: code,
    };
  }
  return { ok: true, amountFunctional: n * r, rate: r, currency: code };
}

/** resolveRateToFunctional + convertToFunctional in one step. */
export function amountToFunctional(
  amount: unknown,
  currency: unknown,
  opts: { explicitRate?: unknown; usdRate?: unknown } = {},
): ConvertedAmount {
  const resolved = resolveRateToFunctional(currency, opts);
  if (!resolved.ok) return resolved;
  const converted = convertToFunctional(amount, resolved.currency, resolved.rate);
  return converted.ok ? { ...converted, source: resolved.source } : converted;
}

/**
 * 1 `from` = N `to`, crossed through the functional currency on the static
 * table (or `rates`, a table of rates TO the functional currency, when given).
 * Refused when either side is unknown — never 1.
 */
export function crossRateViaFunctional(
  from: unknown,
  to: unknown,
  rates: Readonly<Record<string, number>> = DEFAULT_RATES_TO_FUNCTIONAL,
): CrossRate {
  const f = normalizeCurrency(from);
  const t = normalizeCurrency(to);
  if (!f || !t) {
    return { ok: false, reason: 'missing-currency', message: 'No currency to convert from or to', currency: f ?? t };
  }
  if (f === t) return { ok: true, rate: 1, from: f, to: t };
  const fromRate = f === FUNCTIONAL_CURRENCY ? 1 : rates[f];
  const toRate = t === FUNCTIONAL_CURRENCY ? 1 : rates[t];
  if (!Number.isFinite(fromRate) || !(fromRate > 0)) return unknown(f);
  if (!Number.isFinite(toRate) || !(toRate > 0)) return unknown(t);
  // 1 from = fromRate functional = (fromRate / toRate) to.
  return { ok: true, rate: fromRate / toRate, from: f, to: t };
}

/**
 * The static default rate for a KNOWN currency, or null. For display/estimate
 * surfaces that need a number to prefill (never for posting — resolve instead).
 */
export function defaultRateToFunctional(currency: unknown): number | null {
  const code = normalizeCurrency(currency);
  return code && isKnownCurrency(code) ? DEFAULT_RATES_TO_FUNCTIONAL[code] : null;
}
