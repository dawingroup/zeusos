/**
 * useProjectTracker Hook
 * Fetches design projects with summary stats for the CRM project tracker table.
 * Also syncs CRM deals for projects that don't have one yet (runs once per mount).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/shared/hooks';
import { fetchProjectsForTracker, type ProjectTrackerItem } from '../services/crmProjectService';
import { syncDealsForProjects } from '../services/dealSyncService';

interface UseProjectTrackerReturn {
  projects: ProjectTrackerItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useProjectTracker(): UseProjectTrackerReturn {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectTrackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncAttempted = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Run deal sync once per mount (idempotent, won't create duplicates)
      if (!syncAttempted.current && user) {
        syncAttempted.current = true;
        try {
          const result = await syncDealsForProjects(
            user.uid,
            user.displayName || user.email || 'Unknown'
          );
          if (result.created > 0) {
            console.log(`[DealSync] Created ${result.created} deals for unlinked projects`);
          }
        } catch (syncErr) {
          console.warn('[DealSync] Non-blocking sync error:', syncErr);
        }
      }

      const data = await fetchProjectsForTracker();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects for tracker:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { projects, loading, error, refetch: fetchData };
}
