/**
 * React hooks for deal management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Deal,
  DealFormData,
  DealSummary,
  DealActivity,
} from '../types/deal';
import { DealStage } from '../types/deal-stage';
import { TeamMember } from '../types/deal-team';
import {
  dealService,
  DealFilters,
  PipelineSummary,
  StageGateStatus,
} from '../services/deal-service';

/**
 * Hook for fetching a single deal with real-time updates
 */
export function useDeal(dealId: string | undefined) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setDeal(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = dealService.subscribeToDeal(dealId, (updatedDeal) => {
      setDeal(updatedDeal);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dealId]);

  return { deal, loading, error };
}

/**
 * Hook for fetching deals by engagement
 */
export function useEngagementDeals(engagementId: string | undefined) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!engagementId) {
      setDeals([]);
      setLoading(false);
      return;
    }

    const fetchDeals = async () => {
      try {
        setLoading(true);
        const result = await dealService.getDealsByEngagement(engagementId);
        setDeals(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch deals'));
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [engagementId]);

  return { deals, loading, error };
}

/**
 * Hook for pipeline view with real-time updates
 */
export function usePipeline() {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = dealService.subscribeToPipeline((updatedDeals) => {
      setDeals(updatedDeals);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<DealStage, DealSummary[]> = {
      screening: [],
      preliminary: [],
      due_diligence: [],
      negotiation: [],
      documentation: [],
      closing: [],
      post_closing: [],
      asset_management: [],
      exit_planning: [],
      exit: [],
    };

    deals.forEach(deal => {
      if (grouped[deal.currentStage]) {
        grouped[deal.currentStage].push(deal);
      }
    });

    return grouped;
  }, [deals]);

  return { deals, dealsByStage, loading, error };
}

/**
 * Hook for pipeline summary statistics
 */
export function usePipelineSummary() {
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const result = await dealService.getPipelineSummary();
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch pipeline summary'));
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return { summary, loading, error };
}

/**
 * Hook for searching/filtering deals
 */
export function useDealsSearch(initialFilters?: DealFilters) {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [filters, setFilters] = useState<DealFilters>(initialFilters || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (searchFilters?: DealFilters) => {
    const effectiveFilters = searchFilters || filters;
    try {
      setLoading(true);
      const result = await dealService.searchDeals(effectiveFilters);
      setDeals(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to search deals'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    search();
  }, [search]);

  return { deals, filters, setFilters, search, loading, error };
}

/**
 * Hook for creating a deal
 */
export function useCreateDeal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createDeal = useCallback(
    async (
      engagementId: string,
      data: DealFormData,
      userId: string
    ): Promise<Deal> => {
      try {
        setLoading(true);
        setError(null);
        const deal = await dealService.createDeal(engagementId, data, userId);
        return deal;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create deal');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createDeal, loading, error };
}

/**
 * Hook for updating a deal
 */
export function useUpdateDeal(dealId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateDeal = useCallback(
    async (updates: Partial<Deal>, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dealService.updateDeal(dealId, updates, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update deal');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  return { updateDeal, loading, error };
}

/**
 * Hook for stage transitions
 */
export function useStageTransition(dealId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [gateStatus, setGateStatus] = useState<StageGateStatus | null>(null);

  // Fetch gate status
  useEffect(() => {
    const fetchGateStatus = async () => {
      try {
        const status = await dealService.getStageGateStatus(dealId);
        setGateStatus(status);
      } catch (err) {
        console.error('Failed to fetch gate status:', err);
      }
    };

    if (dealId) {
      fetchGateStatus();
    }
  }, [dealId]);

  const changeStage = useCallback(
    async (newStage: DealStage, userId: string, notes?: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dealService.changeStage(dealId, newStage, userId, notes);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to change stage');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  return { changeStage, gateStatus, loading, error };
}

/**
 * Hook for team management
 */
export function useDealTeam(dealId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const addMember = useCallback(
    async (member: TeamMember, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dealService.addTeamMember(dealId, member, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add team member');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  const removeMember = useCallback(
    async (memberId: string, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dealService.removeTeamMember(dealId, memberId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to remove team member');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  return { addMember, removeMember, loading, error };
}

/**
 * Hook for deal activity history
 */
export function useDealActivity(dealId: string) {
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const result = await dealService.getActivityHistory(dealId);
        setActivities(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
      } finally {
        setLoading(false);
      }
    };

    if (dealId) {
      fetchActivities();
    }
  }, [dealId]);

  return { activities, loading, error };
}

/**
 * Hook for cross-module linking
 */
export function useDealLinks(dealId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const linkToProject = useCallback(
    async (projectId: string, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dealService.linkToProject(dealId, projectId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to link to project');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  const linkToMatFlow = useCallback(
    async (boqId: string, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dealService.linkToMatFlow(dealId, boqId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to link to MatFlow');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [dealId]
  );

  return { linkToProject, linkToMatFlow, loading, error };
}
