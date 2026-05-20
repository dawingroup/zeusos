// ============================================================================
// MARKET DATA HOOK
// DawinOS v2.0 - Market Intelligence Module
// Hook for market analysis and industry data (Firestore-backed)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { MarketData, IndustryTrend } from '../types';
import { TrendDirection, SentimentLevel } from '../constants';

const ANALYSES_COLLECTION = 'market_analyses';

interface MarketSegment {
  id: string;
  name: string;
  description?: string;
  sizeUSD: number;
  growthRate: number;
  share: number;
  competitorCount: number;
  concentration: 'high' | 'medium' | 'low';
  attractivenessScore: number;
  entryBarriers: 'high' | 'medium' | 'low';
}

interface UgandaIndicator {
  id: string;
  key: string;
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  unit: string;
  date: string;
}

interface KeyPlayer {
  name: string;
  marketShare: number;
}

interface UseMarketDataOptions {
  sector?: string;
  timeRange?: '30d' | '90d' | '1y' | '3y';
}

interface UseMarketDataReturn {
  marketData: MarketData | null;
  segments: MarketSegment[];
  trends: IndustryTrend[];
  ugandaIndicators: UgandaIndicator[];
  keyPlayers: KeyPlayer[];
  opportunities: string[];
  threats: string[];
  loading: boolean;
  analyzing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  analyze: () => Promise<boolean>;
}

export const useMarketData = ({
  sector,
  timeRange = '1y',
}: UseMarketDataOptions = {}): UseMarketDataReturn => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [segments, setSegments] = useState<MarketSegment[]>([]);
  const [trends, setTrends] = useState<IndustryTrend[]>([]);
  const [ugandaIndicators, setUgandaIndicators] = useState<UgandaIndicator[]>([]);
  const [keyPlayers, setKeyPlayers] = useState<KeyPlayer[]>([]);
  const [opportunities, setOpportunities] = useState<string[]>([]);
  const [threats, setThreats] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch latest analysis for this sector from Firestore
      const q = query(
        collection(db, ANALYSES_COLLECTION),
        where('sector', '==', sector || 'general business'),
        orderBy('analyzedAt', 'desc'),
        firestoreLimit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // No analysis yet — leave everything empty, user can trigger one
        setMarketData(null);
        setSegments([]);
        setTrends([]);
        setUgandaIndicators([]);
        setKeyPlayers([]);
        setOpportunities([]);
        setThreats([]);
        return;
      }

      const analysisDoc = snapshot.docs[0];
      const data = analysisDoc.data();

      // Map to MarketData type
      if (data.marketData) {
        const md = data.marketData;
        setMarketData({
          id: analysisDoc.id,
          sector: md.sector || sector || 'general business',
          region: md.region || 'East Africa',
          marketSizeUSD: md.marketSizeUSD || 0,
          marketSizeUGX: (md.marketSizeUSD || 0) * 3700,
          growthRate: md.growthRate || 0,
          projectedGrowthRate: md.projectedGrowthRate || 0,
          trend: (md.trend || 'stable') as TrendDirection,
          sentiment: (md.sentiment || 'neutral') as SentimentLevel,
          period: md.period || new Date().getFullYear().toString(),
          periodStart: md.periodStart || `${new Date().getFullYear()}-01-01`,
          periodEnd: md.periodEnd || `${new Date().getFullYear()}-12-31`,
          sources: md.sources || ['ai_analysis'],
          confidence: md.confidence || 0.5,
          updatedAt: data.analyzedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        });
      }

      // Map segments
      if (data.segments?.length) {
        setSegments(data.segments.map((s: any, idx: number) => ({
          id: String(idx + 1),
          name: s.name || '',
          description: s.description || '',
          sizeUSD: s.sizeUSD || 0,
          growthRate: s.growthRate || 0,
          share: s.share || 0,
          competitorCount: s.competitorCount || 0,
          concentration: s.concentration || 'medium',
          attractivenessScore: s.attractivenessScore || 50,
          entryBarriers: s.entryBarriers || 'medium',
        })));
      }

      // Map trends
      if (data.trends?.length) {
        setTrends(data.trends.map((t: any, idx: number) => ({
          id: String(idx + 1),
          title: t.title || '',
          description: t.description || '',
          sector: t.sector || sector,
          direction: (t.direction || 'up') as TrendDirection,
          strength: t.strength || 50,
          maturity: t.maturity || 'emerging',
          impactLevel: t.impactLevel || 'moderate',
          affectedSegments: t.affectedSegments || [],
          timeframe: t.timeframe || 'medium_term',
          sources: [],
          identifiedAt: new Date().toISOString(),
          confidence: t.confidence || 0.5,
        })));
      }

      // Map indicators
      if (data.indicators?.length) {
        setUgandaIndicators(data.indicators.map((ind: any, idx: number) => ({
          id: String(idx + 1),
          key: ind.key || '',
          label: ind.label || '',
          value: ind.value || 0,
          previousValue: ind.previousValue,
          change: ind.change,
          unit: ind.unit || '',
          date: ind.date || '',
        })));
      }

      // Key players, opportunities, threats
      if (data.keyPlayers?.length) setKeyPlayers(data.keyPlayers);
      if (data.opportunities?.length) setOpportunities(data.opportunities);
      if (data.threats?.length) setThreats(data.threats);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch market data'));
    } finally {
      setLoading(false);
    }
  }, [sector, timeRange]);

  const analyze = useCallback(async (): Promise<boolean> => {
    try {
      setAnalyzing(true);
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const analyzeFn = httpsCallable(functions, 'analyzeMarketSector');

      const result = await analyzeFn({ sector: sector || 'general business', region: 'Uganda and East Africa' });
      const data = result.data as { success: boolean };

      if (data.success) {
        await fetchMarketData();
      }
      return data.success;
    } catch (err) {
      console.error('Market analysis error:', err);
      return false;
    } finally {
      setAnalyzing(false);
    }
  }, [sector, fetchMarketData]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return {
    marketData,
    segments,
    trends,
    ugandaIndicators,
    keyPlayers,
    opportunities,
    threats,
    loading,
    analyzing,
    error,
    refresh: fetchMarketData,
    analyze,
  };
};

export default useMarketData;
