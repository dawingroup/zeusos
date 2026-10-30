/**
 * The pricing registry: every spelling of a model prices to one row; every
 * billed line is summed; an unknown model is flagged, never costed at zero
 * silently; UGX follows the policy's rate within bounds.
 *
 *    cd functions && node --test __tests__/ai-usage/pricing.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { priceUsage, normalizeModelId, providerForModel, toUgx, MODEL_PRICING, PRICING_VERSION, DEFAULT_UGX_PER_USD } = require('../../src/config/aiPricing');

test('every spelling a model arrives in prices to the same key', () => {
  for (const [spelling, key] of [
    ['claude-sonnet-4-6', 'claude-sonnet-4-6'], ['Claude-Sonnet-4.6', 'claude-sonnet-4-6'],
    ['claude-sonnet-4-20250514', 'claude-sonnet-4'], ['claude-haiku-4-5-20251001', 'claude-haiku-4-5'],
    ['claude-fable-5.1', 'claude-fable-5-1'], ['models/gemini-2.0-flash', 'gemini-2.0-flash'], ['gemini-2.0-flash', 'gemini-2.0-flash'],
  ]) assert.equal(normalizeModelId(spelling), key, spelling);
  assert.equal(normalizeModelId('something-new'), 'something-new');
  assert.equal(normalizeModelId(null), '');
  assert.equal(providerForModel('claude-nope'), 'anthropic');
  assert.equal(providerForModel('models/gemini-9'), 'google');
  assert.equal(providerForModel('llama'), 'unknown');
});

test('sums every billed line; Gemini thinking is billed as output, Anthropic thinking already is', () => {
  const r = priceUsage('claude-sonnet-4-6', { input: 1_000_000, output: 100_000, cacheRead: 2_000_000, cacheWrite: 500_000, searches: 100 });
  assert.equal(r.priced, true);
  assert.equal(r.provider, 'anthropic');
  assert.equal(r.pricingVersion, PRICING_VERSION);
  // 3 + 1.5 + 0.6 + 1.875 + 1 = 7.975
  assert.ok(Math.abs(r.costUsd - 7.975) < 1e-9, String(r.costUsd));
  const g = priceUsage('gemini-2.5-flash', { input: 1_000_000, output: 100_000, thoughts: 100_000 });
  assert.ok(Math.abs(g.costUsd - (0.3 + 0.25 + 0.25)) < 1e-9, String(g.costUsd));
  const a = priceUsage('claude-haiku-4-5', { output: 100_000, thoughts: 100_000 });
  assert.ok(Math.abs(a.costUsd - 0.5) < 1e-9, 'thoughts ignored for anthropic');
  assert.equal(priceUsage('claude-sonnet-4-6', { input: -5, output: 'x' }).costUsd, 0);
});

test('an unknown model is flagged, not silently costed at zero', () => {
  const r = priceUsage('claude-unknown-9', { input: 1_000_000 });
  assert.equal(r.priced, false);
  assert.equal(r.costUsd, 0);
  assert.equal(r.model, 'claude-unknown-9');
  assert.equal(r.provider, 'anthropic');
});

test('UGX follows the configured rate within bounds, else the default', () => {
  assert.equal(toUgx(1), DEFAULT_UGX_PER_USD);
  assert.equal(toUgx(2, 4000), 8000);
  assert.equal(toUgx(1, 100), DEFAULT_UGX_PER_USD, 'out of bounds → default');
  assert.equal(toUgx(1, 'nope'), DEFAULT_UGX_PER_USD);
  assert.equal(toUgx(0.33333, 3000), 1000);
  for (const [k, row] of Object.entries(MODEL_PRICING)) {
    assert.ok(['anthropic', 'google'].includes(row.provider), k);
    assert.ok(row.input >= 0 && row.output >= 0, k);
  }
});
