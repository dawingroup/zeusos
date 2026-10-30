/**
 * Market Intelligence VOCABULARY — the one registry of which subsidiaries a
 * market-intelligence record may name, what each brand competes as, and
 * which collections the module owns
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, D-1 / D-3 / D-13).
 *
 * Until 2026-10 the module spoke DawinOS: `finishes | advisory | technology |
 * capital` on the client type, the scan's SUBSIDIARY_CONTEXT, the MCP enum
 * and every `subsidiariesCompeting[]` / `impactedSubsidiaries[]` field. None
 * of those is a ZeusOS SubsidiaryId, so a scan could only be run "for" a
 * company that does not exist. Market intelligence now uses the CANONICAL
 * ids from src/core/settings/types.ts — the five operating brands. The
 * parent (`zeus-group`) never competes, so it is not a market-intel scope.
 *
 * Pure CJS, no Firebase — the client twin
 * (src/modules/intelligence/constants/marketIntelVocabulary.ts) is pinned to
 * this file by src/modules/intelligence/__tests__/marketIntelVocabulary.lockstep.test.ts,
 * and scripts/audit-market-intel-integrity.cjs reads the collection registry
 * from here so the audit and the code can never disagree about what exists.
 */
'use strict';

/** The five operating brands, in registry order (= BRAND_CAPABILITIES keys). */
const MARKET_INTEL_SUBSIDIARY_IDS = Object.freeze([
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
]);

/**
 * What each brand competes as — the AI scan's research brief. `industries`
 * are matched against `competitors.industries[]` when a competitor is not
 * explicitly linked to the brand; `competitorKeywords` seed web discovery.
 */
const SUBSIDIARY_CONTEXT = Object.freeze({
  'zeus-the-agency': Object.freeze({
    name: 'Zeus The Agency',
    description:
      'Full-service 360° advertising agency — creative, below-the-line activation, digital, PR, media and production — for brands in Uganda and East Africa.',
    industries: Object.freeze(['advertising', 'marketing', 'media', 'public_relations', 'events']),
    competitorKeywords: Object.freeze([
      'advertising agency', 'creative agency', 'integrated marketing agency',
      'brand campaign', 'BTL activation agency', 'PR agency', 'media agency',
    ]),
  }),
  'zeus-digital': Object.freeze({
    name: 'Zeus Digital',
    description:
      'Digital-first marketing — content, SEM/SEO, influencer, programmatic media buying and innovation — for brands in Uganda and East Africa.',
    industries: Object.freeze(['digital', 'marketing', 'media', 'technology']),
    competitorKeywords: Object.freeze([
      'digital marketing agency', 'social media agency', 'performance marketing',
      'SEO agency', 'influencer marketing agency', 'programmatic media buying', 'content studio',
    ]),
  }),
  labyrinth: Object.freeze({
    name: 'Labyrinth Audio & Visual Content Studio',
    description:
      'Audio and visual content production — sound, photography, podcast, film and documentary — for brands, broadcasters and agencies in East Africa.',
    industries: Object.freeze(['media', 'production', 'film', 'audio', 'photography']),
    competitorKeywords: Object.freeze([
      'production house', 'film production company', 'post-production studio',
      'podcast studio', 'commercial photography studio', 'audio production studio', 'video content agency',
    ]),
  }),
  'odd-gorilla': Object.freeze({
    name: 'Odd Gorilla',
    description:
      "Independent 360° creative agency — creative, BTL, digital, PR, media and production — operated as the group's conflict-firewalled sibling for competing accounts.",
    industries: Object.freeze(['advertising', 'marketing', 'media', 'public_relations', 'events']),
    competitorKeywords: Object.freeze([
      'independent creative agency', 'advertising agency', 'boutique creative shop',
      'brand activation', 'PR agency', 'media agency',
    ]),
  }),
  'house-of-zeus': Object.freeze({
    name: 'House of Zeus',
    description:
      '360° advertising agency — creative, BTL, digital, PR, media and production — serving Kenya and the wider East African market from Nairobi.',
    industries: Object.freeze(['advertising', 'marketing', 'media', 'public_relations', 'events']),
    competitorKeywords: Object.freeze([
      'advertising agency Kenya', 'creative agency Nairobi', 'integrated marketing agency Kenya',
      'brand activation Kenya', 'PR agency Nairobi', 'media agency Kenya',
    ]),
  }),
});

function isMarketIntelSubsidiaryId(value) {
  return typeof value === 'string' && MARKET_INTEL_SUBSIDIARY_IDS.includes(value);
}

/** Known ids only, trimmed, de-duplicated, registry order. */
function normalizeSubsidiaryIds(list) {
  if (!Array.isArray(list)) return [];
  const hit = new Set();
  for (const raw of list) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (isMarketIntelSubsidiaryId(id)) hit.add(id);
  }
  return MARKET_INTEL_SUBSIDIARY_IDS.filter((s) => hit.has(s));
}

function subsidiaryNameOf(id) {
  const ctx = SUBSIDIARY_CONTEXT[id];
  return ctx ? ctx.name : null;
}

/**
 * The collections the market-intelligence module OWNS (D-13). Every writer,
 * rule block, index and the integrity audit key off this list.
 *   subsidiaryField  — the field that scopes the doc to a brand, and whether
 *                      it is an array of ids or a single id
 *   competitorField  — the FK to `competitors`; a hard delete of a competitor
 *                      cascades through these (D-3)
 */
const MARKET_INTEL_COLLECTIONS = Object.freeze([
  Object.freeze({ id: 'competitors', subsidiaryField: 'subsidiariesCompeting', subsidiaryFieldKind: 'array' }),
  Object.freeze({ id: 'competitor_swot', competitorField: 'competitorId' }),
  Object.freeze({ id: 'competitive_moves', competitorField: 'competitorId', subsidiaryField: 'impactedSubsidiaries', subsidiaryFieldKind: 'array' }),
  Object.freeze({ id: 'win_loss_records', competitorField: 'competitorId', subsidiaryField: 'subsidiaryId', subsidiaryFieldKind: 'string' }),
  Object.freeze({ id: 'digital_profiles', competitorField: 'competitorId' }),
  Object.freeze({ id: 'social_posts', competitorField: 'competitorId' }),
  Object.freeze({ id: 'social_metrics', competitorField: 'competitorId' }),
  Object.freeze({ id: 'tracked_topics' }),
  Object.freeze({ id: 'topic_mentions' }),
  Object.freeze({ id: 'news_articles' }),
  Object.freeze({ id: 'ai_insights' }),
  Object.freeze({ id: 'market_analyses' }),
  Object.freeze({ id: 'market_intelligence_reports', subsidiaryField: 'subsidiaryId', subsidiaryFieldKind: 'string' }),
]);

const MARKET_INTEL_COLLECTION_IDS = Object.freeze(MARKET_INTEL_COLLECTIONS.map((c) => c.id));

/** Child collections a competitor hard-delete removes (rows keyed by `competitorField`). */
const COMPETITOR_CHILD_COLLECTIONS = Object.freeze(
  MARKET_INTEL_COLLECTIONS.filter((c) => c.competitorField),
);

/** Array fields on other records that merely REFERENCE a competitor — detached, not deleted. */
const COMPETITOR_REFERENCE_ARRAYS = Object.freeze([
  Object.freeze({ id: 'tracked_topics', field: 'relatedCompetitorIds' }),
  Object.freeze({ id: 'ai_insights', field: 'competitorIds' }),
]);

/**
 * `competitorId` values that are NOT foreign keys (B2): the marketing bridge
 * stamps the group's own accounts `OWN_<subsidiaryId>_<accountId>` so the
 * scraper's required-field check passes. A join must skip these.
 */
const COMPETITOR_ID_SENTINEL_PREFIXES = Object.freeze(['OWN_', 'CANDIDATE_']);

function isCompetitorIdSentinel(value) {
  return typeof value === 'string' && COMPETITOR_ID_SENTINEL_PREFIXES.some((p) => value.startsWith(p));
}

/**
 * Collections retired by the audit (D-5): no route, no writer, no document.
 * Their rules blocks and indexes are gone; the audit script reports any
 * document that still appears in one so a stray writer is caught.
 */
const RETIRED_MARKET_INTEL_COLLECTIONS = Object.freeze([
  'market_insights',
  'market_intelligence_insights',
  'market_intelligence_dashboards',
  'market_intelligence_widgets',
  'market_intelligence_data_sources',
  'market_intelligence_analytics',
  'market_intelligence_action_items',
  'market_intelligence_report_schedules',
  'market_share_data',
  'pricing_intelligence',
  'market_signals',
  'market_reports',
  'intelligence_items',
  'swot_analyses',
  'profile_snapshots',
  'environment_signals',
  'pestel_analyses',
  'scenarios',
  'regulatory_items',
  'tracked_indicators',
  'early_warning_alerts',
  'alert_triggers',
]);

module.exports = {
  MARKET_INTEL_SUBSIDIARY_IDS,
  SUBSIDIARY_CONTEXT,
  isMarketIntelSubsidiaryId,
  normalizeSubsidiaryIds,
  subsidiaryNameOf,
  MARKET_INTEL_COLLECTIONS,
  MARKET_INTEL_COLLECTION_IDS,
  COMPETITOR_CHILD_COLLECTIONS,
  COMPETITOR_REFERENCE_ARRAYS,
  COMPETITOR_ID_SENTINEL_PREFIXES,
  isCompetitorIdSentinel,
  RETIRED_MARKET_INTEL_COLLECTIONS,
};
