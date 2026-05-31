/**
 * fx.js — shared FX resolver (Phase 1.1).
 *
 * Run: cd functions && node --test __tests__/finance/fx.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const stub = require('../assignment/_firestore-stub');
const { resolveFxRate, convertMinor, convertAmount, SEED_FX_TO_UGX } = require('../../src/finance/lib/fx');

function freshDb() {
  return stub.makeFirestore().db;
}

test('same-currency short-circuits to 1.0 without a Firestore read', async () => {
  const { rate, source } = await resolveFxRate(null, 'UGX', 'UGX', '2026-05-31');
  assert.equal(rate, 1);
  assert.equal(source, 'manual');
});

test('uses fx_rates/{date} snapshot when present (cross via base)', async () => {
  const db = freshDb();
  // base UGX; USD vs base = 3700, KES vs base = 29.
  db._seed('fx_rates/2026-05-31', { base: 'UGX', rates: { USD: 3700, KES: 29 }, source: 'central-bank' });
  const { rate, source } = await resolveFxRate(db, 'USD', 'KES', '2026-05-31');
  // toVsBase / fromVsBase = 29 / 3700
  assert.ok(Math.abs(rate - 29 / 3700) < 1e-9);
  assert.equal(source, 'central-bank');
});

test('falls back to seeded cross-rates when snapshot missing', async () => {
  const db = freshDb();
  const { rate, source } = await resolveFxRate(db, 'USD', 'UGX', '2026-05-31');
  // fromUgx / toUgx = 3700 / 1
  assert.equal(rate, SEED_FX_TO_UGX.USD / SEED_FX_TO_UGX.UGX);
  assert.equal(source, 'manual');
});

test('throws FX_UNAVAILABLE when neither snapshot nor seed covers the pair', async () => {
  const db = freshDb();
  await assert.rejects(
    () => resolveFxRate(db, 'ZZZ', 'UGX', '2026-05-31'),
    (err) => err && err.code === 'FX_UNAVAILABLE',
  );
});

test('convertMinor rounds to nearest minor unit', () => {
  assert.equal(convertMinor(101, 1.5), 152); // 151.5 → 152 (half-up)
  assert.equal(convertMinor(100, 2.5), 250);
  assert.equal(convertMinor(0, 3700), 0);
  assert.equal(convertMinor(undefined, 2), 0);
});

test('convertAmount resolves + converts in one call', async () => {
  const db = freshDb();
  const { amountMinor, rate } = await convertAmount(db, 1000, 'USD', 'UGX', '2026-05-31');
  assert.equal(rate, 3700);
  assert.equal(amountMinor, 3_700_000);
});
