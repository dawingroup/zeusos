/**
 * useDesignItem Hook
 * Subscribe to a single design item
 */

import { useState, useEffect } from 'react';
import type { DesignItem } from '../types';
import { subscribeToDesignItem, getDesignItem } from '../services/firestore';

export interface UseDesignItemReturn {
  item: DesignItem | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time design item subscription
 */
export function useDesignItem(
  projectId: string | null | undefined,
  itemId: string | null | undefined
): UseDesignItemReturn {
  const [item, setItem] = useState<DesignItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    if (!projectId || !itemId) return;
    try {
      setLoading(true);
      const data = await getDesignItem(projectId, itemId);
      setItem(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch item'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId || !itemId) {
      setItem(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToDesignItem(projectId, itemId, (data) => {
      setItem(data);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [projectId, itemId]);

  return { item, loading, error, refresh };
}

export default useDesignItem;
