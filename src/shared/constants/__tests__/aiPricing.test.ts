/**
 * AI pricing registry ↔ client mirror lockstep. Changing a rate in one and
 * not the other fails here — a drifted mirror would explain a number with the
 * wrong rate.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { MODEL_PRICING, MODEL_ALIASES, PRICING_VERSION, DEFAULT_UGX_PER_USD, normalizeModelId, rateForModel, formatRate } from '../aiPricing';
import { DEFAULT_USD_RATE } from '@/shared/utils/fxRates';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const server = require('../../../../functions/src/config/aiPricing');

describe('AI pricing registry ↔ client mirror', () => {
  it('both sides price exactly the same models, to the cent, at the same version', () => {
    expect(Object.keys(MODEL_PRICING).sort()).toEqual(Object.keys(server.MODEL_PRICING).sort());
    for (const [k, row] of Object.entries(MODEL_PRICING)) expect(row, k).toEqual(server.MODEL_PRICING[k]);
    expect(MODEL_ALIASES).toEqual(server.MODEL_ALIASES);
    expect(PRICING_VERSION).toBe(server.PRICING_VERSION);
    expect(DEFAULT_UGX_PER_USD).toBe(server.DEFAULT_UGX_PER_USD);
    expect(DEFAULT_UGX_PER_USD).toBe(DEFAULT_USD_RATE);
  });

  it('both normalise every spelling a model arrives in to the same key', () => {
    for (const s of ['claude-sonnet-4-20250514', 'Claude-Sonnet-4.6', 'claude-fable-5.1', 'models/gemini-2.0-flash', 'gemini-2.5-pro', 'mystery-9', '']) {
      expect(normalizeModelId(s), s).toBe(server.normalizeModelId(s));
    }
    expect(rateForModel('claude-sonnet-4-20250514')?.input).toBe(3);
    expect(rateForModel('nope')).toBeNull();
    expect(formatRate('claude-sonnet-4-6')).toBe('$3/$15 per million tokens');
    expect(formatRate('nope')).toBe('unpriced');
  });
});
