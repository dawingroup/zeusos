/**
 * useProjectDetail Hook
 * Fetches full aggregated project data for the CRM project detail page
 */

import { useState, useEffect } from 'react';
import { fetchProjectDetail } from '../services/crmProjectService';
import type { ProjectDetailAggregation } from '../types';

interface UseProjectDetailReturn {
  project: ProjectDetailAggregation | null;
  loading: boolean;
  error: string | null;
}

export function useProjectDetail(projectId: string | undefined): UseProjectDetailReturn {
  const [project, setProject] = useState<ProjectDetailAggregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProjectDetail(projectId!);
        if (!cancelled) {
          setProject(data);
        }
      } catch (err) {
        console.error('Error fetching project detail:', err);
        if (!cancelled) {
          setError('Failed to load project details');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { project, loading, error };
}
