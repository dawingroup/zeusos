// ============================================================================
// INSIGHTS HOOK
// DawinOS v2.0 - Market Intelligence Module
// Hook for AI-generated insights management (Firestore-backed)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { Insight } from '../types';

const INSIGHTS_COLLECTION = 'ai_insights';

interface UseInsightsOptions {
  type?: string;
  priority?: string;
  status?: string;
  pageSize?: number;
}

interface UseInsightsReturn {
  insights: Insight[];
  loading: boolean;
  generating: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  generate: (sector?: string, topic?: string) => Promise<number>;
  updateInsightStatus: (insightId: string, status: Insight['status']) => Promise<void>;
  dismissInsight: (insightId: string) => Promise<void>;
  actionInsight: (insightId: string) => Promise<void>;
}

export const useInsights = ({
  type,
  priority,
  status,
  pageSize = 50,
}: UseInsightsOptions = {}): UseInsightsReturn => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let q = query(
        collection(db, INSIGHTS_COLLECTION),
        orderBy('createdAt', 'desc'),
        firestoreLimit(pageSize)
      );

      if (type && type !== 'all') {
        q = query(
          collection(db, INSIGHTS_COLLECTION),
          where('type', '==', type),
          orderBy('createdAt', 'desc'),
          firestoreLimit(pageSize)
        );
      }

      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Insight[];

      // Client-side filters for priority and status
      if (priority && priority !== 'all') {
        results = results.filter(i => i.priority === priority);
      }
      if (status && status !== 'all') {
        results = results.filter(i => i.status === status);
      }

      setInsights(results);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
    } finally {
      setLoading(false);
    }
  }, [type, priority, status, pageSize]);

  const generate = useCallback(async (sector?: string, topic?: string): Promise<number> => {
    try {
      setGenerating(true);
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const generateFn = httpsCallable(functions, 'generateMarketInsights');

      const result = await generateFn({ sector, topic });
      const data = result.data as { insightsGenerated: number };

      await fetchInsights();
      return data.insightsGenerated || 0;
    } catch (err) {
      console.error('Generate insights error:', err);
      return 0;
    } finally {
      setGenerating(false);
    }
  }, [fetchInsights]);

  const updateInsightStatus = useCallback(async (insightId: string, newStatus: Insight['status']) => {
    try {
      await updateDoc(doc(db, INSIGHTS_COLLECTION, insightId), {
        status: newStatus,
        reviewedAt: Timestamp.now(),
      });
      setInsights(prev =>
        prev.map(i => (i.id === insightId ? { ...i, status: newStatus, reviewedAt: new Date().toISOString() } : i))
      );
    } catch (err) {
      console.error('Update insight status error:', err);
    }
  }, []);

  const dismissInsight = useCallback(async (insightId: string) => {
    await updateInsightStatus(insightId, 'dismissed');
  }, [updateInsightStatus]);

  const actionInsight = useCallback(async (insightId: string) => {
    await updateInsightStatus(insightId, 'actioned');
  }, [updateInsightStatus]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    loading,
    generating,
    error,
    refresh: fetchInsights,
    generate,
    updateInsightStatus,
    dismissInsight,
    actionInsight,
  };
};

export default useInsights;
