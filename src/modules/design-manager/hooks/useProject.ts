/**
 * useProject Hook
 * Subscribe to a single design project
 */

import { useState, useEffect } from 'react';
import type { DesignProject } from '../types';
import { subscribeToProject, getProject } from '../services/firestore';

export interface UseProjectReturn {
  project: DesignProject | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time project subscription
 */
export function useProject(projectId: string | null | undefined): UseProjectReturn {
  const [project, setProject] = useState<DesignProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await getProject(projectId);
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch project'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToProject(projectId, (data) => {
      setProject(data);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [projectId]);

  return { project, loading, error, refresh };
}

export default useProject;
