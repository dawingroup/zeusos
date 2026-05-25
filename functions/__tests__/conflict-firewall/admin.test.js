/**
 * Conflict-firewall admin callables — Phase 6.UI.C unit tests.
 *   cd functions && node --test __tests__/conflict-firewall/admin.test.js
 *
 * Covers all five callables:
 *   - addCategory:           create + idempotent update
 *   - addClientCategory:     happy path + unknown category → not-found
 *   - removeClientCategory:  removes the row
 *   - addConflictWall:       create + idempotent on (brand, category, client)
 *   - removeConflictWall:    removes by id
 *
 * Tests inject the in-memory Firestore stub from `_firestore-stub.js`
 * + a fake `assertAuth` that always returns the seed uid. Real auth is
 * exercised in the firestore.rules integration suite (separate).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const {
  runAddCategory,
  runAddClientCategory,
  runRemoveClientCategory,
  runAddConflictWall,
  runRemoveConflictWall,
} = require('../../src/conflict-firewall/admin');

function stubAuth(uid = 'user-am-1') {
  return async (_auth) => ({ uid });
}
const SEED_AUTH = { uid: 'user-am-1' };

// ────────────────────────────────────────────────────────────────
// addCategory
// ────────────────────────────────────────────────────────────────

test('addCategory: creates a new category doc with audit fields', async () => {
  const { db, FieldValue } = makeFirestore();
  const r = await runAddCategory({
    db, auth: SEED_AUTH,
    data: { id: 'CARBONATED_BEVERAGE', name: 'Carbonated Beverage' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r.id, 'CARBONATED_BEVERAGE');
  assert.equal(r.created, true);
  const doc = db._dump()['categories/CARBONATED_BEVERAGE'];
  assert.equal(doc.name, 'Carbonated Beverage');
  assert.equal(doc.isActive, true);
  assert.equal(doc.createdBy, 'user-am-1');
});

test('addCategory: re-issuing updates name + stamps updatedAt, returns created:false', async () => {
  const { db, FieldValue } = makeFirestore();
  await runAddCategory({
    db, auth: SEED_AUTH,
    data: { id: 'CARBONATED_BEVERAGE', name: 'Carbonated Beverage' },
    fieldValue: FieldValue,
    assertAuth: stubAuth('user-am-1'),
  });
  const r = await runAddCategory({
    db, auth: SEED_AUTH,
    data: { id: 'CARBONATED_BEVERAGE', name: 'Soft Drinks' },
    fieldValue: FieldValue,
    assertAuth: stubAuth('user-am-2'),
  });
  assert.equal(r.created, false);
  const doc = db._dump()['categories/CARBONATED_BEVERAGE'];
  assert.equal(doc.name, 'Soft Drinks');
  assert.equal(doc.updatedBy, 'user-am-2');
  assert.equal(doc.createdBy, 'user-am-1', 'createdBy preserved across re-issue');
});

test('addCategory: rejects non-UPPER_SNAKE_CASE ids', async () => {
  const { db, FieldValue } = makeFirestore();
  await assert.rejects(
    runAddCategory({
      db, auth: SEED_AUTH,
      data: { id: 'carbonated-beverage', name: 'Carbonated Beverage' },
      fieldValue: FieldValue,
      assertAuth: stubAuth(),
    }),
    /UPPER_SNAKE_CASE/,
  );
});

// ────────────────────────────────────────────────────────────────
// addClientCategory
// ────────────────────────────────────────────────────────────────

test('addClientCategory: tags a client; defaults exclusive=true', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('categories/CARBONATED_BEVERAGE', { id: 'CARBONATED_BEVERAGE', name: 'Carbonated Beverage', isActive: true });
  const r = await runAddClientCategory({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-coke', categoryId: 'CARBONATED_BEVERAGE' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r.id, 'client-coke__CARBONATED_BEVERAGE');
  assert.equal(r.exclusive, true);
  assert.equal(r.created, true);
  const row = db._dump()['client_categories/client-coke__CARBONATED_BEVERAGE'];
  assert.equal(row.clientId, 'client-coke');
});

test('addClientCategory: idempotent — second call updates exclusive flag, returns created:false', async () => {
  const { db, FieldValue } = makeFirestore();
  db._seed('categories/CARBONATED_BEVERAGE', { id: 'CARBONATED_BEVERAGE', name: 'CB', isActive: true });
  await runAddClientCategory({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-coke', categoryId: 'CARBONATED_BEVERAGE', exclusive: true },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  const r = await runAddClientCategory({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-coke', categoryId: 'CARBONATED_BEVERAGE', exclusive: false },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r.created, false);
  const row = db._dump()['client_categories/client-coke__CARBONATED_BEVERAGE'];
  assert.equal(row.exclusive, false);
});

test('addClientCategory: rejects unknown categoryId', async () => {
  const { db, FieldValue } = makeFirestore();
  await assert.rejects(
    runAddClientCategory({
      db, auth: SEED_AUTH,
      data: { clientId: 'client-coke', categoryId: 'MYSTERY' },
      fieldValue: FieldValue,
      assertAuth: stubAuth(),
    }),
    /Unknown categoryId/,
  );
});

// ────────────────────────────────────────────────────────────────
// removeClientCategory
// ────────────────────────────────────────────────────────────────

test('removeClientCategory: deletes the edge row', async () => {
  const { db } = makeFirestore();
  db._seed('client_categories/client-coke__CARBONATED_BEVERAGE', {
    id: 'client-coke__CARBONATED_BEVERAGE',
    clientId: 'client-coke',
    categoryId: 'CARBONATED_BEVERAGE',
  });
  const r = await runRemoveClientCategory({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-coke', categoryId: 'CARBONATED_BEVERAGE' },
    assertAuth: stubAuth(),
  });
  assert.equal(r.removed, true);
  assert.equal(db._dump()['client_categories/client-coke__CARBONATED_BEVERAGE'], undefined);
});

// ────────────────────────────────────────────────────────────────
// addConflictWall
// ────────────────────────────────────────────────────────────────

test('addConflictWall: creates a new wall with default reason MANUAL_OVERRIDE', async () => {
  const { db, FieldValue } = makeFirestore();
  const r = await runAddConflictWall({
    db, auth: SEED_AUTH,
    data: {
      clientId: 'client-coke',
      servingOrgId: 'zeus-the-agency',
      categoryId: 'CARBONATED_BEVERAGE',
    },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r.created, true);
  const wall = db._dump_prefix('conflict_walls')[0].data;
  assert.equal(wall.reason, 'MANUAL_OVERRIDE');
  assert.equal(wall.servingOrgId, 'zeus-the-agency');
  assert.equal(wall.categoryId, 'CARBONATED_BEVERAGE');
  assert.equal(wall.clientId, 'client-coke');
});

test('addConflictWall: idempotent — second call returns existing wall id', async () => {
  const { db, FieldValue } = makeFirestore();
  const r1 = await runAddConflictWall({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-coke', servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  const r2 = await runAddConflictWall({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-coke', servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r2.id, r1.id);
  assert.equal(r2.created, false);
  assert.equal(db._dump_prefix('conflict_walls').length, 1);
});

// ────────────────────────────────────────────────────────────────
// removeConflictWall
// ────────────────────────────────────────────────────────────────

test('removeConflictWall: deletes the wall by id', async () => {
  const { db } = makeFirestore();
  db._seed('conflict_walls/w1', { id: 'w1', clientId: 'client-coke', servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE' });
  const r = await runRemoveConflictWall({
    db, auth: SEED_AUTH,
    data: { wallId: 'w1' },
    assertAuth: stubAuth(),
  });
  assert.equal(r.removed, true);
  assert.equal(db._dump()['conflict_walls/w1'], undefined);
});
