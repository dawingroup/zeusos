// ============================================================================
// USE COMPETITOR DETAIL HOOK
// ZeusOS v2.0 - Market Intelligence Module
// Fetches competitor profile, SWOT, and competitive moves for detail page
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  competitorService,
  swotService,
  competitiveMoveService,
} from '../services/competitorService';
import {
  Competitor,
  SWOTAnalysis,
  CompetitiveMove,
} from '../types/competitor.types';
import { CompetitorActivity } from '../types';

// --------------------------------------------------------------------------
// Mapping helpers
// --------------------------------------------------------------------------

const MOVE_TYPE_TO_ACTIVITY_TYPE: Record<string, CompetitorActivity['activityType']> = {
  product_launch: 'product_launch',
  technology_launch: 'product_launch',
  funding_round: 'funding',
  partnership: 'partnership',
  talent_hire: 'hiring',
  expansion: 'expansion',
  market_entry: 'expansion',
  market_exit: 'news',
  acquisition: 'news',
  price_change: 'news',
  leadership_change: 'news',
  restructuring: 'news',
  marketing_campaign: 'social',
  regulatory_filing: 'news',
  ipo: 'funding',
};

const SIGNIFICANCE_TO_IMPACT: Record<string, 'high' | 'medium' | 'low'> = {
  transformative: 'high',
  major: 'high',
  significant: 'high',
  moderate: 'medium',
  minor: 'low',
  negligible: 'low',
};

function mapMoveToActivity(move: CompetitiveMove): CompetitorActivity {
  return {
    id: move.id,
    competitorId: move.competitorId,
    activityType: MOVE_TYPE_TO_ACTIVITY_TYPE[move.moveType] || 'other',
    title: move.title,
    description: move.description,
    date: move.dateObserved.toDate().toISOString(),
    source: 'news',
    sentiment: 'neutral',
    impact: SIGNIFICANCE_TO_IMPACT[move.impactSignificance] || 'medium',
    tags: [
      ...(move.impactedIndustries || []),
      ...(move.impactedMarkets || []),
    ],
  };
}

function computeDataConfidence(
  competitor: Competitor,
  swotAnalysis: SWOTAnalysis | null,
  movesCount: number,
): number {
  let score = 0;

  // Has meaningful description
  if (competitor.description && competitor.description.length > 20) {
    score += 0.15;
  }

  // Has financial data
  if (competitor.estimatedRevenue || competitor.estimatedMarketShare) {
    score += 0.15;
  }

  // Has SWOT analysis
  if (swotAnalysis) {
    score += 0.25;
  }

  // Has intelligence sources
  if (competitor.intelligenceSources?.length > 0) {
    score += Math.min(0.15, competitor.intelligenceSources.length * 0.05);
  }

  // Has tracked moves
  if (movesCount > 0) {
    score += 0.15;
  }

  // Has social profiles / digital presence
  if (
    competitor.socialProfiles &&
    Object.values(competitor.socialProfiles).some(v => !!v)
  ) {
    score += 0.1;
  }

  // Has key executives
  if (competitor.keyExecutives?.length > 0) {
    score += 0.05;
  }

  return Math.min(1, score);
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

interface UseCompetitorDetailReturn {
  competitor: Competitor | null;
  swotAnalysis: SWOTAnalysis | null;
  activities: CompetitorActivity[];
  recentMoveCount: number;
  dataConfidence: number;
  loading: boolean;
  swotLoading: boolean;
  movesLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCompetitorDetail(
  competitorId: string | undefined,
): UseCompetitorDetailReturn {
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [swotAnalysis, setSwotAnalysis] = useState<SWOTAnalysis | null>(null);
  const [activities, setActivities] = useState<CompetitorActivity[]>([]);
  const [recentMoveCount, setRecentMoveCount] = useState(0);
  const [dataConfidence, setDataConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swotLoading, setSwotLoading] = useState(true);
  const [movesLoading, setMovesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!competitorId) {
      setLoading(false);
      setSwotLoading(false);
      setMovesLoading(false);
      return;
    }

    setLoading(true);
    setSwotLoading(true);
    setMovesLoading(true);
    setError(null);

    try {
      // Fetch competitor document first
      const comp = await competitorService.getCompetitor(competitorId);
      setCompetitor(comp);
      setLoading(false);

      if (!comp) {
        setSwotLoading(false);
        setMovesLoading(false);
        return;
      }

      // Fetch SWOT and moves in parallel
      const [latestSwot, moves] = await Promise.all([
        swotService.getLatestSWOT(competitorId).catch(() => null),
        competitiveMoveService
          .getMoves({ competitorId })
          .catch(() => [] as CompetitiveMove[]),
      ]);

      setSwotAnalysis(latestSwot);
      setSwotLoading(false);

      const mapped = moves.map(mapMoveToActivity);
      setActivities(mapped);
      setMovesLoading(false);

      // Count moves in last 30 days
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = moves.filter(
        m => m.dateObserved.toDate().getTime() > thirtyDaysAgo,
      );
      setRecentMoveCount(recent.length);

      // Compute data confidence
      setDataConfidence(computeDataConfidence(comp, latestSwot, moves.length));
    } catch (err) {
      console.error('Error fetching competitor detail:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load competitor',
      );
      setLoading(false);
      setSwotLoading(false);
      setMovesLoading(false);
    }
  }, [competitorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    competitor,
    swotAnalysis,
    activities,
    recentMoveCount,
    dataConfidence,
    loading,
    swotLoading,
    movesLoading,
    error,
    refresh: fetchData,
  };
}
