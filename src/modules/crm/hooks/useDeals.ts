/**
 * useDeals Hook
 * Real-time deal subscription with CRUD actions and pipeline stats
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/shared/hooks';
import type { CRMDeal, CRMDealFormData, CRMDealStage, PipelineSummary } from '../types';
import {
  subscribeToDeals,
  createDeal,
  updateDeal,
  updateDealStage,
  deleteDeal,
  linkProjectToDeal,
} from '../services/crmDealService';
import { calculatePipelineSummary, groupDealsByStage } from '../services/crmPipelineService';
import { syncDealsForProjects, type DealSyncResult } from '../services/dealSyncService';

interface UseDealsOptions {
  stage?: CRMDealStage;
  ownerId?: string;
  customerId?: string;
}

interface UseDealsReturn {
  deals: CRMDeal[];
  loading: boolean;
  error: string | null;
  syncing: boolean;
  autoSyncResult: DealSyncResult | null;
  autoSyncError: string | null;
  pipelineSummary: PipelineSummary | null;
  dealsByStage: Record<CRMDealStage, CRMDeal[]>;
  actions: {
    create: (data: CRMDealFormData) => Promise<string>;
    update: (dealId: string, data: Partial<CRMDeal>) => Promise<void>;
    changeStage: (dealId: string, newStage: CRMDealStage, notes?: string) => Promise<void>;
    remove: (dealId: string) => Promise<void>;
    linkProject: (dealId: string, projectId: string) => Promise<void>;
    syncFromProjects: () => Promise<DealSyncResult>;
  };
}

export function useDeals(options?: UseDealsOptions): UseDealsReturn {
  const { user } = useAuth();
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [autoSyncResult, setAutoSyncResult] = useState<DealSyncResult | null>(null);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);
  const syncAttempted = useRef(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToDeals(
      (data) => {
        setDeals(data);
        setLoading(false);

        // Auto-sync deals from design projects if no deals exist yet
        if (data.length === 0 && !syncAttempted.current && user) {
          syncAttempted.current = true;
          setSyncing(true);
          setAutoSyncError(null);
          syncDealsForProjects(
            user.uid,
            user.displayName || user.email || 'Unknown'
          )
            .then((result) => {
              console.log('[useDeals] Auto-sync result:', result);
              setAutoSyncResult(result);
            })
            .catch((err) => {
              const msg = `Deal sync failed: ${(err as Error).message}`;
              console.error('[useDeals]', msg);
              setAutoSyncError(msg);
            })
            .finally(() => {
              setSyncing(false);
            });
          // The real-time subscription will pick up newly created deals automatically
        }
      },
      {
        stage: options?.stage,
        ownerId: options?.ownerId,
        customerId: options?.customerId,
      },
      (err) => {
        console.error('[useDeals] Subscription error:', err);
        setError(`Failed to load deals: ${err.message}`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [options?.stage, options?.ownerId, options?.customerId, user]);

  const pipelineSummary = useMemo(() => {
    if (deals.length === 0) return null;
    return calculatePipelineSummary(deals);
  }, [deals]);

  const dealsByStage = useMemo(() => groupDealsByStage(deals), [deals]);

  const create = useCallback(
    async (data: CRMDealFormData) => {
      if (!user) throw new Error('Not authenticated');
      return createDeal(data, user.uid, user.displayName || user.email || 'Unknown');
    },
    [user]
  );

  const update = useCallback(
    async (dealId: string, data: Partial<CRMDeal>) => {
      if (!user) throw new Error('Not authenticated');
      return updateDeal(dealId, data, user.uid);
    },
    [user]
  );

  const changeStage = useCallback(
    async (dealId: string, newStage: CRMDealStage, notes?: string) => {
      if (!user) throw new Error('Not authenticated');
      return updateDealStage(dealId, newStage, user.uid, user.displayName || user.email || 'Unknown', notes);
    },
    [user]
  );

  const remove = useCallback(async (dealId: string) => {
    return deleteDeal(dealId);
  }, []);

  const linkProjectAction = useCallback(
    async (dealId: string, projectId: string) => {
      if (!user) throw new Error('Not authenticated');
      return linkProjectToDeal(dealId, projectId, user.uid);
    },
    [user]
  );

  const syncFromProjects = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    setSyncing(true);
    try {
      const result = await syncDealsForProjects(
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      return result;
    } finally {
      setSyncing(false);
    }
  }, [user]);

  return {
    deals,
    loading,
    error,
    syncing,
    autoSyncResult,
    autoSyncError,
    pipelineSummary,
    dealsByStage,
    actions: {
      create,
      update,
      changeStage,
      remove,
      linkProject: linkProjectAction,
      syncFromProjects,
    },
  };
}
