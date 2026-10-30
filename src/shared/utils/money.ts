/**
 * ONE money formatter for ZeusOS.
 *
 * Everything here is DISPLAY ONLY — no conversion, no tax math.
 *
 *   formatMoney(1234567)                        → "UGX 1,234,567"
 *   formatMoney(1234.5, 'USD')                  → "USD 1,234.50"
 *   formatMoney(1234567, 'KES', { code: 'none' })   → "1,234,567"
 *   formatMoney(1234567, 'UGX', { compact: true })  → "UGX 1.2M"
 *   formatMoney(-1234, 'UGX', { accounting: true, code: 'none' }) → "(1,234)"
 *
 * Minor units are per currency: UGX/KES/TZS/RWF have none in practice, USD/EUR/GBP
 * have two, and any other ISO code uses what `Intl` knows for it (JPY 0, KWD 3) —
 * an unfamiliar code is NEVER silently formatted as shillings.
 *
 * Amounts in ZeusOS's commercial collections are stored as MINOR units
 * (`amountMinor`); use `formatMinor` for those. `formatMoney` takes MAJOR units.
 */
import { FUNCTIONAL_CURRENCY, MONEY_LOCALE } from '@/shared/constants/functionalCurrency';

/** The home / functional currency. Amounts in it may be shown bare (`code: 'foreign'`). */
export const HOME_CURRENCY = FUNCTIONAL_CURRENCY;
export { MONEY_LOCALE };

/**
 * Minor units we pin explicitly. East African shillings/francs are quoted
 * without cents everywhere in the business (Intl says KES/TZS carry 2 — the
 * books never do), and the three reserve currencies always show cents.
 */
const PINNED_MINOR_UNITS: Readonly<Record<string, number>> = {
  UGX: 0,
  KES: 0,
  TZS: 0,
  RWF: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

/**
 * How the currency is shown next to the number.
 * - `prefix`  (default) ISO code + space: `UGX 1,234,567`, `USD 1,234.50`, `UGX -500`.
 * - `symbol`  the locale symbol via Intl: `USh 1,234,567`, `US$1,234.50`.
 * - `none`    bare number — the caller prints the currency itself (a column header, a unit label).
 * - `foreign` bare for the home currency, `prefix` for anything else — for places
 *             labelled in the home currency that can still hold a foreign amount, so a
 *             dollar figure never reads as shillings.
 */
export type MoneyCodeDisplay = 'prefix' | 'symbol' | 'none' | 'foreign';

export interface FormatMoneyOptions {
  code?: MoneyCodeDisplay;
  /** Short scale: `1.2B`, `3.4M`, `12K` (B/M to one decimal, K and below whole). */
  compact?: boolean;
  /**
   * Override the currency's minor units (e.g. `0` for a whole-number summary).
   * In compact mode it sets the decimals of the B and M tiers instead.
   */
  fractionDigits?: number;
  /** Same meaning as `Intl.NumberFormat`'s `signDisplay`. Default `auto`. */
  signDisplay?: 'auto' | 'always' | 'exceptZero' | 'never';
  /** Negative amounts in parentheses — `(1,234)` / `(UGX 1,234)` — instead of a minus. */
  accounting?: boolean;
  /** Glyph for the minus sign. Default hyphen-minus `-`; statements use the typographic `−` (U+2212). */
  minusSign?: string;
  /** Rendered for null / undefined / NaN / ±Infinity. Default: the amount is treated as 0. */
  empty?: string;
  /** Rendered for an amount that is (or rounds to) zero, e.g. `'—'` in dense tables. */
  zero?: string;
}

/**
 * Upper-cased, trimmed ISO code. A missing currency is the home currency —
 * legacy documents written before multi-currency carry no `currency` field.
 */
export function normalizeCurrencyCode(currency: string | null | undefined): string {
  if (typeof currency !== 'string') return HOME_CURRENCY;
  const code = currency.trim().toUpperCase();
  return code || HOME_CURRENCY;
}

const currencyFormatCache = new Map<string, Intl.NumberFormat | null>();

/** Intl currency formatter for a code, or null when Intl rejects the code. */
function intlCurrencyFormat(code: string, digits?: number): Intl.NumberFormat | null {
  const key = `${code}|${digits ?? ''}`;
  if (currencyFormatCache.has(key)) return currencyFormatCache.get(key) ?? null;
  let fmt: Intl.NumberFormat | null;
  try {
    fmt = new Intl.NumberFormat(MONEY_LOCALE, {
      style: 'currency',
      currency: code,
      ...(digits !== undefined ? { minimumFractionDigits: digits, maximumFractionDigits: digits } : {}),
    });
  } catch {
    fmt = null; // not a code Intl recognises ("US DOLLAR", "SHS", …)
  }
  currencyFormatCache.set(key, fmt);
  return fmt;
}

/** Decimal places a currency is shown with (see PINNED_MINOR_UNITS for the rationale). */
export function currencyMinorUnits(currency: string | null | undefined): number {
  const code = normalizeCurrencyCode(currency);
  const pinned = PINNED_MINOR_UNITS[code];
  if (pinned !== undefined) return pinned;
  const fmt = intlCurrencyFormat(code);
  return fmt?.resolvedOptions().maximumFractionDigits ?? 2;
}

const decimalFormatCache = new Map<number, Intl.NumberFormat>();

function formatDigits(abs: number, digits: number): string {
  let fmt = decimalFormatCache.get(digits);
  if (!fmt) {
    fmt = new Intl.NumberFormat(MONEY_LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    decimalFormatCache.set(digits, fmt);
  }
  return fmt.format(abs);
}

function toFiniteNumber(amount: unknown): number | null {
  const n = typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : amount;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** The magnitude, scaled for compact display, with its suffix and decimals. */
function compactParts(abs: number, fractionDigits: number | undefined): { scaled: number; suffix: string; digits: number } {
  if (abs >= 1e9) return { scaled: abs / 1e9, suffix: 'B', digits: fractionDigits ?? 1 };
  if (abs >= 1e6) return { scaled: abs / 1e6, suffix: 'M', digits: fractionDigits ?? 1 };
  if (abs >= 1e3) return { scaled: abs / 1e3, suffix: 'K', digits: 0 };
  return { scaled: abs, suffix: '', digits: 0 };
}

/**
 * Format an amount of money (MAJOR units) for display. Null-safe; never throws.
 *
 * @param amount   the amount (null / undefined / NaN render as 0, or as `opts.empty`)
 * @param currency ISO 4217 code; missing → the home currency (see normalizeCurrencyCode)
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = HOME_CURRENCY,
  opts: FormatMoneyOptions = {},
): string {
  const n = toFiniteNumber(amount);
  if (n === null && opts.empty !== undefined) return opts.empty;
  const value = n ?? 0;

  const code = normalizeCurrencyCode(currency);
  const display: Exclude<MoneyCodeDisplay, 'foreign'> =
    opts.code === 'foreign' ? (code === HOME_CURRENCY ? 'none' : 'prefix') : (opts.code ?? 'prefix');

  const abs = Math.abs(value);
  const { scaled, suffix, digits } = opts.compact
    ? compactParts(abs, opts.fractionDigits)
    : { scaled: abs, suffix: '', digits: opts.fractionDigits ?? currencyMinorUnits(code) };

  // Anything that rounds to zero IS zero — no "-0", no "-UGX 0".
  const isZero = scaled < 0.5 * 10 ** -digits;
  if (isZero && opts.zero !== undefined) return opts.zero;
  const negative = value < 0 && !isZero;

  let sign = '';
  if (!opts.accounting || !negative) {
    const sd = opts.signDisplay ?? 'auto';
    if (negative && sd !== 'never') sign = opts.minusSign ?? '-';
    else if (!negative && (sd === 'always' || (sd === 'exceptZero' && !isZero))) sign = '+';
  }
  const wrap = (body: string) => (opts.accounting && negative ? `(${body})` : body);

  if (display === 'symbol') {
    const fmt = intlCurrencyFormat(code, digits);
    if (fmt) {
      // Intl places the sign before the symbol ("-USh 1,234"); keep it byte-identical.
      return wrap(`${sign}${fmt.format(scaled)}${suffix}`);
    }
    // Intl does not know the code — fall through to the plain prefix form.
  }

  const number = `${formatDigits(scaled, digits)}${suffix}`;
  if (display === 'none') return wrap(`${sign}${number}`);
  return wrap(`${code} ${sign}${number}`);
}

/**
 * Format an amount stored in MINOR units (`amountMinor`, as the commercial
 * collections store money). The minor-unit scale is the currency's own:
 * 100 for USD/EUR/GBP, 1 for the zero-decimal shillings and francs.
 */
export function formatMinor(
  amountMinor: number | null | undefined,
  currency: string | null | undefined = HOME_CURRENCY,
  opts: FormatMoneyOptions = {},
): string {
  const n = toFiniteNumber(amountMinor);
  if (n === null) return formatMoney(null, currency, opts);
  const scale = 10 ** currencyMinorUnits(currency);
  return formatMoney(n / scale, currency, opts);
}

/**
 * The currency most rows are in (missing codes count as the home currency) —
 * the label for a total or KPI computed over a list. Ties go to the code seen
 * first. Labelling only: it does not make a mixed-currency sum meaningful.
 */
export function dominantCurrency(codes: Iterable<string | null | undefined>): string {
  const counts = new Map<string, number>();
  for (const c of codes) {
    const code = normalizeCurrencyCode(c);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best = HOME_CURRENCY;
  let bestCount = 0;
  for (const [code, n] of counts) {
    if (n > bestCount) {
      best = code;
      bestCount = n;
    }
  }
  return best;
}
