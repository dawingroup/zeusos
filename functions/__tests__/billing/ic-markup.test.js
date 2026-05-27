/**
 * IC markup resolver tests — ADR-2026-05-25 §2.Q3.
 *   cd functions && node --test __tests__/billing/ic-markup.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const {
  DEFAULT_IC_MARKUP_PCT,
  resolveIcMarkupPct,
  applyMarkup,
} = require('../../src/billing/ic-markup');

test('resolveIcMarkupPct: falls back to DEFAULT when nothing seeded', async () => {
  const { db } = makeFirestore();
  const pct = await resolveIcMarkupPct(db, 'zeus-the-agency');
  assert.equal(pct, DEFAULT_IC_MARKUP_PCT);
});

test('resolveIcMarkupPct: reads engine_config.icMarkupPctDefault when present', async () => {
  const { db } = makeFirestore();
  db._seed('engine_config/global', { id: 'global', icMarkupPctDefault: 20 });
  const pct = await resolveIcMarkupPct(db, 'zeus-the-agency');
  assert.equal(pct, 20);
});

test('resolveIcMarkupPct: org-level override wins over engine_config', async () => {
  const { db } = makeFirestore();
  db._seed('engine_config/global', { id: 'global', icMarkupPctDefault: 20 });
  db._seed('organizations/labyrinth', { id: 'labyrinth', icMarkupPct: 25 });
  const pct = await resolveIcMarkupPct(db, 'labyrinth');
  assert.equal(pct, 25);
});

test('resolveIcMarkupPct: org with null icMarkupPct falls back to engine_config', async () => {
  const { db } = makeFirestore();
  db._seed('engine_config/global', { id: 'global', icMarkupPctDefault: 18 });
  db._seed('organizations/zeus-digital', { id: 'zeus-digital', icMarkupPct: null });
  const pct = await resolveIcMarkupPct(db, 'zeus-digital');
  assert.equal(pct, 18);
});

test('resolveIcMarkupPct: missing receivingOrgId returns DEFAULT', async () => {
  const { db } = makeFirestore();
  db._seed('engine_config/global', { id: 'global', icMarkupPctDefault: 20 });
  const pct = await resolveIcMarkupPct(db, '');
  assert.equal(pct, DEFAULT_IC_MARKUP_PCT);
});

test('applyMarkup: 100 cost × 15% → 115 (rounded)', () => {
  assert.equal(applyMarkup(100, 15), 115);
});

test('applyMarkup: 1000 cost × 15% → 1150', () => {
  assert.equal(applyMarkup(1000, 15), 1150);
});

test('applyMarkup: 0 cost → 0', () => {
  assert.equal(applyMarkup(0, 15), 0);
});

test('applyMarkup: 0 markup returns cost unchanged', () => {
  assert.equal(applyMarkup(500, 0), 500);
});

test('applyMarkup: negative markup returns cost unchanged (defensive)', () => {
  assert.equal(applyMarkup(500, -5), 500);
});

test('applyMarkup: rounds half-up', () => {
  // 333 * 1.15 = 382.95 → 383
  assert.equal(applyMarkup(333, 15), 383);
});
