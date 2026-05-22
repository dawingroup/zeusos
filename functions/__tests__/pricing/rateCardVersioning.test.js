/**
 * Node-test twin of src/modules/pricing/services/__tests__/rateCardVersioning.test.ts.
 * Run with:
 *   cd functions && node --test __tests__/pricing/rateCardVersioning.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  nextVersion,
  autoRetireEffectiveTo,
  assertCanActivate,
  assertCanRetire,
  planActivation,
  RateCardError,
} = require('../../src/pricing/lib/rateCardVersioning');

test('nextVersion: 1 for empty, max+1 otherwise', () => {
  assert.equal(nextVersion([]), 1);
  assert.equal(nextVersion([{ version: 1 }, { version: 3 }, { version: 2 }]), 4);
});

test('autoRetireEffectiveTo: one day before, month-boundary safe', () => {
  assert.equal(
    autoRetireEffectiveTo(new Date(Date.UTC(2026, 5, 15))).toISOString().slice(0, 10),
    '2026-06-14',
  );
  assert.equal(
    autoRetireEffectiveTo(new Date(Date.UTC(2026, 6, 1))).toISOString().slice(0, 10),
    '2026-06-30',
  );
});

test('assertCanActivate rejects non-DRAFT', () => {
  assert.throws(() => assertCanActivate({ status: 'ACTIVE' }), /NOT_DRAFT/);
  assert.throws(() => assertCanActivate({ status: 'RETIRED' }), RateCardError);
});

test('assertCanRetire rejects non-ACTIVE', () => {
  assert.throws(() => assertCanRetire({ status: 'DRAFT' }), /NOT_ACTIVE/);
});

test('planActivation: v2 activates → v1 auto-retires at from − 1 day', () => {
  const from = new Date(Date.UTC(2026, 5, 15));
  const plan = planActivation({
    candidate: { id: 'rc_v2', status: 'DRAFT' },
    currentActive: { id: 'rc_v1', status: 'ACTIVE' },
    effectiveFrom: from,
  });
  assert.equal(plan.toActivate.id, 'rc_v2');
  assert.equal(plan.toActivate.nextStatus, 'ACTIVE');
  assert.equal(plan.toRetire.id, 'rc_v1');
  assert.equal(plan.toRetire.nextStatus, 'RETIRED');
  assert.equal(plan.toRetire.effectiveTo.toISOString().slice(0, 10), '2026-06-14');
});

test('planActivation: no prior active produces activate-only plan', () => {
  const plan = planActivation({
    candidate: { id: 'rc_v1', status: 'DRAFT' },
    effectiveFrom: new Date(Date.UTC(2026, 5, 15)),
  });
  assert.equal(plan.toActivate.id, 'rc_v1');
  assert.equal(plan.toRetire, undefined);
});
