/**
 * Conflict firewall — ADR-2026-05-25 §2.Q4 named-competitor model tests.
 *   cd functions && node --test __tests__/assignment/conflict-firewall.test.js
 *
 * Covers:
 *   - no competitors listed       → no-op (firewall doesn't trigger)
 *   - empty candidates            → no-op
 *   - all candidates pre-rejected → no-op (don't override existing reason)
 *   - brand serving a listed competitor's open IWO → brand excluded
 *   - brand serving the same client (not a competitor) → no exclusion
 *   - brand has no open IWOs → no exclusion even if competitor is listed
 *   - closed/cancelled IWOs → ignored (not "open", so no conflict)
 *   - multiple brands walled → all excluded
 *   - integration: runRouteBrand respects named-competitor wall
 *   - integration: ConflictExclusivityRisk event emitted with new payload
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('./_firestore-stub');
const { excludeConflicted } = require('../../src/conflict-firewall/excludeConflicted');
const { runRouteBrand } = require('../../src/assignment/services/route-brand.service');

// ── helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Seed a `client_competitors` doc — "clientId considers
 * competitorClientId a named competitor."
 */
function seedCompetitor(db, { id, clientId, competitorClientId }) {
  return db.collection('client_competitors').doc(id).set({
    id, clientId, competitorClientId,
    createdAt: new Date().toISOString(),
    createdBy: 'system',
  });
}

/**
 * Seed an IWO assigned to a brand.  `masterJobId` bridges to the client.
 * `state` defaults to 'IN_PROGRESS' (active / open).
 */
function seedIwo(db, { id, subsidiaryOrgId, masterJobId, state = 'IN_PROGRESS' }) {
  return db.collection('internal_work_orders').doc(id).set({
    id, subsidiaryOrgId, masterJobId, state,
    createdAt: new Date().toISOString(),
  });
}

/** Seed a master_job with a clientId. */
function seedMasterJob(db, { id, clientId }) {
  return db.collection('master_jobs').doc(id).set({ id, clientId });
}

// ── early-return paths ────────────────────────────────────────────────────────

test('no competitors listed → no-op (firewall not evaluable)', async () => {
  const { db } = makeFirestore();
  // No docs in client_competitors for 'client-pepsi'.
  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });
  assert.deepEqual(r.walledBrandIds, []);
  assert.deepEqual(r.listedCompetitorIds, []);
  candidates.forEach((c) => {
    assert.equal(c.conflicted, false);
    assert.equal(c.rejectionReason, null);
  });
});

test('empty candidates array → no-op', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  const r = await excludeConflicted({ db, candidates: [], accountId: 'client-pepsi' });
  assert.deepEqual(r.walledBrandIds, []);
});

test('all candidates pre-rejected → no-op', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-coke' });
  const candidates = freshCandidates(['zeus-the-agency']);
  candidates[0].rejectionReason = 'NO_CAPABILITY';   // already rejected
  await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });
  // Pre-rejected → firewall doesn't override the reason.
  assert.equal(candidates[0].rejectionReason, 'NO_CAPABILITY');
  assert.equal(candidates[0].conflicted, false);
});

// ── core exclusion ────────────────────────────────────────────────────────────

test('brand serving a listed competitor\'s open IWO → brand excluded', async () => {
  const { db } = makeFirestore();
  // pepsi considers coke a competitor.
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  // ZTA is serving coke right now (open IWO).
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-coke' });

  const candidates = freshCandidates(['zeus-the-agency', 'odd-gorilla']);
  const r = await excludeConflicted({
    db, candidates, accountId: 'client-pepsi', masterJobId: 'mj-pepsi',
  });

  assert.deepEqual(r.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(r.listedCompetitorIds, ['client-coke']);
  assert.deepEqual(r.walledCompetitorByBrand['zeus-the-agency'], ['client-coke']);

  const zta = candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.conflicted, true);
  assert.equal(zta.rejectionReason, 'CONFLICTED');

  const og = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(og.conflicted, false);
  assert.equal(og.rejectionReason, null);
});

test('brand serving the same client → not a competitor, no exclusion', async () => {
  const { db } = makeFirestore();
  // pepsi considers coke a competitor — but ZTA is serving pepsi, not coke.
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-pepsi', clientId: 'client-pepsi' });
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-pepsi' });

  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });

  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

test('brand has no open IWOs → no exclusion even if competitor is listed', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  // ZTA has zero open IWOs — nothing to conflict with.

  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });

  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

test('closed IWOs are ignored — CLOSED state does not trigger conflict', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  // IWO is CLOSED — no longer "serving" the client.
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-coke', state: 'CLOSED' });

  const candidates = freshCandidates(['zeus-the-agency']);
  const r = await excludeConflicted({ db, candidates, accountId: 'client-pepsi' });

  assert.deepEqual(r.walledBrandIds, []);
  assert.equal(candidates[0].rejectionReason, null);
});

test('multiple brands serving competitors → all excluded', async () => {
  const { db } = makeFirestore();
  // pepsi considers coke + bigi competitors.
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedCompetitor(db, { id: 'cc2', clientId: 'client-pepsi', competitorClientId: 'client-bigi' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-bigi', clientId: 'client-bigi' });
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-coke' });
  await seedIwo(db, { id: 'iwo2', subsidiaryOrgId: 'zeus-digital', masterJobId: 'mj-bigi' });

  const candidates = freshCandidates(['zeus-the-agency', 'zeus-digital', 'odd-gorilla']);
  const r = await excludeConflicted({
    db, candidates, accountId: 'client-pepsi', masterJobId: 'mj-pepsi',
  });

  assert.deepEqual(r.walledBrandIds.sort(), ['zeus-digital', 'zeus-the-agency']);
  assert.deepEqual(r.listedCompetitorIds.sort(), ['client-bigi', 'client-coke']);

  const og = candidates.find((c) => c.brandId === 'odd-gorilla');
  assert.equal(og.rejectionReason, null);            // OG free to take Pepsi
});

// ── integration: runRouteBrand respects named-competitor walls ────────────────

test('runRouteBrand: ZTA walled for competitor → proposes another brand', async () => {
  const { db } = makeFirestore();
  // Set up competitor + ZTA serving coke.
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-coke' });

  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-1',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
    },
  });

  // ZTA is walled. Eligible candidates left: zeus-digital, odd-gorilla,
  // house-of-zeus. proposedBrandId must NOT be zeus-the-agency.
  assert.notEqual(r.proposedBrandId, 'zeus-the-agency');
  assert.ok(
    ['zeus-digital', 'odd-gorilla', 'house-of-zeus'].includes(r.proposedBrandId),
    `unexpected proposedBrandId: ${r.proposedBrandId}`,
  );

  const zta = r.candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.rejectionReason, 'CONFLICTED');
});

test('runRouteBrand: all eligible brands walled → NO_ELIGIBLE_BRAND', async () => {
  const { db } = makeFirestore();
  // pepsi considers each brand's current client a competitor.
  for (const brandId of ['zeus-the-agency', 'zeus-digital', 'odd-gorilla', 'house-of-zeus']) {
    const competitorClientId = `client-already-${brandId}`;
    await seedCompetitor(db, {
      id: `cc-${brandId}`, clientId: 'client-pepsi', competitorClientId,
    });
    const mjId = `mj-${brandId}`;
    await seedMasterJob(db, { id: mjId, clientId: competitorClientId });
    await seedIwo(db, { id: `iwo-${brandId}`, subsidiaryOrgId: brandId, masterJobId: mjId });
  }

  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-1',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
    },
  });
  // labyrinth lacks 'creative', the other 4 are walled → no winner.
  assert.equal(r.proposedBrandId, null);
  assert.equal(r.reasonNoCandidate, 'NO_ELIGIBLE_BRAND');
});

test('runRouteBrand emits ConflictExclusivityRisk with named-competitor payload', async () => {
  const { db } = makeFirestore();
  await seedCompetitor(db, { id: 'cc1', clientId: 'client-pepsi', competitorClientId: 'client-coke' });
  await seedMasterJob(db, { id: 'mj-coke', clientId: 'client-coke' });
  await seedIwo(db, { id: 'iwo1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-coke' });

  await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj-pepsi-1',
      requiredCapability: 'creative',
      accountId: 'client-pepsi',
    },
  });

  const eventsSnap = await db.collection('domain_events').get();
  const events = eventsSnap.docs.map((d) => d.data());
  const risk = events.find((e) => e.eventType === 'ConflictExclusivityRisk');
  assert.ok(risk, 'expected ConflictExclusivityRisk emitted');
  assert.equal(risk.aggregateId, 'mj-pepsi-1');

  // New payload shape — named-competitor model.
  const p = risk.payload;
  assert.equal(p.requestedClientId, 'client-pepsi');
  assert.deepEqual(p.listedCompetitorIds, ['client-coke']);
  assert.deepEqual(p.walledBrandIds, ['zeus-the-agency']);
  assert.deepEqual(p.walledCompetitorByBrand['zeus-the-agency'], ['client-coke']);
  assert.equal(p.masterJobId, 'mj-pepsi-1');
});
