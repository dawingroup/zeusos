import { useState, useEffect, useCallback } from 'react';
import type {
  CapitalApplication,
  CapitalApplicationFilters,
  ApplicationStage,
} from '../types/capital.types';
import type { CapitalApplicationInput } from '../schemas/capital.schemas';
import { applicationService } from '../services/applicationService';

export function useApplications(companyId: string, filters: CapitalApplicationFilters = {}) {
  const [applications, setApplications] = useState<CapitalApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await applicationService.getApplications(companyId, filters);
      setApplications(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createApplication = useCallback(
    async (input: CapitalApplicationInput, userId: string) => {
      const app = await applicationService.createApplication(companyId, input, userId);
      setApplications(prev => [app, ...prev]);
      return app;
    },
    [companyId],
  );

  const updateStage = useCallback(
    async (appId: string, stage: ApplicationStage, userId: string, notes?: string) => {
      await applicationService.updateStage(companyId, appId, stage, userId, notes);
      await refresh();
    },
    [companyId, refresh],
  );

  const deleteApplication = useCallback(
    async (appId: string) => {
      await applicationService.deleteApplication(companyId, appId);
      setApplications(prev => prev.filter(a => a.id !== appId));
    },
    [companyId],
  );

  return {
    applications,
    loading,
    error,
    refresh,
    createApplication,
    updateStage,
    deleteApplication,
  };
}
