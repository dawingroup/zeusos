/**
 * Conflict firewall — ADR-2026-05-25 §2.Q4 named-competitor model.
 *   cd functions && node --test __tests__/conflict-firewall/firewall.test.js
 *
 * Covers:
 *   - addClientCompetitor: happy path, idempotent, validates clientId
 *     exists, rejects self-competitor
 *   - removeClientCompetitor: removes the row
 *   - excludeConflicted: no list → no-op; list + walled brand → exclude
 *     with risk event; list + no brand serving competitor → no-op
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const {
  runAddClientCompetitor,
  runRemoveClientCompetitor,
} = require('../../src/conflict-firewall/admin');
const { excludeConflicted } = require('../../src/conflict-firewall/excludeConflicted');

const SEED_AUTH = { uid: 'user-am-1' };
const stubAuth = (uid = 'user-am-1') => async () => ({ uid });

function seedClient(db, id) {
  db._seed(`clients/${id}`, { id, name: id, parentOrgId: 'zeus-group', status: 'ACTIVE' });
}

function freshCandidates(brandIds) {
  return brandIds.map((brandId) => ({
    brandId,
    hasCapability: true,
    conflicted: false,
    openIwoCount: 0,
    availability: 100,
    rejectionReason: null,
  }));
}

// ────────────────────────────────────────────────────────────────
// addClientCompetitor
// ────────────────────────────────────────────────────────────────

test('addClientCompetitor: creates the row with composite id', async () => {
  const { db, FieldValue } = makeFirestore();
  seedClient(db, 'client-pepsi');
  const r = await runAddClientCompetitor({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-pepsi', competitorClientId: 'client-coke' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r.id, 'client-pepsi__client-coke');
  assert.equal(r.created, true);
  const row = db._dump()['client_competitors/client-pepsi__client-coke'];
  assert.equal(row.competitorClientId, 'client-coke');
  assert.equal(row.source, 'MANUAL');
  assert.equal(row.addedBy, 'user-am-1');
});

test('addClientCompetitor: idempotent on (clientId, competitorClientId) — second call updates notes', async () => {
  const { db, FieldValue } = makeFirestore();
  seedClient(db, 'client-pepsi');
  await runAddClientCompetitor({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-pepsi', competitorClientId: 'client-coke', notes: 'v1' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  const r = await runAddClientCompetitor({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-pepsi', competitorClientId: 'client-coke', notes: 'v2' },
    fieldValue: FieldValue,
    assertAuth: stubAuth(),
  });
  assert.equal(r.created, false);
  const row = db._dump()['client_competitors/client-pepsi__client-coke'];
  assert.equal(row.notes, 'v2');
});

test('addClientCompetitor: rejects unknown clientId', async () => {
  const { db, FieldValue } = makeFirestore();
  await assert.rejects(
    runAddClientCompetitor({
      db, auth: SEED_AUTH,
      data: { clientId: 'ghost', competitorClientId: 'client-coke' },
      fieldValue: FieldValue,
      assertAuth: stubAuth(),
    }),
    /not found/i,
  );
});

test('addClientCompetitor: rejects self-competitor', async () => {
  const { db, FieldValue } = makeFirestore();
  seedClient(db, 'client-pepsi');
  await assert.rejects(
    runAddClientCompetitor({
      db, auth: SEED_AUTH,
      data: { clientId: 'client-pepsi', competitorClientId: 'client-pepsi' },
      fieldValue: FieldValue,
      assertAuth: stubAuth(),
    }),
    /cannot be its own competitor/,
  );
});

test('addClientCompetitor: validates source enum', async () => {
  const { db, FieldValue } = makeFirestore();
  seedClient(db, 'client-pepsi');
  await assert.rejects(
    runAddClientCompetitor({
      db, auth: SEED_AUTH,
      data: { clientId: 'client-pepsi', competitorClientId: 'client-coke', source: 'INVALID' },
      fieldValue: FieldValue,
      assertAuth: stubAuth(),
    }),
    /source must be one of/,
  );
});

// ────────────────────────────────────────────────────────────────
// removeClientCompetitor
// ────────────────────────────────────────────────────────────────

test('removeClientCompetitor: removes the row', async () => {
  const { db } = makeFirestore();
  db._seed('client_competitors/client-pepsi__client-coke', {
    id: 'client-pepsi__client-coke',
    clientId: 'client-pepsi',
    competitorClientId: 'client-coke',
  });
  const r = await runRemoveClientCompetitor({
    db, auth: SEED_AUTH,
    data: { clientId: 'client-pepsi', competitorClientId: 'client-coke' },
    assertAuth: stubAuth(),
  });
  assert.equal(r.removed, true);
  assert.equal(db._dump()['client_competitors/client-pepsi__client-coke'], undefined);
});

// ────────────────────────────────────────────────────────────────
// excludeConflicted
// ────────────────────────────────────────────────────────────────

test('excludeConflicted: empty candidates → no-op', async () => {
  const { db } = makeFirestore();
  const r = await excludeConflicted({ db, candidates: [], accountId: 'client-pepsi' });
  assert.deepEqual(r.walledBrandIds, []);
  assert.deepEqual(r.listedCompetitorIds, []);
});

test('excludeConflicted: no accountId → no-op (firewall not evaluable)', async () => {
  const { db } = makeFirestore();
  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({ db, candidates });
  assert.deepEqual(r.walledBrandIds, []);
  candidates.forEach((c) => assert.equal(c.rejectionReason, null));
});

test('excludeConflicted: client has no competitor list → no-op', async () => {
  const { db } = makeFirestore();
  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });
  assert.deepEqual(r.walledBrandIds, []);
  assert.deepEqual(r.listedCompetitorIds, []);
});

test('excludeConflicted: candidate brand serving a listed competitor is excluded', async () => {
  const { db } = makeFirestore();
  // Pepsi blocks Coca-Cola.
  db._seed('client_competitors/client-pepsi__client-coke', {
    id: 'client-pepsi__client-coke',
    clientId: 'client-pepsi',
    competitorClientId: 'client-coke',
    source: 'MSA',
  });
  // Zeus The Agency is currently serving Coca-Cola.
  db._seed('master_jobs/mj-coke-1', { id: 'mj-coke-1', clientId: 'client-coke' });
  db._seed('internal_work_orders/iwo-coke-1', {
    id: 'iwo-coke-1',
    subsidiaryOrgId: 'zeus-the-agency',
    masterJobId: 'mj-coke-1',
    state: 'IN_PROGRESS',
  });

  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla', 'house-of-zeus']);
  const r = await excludeConflicted({
    db, candidates,
    accountId: 'client-pepsi',
    masterJobId: 'mj-pepsi-new',
  });

  assert.deepEqual(r.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(r.listedCompetitorIds, ['client-coke']);
  assert.deepEqual(r.walledCompetitorByBrand, { 'zeus-the-agency': ['client-coke'] });

  // Mutation applied
  const zta = candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.conflicted, true);
  assert.equal(zta.rejectionReason, 'CONFLICTED');

  // Other brands not walled
  const odd = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(odd.conflicted, false);
  assert.equal(odd.rejectionReason, null);
});

test('excludeConflicted: closed/cancelled IWOs do not trigger the firewall', async () => {
  const { db } = makeFirestore();
  db._seed('client_competitors/client-pepsi__client-coke', {
    id: 'client-pepsi__client-coke',
    clientId: 'client-pepsi',
    competitorClientId: 'client-coke',
    source: 'MSA',
  });
  db._seed('master_jobs/mj-coke-1', { id: 'mj-coke-1', clientId: 'client-coke' });
  // Coca-Cola work for ZTA is CLOSED — no longer "currently serving".
  db._seed('internal_work_orders/iwo-coke-1', {
    id: 'iwo-coke-1',
    subsidiaryOrgId: 'zeus-the-agency',
    masterJobId: 'mj-coke-1',
    state: 'CLOSED',
  });

  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi', masterJobId: 'mj-pepsi-new' });
  assert.deepEqual(r.walledBrandIds, []);
});

test('excludeConflicted: emits ConflictExclusivityRisk when walls fire', async () => {
  const { db } = makeFirestore();
  db._seed('client_competitors/client-pepsi__client-coke', {
    id: 'client-pepsi__client-coke',
    clientId: 'client-pepsi',
    competitorClientId: 'client-coke',
    source: 'MSA',
  });
  db._seed('master_jobs/mj-coke-1', { id: 'mj-coke-1', clientId: 'client-coke' });
  db._seed('internal_work_orders/iwo-coke-1', {
    id: 'iwo-coke-1', subsidiaryOrgId: 'zeus-the-agency',
    masterJobId: 'mj-coke-1', state: 'IN_PROGRESS',
  });

  const candidates = freshCandidates(['zeus-the-agency']);
  await excludeConflicted({ db, candidates, accountId: 'client-pepsi', masterJobId: 'mj-pepsi-new' });

  const events = db._dump_prefix('domain_events');
  assert.ok(events.length >= 1, 'expected ConflictExclusivityRisk event');
  const risk = events.find((e) => e.data.eventType === 'ConflictExclusivityRisk');
  assert.ok(risk, 'expected ConflictExclusivityRisk event in outbox');
  assert.equal(risk.data.payload.requestedClientId, 'client-pepsi');
  assert.deepEqual(risk.data.payload.walledBrandIds, ['zeus-the-agency']);
});
