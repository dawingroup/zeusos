/**
 * withIdempotency() — Stripe-style cache + cross-endpoint conflict.
 *   cd functions && node --test __tests__/assignment/idempotency.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { withIdempotency, IdempotencyConflictError } = require('../../src/platform/idempotency');
const { makeFirestore } = require('./_firestore-stub');

test('no key → body runs, no cache row written', async () => {
  const { db } = makeFirestore();
  let runs = 0;
  const r = await withIdempotency(db, { endpoint: 'noop' }, async (_tx, record) => {
    runs += 1;
    record({ ok: true, n: runs });
    return { ok: true, n: runs };
  });
  assert.equal(runs, 1);
  assert.deepEqual(r, { ok: true, n: 1 });
  assert.equal(db._dump_prefix('idempotency_keys').length, 0);
});

test('with key → first run writes cache, second hit returns cached', async () => {
  const { db } = makeFirestore();
  let runs = 0;
  const key = 'abcd1234';
  const run = () => withIdempotency(db, { key, endpoint: 'issueWorkOrder' }, async (_tx, record) => {
    runs += 1;
    const resp = { ok: true, n: runs };
    record(resp);
    return resp;
  });

  const r1 = await run();
  const r2 = await run();
  assert.deepEqual(r1, { ok: true, n: 1 });
  assert.deepEqual(r2, { ok: true, n: 1 }, 'second call returns cached response');
  assert.equal(runs, 1, 'body ran exactly once');
  assert.equal(db._dump_prefix('idempotency_keys').length, 1);
});

test('same key, different endpoint → IDEMPOTENCY_CONFLICT', async () => {
  const { db } = makeFirestore();
  await withIdempotency(db, { key: 'shared_key_12345', endpoint: 'issueWorkOrder' }, async (_t, record) => {
    record({ ok: 'a' });
    return { ok: 'a' };
  });
  await assert.rejects(
    withIdempotency(db, { key: 'shared_key_12345', endpoint: 'closeWorkOrder' }, async (_t, record) => {
      record({ ok: 'b' });
      return { ok: 'b' };
    }),
    (err) => err instanceof IdempotencyConflictError,
  );
});
