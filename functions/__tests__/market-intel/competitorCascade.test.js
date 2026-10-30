/**
 * Competitor hard-delete cascade (audit 2026-10, B1 / D-3): the pure plan
 * and the runner against the in-memory Firestore stub.
 *
 *    cd functions && node --test __tests__/market-intel/competitorCascade.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { planCompetitorCascade, summarizeCascade, runCompetitorCascade } = require('../../src/lib/competitorCascade');

test('planCompetitorCascade: child rows deleted, reference arrays detached, other rows untouched', () => {
  const ops = planCompetitorCascade('acme', {
    competitor_swot: [{ id: 's1', data: { competitorId: 'acme' } }, { id: 's2', data: { competitorId: 'other' } }],
    social_posts: [{ id: 'instagram_1', data: { competitorId: 'acme' } }, { id: 'instagram_2', data: { competitorId: 'OWN_zeus-digital_a1' } }],
    tracked_topics: [{ id: 't1', data: { relatedCompetitorIds: ['acme', 'other'] } }, { id: 't2', data: { relatedCompetitorIds: ['other'] } }],
    ai_insights: [{ id: 'i1', data: { competitorIds: ['acme'] } }],
  });
  assert.deepEqual(ops, [
    { op: 'delete', collection: 'competitor_swot', id: 's1' },
    { op: 'delete', collection: 'social_posts', id: 'instagram_1' },
    { op: 'update', collection: 'tracked_topics', id: 't1', update: { relatedCompetitorIds: ['other'] } },
    { op: 'update', collection: 'ai_insights', id: 'i1', update: { competitorIds: [] } },
  ]);
  assert.deepEqual(summarizeCascade(ops), {
    deleted: 2,
    detached: 2,
    byCollection: { competitor_swot: 1, social_posts: 1, tracked_topics: 1, ai_insights: 1 },
  });
});

test('planCompetitorCascade: no id, no plan', () => {
  assert.deepEqual(planCompetitorCascade('', { competitor_swot: [{ id: 's1', data: { competitorId: '' } }] }), []);
  assert.deepEqual(planCompetitorCascade(undefined, {}), []);
  assert.deepEqual(planCompetitorCascade('acme', undefined), []);
});

test('runCompetitorCascade: reads every child collection, deletes, detaches, leaves sentinels and other competitors alone', async () => {
  const { db } = makeFirestore();
  db._seed('competitors/other', { name: 'Other' });
  db._seed('competitor_swot/s1', { competitorId: 'acme' });
  db._seed('competitor_swot/s2', { competitorId: 'other' });
  db._seed('competitive_moves/m1', { competitorId: 'acme' });
  db._seed('win_loss_records/w1', { competitorId: 'acme' });
  db._seed('digital_profiles/p1', { competitorId: 'acme' });
  db._seed('digital_profiles/p2', { competitorId: 'OWN_zeus-digital_a1' });
  db._seed('social_posts/instagram_1', { competitorId: 'acme', postId: '1', platform: 'instagram' });
  db._seed('social_metrics/mt1', { competitorId: 'acme' });
  db._seed('tracked_topics/t1', { relatedCompetitorIds: ['acme', 'other'] });
  db._seed('ai_insights/i1', { competitorIds: ['acme'], title: 'x' });
  db._seed('news_articles/n1', { title: 'unrelated' });

  const result = await runCompetitorCascade(db, 'acme', { now: () => '2026-10-29T09:00:00.000Z' });
  assert.equal(result.competitorId, 'acme');
  assert.equal(result.deleted, 6);
  assert.equal(result.detached, 2);

  const dump = db._dump();
  assert.deepEqual(
    Object.keys(dump).sort(),
    ['ai_insights/i1', 'competitor_swot/s2', 'competitors/other', 'digital_profiles/p2', 'news_articles/n1', 'tracked_topics/t1'],
  );
  assert.deepEqual(dump['tracked_topics/t1'], { relatedCompetitorIds: ['other'], updatedAt: '2026-10-29T09:00:00.000Z' });
  assert.deepEqual(dump['ai_insights/i1'].competitorIds, []);
});

test('runCompetitorCascade: a competitor with no children is a no-op', async () => {
  const { db } = makeFirestore();
  db._seed('competitor_swot/s2', { competitorId: 'other' });
  const result = await runCompetitorCascade(db, 'lonely');
  assert.deepEqual(result, { competitorId: 'lonely', deleted: 0, detached: 0, byCollection: {} });
  assert.equal(Object.keys(db._dump()).length, 1);
});
