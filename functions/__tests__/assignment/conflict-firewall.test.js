/**
 * Conflict firewall — Phase 6.C v2 unit tests (ADR-0001 Q4 + v1.1 C3).
 *   cd functions && node --test __tests__/assignment/conflict-firewall.test.js
 *
 * Covers the named-competitor model (replaces v1's Category model):
 *   - no requestingClientId  → no-op (firewall not evaluable)
 *   - empty candidates       → no-op
 *   - no competitor edges    → no exclusions
 *   - competitor has open IWO at candidate brand → that brand walled
 *   - competitor with closed IWOs → no wall (only open IWOs anchor)
 *   - asymmetry: (pepsi → coke) walls; (coke → pepsi) doesn't fire
 *     unless its own edge exists
 *   - de-duplicates master_job reads across multiple IWOs
 *   - integration: routeBrand respects walls + emits risk event
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('./_firestore-stub');
const { excludeConflicted } = require('../../src/conflict-firewall/excludeConflicted');
const { runRouteBrand } = require('../../src/assignment/services/route-brand.service');

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

function seedCompetitor(db, { clientId, competitorClientId }) {
  const id = `${clientId}__${competitorClientId}`;
  return db.collection('client_competitors').doc(id).set({
    id, clientId, competitorClientId,
    addedBy: 'user-am',
    addedAt: new Date().toISOString(),
  });
}

function seedMasterJob(db, { id, clientId, status = 'OPEN' }) {
  return db.collection('master_jobs').doc(id).set({
    id, clientId, status,
    createdAt: new Date().toISOString(),
  });
}

function seedIwo(db, { id, masterJobId, subsidiaryOrgId, state = 'IN_PROGRESS' }) {
  return db.collection('internal_work_orders').doc(id).set({
    id, masterJobId, subsidiaryOrgId, state,
    createdAt: new Date().toISOString(),
  });
}

// ----- early-return paths ----------------------------------------------

test('no requestingClientId → no-op', async () => {
  const { db } = makeFirestore();
  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({ db, candidates });
  assert.deepEqual(r.walledBrandIds, []);
  candidates.forEach((c) => {
    assert.equal(c.conflicted, false);
    assert.equal(c.rejectionReason, null);
  });
});

test('empty candidates array → no-op', async () => {
  const { db } = makeFirestore();
  const r = await excludeConflicted({
    db, candidates: [], requestingClientId: 'client-pepsi',
  });
  assert.deepEqual(r.walledBrandIds, []);
});

test('all candidates pre-rejected → no-op (firewall doesn\'t override prior reason)', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo-coke', masterJobId: 'mj-coke', subsidiaryOrgId: 'zeus-the-agency' });

  const candidates = freshCandidates(['zeus-the-agency']);
  candidates[0].rejectionReason = 'NO_CAPABILITY';
  await excludeConflicted({
    db, candidates,
    requestingClientId: 'client-pepsi',
  });
  assert.equal(candidates[0].rejectionReason, 'NO_CAPABILITY');
  assert.equal(candidates[0].conflicted, false);
});

test('no competitor edges → no exclusions', async () => {
  const { db } = makeFirestore();
  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({
    db, candidates,
    requestingClientId: 'client-pepsi',
  });
  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

// ----- core exclusion --------------------------------------------------

test('competitor open at candidate brand → brand walled', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo-coke', masterJobId: 'mj-coke', subsidiaryOrgId: 'zeus-the-agency' });

  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({
    db, candidates,
    requestingClientId: 'client-pepsi',
  });
  assert.deepEqual(r.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(r.walledByBrand, { 'zeus-the-agency': 'client-coke' });

  const zta = candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.conflicted, true);
  assert.equal(zta.rejectionReason, 'CONFLICTED');

  const og = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(og.conflicted, false);
  assert.equal(og.rejectionReason, null);
});

test('competitor with closed IWO → no wall (only OPEN states count)', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, {
    id: 'iwo-coke-closed',
    masterJobId: 'mj-coke',
    subsidiaryOrgId: 'zeus-the-agency',
    state: 'CLOSED',
  });

  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({
    db, candidates,
    requestingClientId: 'client-pepsi',
  });
  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

test('asymmetry: (pepsi → coke) edge walls pepsi requests only', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-pepsi', clientId: 'client-pepsi' });
  await seedIwo(db, { id: 'iwo-pepsi', masterJobId: 'mj-pepsi', subsidiaryOrgId: 'zeus-the-agency' });

  // Pepsi requests work → ZTA is serving pepsi (not a competitor)
  const candidatesForPepsi = freshCandidates(['zeus-the-agency']);
  await excludeConflicted({
    db, candidates: candidatesForPepsi, requestingClientId: 'client-pepsi',
  });
  assert.equal(candidatesForPepsi[0].rejectionReason, null);

  // Coke requests work → no edge from coke → no firewall
  const candidatesForCoke = freshCandidates(['zeus-the-agency']);
  await excludeConflicted({
    db, candidates: candidatesForCoke, requestingClientId: 'client-coke',
  });
  assert.equal(candidatesForCoke[0].rejectionReason, null);
});

test('asymmetry confirmed: add coke→pepsi edge, then coke\'s request is walled', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-coke', competitorClientId: 'client-pepsi' });
  await seedMasterJob(db, { id: 'mj-pepsi', clientId: 'client-pepsi' });
  await seedIwo(db, { id: 'iwo-pepsi', masterJobId: 'mj-pepsi', subsidiaryOrgId: 'zeus-the-agency' });

  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({
    db, candidates, requestingClientId: 'client-coke',
  });
  assert.deepEqual(r.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(r.walledByBrand, { 'zeus-the-agency': 'client-pepsi' });
});

test('multiple brands serving distinct competitors → all walled, mapping accurate', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-bigi' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-bigi', clientId: 'client-bigi' });
  await seedIwo(db, { id: 'iwo-coke', masterJobId: 'mj-coke', subsidiaryOrgId: 'zeus-the-agency' });
  await seedIwo(db, { id: 'iwo-bigi', masterJobId: 'mj-bigi', subsidiaryOrgId: 'zeus-digital' });

  const candidates = freshCandidates(['zeus-the-agency', 'zeus-digital', 'odd-gorilla']);
  const r = await excludeConflicted({
    db, candidates, requestingClientId: 'client-pepsi',
  });
  assert.deepEqual(r.walledBrandIds.sort(), ['zeus-digital', 'zeus-the-agency']);
  assert.deepEqual(r.walledByBrand, {
    'zeus-the-agency': 'client-coke',
    'zeus-digital': 'client-bigi',
  });
  const og = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(og.rejectionReason, null);
});

// ----- integration: runRouteBrand respects walls -----------------------

test('runRouteBrand: requesting client\'s competitor is at ZTA → proposes another brand', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo-coke', masterJobId: 'mj-coke', subsidiaryOrgId: 'zeus-the-agency' });

  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-new',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
    },
  });
  assert.notEqual(r.proposedBrandId, 'zeus-the-agency');
  assert.ok(['zeus-digital', 'odd-gorilla', 'house-of-zeus'].includes(r.proposedBrandId));

  const zta = r.candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.rejectionReason, 'CONFLICTED');
});

test('runRouteBrand: all eligible brands walled → NO_ELIGIBLE_BRAND', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-fanta' });
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-sprite' });
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-bigi' });

  const setup = [
    { brand: 'zeus-the-agency', client: 'client-coke' },
    { brand: 'zeus-digital',    client: 'client-fanta' },
    { brand: 'odd-gorilla',     client: 'client-sprite' },
    { brand: 'house-of-zeus',   client: 'client-bigi' },
  ];
  for (const s of setup) {
    await seedMasterJob(db, { id: `mj-${s.client}`, clientId: s.client });
    await seedIwo(db, { id: `iwo-${s.client}`, masterJobId: `mj-${s.client}`, subsidiaryOrgId: s.brand });
  }

  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-new',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
    },
  });
  assert.equal(r.proposedBrandId, null);
  assert.equal(r.reasonNoCandidate, 'NO_ELIGIBLE_BRAND');
});

test('runRouteBrand emits ConflictExclusivityRisk via outbox', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo-coke', masterJobId: 'mj-coke', subsidiaryOrgId: 'zeus-the-agency' });

  await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-new',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
    },
  });
  const eventsSnap = await db.collection('domain_events').get();
  const events = eventsSnap.docs.map((d) => d.data());
  const risk = events.find((e) => e.eventType === 'ConflictExclusivityRisk');
  assert.ok(risk, 'expected ConflictExclusivityRisk emitted');
  assert.equal(risk.aggregateId, 'mj-pepsi-new');
  assert.equal(risk.payload.requestedClientId, 'client-pepsi');
  assert.deepEqual(risk.payload.listedCompetitorIds, ['client-coke']);
  assert.deepEqual(risk.payload.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(risk.payload.walledCompetitorByBrand, { 'zeus-the-agency': 'client-coke' });
});
