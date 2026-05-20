/**
 * Cross-Module React Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CrossModuleLink,
  DealProjectLink,
  CreateLinkRequest,
  ProjectCreationFromDeal,
  CrossModuleDashboard,
  SyncResult,
  ModuleType,
  ProgressMapping,
  FinancialMapping,
  CrossModuleAlert,
} from '../types/cross-module-link';
import { crossModuleService } from '../services/cross-module-service';
import { dealProjectSyncService } from '../../investment/services/deal-project-sync-service';
import { useAuth } from '@/shared/hooks/useAuth';

/**
 * Get all links for an entity
 */
export function useEntityLinks(module: ModuleType, entityId: string | undefined) {
  const [links, setLinks] = useState<CrossModuleLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!entityId) {
      setLinks([]);
      setLoading(false);
      return;
    }

    const fetchLinks = async () => {
      try {
        setLoading(true);
        const result = await crossModuleService.getEntityLinks(module, entityId);
        setLinks(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch links'));
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, [module, entityId]);

  return { links, loading, error };
}

/**
 * Get deal-project link with enriched data
 */
export function useDealProjectLink(dealId: string | undefined) {
  const [link, setLink] = useState<DealProjectLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setLink(null);
      setLoading(false);
      return;
    }

    const fetchLink = async () => {
      try {
        setLoading(true);
        const result = await crossModuleService.getDealProjectLink(dealId);
        setLink(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch link'));
      } finally {
        setLoading(false);
      }
    };

    fetchLink();
  }, [dealId]);

  const refresh = useCallback(async () => {
    if (!dealId) return;
    try {
      const result = await crossModuleService.getDealProjectLink(dealId);
      setLink(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh link'));
    }
  }, [dealId]);

  return { link, loading, error, refresh };
}

/**
 * Subscribe to real-time link updates
 */
export function useLinkSubscription(linkId: string | undefined) {
  const [link, setLink] = useState<CrossModuleLink | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!linkId) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = crossModuleService.subscribeToLinkUpdates(linkId, (updatedLink) => {
      setLink(updatedLink);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [linkId]);
  
  return { link, loading };
}

/**
 * Create a cross-module link
 */
export function useCreateLink() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createLink = useCallback(
    async (request: CreateLinkRequest, userId: string): Promise<CrossModuleLink> => {
      try {
        setLoading(true);
        setError(null);
        const result = await crossModuleService.createLink(request, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create link');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createLink, loading, error };
}

/**
 * Sync a link
 */
export function useSyncLink() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sync = useCallback(
    async (linkId: string, userId: string): Promise<SyncResult> => {
      try {
        setLoading(true);
        setError(null);
        const result = await crossModuleService.syncLink(linkId, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to sync link');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { sync, loading, error };
}
/**
 * Create project from deal
 */
export function useCreateProjectFromDeal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const createProject = useCallback(
    async (
      config: ProjectCreationFromDeal,
    ): Promise<{ projectId: string; linkId: string }> => {
      if (!user) {
        throw new Error('User is not authenticated');
      }

      try {
        setLoading(true);
        setError(null);
        const orgId = (user as unknown as Record<string, unknown>).orgId as string || 'default';
        const result = await crossModuleService.createProjectFromDeal(orgId, config, user.uid);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create project');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return { createProject, loading, error };
}

/**
 * Get construction summary for deal
 */
export function useConstructionSummary(dealId: string | undefined) {
  const [summary, setSummary] = useState<{
    progress: ProgressMapping;
    financials: FinancialMapping;
    milestones: unknown[];
    alerts: CrossModuleAlert[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const result = await dealProjectSyncService.getConstructionSummaryForDeal(dealId);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch summary'));
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();

    // Refetch every minute
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [dealId]);

  return { summary, loading, error };
}

/**
 * Sync deal with project
 */
export function useSyncDealWithProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sync = useCallback(
    async (dealId: string, userId: string): Promise<SyncResult> => {
      try {
        setLoading(true);
        setError(null);
        const result = await dealProjectSyncService.syncDealWithProjectProgress(dealId, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to sync deal with project');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { sync, loading, error };
}

/**
 * Get cross-module dashboard
 */
export function useCrossModuleDashboard(engagementId: string | undefined) {
  const [dashboard, setDashboard] = useState<CrossModuleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!engagementId) {
      setDashboard(null);
      setLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const result = await crossModuleService.getCrossModuleDashboard(engagementId);
        setDashboard(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch dashboard'));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [engagementId]);

  return { dashboard, loading, error };
}

/**
 * Acknowledge alert
 */
export function useAcknowledgeAlert() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const acknowledge = useCallback(
    async (alertId: string, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await crossModuleService.acknowledgeAlert(alertId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to acknowledge alert');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { acknowledge, loading, error };
}

/**
 * Check if deal has linked project
 */
export function useHasLinkedProject(dealId: string | undefined) {
  const { link, loading } = useDealProjectLink(dealId);
  
  return {
    hasLinkedProject: !!link,
    isLoading: loading,
    link,
  };
}

/**
 * Get linked entity data
 */
export function useLinkedEntityData(link: CrossModuleLink | null) {
  // Return link metadata for display
  return {
    data: link ? {
      id: link.targetEntityId,
      module: link.targetModule,
      linkId: link.id,
      status: link.status,
      lastSynced: link.lastSyncedAt,
    } : null,
    isLinked: !!link,
  };
}

/**
 * Batch sync multiple deals
 */
export function useBatchSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<Map<string, SyncResult> | null>(null);

  const batchSync = useCallback(
    async (dealIds: string[], userId: string): Promise<Map<string, SyncResult>> => {
      try {
        setLoading(true);
        setError(null);
        const syncResults = await dealProjectSyncService.batchSyncDealProjectLinks(dealIds, userId);
        setResults(syncResults);
        return syncResults;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to batch sync');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { batchSync, loading, error, results };
}
