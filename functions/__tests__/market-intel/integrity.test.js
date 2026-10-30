/**
 * The integrity audit's pure half (audit 2026-10, WP0): a clean world has no
 * defects; a dirty world names each defect with its count.
 *
 *    cd functions && node --test __tests__/market-intel/integrity.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { auditMarketIntel, hasDefects, renderReport, AUDITED_COLLECTION_IDS } = require(
  path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'marketIntelIntegrity.cjs'),
);

const ts = { toDate: () => new Date('2026-10-29T09:00:00.000Z') };

function cleanWorld() {
  return {
    competitors: [{ id: 'acme', data: { name: 'Acme', subsidiariesCompeting: ['zeus-the-agency'], archived: true, archivedAt: '2026-10-29T09:00:00.000Z' } }],
    competitor_swot: [{ id: 's1', data: { competitorId: 'acme' } }],
    competitive_moves: [{ id: 'm1', data: { competitorId: 'acme', impactedSubsidiaries: ['zeus-the-agency', 'odd-gorilla'] } }],
    win_loss_records: [{ id: 'w1', data: { competitorId: 'acme', subsidiaryId: 'labyrinth' } }],
    digital_profiles: [{ id: 'p1', data: { competitorId: 'acme' } }, { id: 'p2', data: { competitorId: 'OWN_zeus-digital_a1' } }],
    social_posts: [{ id: 'instagram_C1', data: { competitorId: 'acme', platform: 'instagram', postId: 'C1', contentText: 'hello', likes: 3 } }],
    social_metrics: [{ id: 'mt1', data: { competitorId: 'acme', followers: 120, following: 10, totalPosts: 40 } }],
    tracked_topics: [{ id: 't1', data: { relatedCompetitorIds: ['acme'] } }],
    ai_insights: [{ id: 'i1', data: { competitorIds: ['acme'] } }],
    market_intelligence_reports: [{ id: 'r1', data: { title: 'T', reportTitle: 'T', reportType: 'ai_scan', subsidiaryId: 'zeus-digital', generatedAt: ts, source: 'ai_scan', organizationId: 'default' } }],
  };
}

test('the audited list is the owned collections followed by the retired ones', () => {
  assert.equal(AUDITED_COLLECTION_IDS[0], 'competitors');
  assert.ok(AUDITED_COLLECTION_IDS.includes('market_insights'));
  assert.equal(new Set(AUDITED_COLLECTION_IDS).size, AUDITED_COLLECTION_IDS.length);
});

test('a clean world: counts, vocabulary distribution, sentinels noted, no defects', () => {
  const r = auditMarketIntel(cleanWorld(), { measuredAt: '2026-10-29T09:00:00.000Z' });
  assert.equal(hasDefects(r), false);
  assert.equal(r.summary.totalDocs, 11);
  assert.equal(r.collections.competitors.docs, 1);
  assert.equal(r.collections.market_insights.docs, 0);
  assert.equal(r.collections.market_insights.retired, true);
  assert.deepEqual(r.vocabulary.competitive_moves, { field: 'impactedSubsidiaries', values: { 'zeus-the-agency': 1, 'odd-gorilla': 1 } });
  assert.deepEqual(r.sentinels, { digital_profiles: 1 });
  assert.deepEqual(r.vocabulary.market_intelligence_reports.shapes, { generatedAtString: 0, generatedAtTimestamp: 1, titleOnly: 0, reportTitleOnly: 0, both: 1, neither: 0 });
  assert.match(renderReport(r), /Defects: none/);
});

test('an empty world (ZeusOS on 2026-10-29) has zero documents and zero defects', () => {
  const r = auditMarketIntel({});
  assert.equal(r.summary.totalDocs, 0);
  assert.equal(r.summary.collectionsPresent, 0);
  assert.equal(hasDefects(r), false);
});

test('a dirty world names every defect with its count', () => {
  const r = auditMarketIntel({
    competitors: [
      { id: 'c1', data: { subsidiariesCompeting: ['finishes'] } },
      { id: 'c2', data: { subsidiariesCompeting: [], archived: true } },
    ],
    competitor_swot: [{ id: 's1', data: { competitorId: 'gone' } }, { id: 's2', data: { competitorId: '' } }],
    win_loss_records: [{ id: 'w1', data: { competitorId: 'c1', dawinSubsidiary: 'finishes' } }],
    social_posts: [
      { id: 'auto1', data: { competitorId: 'c1', platform: 'twitter', postId: 'tw_1700000000000_0.5', contentText: '' } },
      { id: 'twitter_9', data: { competitorId: 'c1', platform: 'twitter', postId: '9', contentText: 'ok' } },
    ],
    social_metrics: [{ id: 'z', data: { competitorId: 'c1', followers: 0 } }],
    tracked_topics: [{ id: 't1', data: { relatedCompetitorIds: ['gone'] } }],
    market_intelligence_reports: [{ id: 'r1', data: { reportTitle: 'old', generatedAt: 'ISO date string', subsidiaryId: 'advisory' } }],
    market_insights: [{ id: 'x', data: {} }],
    profile_snapshots: [{ id: 'y', data: {} }],
  });
  const byCode = Object.fromEntries(r.defects.map((d) => [`${d.code}@${d.collection}`, d.count]));
  assert.deepEqual(byCode, {
    'retired_collection_present@market_insights': 1,
    'retired_collection_present@profile_snapshots': 1,
    'unknown_subsidiary_id@competitors': 1,
    'missing_subsidiary_scope@competitors': 1,
    'missing_subsidiary_scope@win_loss_records': 1,
    'unknown_subsidiary_id@market_intelligence_reports': 1,
    'legacy_subsidiary_field@win_loss_records': 1,
    'orphan_competitor_ref@competitor_swot': 2,
    'dangling_competitor_reference@tracked_topics': 1,
    'archived_without_stamp@competitors': 1,
    'synthetic_post_id@social_posts': 1,
    'empty_social_post@social_posts': 1,
    'social_post_doc_id_not_natural@social_posts': 1,
    'zero_follower_metrics@social_metrics': 1,
    'report_missing_title@market_intelligence_reports': 1,
    'report_missing_type@market_intelligence_reports': 1,
    'report_generated_at_not_timestamp@market_intelligence_reports': 1,
    'report_organization_not_default@market_intelligence_reports': 1,
  });
  assert.equal(hasDefects(r), true);
  assert.equal(r.vocabulary.competitors.values['(none)'], 1);
  assert.match(renderReport(r), /unknown_subsidiary_id\s+competitors\s+1/);
  const samples = r.defects.find((d) => d.code === 'orphan_competitor_ref').sample;
  assert.deepEqual(samples, ['s1', 's2']);
});
