/**
 * Tests for the archive-sweep eligibility predicate.
 * Run with:
 *    cd functions && node --test __tests__/archiveSweep.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldSweepArchive } = require('../src/scheduled/archiveSweep');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 3, 20, 12, 0, 0);

function doc(overrides = {}) {
  return {
    status: 'completed',
    archived: false,
    updatedAt: {
      toMillis: () => overrides.updatedAtMs ?? NOW - 10 * DAY, // default: 10 days ago
    },
    ...overrides,
  };
}

test('rejects when no doc', () => {
  const d = shouldSweepArchive(null, NOW);
  assert.equal(d.eligible, false);
  assert.equal(d.reason, 'no doc');
});

test('rejects when status is not completed', () => {
  const d = shouldSweepArchive(doc({ status: 'active' }), NOW);
  assert.equal(d.eligible, false);
  assert.equal(d.reason, 'status not completed');
});

test('rejects when already archived', () => {
  const d = shouldSweepArchive(doc({ archived: true }), NOW);
  assert.equal(d.eligible, false);
  assert.equal(d.reason, 'already archived');
});

test('rejects inside the 7-day quiet period', () => {
  const d = shouldSweepArchive(doc({ updatedAtMs: NOW - 2 * DAY }), NOW);
  assert.equal(d.eligible, false);
  assert.equal(d.reason, 'inside quiet period');
});

test('accepts once the quiet period has passed', () => {
  const d = shouldSweepArchive(doc({ updatedAtMs: NOW - 10 * DAY }), NOW);
  assert.equal(d.eligible, true);
  assert.equal(d.reason, 'ok');
});

test('accepts when updatedAt is absent (pre-Phase-4 projects)', () => {
  const d = shouldSweepArchive(doc({ updatedAt: undefined }), NOW);
  assert.equal(d.eligible, true);
});

test('custom quiet period is respected', () => {
  // 10-day-old project, 14-day quiet period → not yet eligible.
  const d1 = shouldSweepArchive(doc({ updatedAtMs: NOW - 10 * DAY }), NOW, 14);
  assert.equal(d1.eligible, false);
  // 20-day-old project, 14-day quiet period → eligible.
  const d2 = shouldSweepArchive(doc({ updatedAtMs: NOW - 20 * DAY }), NOW, 14);
  assert.equal(d2.eligible, true);
});

test('numeric updatedAt is accepted (defensive)', () => {
  const d = shouldSweepArchive(
    { status: 'completed', archived: false, updatedAt: NOW - 10 * DAY },
    NOW,
  );
  assert.equal(d.eligible, true);
});
