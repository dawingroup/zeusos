// ============================================================================
// USE INTELLIGENCE DASHBOARD HOOK
// DawinOS v2.0 - Market Intelligence Module
// Dashboard data fetching from Firestore
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
import { IntelligenceDashboard, Insight, NewsArticle, CompetitorActivity } from '../types';
import { SentimentLevel, TrendDirection } from '../constants';
import { competitorService, competitiveMoveService } from '../services/competitorService';
import { topicTrackingService } from '../services/topicTrackingService';

// --------------------------------------------------------------------------
// Mapping helpers
// --------------------------------------------------------------------------

function mapMoveTypeToActivityType(
  moveType: string,
): CompetitorActivity['activityType'] {
  const map: Record<string, CompetitorActivity['activityType']> = {
    product_launch: 'product_launch',
    technology_launch: 'product_launch',
    funding_round: 'funding',
    partnership: 'partnership',
    talent_hire: 'hiring',
    expansion: 'expansion',
    market_entry: 'expansion',
  };
  return map[moveType] || 'other';
}

function mapImpactSignificance(
  significance: string,
): 'high' | 'medium' | 'low' {
  if (['transformative', 'major', 'significant'].includes(significance))
    return 'high';
  if (significance === 'moderate') return 'medium';
  return 'low';
}

function mapTopicTrend(trendDirection: string): TrendDirection {
  const map: Record<string, TrendDirection> = {
    rising: 'up',
    stable: 'flat',
    declining: 'down',
    up: 'up',
    strong_up: 'strong_up',
    flat: 'flat',
    down: 'down',
    strong_down: 'strong_down',
  };
  return map[trendDirection] || 'flat';
}

// --------------------------------------------------------------------------
// Hook
// --------------------------------------------------------------------------

interface UseIntelligenceDashboardReturn {
  dashboard: IntelligenceDashboard | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  lastRefresh: string | null;
}

export const useIntelligenceDashboard =
  (): UseIntelligenceDashboardReturn => {
    const [dashboard, setDashboard] =
      useState<IntelligenceDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lastRefresh, setLastRefresh] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        // Parallel fetch all data sources
        const [
          competitors,
          recentMoves,
          insightsSnapshot,
          newsSnapshot,
          activeTopics,
        ] = await Promise.all([
          competitorService
            .getCompetitors({ status: 'active' })
            .catch(() => []),
          competitiveMoveService.getRecentMoves(7).catch(() => []),
          getDocs(
            query(
              collection(db, 'ai_insights'),
              where('status', 'in', ['new', 'reviewed']),
              orderBy('createdAt', 'desc'),
              firestoreLimit(10),
            ),
          ).catch(() => null),
          getDocs(
            query(
              collection(db, 'news_articles'),
              orderBy('publishedAt', 'desc'),
              firestoreLimit(20),
            ),
          ).catch(() => null),
          topicTrackingService.getActiveTopics().catch(() => []),
        ]);

        // Parse insights from Firestore
        const recentInsights: Insight[] = insightsSnapshot
          ? insightsSnapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
            }) as Insight)
          : [];

        // Parse news from Firestore
        const allNews: NewsArticle[] = newsSnapshot
          ? newsSnapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
            }) as NewsArticle)
          : [];
        const unreadNews = allNews.filter(n => !n.isRead);

        // Map recent competitive moves to CompetitorActivity for alerts
        const competitorAlerts: CompetitorActivity[] = recentMoves
          .slice(0, 10)
          .map(move => ({
            id: move.id,
            competitorId: move.competitorId,
            activityType: mapMoveTypeToActivityType(move.moveType),
            title: move.title,
            description: move.description,
            date: move.dateObserved.toDate().toISOString(),
            source: 'news' as const,
            sentiment: 'neutral' as SentimentLevel,
            impact: mapImpactSignificance(move.impactSignificance),
            tags: [],
          }));

        // Count alerts from today
        const today = new Date();
        const alertsToday = recentMoves.filter(m => {
          const moveDate = m.dateObserved.toDate();
          return moveDate.toDateString() === today.toDateString();
        }).length;

        // Map topic trends from tracked topics
        const topicTrends = activeTopics.slice(0, 10).map(topic => ({
          topic: topic.name,
          mentions: topic.totalMentions || 0,
          trend: mapTopicTrend(topic.trendDirection),
        }));

        // Compute overall sentiment from recent news
        const sentimentScores = allNews
          .map(n => n.sentimentScore || 0)
          .filter(s => s !== 0);
        const avgSentiment =
          sentimentScores.length > 0
            ? sentimentScores.reduce((a, b) => a + b, 0) /
              sentimentScores.length
            : 0;
        const overallSentiment: SentimentLevel =
          avgSentiment > 0.3
            ? 'positive'
            : avgSentiment < -0.3
              ? 'negative'
              : 'neutral';
        const sentimentTrend: TrendDirection =
          avgSentiment > 0.1
            ? 'up'
            : avgSentiment < -0.1
              ? 'down'
              : 'flat';

        const dashboardData: IntelligenceDashboard = {
          trackedCompetitors: competitors.length,
          activeInsights: recentInsights.filter(i => i.status === 'new')
            .length,
          unreadNews: unreadNews.length,
          alertsToday,
          recentInsights,
          recentNews: allNews.slice(0, 10),
          competitorAlerts,
          marketTrends: [],
          topicTrends,
          overallSentiment,
          sentimentTrend,
          lastRefresh: new Date().toISOString(),
        };

        setDashboard(dashboardData);
        setLastRefresh(new Date().toISOString());
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch dashboard'),
        );
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchDashboard();
    }, [fetchDashboard]);

    return {
      dashboard,
      loading,
      error,
      refresh: fetchDashboard,
      lastRefresh,
    };
  };

export default useIntelligenceDashboard;
