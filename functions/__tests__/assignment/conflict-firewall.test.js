/**
 * Conflict firewall — Phase 6.C unit tests.
 *   cd functions && node --test __tests__/assignment/conflict-firewall.test.js
 *
 * Covers:
 *   - no accountCategory  → no exclusions (firewall not evaluable)
 *   - empty candidates    → no-op
 *   - wall on competing brand+category → that brand excluded
 *   - wall on same client (not a competitor) → no exclusion
 *   - multiple walled brands in same category → both excluded
 *   - wall on different category → no exclusion
 *   - integration: runRouteBrand respects walls + emits risk event
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

function seedWall(db, { id, clientId, servingOrgId, categoryId }) {
  return db.collection('conflict_walls').doc(id).set({
    id, clientId, servingOrgId, categoryId,
    reason: 'SERVING_ACCOUNT',
    sourceAggregateType: 'master_job',
    sourceAggregateId: 'mj-x',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
  });
}

// ----- early-return paths ----------------------------------------------

test('no accountCategory → no-op (firewall not evaluable)', async () => {
  const { db } = makeFirestore();
  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });
  assert.deepEqual(r, { walledBrandIds: [], walledClientIds: [] });
  candidates.forEach((c) => {
    assert.equal(c.conflicted, false);
    assert.equal(c.rejectionReason, null);
  });
});

test('empty candidates array → no-op', async () => {
  const { db } = makeFirestore();
  const r = await excludeConflicted({
    db,
    candidates: [],
    accountId: 'client-pepsi',
    accountCategory: 'CARBONATED_BEVERAGE',
  });
  assert.deepEqual(r.walledBrandIds, []);
});

test('all candidates pre-rejected → no-op', async () => {
  const { db } = makeFirestore();
  await seedWall(db, {
    id: 'w1', clientId: 'client-coke',
    servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE',
  });
  const candidates = freshCandidates(['zeus-the-agency']);
  candidates[0].rejectionReason = 'NO_CAPABILITY';
  await excludeConflicted({
    db, candidates,
    accountId: 'client-pepsi',
    accountCategory: 'CARBONATED_BEVERAGE',
  });
  // Pre-rejected → firewall doesn't override the reason.
  assert.equal(candidates[0].rejectionReason, 'NO_CAPABILITY');
  assert.equal(candidates[0].conflicted, false);
});

// ----- core exclusion --------------------------------------------------

test('wall on competing brand+category → brand excluded', async () => {
  const { db } = makeFirestore();
  await seedWall(db, {
    id: 'w1',
    clientId: 'client-coke',                  // already-served competitor
    servingOrgId: 'zeus-the-agency',
    categoryId: 'CARBONATED_BEVERAGE',
  });
  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({
    db, candidates,
    accountId: 'client-pepsi',                // new client we're routing for
    accountCategory: 'CARBONATED_BEVERAGE',
  });
  assert.deepEqual(r.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(r.walledClientIds, ['client-coke']);

  const zta = candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.conflicted, true);
  assert.equal(zta.rejectionReason, 'CONFLICTED');

  const og = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(og.conflicted, false);
  assert.equal(og.rejectionReason, null);
});

test('wall on same client → not a competitor, no exclusion', async () => {
  const { db } = makeFirestore();
  // Wall says ZTA is serving client-pepsi in CARBONATED. We're now
  // routing MORE work for client-pepsi → the wall doesn't exclude.
  await seedWall(db, {
    id: 'w1',
    clientId: 'client-pepsi',
    servingOrgId: 'zeus-the-agency',
    categoryId: 'CARBONATED_BEVERAGE',
  });
  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({
    db, candidates,
    accountId: 'client-pepsi',
    accountCategory: 'CARBONATED_BEVERAGE',
  });
  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

test('wall on different category → no exclusion', async () => {
  const { db } = makeFirestore();
  await seedWall(db, {
    id: 'w1',
    clientId: 'client-coke',
    servingOrgId: 'zeus-the-agency',
    categoryId: 'CARBONATED_BEVERAGE',
  });
  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({
    db, candidates,
    accountId: 'client-stanbic',
    accountCategory: 'COMMERCIAL_BANK',       // different category
  });
  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

test('walls on multiple brands in same category → all walled excluded', async () => {
  const { db } = makeFirestore();
  await seedWall(db, {
    id: 'w1', clientId: 'client-coke',
    servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE',
  });
  await seedWall(db, {
    id: 'w2', clientId: 'client-bigi',
    servingOrgId: 'zeus-digital', categoryId: 'CARBONATED_BEVERAGE',
  });
  const candidates = freshCandidates([
    'zeus-the-agency', 'zeus-digital', 'odd-gorilla',
  ]);
  const r = await excludeConflicted({
    db, candidates,
    accountId: 'client-pepsi',
    accountCategory: 'CARBONATED_BEVERAGE',
  });
  assert.deepEqual(r.walledBrandIds.sort(), ['zeus-digital', 'zeus-the-agency']);
  assert.deepEqual(r.walledClientIds.sort(), ['client-bigi', 'client-coke']);

  const og = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(og.rejectionReason, null);            // OG free to take Pepsi
});

// ----- integration: routeBrand respects walls --------------------------

test('runRouteBrand: ZTA walled for category → proposes another brand', async () => {
  const { db } = makeFirestore();
  await seedWall(db, {
    id: 'w1', clientId: 'client-coke',
    servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE',
  });
  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-1',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
      accountCategory: 'CARBONATED_BEVERAGE',
    },
  });
  // ZTA is walled. Eligible candidates left: zeus-digital, odd-gorilla,
  // house-of-zeus. proposedBrandId must NOT be zeus-the-agency.
  assert.notEqual(r.proposedBrandId, 'zeus-the-agency');
  assert.ok(['zeus-digital', 'odd-gorilla', 'house-of-zeus'].includes(r.proposedBrandId));

  const zta = r.candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.rejectionReason, 'CONFLICTED');
});

test('runRouteBrand: all eligible brands walled → NO_ELIGIBLE_BRAND', async () => {
  const { db } = makeFirestore();
  for (const brandId of ['zeus-the-agency', 'zeus-digital', 'odd-gorilla', 'house-of-zeus']) {
    await seedWall(db, {
      id: `w-${brandId}`,
      clientId: `client-already-${brandId}`,
      servingOrgId: brandId,
      categoryId: 'CARBONATED_BEVERAGE',
    });
  }
  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-1',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
      accountCategory: 'CARBONATED_BEVERAGE',
    },
  });
  // labyrinth lacks 'creative', the other 4 are walled → no winner.
  assert.equal(r.proposedBrandId, null);
  assert.equal(r.reasonNoCandidate, 'NO_ELIGIBLE_BRAND');
});

test('runRouteBrand emits ConflictExclusivityRisk when wall fires', async () => {
  const { db } = makeFirestore();
  await seedWall(db, {
    id: 'w1', clientId: 'client-coke',
    servingOrgId: 'zeus-the-agency', categoryId: 'CARBONATED_BEVERAGE',
  });
  await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-1',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
      accountCategory: 'CARBONATED_BEVERAGE',
    },
  });
  // The outbox writes to `domain_events/{eventId}`.
  const eventsSnap = await db.collection('domain_events').get();
  const events = eventsSnap.docs.map((d) => d.data());
  const risk = events.find((e) => e.eventType === 'ConflictExclusivityRisk');
  assert.ok(risk, 'expected ConflictExclusivityRisk emitted');
  assert.equal(risk.aggregateId, 'mj-pepsi-1');
  assert.equal(risk.payload.categoryId, 'CARBONATED_BEVERAGE');
  assert.deepEqual(risk.payload.excludedBrandIds, ['zeus-the-agency']);
});
