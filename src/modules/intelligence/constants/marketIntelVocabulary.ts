/**
 * Market Intelligence VOCABULARY — client twin of
 * functions/src/lib/marketIntelVocabulary.js
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, D-1 / D-13).
 *
 * Until 2026-10 the module spoke DawinOS (`finishes | advisory | technology |
 * capital`) on the scan type, the subsidiary picker, every
 * `subsidiariesCompeting[]` / `impactedSubsidiaries[]` field and the MCP
 * enum — none of which is a ZeusOS SubsidiaryId. Market intelligence now
 * uses the CANONICAL ids: the five operating brands. The parent
 * (`zeus-group`) never competes, so it is not a market-intel scope.
 *
 * Pinned field-for-field to the server file by
 * src/modules/intelligence/__tests__/marketIntelVocabulary.lockstep.test.ts.
 * Change both together.
 */
import type { SubsidiaryId } from '@/core/settings/types';

/** The five operating brands, in registry order (= BRAND_CAPABILITIES keys). */
export const MARKET_INTEL_SUBSIDIARY_IDS = [
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
] as const satisfies readonly SubsidiaryId[];

export type MarketIntelSubsidiaryId = (typeof MARKET_INTEL_SUBSIDIARY_IDS)[number];

export interface MarketIntelSubsidiaryContext {
  name: string;
  description: string;
  industries: readonly string[];
  competitorKeywords: readonly string[];
}

/** What each brand competes as — the AI scan's research brief (server twin runs the scan). */
export const MARKET_INTEL_SUBSIDIARY_CONTEXT: Record<MarketIntelSubsidiaryId, MarketIntelSubsidiaryContext> = {
  'zeus-the-agency': {
    name: 'Zeus The Agency',
    description:
      'Full-service 360° advertising agency — creative, below-the-line activation, digital, PR, media and production — for brands in Uganda and East Africa.',
    industries: ['advertising', 'marketing', 'media', 'public_relations', 'events'],
    competitorKeywords: [
      'advertising agency', 'creative agency', 'integrated marketing agency',
      'brand campaign', 'BTL activation agency', 'PR agency', 'media agency',
    ],
  },
  'zeus-digital': {
    name: 'Zeus Digital',
    description:
      'Digital-first marketing — content, SEM/SEO, influencer, programmatic media buying and innovation — for brands in Uganda and East Africa.',
    industries: ['digital', 'marketing', 'media', 'technology'],
    competitorKeywords: [
      'digital marketing agency', 'social media agency', 'performance marketing',
      'SEO agency', 'influencer marketing agency', 'programmatic media buying', 'content studio',
    ],
  },
  labyrinth: {
    name: 'Labyrinth Audio & Visual Content Studio',
    description:
      'Audio and visual content production — sound, photography, podcast, film and documentary — for brands, broadcasters and agencies in East Africa.',
    industries: ['media', 'production', 'film', 'audio', 'photography'],
    competitorKeywords: [
      'production house', 'film production company', 'post-production studio',
      'podcast studio', 'commercial photography studio', 'audio production studio', 'video content agency',
    ],
  },
  'odd-gorilla': {
    name: 'Odd Gorilla',
    description:
      "Independent 360° creative agency — creative, BTL, digital, PR, media and production — operated as the group's conflict-firewalled sibling for competing accounts.",
    industries: ['advertising', 'marketing', 'media', 'public_relations', 'events'],
    competitorKeywords: [
      'independent creative agency', 'advertising agency', 'boutique creative shop',
      'brand activation', 'PR agency', 'media agency',
    ],
  },
  'house-of-zeus': {
    name: 'House of Zeus',
    description:
      '360° advertising agency — creative, BTL, digital, PR, media and production — serving Kenya and the wider East African market from Nairobi.',
    industries: ['advertising', 'marketing', 'media', 'public_relations', 'events'],
    competitorKeywords: [
      'advertising agency Kenya', 'creative agency Nairobi', 'integrated marketing agency Kenya',
      'brand activation Kenya', 'PR agency Nairobi', 'media agency Kenya',
    ],
  },
};

export function isMarketIntelSubsidiaryId(value: unknown): value is MarketIntelSubsidiaryId {
  return typeof value === 'string' && (MARKET_INTEL_SUBSIDIARY_IDS as readonly string[]).includes(value);
}

/** Known ids only, trimmed, de-duplicated, registry order. */
export function normalizeSubsidiaryIds(list: unknown): MarketIntelSubsidiaryId[] {
  if (!Array.isArray(list)) return [];
  const hit = new Set<MarketIntelSubsidiaryId>();
  for (const raw of list) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (isMarketIntelSubsidiaryId(id)) hit.add(id);
  }
  return MARKET_INTEL_SUBSIDIARY_IDS.filter((s) => hit.has(s));
}

export function subsidiaryNameOf(id: string): string | null {
  return isMarketIntelSubsidiaryId(id) ? MARKET_INTEL_SUBSIDIARY_CONTEXT[id].name : null;
}

/** Picker rows for the scan page and any brand filter. */
export const MARKET_INTEL_SUBSIDIARY_OPTIONS: ReadonlyArray<{ id: MarketIntelSubsidiaryId; name: string; description: string }> =
  MARKET_INTEL_SUBSIDIARY_IDS.map((id) => ({
    id,
    name: MARKET_INTEL_SUBSIDIARY_CONTEXT[id].name,
    description: MARKET_INTEL_SUBSIDIARY_CONTEXT[id].description,
  }));

/** The collections the market-intelligence module OWNS (D-13) — the rules carry one block each. */
export const MARKET_INTEL_COLLECTION_IDS = [
  'competitors',
  'competitor_swot',
  'competitive_moves',
  'win_loss_records',
  'digital_profiles',
  'social_posts',
  'social_metrics',
  'tracked_topics',
  'topic_mentions',
  'news_articles',
  'ai_insights',
  'market_analyses',
  'market_intelligence_reports',
] as const;

export type MarketIntelCollectionId = (typeof MARKET_INTEL_COLLECTION_IDS)[number];

/** Retired by the audit (D-5): no route, no writer, no document, no rules block. Never read or write these. */
export const RETIRED_MARKET_INTEL_COLLECTIONS = [
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
] as const;
