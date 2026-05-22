/**
 * burnCheck — spec §11.2 (hard block at 100%, soft event at 80%).
 *   cd functions && node --test __tests__/assignment/burn-check.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { burnCheck } = require('../../src/assignment/lib/burn-check');

test('under budget — no thresholds crossed', () => {
  const r = burnCheck({
    previousCumulativeMinor: 0,
    entryAmountMinor: 100_00,
    budgetMinor: 1_000_00,
  });
  assert.ok(r.ok);
  assert.equal(r.newCumulative, 100_00);
  assert.equal(r.crossed80, false);
  assert.equal(r.crossed100, false);
});

test('crossing 80% threshold for the first time emits event', () => {
  const r = burnCheck({
    previousCumulativeMinor: 70_00,        // 70%
    entryAmountMinor: 15_00,               // → 85%
    budgetMinor: 100_00,
    thresholdAlreadyCrossed80: false,
  });
  assert.ok(r.ok);
  assert.equal(r.crossed80, true);
  assert.equal(r.crossed100, false);
});

test('80% suppressed if previously crossed', () => {
  const r = burnCheck({
    previousCumulativeMinor: 85_00,
    entryAmountMinor: 5_00,
    budgetMinor: 100_00,
    thresholdAlreadyCrossed80: true,
  });
  assert.equal(r.crossed80, false);
});

test('exactly 100% — crossed100 flag set, ok still true', () => {
  const r = burnCheck({
    previousCumulativeMinor: 70_00,
    entryAmountMinor: 30_00,
    budgetMinor: 100_00,
  });
  assert.ok(r.ok);
  assert.equal(r.crossed100, true);
});

test('over 100% — hard block, BUDGET_EXCEEDED', () => {
  const r = burnCheck({
    previousCumulativeMinor: 95_00,
    entryAmountMinor: 10_00,           // → 105
    budgetMinor: 100_00,
  });
  assert.ok(!r.ok);
  assert.equal(r.error.code, 'BUDGET_EXCEEDED');
  assert.equal(r.error.details.cumulativeMinor, 105_00);
  assert.equal(r.error.details.budgetMinor, 100_00);
});
