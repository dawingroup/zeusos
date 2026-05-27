/**
 * Event/Task engine — expression helpers (Phase 6.E).
 *   cd functions && node --test __tests__/event-task-engine/expression.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getByPath,
  evaluateCondition,
  evaluateAllConditions,
  interpolateTemplate,
} = require('../../src/event-task-engine/lib/expression');

// ----- getByPath -------------------------------------------------------

test('getByPath: walks dotted paths', () => {
  const o = { a: { b: { c: 42 } } };
  assert.equal(getByPath(o, 'a.b.c'), 42);
  assert.equal(getByPath(o, 'a.b'), o.a.b);
});

test('getByPath: missing → undefined', () => {
  assert.equal(getByPath({ a: 1 }, 'a.b.c'), undefined);
  assert.equal(getByPath(null, 'a'), undefined);
  assert.equal(getByPath(undefined, 'a'), undefined);
  assert.equal(getByPath({}, ''), undefined);
});

// ----- evaluateCondition ----------------------------------------------

test('evaluateCondition: exists / eq / neq', () => {
  const e = { payload: { tier: 'TIER_1', x: 0, y: null } };
  assert.equal(evaluateCondition(e, { op: 'exists', path: 'payload.tier' }), true);
  assert.equal(evaluateCondition(e, { op: 'exists', path: 'payload.missing' }), false);
  assert.equal(evaluateCondition(e, { op: 'exists', path: 'payload.y' }), false); // null !== exists
  assert.equal(evaluateCondition(e, { op: 'eq', path: 'payload.tier', value: 'TIER_1' }), true);
  assert.equal(evaluateCondition(e, { op: 'eq', path: 'payload.x', value: 0 }), true);
  assert.equal(evaluateCondition(e, { op: 'neq', path: 'payload.tier', value: 'TIER_2' }), true);
});

test('evaluateCondition: gt / gte / lt / lte (number-only)', () => {
  const e = { payload: { count: 5 } };
  assert.equal(evaluateCondition(e, { op: 'gt', path: 'payload.count', value: 4 }), true);
  assert.equal(evaluateCondition(e, { op: 'gt', path: 'payload.count', value: 5 }), false);
  assert.equal(evaluateCondition(e, { op: 'gte', path: 'payload.count', value: 5 }), true);
  assert.equal(evaluateCondition(e, { op: 'lt', path: 'payload.count', value: 6 }), true);
  assert.equal(evaluateCondition(e, { op: 'lte', path: 'payload.count', value: 5 }), true);
  // type-mismatched comparisons are false (no auto-coerce)
  assert.equal(evaluateCondition({ payload: { count: '5' } }, { op: 'gt', path: 'payload.count', value: 4 }), false);
});

test('evaluateCondition: contains (array + string)', () => {
  assert.equal(evaluateCondition({ payload: { ids: ['a', 'b'] } }, {
    op: 'contains', path: 'payload.ids', value: 'a',
  }), true);
  assert.equal(evaluateCondition({ payload: { ids: ['a', 'b'] } }, {
    op: 'contains', path: 'payload.ids', value: 'z',
  }), false);
  assert.equal(evaluateCondition({ payload: { msg: 'firewall breach' } }, {
    op: 'contains', path: 'payload.msg', value: 'breach',
  }), true);
});

test('evaluateCondition: unknown op → false (safe default)', () => {
  assert.equal(evaluateCondition({ a: 1 }, { op: 'mystery', path: 'a', value: 1 }), false);
  assert.equal(evaluateCondition({ a: 1 }, null), false);
});

// ----- evaluateAllConditions ------------------------------------------

test('evaluateAllConditions: empty / missing → true', () => {
  assert.equal(evaluateAllConditions({}, []), true);
  assert.equal(evaluateAllConditions({}, undefined), true);
  assert.equal(evaluateAllConditions({}, null), true);
});

test('evaluateAllConditions: ANDs across', () => {
  const e = { payload: { tier: 'TIER_1', count: 3 } };
  assert.equal(evaluateAllConditions(e, [
    { op: 'eq', path: 'payload.tier', value: 'TIER_1' },
    { op: 'gt', path: 'payload.count', value: 2 },
  ]), true);
  assert.equal(evaluateAllConditions(e, [
    { op: 'eq', path: 'payload.tier', value: 'TIER_1' },
    { op: 'gt', path: 'payload.count', value: 99 },         // fails
  ]), false);
});

// ----- interpolateTemplate --------------------------------------------

test('interpolateTemplate: substitutes {{path}}', () => {
  const ctx = { aggregateId: 'iwo-42', payload: { tier: 'TIER_1', user: { id: 'u1' } } };
  assert.equal(
    interpolateTemplate('Review IWO {{aggregateId}} at {{payload.tier}}', ctx),
    'Review IWO iwo-42 at TIER_1',
  );
  assert.equal(
    interpolateTemplate('User: {{payload.user.id}}', ctx),
    'User: u1',
  );
});

test('interpolateTemplate: missing path → empty string', () => {
  assert.equal(
    interpolateTemplate('hello {{payload.missing}}', { payload: {} }),
    'hello ',
  );
});

test('interpolateTemplate: tolerates whitespace inside {{ }}', () => {
  assert.equal(
    interpolateTemplate('hi {{  aggregateId  }}', { aggregateId: 'X' }),
    'hi X',
  );
});

test('interpolateTemplate: non-string template → empty string', () => {
  assert.equal(interpolateTemplate(null, {}), '');
  assert.equal(interpolateTemplate(undefined, {}), '');
});
