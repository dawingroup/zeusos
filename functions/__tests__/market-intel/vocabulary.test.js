/**
 * The market-intelligence vocabulary (audit 2026-10, D-1 / D-13): the
 * subsidiary ids ARE the five routed brands, every brand has a research
 * brief, and the collection registry is internally consistent.
 *
 *    cd functions && node --test __tests__/market-intel/vocabulary.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const v = require('../../src/lib/marketIntelVocabulary');
const { BRAND_CAPABILITIES } = require('../../src/assignment/services/route-brand.service');

test('the subsidiary ids are exactly the routed brands, in the same order', () => {
  assert.deepEqual([...v.MARKET_INTEL_SUBSIDIARY_IDS], Object.keys(BRAND_CAPABILITIES));
  assert.equal(v.isMarketIntelSubsidiaryId('zeus-group'), false, 'the parent never competes');
  assert.equal(v.isMarketIntelSubsidiaryId('finishes'), false, 'DawinOS short forms are gone');
  assert.equal(v.isMarketIntelSubsidiaryId('labyrinth'), true);
});

test('every brand has a scan brief: name, description, industries, keywords', () => {
  for (const id of v.MARKET_INTEL_SUBSIDIARY_IDS) {
    const ctx = v.SUBSIDIARY_CONTEXT[id];
    assert.ok(ctx, id);
    assert.equal(typeof ctx.name, 'string');
    assert.ok(ctx.description.length > 40, `${id} description`);
    assert.ok(ctx.industries.length >= 3, `${id} industries`);
    assert.ok(ctx.competitorKeywords.length >= 5, `${id} keywords`);
    assert.doesNotMatch(ctx.name + ctx.description, /Dawin|furniture|millwork/i, `${id} is Zeus-shaped`);
  }
  assert.deepEqual(Object.keys(v.SUBSIDIARY_CONTEXT), [...v.MARKET_INTEL_SUBSIDIARY_IDS]);
  assert.equal(v.subsidiaryNameOf('house-of-zeus'), 'House of Zeus');
  assert.equal(v.subsidiaryNameOf('finishes'), null);
});

test('normalizeSubsidiaryIds keeps known ids only, de-duplicated, in registry order', () => {
  assert.deepEqual(v.normalizeSubsidiaryIds(['odd-gorilla', ' labyrinth ', 'finishes', 'odd-gorilla', 7, null]), ['labyrinth', 'odd-gorilla']);
  assert.deepEqual(v.normalizeSubsidiaryIds('zeus-digital'), []);
});

test('collection registry: unique, children keyed on competitorId, retired disjoint from owned', () => {
  const ids = v.MARKET_INTEL_COLLECTION_IDS;
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 13);
  for (const c of v.COMPETITOR_CHILD_COLLECTIONS) assert.equal(c.competitorField, 'competitorId', c.id);
  assert.deepEqual(v.COMPETITOR_CHILD_COLLECTIONS.map((c) => c.id), [
    'competitor_swot', 'competitive_moves', 'win_loss_records', 'digital_profiles', 'social_posts', 'social_metrics',
  ]);
  for (const r of v.COMPETITOR_REFERENCE_ARRAYS) assert.ok(ids.includes(r.id), `${r.id} is owned`);
  for (const r of v.RETIRED_MARKET_INTEL_COLLECTIONS) assert.ok(!ids.includes(r), `${r} is not both owned and retired`);
  assert.ok(v.RETIRED_MARKET_INTEL_COLLECTIONS.includes('market_insights'));
  assert.ok(v.RETIRED_MARKET_INTEL_COLLECTIONS.includes('profile_snapshots'));
});

test('sentinel competitorIds are recognised and never treated as foreign keys', () => {
  assert.equal(v.isCompetitorIdSentinel('OWN_zeus-digital_acc1'), true);
  assert.equal(v.isCompetitorIdSentinel('CANDIDATE_Acme'), true);
  assert.equal(v.isCompetitorIdSentinel('abc123'), false);
  assert.equal(v.isCompetitorIdSentinel(null), false);
});
