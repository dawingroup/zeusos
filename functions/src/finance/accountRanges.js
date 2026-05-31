/**
 * Account-code → statement-line classifier — Phase 1.1.
 *
 * ZeusOS posts double-entry `gl_postings` against a fixed numeric chart of
 * accounts (see functions/src/finance/chartOfAccounts.js + the IC/payment
 * writers). Where DawinOS parsed pre-totalled QuickBooks report trees and
 * classified leaves by NAME regex, Zeus reconstructs P&L / Balance Sheet
 * from raw GL by bucketing each posting's `accountCode` into the
 * accumulator line the consolidation math (finalisePnL / finaliseBalanceSheet)
 * expects. Numeric ranges are deterministic — no regex guessing.
 *
 * Known codes in use today (extend as the COA grows; finance can override
 * the mapping via `finance_config/account_ranges` without a redeploy — the
 * loader merges overrides over these defaults):
 *   1000 Cash · 1200 AR · 2000 IC-AP · 2050 AP-Contractors · 2051 AP-Media
 *   3xxx Equity · 4000 Service Revenue · 5000 IC-Cost · 5010 Talent · 5020 Media
 *
 * Classification returns the STATEMENT and the accumulator LINE key only.
 * Debit/credit SIGN handling (assets/expenses are debit-normal, revenue/
 * liabilities/equity credit-normal) lives in nativeLedgerSource.js so this
 * module stays a pure lookup.
 */

const STATEMENT = { PNL: 'pnl', BS: 'bs' };

/**
 * Default range table. Each entry: [minInclusive, maxInclusive, statement, line].
 * Ordered most-specific first; the first matching range wins.
 */
const DEFAULT_RANGES = Object.freeze([
  // ── Assets (1xxx) — debit-normal ──────────────────────────────────────
  [1000, 1099, STATEMENT.BS, 'cash'],
  [1100, 1199, STATEMENT.BS, 'inventory'],
  [1200, 1299, STATEMENT.BS, 'ar'],
  [1300, 1899, STATEMENT.BS, 'prepaidOtherCA'],
  [1900, 1999, STATEMENT.BS, 'nonCurrentAssets'],
  // Fixed / non-current assets sometimes sit at 1500-1899 in other COAs;
  // the 1300-1899 bucket above absorbs them as "other CA" until finance
  // splits them out via an override.

  // ── Liabilities (2xxx) — credit-normal ────────────────────────────────
  [2000, 2099, STATEMENT.BS, 'ap'],
  [2100, 2199, STATEMENT.BS, 'taxPayable'],
  [2200, 2899, STATEMENT.BS, 'accruedOtherCL'],
  [2900, 2999, STATEMENT.BS, 'longTermLiabilities'],

  // ── Equity (3xxx) — credit-normal ─────────────────────────────────────
  [3000, 3099, STATEMENT.BS, 'shareCapital'],
  [3100, 3899, STATEMENT.BS, 'reserves'],
  [3900, 3999, STATEMENT.BS, 'retainedEarnings'],

  // ── Revenue (4xxx) — credit-normal ────────────────────────────────────
  [4000, 4899, STATEMENT.PNL, 'revenue'],
  [4900, 4999, STATEMENT.PNL, 'otherIncome'],

  // ── Cost of sales (5000-5099) — debit-normal ──────────────────────────
  // IC cost, talent/contractor fees, media spend = direct project cost.
  [5000, 5099, STATEMENT.PNL, 'costOfSales'],

  // ── Operating expenses (5100-6999) — debit-normal ─────────────────────
  [5100, 6999, STATEMENT.PNL, 'operatingExpenses'],

  // ── Other expense / tax (7xxx) — debit-normal ─────────────────────────
  [7000, 7899, STATEMENT.PNL, 'otherExpenses'],
  [7900, 7999, STATEMENT.PNL, 'taxExpense'],
]);

/** Lines that are credit-normal — a positive accumulator magnitude comes
 *  from (credit − debit) rather than (debit − credit). */
const CREDIT_NORMAL_LINES = new Set([
  'ap', 'taxPayable', 'accruedOtherCL', 'longTermLiabilities',
  'shareCapital', 'reserves', 'retainedEarnings',
  'revenue', 'otherIncome',
]);

/**
 * Classify an account code into { statement, line } using the supplied
 * range table (defaults when omitted). Returns null for unmapped codes so
 * the caller can log the gap rather than silently mis-bucket.
 *
 * @param {string|number} accountCode
 * @param {Array} [ranges] — override table (same shape as DEFAULT_RANGES)
 * @returns {{ statement: string, line: string, creditNormal: boolean } | null}
 */
function classifyAccount(accountCode, ranges = DEFAULT_RANGES) {
  const code = typeof accountCode === 'string' ? parseInt(accountCode, 10) : accountCode;
  if (!Number.isFinite(code)) return null;
  for (const [min, max, statement, line] of ranges) {
    if (code >= min && code <= max) {
      return { statement, line, creditNormal: CREDIT_NORMAL_LINES.has(line) };
    }
  }
  return null;
}

module.exports = {
  STATEMENT,
  DEFAULT_RANGES,
  CREDIT_NORMAL_LINES,
  classifyAccount,
};
