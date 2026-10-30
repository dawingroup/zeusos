/**
 * AI pricing registry — the single source of truth for what a model call costs
 * (DawinOS stream D port, 2026-10-29).
 *
 * Every price is per MILLION tokens in USD, from the providers' published
 * rates. Mirrored for the client in `src/shared/constants/aiPricing.ts`; the
 * two are pinned together by `src/shared/constants/__tests__/aiPricing.test.ts`.
 * Changing a rate in one and not the other fails the suite — that is the point.
 *
 * PURE (no npm imports): loadable by the client lockstep test and by node
 * tests without firebase-functions. Bump PRICING_VERSION whenever a rate
 * changes; every ledger row records the version it was priced at, so a
 * historical total stays explainable after a provider changes its prices.
 */

'use strict';

const PRICING_VERSION = '2026-10-29';

/**
 * The ONE USD→UGX fallback, the same figure as src/shared/utils/fxRates.ts
 * (DEFAULT_USD_TO_UGX). `ai_policy/global.ugxPerUsd` overrides it at read
 * time; a value outside the bounds is ignored like a missing one.
 */
const DEFAULT_UGX_PER_USD = 3700;
const UGX_PER_USD_BOUNDS = Object.freeze({ min: 2500, max: 8000 });

function isUgxRateInBounds(rate) {
  const n = Number(rate);
  return Number.isFinite(n) && n >= UGX_PER_USD_BOUNDS.min && n <= UGX_PER_USD_BOUNDS.max;
}

/**
 * Per-model rates, USD per million tokens. `cacheRead` / `cacheWrite5m` /
 * `cacheWrite1h` are Anthropic's prompt-caching rates; `searchPer1k` is the
 * server-side search charge per 1,000 searches.
 */
const MODEL_PRICING = {
  // ── Anthropic ────────────────────────────────────────────────────────────
  'claude-haiku-4-5': { provider: 'anthropic', input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2, searchPer1k: 10 },
  'claude-sonnet-4': { provider: 'anthropic', input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6, searchPer1k: 10 },
  'claude-sonnet-4-6': { provider: 'anthropic', input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6, searchPer1k: 10 },
  'claude-sonnet-5': { provider: 'anthropic', input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4, searchPer1k: 10 },
  'claude-sonnet-5-5': { provider: 'anthropic', input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4, searchPer1k: 10 },
  'claude-opus-4-6': { provider: 'anthropic', input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, searchPer1k: 10 },
  'claude-opus-4-7': { provider: 'anthropic', input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, searchPer1k: 10 },
  'claude-opus-4-8': { provider: 'anthropic', input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, searchPer1k: 10 },
  'claude-opus-5': { provider: 'anthropic', input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, searchPer1k: 10 },
  'claude-opus-5-5': { provider: 'anthropic', input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10, searchPer1k: 10 },
  'claude-fable-5-1': { provider: 'anthropic', input: 10, output: 50, cacheRead: 0.25, cacheWrite5m: 12.5, cacheWrite1h: 20, searchPer1k: 10 },

  // ── Google ───────────────────────────────────────────────────────────────
  // Gemini bills thinking tokens at the OUTPUT rate and reports them in a
  // separate `thoughtsTokenCount` — priceUsage adds them to output for this
  // provider. Anthropic already folds thinking into `output_tokens`.
  'gemini-2.0-flash': { provider: 'google', input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 35 },
  'gemini-2.5-flash': { provider: 'google', input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 35 },
  'gemini-2.5-pro': { provider: 'google', input: 1.25, output: 10, cacheRead: 0.125, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 35 },
  'gemini-3.5-flash': { provider: 'google', input: 1.5, output: 9, cacheRead: 0.15, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 14 },
  'gemini-embedding-001': { provider: 'google', input: 0.15, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 0 },
};

/** Product-level aliases → canonical ids (the agent registry stores dotted aliases). */
const MODEL_ALIASES = {
  'claude-haiku-4.5': 'claude-haiku-4-5',
  'claude-sonnet-4.6': 'claude-sonnet-4-6',
  'claude-sonnet-5.5': 'claude-sonnet-5-5',
  'claude-opus-4.6': 'claude-opus-4-6',
  'claude-opus-4.7': 'claude-opus-4-7',
  'claude-opus-4.8': 'claude-opus-4-8',
  'claude-opus-5.5': 'claude-opus-5-5',
  'claude-fable-5.1': 'claude-fable-5-1',
  'models/gemini-2.0-flash': 'gemini-2.0-flash',
  'models/gemini-2.5-flash': 'gemini-2.5-flash',
  'models/gemini-2.5-pro': 'gemini-2.5-pro',
};

/**
 * Resolve any spelling of a model to its pricing key. Returns the input
 * lowercased when nothing matches — the caller then records the row as
 * unpriced rather than silently costing it at zero.
 */
function normalizeModelId(model) {
  if (!model || typeof model !== 'string') return '';
  const raw = model.trim().toLowerCase();
  if (MODEL_PRICING[raw]) return raw;
  if (MODEL_ALIASES[raw]) return MODEL_ALIASES[raw];
  // Dated pinned snapshots: claude-sonnet-4-20250514 → claude-sonnet-4
  const undated = raw.replace(/-\d{8}$/, '');
  if (MODEL_PRICING[undated]) return undated;
  if (MODEL_ALIASES[undated]) return MODEL_ALIASES[undated];
  return raw;
}

/** The provider that serves a model, inferred from the id when unpriced. */
function providerForModel(model) {
  const row = MODEL_PRICING[normalizeModelId(model)];
  if (row) return row.provider;
  const raw = String(model || '').toLowerCase();
  if (raw.startsWith('claude')) return 'anthropic';
  if (raw.startsWith('gemini') || raw.startsWith('models/gemini')) return 'google';
  return 'unknown';
}

const PER_MILLION = 1_000_000;
const PER_THOUSAND = 1_000;

/**
 * Cost one call.
 *
 * `priced: false` means the model is not in the registry. The cost is 0 but
 * the row is FLAGGED, so a new model shows up in the dashboard as unpriced
 * traffic instead of quietly reporting no spend.
 */
function priceUsage(model, usage = {}) {
  const key = normalizeModelId(model);
  const row = MODEL_PRICING[key];
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

  const counts = {
    input: n(usage.input),
    output: n(usage.output),
    cacheRead: n(usage.cacheRead),
    cacheWrite: n(usage.cacheWrite),
    cacheWrite1h: n(usage.cacheWrite1h),
    thoughts: n(usage.thoughts),
    searches: n(usage.searches),
  };

  if (!row) {
    return { costUsd: 0, priced: false, pricingVersion: PRICING_VERSION, model: key, provider: providerForModel(model), breakdown: {} };
  }

  const outputTokens = counts.output + (row.provider === 'google' ? counts.thoughts : 0);
  const breakdown = {
    input: (counts.input / PER_MILLION) * row.input,
    output: (outputTokens / PER_MILLION) * row.output,
    cacheRead: (counts.cacheRead / PER_MILLION) * row.cacheRead,
    cacheWrite: (counts.cacheWrite / PER_MILLION) * row.cacheWrite5m,
    cacheWrite1h: (counts.cacheWrite1h / PER_MILLION) * row.cacheWrite1h,
    searches: (counts.searches / PER_THOUSAND) * row.searchPer1k,
  };
  const costUsd = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { costUsd, priced: true, pricingVersion: PRICING_VERSION, model: key, provider: row.provider, breakdown };
}

/** USD → UGX, rounded to whole shillings. An override outside the bounds is ignored. */
function toUgx(costUsd, ugxPerUsd = DEFAULT_UGX_PER_USD) {
  const rate = isUgxRateInBounds(ugxPerUsd) ? Number(ugxPerUsd) : DEFAULT_UGX_PER_USD;
  return Math.round(Number(costUsd || 0) * rate);
}

module.exports = {
  PRICING_VERSION,
  DEFAULT_UGX_PER_USD,
  UGX_PER_USD_BOUNDS,
  MODEL_PRICING,
  MODEL_ALIASES,
  isUgxRateInBounds,
  normalizeModelId,
  providerForModel,
  priceUsage,
  toUgx,
};
