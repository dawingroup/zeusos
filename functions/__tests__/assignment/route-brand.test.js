/**
 * routeBrand — Phase 6.B unit tests.
 *   cd functions && node --test __tests__/assignment/route-brand.test.js
 *
 * Tests run against the in-memory firestore-stub (no `in` query
 * support — `countOpenIwosForBrand` therefore reads 0 for every
 * brand here. That's enough to exercise capability + geography +
 * NO_ELIGIBLE_BRAND paths. Real-load ranking is covered by the
 * emulator-based integration suite when 6.E lands.)
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('./_firestore-stub');
const {
  runRouteBrand,
  BRAND_CAPABILITIES,
  ALL_DELIVERY_BRANDS,
} = require('../../src/assignment/services/route-brand.service');

// ----- input validation -----------------------------------------------

test('rejects missing input', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => runRouteBrand({ db, input: null }),
    /input is required/
  );
});

test('rejects missing masterJobId', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => runRouteBrand({ db, input: { requiredCapability: 'creative' } }),
    /input\.masterJobId is required/
  );
});

test('rejects missing requiredCapability', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    () => runRouteBrand({ db, input: { masterJobId: 'mj1' } }),
    /input\.requiredCapability is required/
  );
});

// ----- capability matching --------------------------------------------

test('capability "creative" — eligible brands include all 360° brands', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: { masterJobId: 'mj1', requiredCapability: 'creative' },
  });
  // creative is declared by zeus-the-agency, zeus-digital, odd-gorilla, house-of-zeus.
  // labyrinth (audio/visual studio) does NOT declare creative.
  const labyrinth = r.candidates.find((c) => c.brandId === 'labyrinth');
  assert.equal(labyrinth.rejectionReason, 'NO_CAPABILITY');
  assert.equal(labyrinth.hasCapability, false);

  const zta = r.candidates.find((c) => c.brandId === 'zeus-the-agency');
  assert.equal(zta.hasCapability, true);
  assert.equal(zta.rejectionReason, null);
  assert.ok(r.proposedBrandId);
  assert.ok(['zeus-the-agency', 'zeus-digital', 'odd-gorilla', 'house-of-zeus'].includes(r.proposedBrandId));
});

test('capability "podcast" — only labyrinth declares it', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: { masterJobId: 'mj1', requiredCapability: 'podcast' },
  });
  assert.equal(r.proposedBrandId, 'labyrinth');
  const lab = r.candidates.find((c) => c.brandId === 'labyrinth');
  assert.equal(lab.hasCapability, true);
});

test('unknown capability → NO_ELIGIBLE_BRAND', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: { masterJobId: 'mj1', requiredCapability: 'quantum_computing' },
  });
  assert.equal(r.proposedBrandId, null);
  assert.equal(r.reasonNoCandidate, 'NO_ELIGIBLE_BRAND');
  // Every candidate rejected with NO_CAPABILITY.
  assert.ok(r.candidates.every((c) => c.rejectionReason === 'NO_CAPABILITY'));
});

// ----- geography preference -------------------------------------------

test('KE region → HouseOfZeus winning when capability matches', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj1',
      requiredCapability: 'creative',
      accountRegion: 'KE',
    },
  });
  assert.equal(r.proposedBrandId, 'house-of-zeus');
  assert.equal(r.geographyPreferenceApplied, 'house-of-zeus');
});

test('KE region but capability HoZ does not declare → preference falls back', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj1',
      requiredCapability: 'podcast', // labyrinth-only
      accountRegion: 'KE',
    },
  });
  assert.equal(r.proposedBrandId, 'labyrinth');
  // Geography preference NOT applied because house-of-zeus wasn't eligible.
  assert.equal(r.geographyPreferenceApplied, null);
});

test('UG region — no geography preference applied', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: {
      masterJobId: 'mj1',
      requiredCapability: 'creative',
      accountRegion: 'UG',
    },
  });
  assert.equal(r.geographyPreferenceApplied, null);
  // Any of the 360° brands is acceptable; not asserting which.
  assert.ok(r.proposedBrandId);
});

// ----- tier passthrough ------------------------------------------------

test('explicit tier in input is echoed in result', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: { masterJobId: 'mj1', requiredCapability: 'creative', tier: 'TIER_1' },
  });
  assert.equal(r.tierApplied, 'TIER_1');
});

test('tier read from MasterJob when not in input', async () => {
  const { db } = makeFirestore();
  await db.doc('master_jobs/mj-tiered').set({
    id: 'mj-tiered',
    tier: 'TIER_3',
    status: 'OPEN',
  });
  const r = await runRouteBrand({
    db,
    input: { masterJobId: 'mj-tiered', requiredCapability: 'creative' },
  });
  assert.equal(r.tierApplied, 'TIER_3');
});

test('no tier on MasterJob or input → tierApplied null (back-compat)', async () => {
  const { db } = makeFirestore();
  const r = await runRouteBrand({
    db,
    input: { masterJobId: 'mj-untiered', requiredCapability: 'creative' },
  });
  assert.equal(r.tierApplied, null);
});

// ----- brand-capability registry sanity --------------------------------

test('all five sibling brands present in registry', () => {
  assert.equal(ALL_DELIVERY_BRANDS.length, 5);
  for (const id of ['zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus']) {
    assert.ok(BRAND_CAPABILITIES[id], `missing capability set for ${id}`);
    assert.ok(BRAND_CAPABILITIES[id].size > 0, `empty capability set for ${id}`);
  }
});

test('odd-gorilla mirrors zeus-the-agency capabilities (conflict-firewall twin)', () => {
  const zta = BRAND_CAPABILITIES['zeus-the-agency'];
  const og = BRAND_CAPABILITIES['odd-gorilla'];
  assert.equal(zta.size, og.size);
  for (const cap of zta) {
    assert.ok(og.has(cap), `odd-gorilla missing capability ${cap}`);
  }
});
