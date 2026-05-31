/**
 * FX resolution for finance consolidation — Phase 1.1.
 *
 * Single source of truth for converting between the group's trading
 * currencies (UGX / KES / USD / EUR / GBP / …). Reads the daily
 * `fx_rates/{YYYY-MM-DD}` snapshot when present, falling back to seeded
 * cross-rates via UGX so a missing snapshot never silently zeroes a
 * conversion.
 *
 * Extracted from `functions/src/billing/generateClientInvoice.js` so the
 * group roll-up (groupRollup.js), AR/AP aging (aging.js) and the native
 * ledger source all share ONE rate table and one resolution path. The
 * frontend mirror lives at `src/modules/billing/services/fx-rate.service.ts`
 * (`getEffectiveRate`).
 *
 * Failure mode: a missing rate throws a plain `Error` tagged
 * `code = 'FX_UNAVAILABLE'`. Callable handlers wrap it as an
 * HttpsError('failed-precondition'); scheduled handlers (rollup) catch and
 * record the gap rather than crashing the whole consolidation.
 */

// Seed FX cross-rates (vs UGX). Mirrors EXCHANGE_RATES_TO_UGX in
// src/modules/finance/constants/currency.constants.ts. Used when the
// fx_rates/{date} snapshot is missing.
const SEED_FX_TO_UGX = {
  UGX: 1,
  USD: 3700,
  EUR: 4000,
  GBP: 4600,
  AED: 1000,
  KES: 29,
  ZAR: 205,
};

/**
 * Resolve the rate to convert `fromCurrency` → `toCurrency` for a given
 * consolidation date. Tries `fx_rates/{date}` first, then seeded cross-rates
 * via UGX. Same-currency short-circuits to 1.0.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {string} date — 'YYYY-MM-DD'
 * @returns {Promise<{ rate: number, source: string }>}
 * @throws {Error} code 'FX_UNAVAILABLE' when neither snapshot nor seed covers the pair.
 */
async function resolveFxRate(db, fromCurrency, toCurrency, date) {
  if (fromCurrency === toCurrency) return { rate: 1, source: 'manual' };

  const snap = await db.doc(`fx_rates/${date}`).get();
  if (snap.exists) {
    const data = snap.data() || {};
    const base = data.base;
    const rates = data.rates || {};
    const fromVsBase = fromCurrency === base ? 1 : rates[fromCurrency];
    const toVsBase = toCurrency === base ? 1 : rates[toCurrency];
    if (fromVsBase != null && toVsBase != null && fromVsBase !== 0) {
      return { rate: toVsBase / fromVsBase, source: data.source || 'manual' };
    }
  }

  // Fallback — cross via UGX.
  const fromUgx = SEED_FX_TO_UGX[fromCurrency];
  const toUgx = SEED_FX_TO_UGX[toCurrency];
  if (fromUgx == null || toUgx == null || toUgx === 0) {
    const err = new Error(
      `FX rate unavailable: ${fromCurrency} → ${toCurrency} on ${date}. ` +
        'Seed cross-rates do not cover one of these currencies. ' +
        'Post the rate to fx_rates/{YYYY-MM-DD} or extend SEED_FX_TO_UGX.',
    );
    err.code = 'FX_UNAVAILABLE';
    throw err;
  }
  return { rate: fromUgx / toUgx, source: 'manual' };
}

/** Convert a minor-unit amount by a resolved rate (round to nearest minor unit). */
function convertMinor(amountMinor, rate) {
  return Math.round((amountMinor || 0) * rate);
}

/**
 * Convenience: resolve a rate then convert in one call.
 * @returns {Promise<{ amountMinor: number, rate: number, source: string }>}
 */
async function convertAmount(db, amountMinor, fromCurrency, toCurrency, date) {
  const { rate, source } = await resolveFxRate(db, fromCurrency, toCurrency, date);
  return { amountMinor: convertMinor(amountMinor, rate), rate, source };
}

module.exports = {
  SEED_FX_TO_UGX,
  resolveFxRate,
  convertMinor,
  convertAmount,
};
