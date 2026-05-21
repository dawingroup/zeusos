// ============================================================================
// USE SOCIAL INTELLIGENCE HOOK
// ZeusOS v2.0 - Market Intelligence Module
// React hook for social media tracking data and actions
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { socialIntelligenceService } from '../services/socialIntelligenceService';
import {
  SocialPost,
  SocialMetrics,
  SocialPlatform,
  SocialAnalysisResult,
} from '../types/socialIntelligence.types';

interface UseSocialIntelligenceOptions {
  competitorId?: string;
  platform?: SocialPlatform;
  limit?: number;
}

interface UseSocialIntelligenceReturn {
  // Data
  posts: SocialPost[];
  metrics: SocialMetrics[];
  // State
  loading: boolean;
  error: string | null;
  syncing: boolean;
  analyzing: boolean;
  fetchingPosts: boolean;
  // Actions
  refresh: () => Promise<void>;
  fetchPosts: (profileId: string) => Promise<void>;
  analyzeStrategy: (postIds: string[], competitorName: string) => Promise<SocialAnalysisResult | null>;
  triggerSync: (competitorId?: string) => Promise<void>;
}

export function useSocialIntelligence(
  options: UseSocialIntelligenceOptions = {}
): UseSocialIntelligenceReturn {
  const { competitorId, platform, limit } = options;

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [metrics, setMetrics] = useState<SocialMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(false);

  const loadData = useCallback(async () => {
    if (!competitorId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const [postsData, metricsData] = await Promise.all([
        socialIntelligenceService.getPostsByCompetitor(competitorId, { platform, limit }),
        socialIntelligenceService.getLatestMetrics(competitorId),
      ]);
      setPosts(postsData);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Social intelligence load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load social data');
    } finally {
      setLoading(false);
    }
  }, [competitorId, platform, limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadData();
  }, [loadData]);

  const fetchPosts = useCallback(async (profileId: string) => {
    setFetchingPosts(true);
    setError(null);
    try {
      await socialIntelligenceService.fetchPosts(profileId);
      await loadData();
    } catch (err) {
      console.error('Fetch posts error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setFetchingPosts(false);
    }
  }, [loadData]);

  const analyzeStrategy = useCallback(async (
    postIds: string[],
    competitorName: string
  ): Promise<SocialAnalysisResult | null> => {
    if (!competitorId) return null;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await socialIntelligenceService.analyzeStrategy(
        postIds,
        competitorId,
        competitorName
      );
      await loadData();
      return result;
    } catch (err) {
      console.error('Analyze strategy error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze posts');
      return null;
    } finally {
      setAnalyzing(false);
    }
  }, [competitorId, loadData]);

  const triggerSync = useCallback(async (targetCompetitorId?: string) => {
    setSyncing(true);
    setError(null);
    try {
      await socialIntelligenceService.triggerSync(targetCompetitorId || competitorId);
      await loadData();
    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Social sync failed');
    } finally {
      setSyncing(false);
    }
  }, [competitorId, loadData]);

  return {
    posts,
    metrics,
    loading,
    error,
    syncing,
    analyzing,
    fetchingPosts,
    refresh,
    fetchPosts,
    analyzeStrategy,
    triggerSync,
  };
}
