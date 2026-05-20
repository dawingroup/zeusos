/**
 * useCutlistAggregation Hook
 * Manage cutlist aggregation for a project
 */

import { useState, useCallback } from 'react';
import { aggregateCutlist, markCutlistStale } from '../services/cutlistAggregation';
import type { ConsolidatedCutlist } from '../types';
import type { MaterialPaletteEntry } from '@/shared/types';

interface UseCutlistAggregationReturn {
  loading: boolean;
  error: Error | null;
  regenerate: (userId: string) => Promise<ConsolidatedCutlist>;
  markStale: (reason: string) => Promise<void>;
  clearError: () => void;
}

export function useCutlistAggregation(
  projectId: string,
  materialPalette?: MaterialPaletteEntry[]
): UseCutlistAggregationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const regenerate = useCallback(
    async (userId: string): Promise<ConsolidatedCutlist> => {
      setLoading(true);
      setError(null);
      try {
        const cutlist = await aggregateCutlist(projectId, userId, materialPalette);
        return cutlist;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to aggregate cutlist');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, materialPalette]
  );

  const markStale = useCallback(
    async (reason: string): Promise<void> => {
      try {
        await markCutlistStale(projectId, reason);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to mark cutlist stale');
        setError(error);
        throw error;
      }
    },
    [projectId]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    regenerate,
    markStale,
    clearError,
  };
}
