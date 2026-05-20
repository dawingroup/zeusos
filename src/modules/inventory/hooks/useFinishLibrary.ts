/**
 * useFinishLibrary Hook
 * Real-time subscription to the finish library with optional category/status filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FinishDocument, FinishCategory } from '../types';
import { subscribeToFinishes } from '../services/finishLibraryService';

interface UseFinishLibraryOptions {
  organizationId?: string;
  category?: FinishCategory;
  isActive?: boolean;
}

interface UseFinishLibraryResult {
  finishes: FinishDocument[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useFinishLibrary(options?: UseFinishLibraryOptions): UseFinishLibraryResult {
  const [finishes, setFinishes] = useState<FinishDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToFinishes(
      (data) => {
        setFinishes(data);
        setLoading(false);
      },
      {
        organizationId: options?.organizationId,
        category: options?.category,
        isActive: options?.isActive,
      }
    );

    return () => unsubscribe();
  }, [options?.organizationId, options?.category, options?.isActive, refreshKey]);

  return { finishes, loading, error, refresh };
}
