/**
 * AI pricing — CLIENT MIRROR of `functions/src/config/aiPricing.js`.
 *
 * The dashboard needs these rates to explain a cost figure ("Sonnet 4.6 at
 * $3/$15 per million"). The server remains the authority: every ledger row is
 * costed when it is written and carries the `pricingVersion` it was costed at.
 * `__tests__/aiPricing.test.ts` pins this file against the server registry.
 *
 * PURE DATA: no Firebase, nothing from `functions/`.
 */

export const PRICING_VERSION = '2026-10-29';

/** The same figure as fxRates.DEFAULT_USD_TO_UGX; `ai_policy/global.ugxPerUsd` overrides at read time. */
export const DEFAULT_UGX_PER_USD = 3700;

export type AiProvider = 'anthropic' | 'google' | 'unknown';

export interface ModelRate {
  provider: AiProvider;
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens. Gemini bills thinking tokens at this rate. */
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  /** USD per 1,000 server-side searches. */
  searchPer1k: number;
}

export const MODEL_PRICING: Record<string, ModelRate> = {
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
  'gemini-2.0-flash': { provider: 'google', input: 0.1, output: 0.4, cacheRead: 0.025, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 35 },
  'gemini-2.5-flash': { provider: 'google', input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 35 },
  'gemini-2.5-pro': { provider: 'google', input: 1.25, output: 10, cacheRead: 0.125, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 35 },
  'gemini-3.5-flash': { provider: 'google', input: 1.5, output: 9, cacheRead: 0.15, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 14 },
  'gemini-embedding-001': { provider: 'google', input: 0.15, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0, searchPer1k: 0 },
};

export const MODEL_ALIASES: Record<string, string> = {
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

/** Resolve any spelling of a model — dotted alias, dated snapshot — to its rate key. */
export function normalizeModelId(model: string | undefined | null): string {
  if (!model || typeof model !== 'string') return '';
  const raw = model.trim().toLowerCase();
  if (MODEL_PRICING[raw]) return raw;
  if (MODEL_ALIASES[raw]) return MODEL_ALIASES[raw];
  const undated = raw.replace(/-\d{8}$/, '');
  if (MODEL_PRICING[undated]) return undated;
  if (MODEL_ALIASES[undated]) return MODEL_ALIASES[undated];
  return raw;
}

/** The published rate for a model, or null when it is not in the registry. */
export function rateForModel(model: string | undefined | null): ModelRate | null {
  return MODEL_PRICING[normalizeModelId(model)] ?? null;
}

/** Human-readable rate, for a tooltip on a cost figure. */
export function formatRate(model: string | undefined | null): string {
  const rate = rateForModel(model);
  if (!rate) return 'unpriced';
  return `$${rate.input}/$${rate.output} per million tokens`;
}
