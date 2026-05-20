// ============================================================================
// USE INTELLIGENCE OVERVIEW HOOK
// DawinOS v2.0 - Intelligence Layer
// Fetch overall intelligence metrics and activity
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { IntelligenceOverview, ActivityItem } from '../types';

interface UseIntelligenceOverviewReturn {
  overview: IntelligenceOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const useIntelligenceOverview = (): UseIntelligenceOverviewReturn => {
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock data - replace with actual Firestore queries
      const mockActivities: ActivityItem[] = [
        {
          id: '1',
          type: 'suggestion',
          title: 'Budget optimization opportunity detected',
          description: 'AI found potential savings in Q1 budget allocation',
          sourceModule: 'financial',
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
          id: '2',
          type: 'anomaly',
          title: 'Unusual expense pattern detected',
          description: 'Travel expenses 40% above historical average',
          sourceModule: 'financial',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
        {
          id: '3',
          type: 'prediction',
          title: 'Q2 revenue forecast updated',
          description: 'New prediction based on current pipeline',
          sourceModule: 'capital_hub',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
        },
        {
          id: '4',
          type: 'query',
          title: 'Natural language query processed',
          description: '"What was our revenue last month?"',
          sourceModule: 'financial',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
        },
        {
          id: '5',
          type: 'analysis',
          title: 'Competitor report analyzed',
          description: 'Key insights extracted from market report',
          sourceModule: 'market_intelligence',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
        },
      ];

      setOverview({
        activeSuggestions: 12,
        pendingAnomalies: 3,
        activePredictions: 8,
        documentsAnalyzed: 127,
        queriesProcessed: 45,
        aiAccuracy: 0.87,
        recentActivity: mockActivities,
        featureUsage: [
          { feature: 'smart_suggestions', usageCount: 234, trend: 'up', lastUsed: new Date() },
          { feature: 'anomaly_detection', usageCount: 89, trend: 'stable', lastUsed: new Date() },
          { feature: 'predictive_analytics', usageCount: 156, trend: 'up', lastUsed: new Date() },
          { feature: 'natural_language', usageCount: 312, trend: 'up', lastUsed: new Date() },
        ],
      });

      setLoading(false);
    } catch (err) {
      console.error('Overview fetch error:', err);
      setError('Failed to load intelligence overview');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { overview, loading, error, refresh: fetchOverview };
};

export default useIntelligenceOverview;
