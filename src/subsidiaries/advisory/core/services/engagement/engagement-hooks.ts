/**
 * ENGAGEMENT HOOKS
 * 
 * React hooks for consuming engagement data in components.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  engagementService,
  CreateEngagementInput,
  PaginationOptions,
  ModuleActivationResult,
  ActivityLogEntry,
} from './engagement-service';
import { 
  Engagement,
  EngagementStatus,
  EngagementModules,
  EngagementFilter,
  EngagementWithEntities,
  UpdateEngagementData,
} from '../../types';
import { TeamMember, TeamRole } from '../../types/engagement-team';

// ============================================================================
// Single Engagement Hook
// ============================================================================

interface UseEngagementResult {
  engagement: Engagement | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and subscribe to a single engagement
 */
export function useEngagement(
  engagementId: string | undefined,
  options: { realtime?: boolean } = {}
): UseEngagementResult {
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { realtime = false } = options;

  const fetchEngagement = useCallback(async () => {
    if (!engagementId) {
      setEngagement(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await engagementService.getEngagement(engagementId);
      setEngagement(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch engagement'));
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    if (!engagementId) return;

    if (realtime) {
      setLoading(true);
      const unsubscribe = engagementService.subscribeToEngagement(
        engagementId,
        (data) => {
          setEngagement(data);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      fetchEngagement();
    }
  }, [engagementId, realtime, fetchEngagement]);

  return {
    engagement,
    loading,
    error,
    refresh: fetchEngagement,
  };
}

// ============================================================================
// Engagement with Entities Hook
// ============================================================================

interface UseEngagementWithEntitiesResult {
  engagement: EngagementWithEntities | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch engagement with related entities
 */
export function useEngagementWithEntities(
  engagementId: string | undefined
): UseEngagementWithEntitiesResult {
  const [engagement, setEngagement] = useState<EngagementWithEntities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEngagement = useCallback(async () => {
    if (!engagementId) {
      setEngagement(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await engagementService.getEngagementWithEntities(engagementId);
      setEngagement(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch engagement'));
    } finally {
      setLoading(false);
    }
  }, [engagementId]);

  useEffect(() => {
    fetchEngagement();
  }, [fetchEngagement]);

  return {
    engagement,
    loading,
    error,
    refresh: fetchEngagement,
  };
}

// ============================================================================
// Engagement List Hook
// ============================================================================

interface UseEngagementsResult {
  engagements: Engagement[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage engagement list
 */
export function useEngagements(
  filters: EngagementFilter = {},
  pagination: Partial<PaginationOptions> = {},
  options: { realtime?: boolean } = {}
): UseEngagementsResult {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<any>(undefined);

  const { realtime = false } = options;
  const pageSize = pagination.pageSize || 20;

  // Stringify filters to use as dependency
  const filtersKey = JSON.stringify(filters);

  const fetchEngagements = useCallback(async (append = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await engagementService.listEngagements(filters, {
        pageSize,
        cursor: append ? cursor : undefined,
        sortField: pagination.sortField,
        sortDirection: pagination.sortDirection,
      });

      if (append) {
        setEngagements(prev => [...prev, ...result.data]);
      } else {
        setEngagements(result.data);
      }
      
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch engagements'));
    } finally {
      setLoading(false);
    }
  }, [filtersKey, pageSize, pagination.sortField, pagination.sortDirection, cursor]);

  useEffect(() => {
    if (realtime) {
      setLoading(true);
      const unsubscribe = engagementService.subscribeToEngagements(
        filters,
        (data) => {
          setEngagements(data);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      fetchEngagements(false);
    }
  }, [realtime, filtersKey]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchEngagements(true);
  }, [hasMore, loading, fetchEngagements]);

  const refresh = useCallback(async () => {
    setCursor(undefined);
    await fetchEngagements(false);
  }, [fetchEngagements]);

  return {
    engagements,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

// ============================================================================
// My Engagements Hook
// ============================================================================

/**
 * Hook to fetch current user's engagements
 */
export function useMyEngagements(
  status?: EngagementStatus
): Omit<UseEngagementsResult, 'loadMore' | 'hasMore'> {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEngagements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await engagementService.getMyEngagements(status);
      setEngagements(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch engagements'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchEngagements();
  }, [fetchEngagements]);

  return {
    engagements,
    loading,
    error,
    refresh: fetchEngagements,
  };
}

// ============================================================================
// Engagement Mutations Hook
// ============================================================================

interface UseEngagementMutationsResult {
  createEngagement: (data: CreateEngagementInput) => Promise<Engagement>;
  updateEngagement: (id: string, updates: UpdateEngagementData) => Promise<void>;
  updateStatus: (id: string, status: EngagementStatus, reason?: string) => Promise<void>;
  archiveEngagement: (id: string) => Promise<void>;
  cloneEngagement: (sourceId: string, overrides?: Partial<CreateEngagementInput>) => Promise<Engagement>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for engagement mutations
 */
export function useEngagementMutations(): UseEngagementMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Operation failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createEngagement = useCallback(async (data: CreateEngagementInput) => {
    return withLoading(() => engagementService.createEngagement(data));
  }, []);

  const updateEngagement = useCallback(async (id: string, updates: UpdateEngagementData) => {
    return withLoading(() => engagementService.updateEngagement(id, updates));
  }, []);

  const updateStatus = useCallback(async (id: string, status: EngagementStatus, reason?: string) => {
    return withLoading(() => engagementService.updateStatus(id, status, reason));
  }, []);

  const archiveEngagement = useCallback(async (id: string) => {
    return withLoading(() => engagementService.archiveEngagement(id));
  }, []);

  const cloneEngagement = useCallback(async (sourceId: string, overrides?: Partial<CreateEngagementInput>) => {
    return withLoading(() => engagementService.cloneEngagement(sourceId, overrides));
  }, []);

  return {
    createEngagement,
    updateEngagement,
    updateStatus,
    archiveEngagement,
    cloneEngagement,
    loading,
    error,
  };
}

// ============================================================================
// Team Management Hook
// ============================================================================

interface UseTeamManagementResult {
  addMember: (engagementId: string, member: Omit<TeamMember, 'startDate' | 'isActive'>) => Promise<void>;
  updateRole: (engagementId: string, userId: string, newRole: TeamRole) => Promise<void>;
  removeMember: (engagementId: string, userId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for team management operations
 */
export function useTeamManagement(): UseTeamManagementResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Operation failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addMember = useCallback(async (
    engagementId: string, 
    member: Omit<TeamMember, 'startDate' | 'isActive'>
  ) => {
    return withLoading(() => engagementService.addTeamMember(engagementId, member));
  }, []);

  const updateRole = useCallback(async (
    engagementId: string, 
    userId: string, 
    newRole: TeamRole
  ) => {
    return withLoading(() => engagementService.updateTeamMemberRole(engagementId, userId, newRole));
  }, []);

  const removeMember = useCallback(async (engagementId: string, userId: string) => {
    return withLoading(() => engagementService.removeTeamMember(engagementId, userId));
  }, []);

  return {
    addMember,
    updateRole,
    removeMember,
    loading,
    error,
  };
}

// ============================================================================
// Module Management Hook
// ============================================================================

interface UseModuleManagementResult {
  activateModule: (engagementId: string, module: keyof EngagementModules) => Promise<ModuleActivationResult>;
  deactivateModule: (engagementId: string, module: keyof EngagementModules) => Promise<ModuleActivationResult>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for module management operations
 */
export function useModuleManagement(): UseModuleManagementResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Operation failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const activateModule = useCallback(async (
    engagementId: string, 
    module: keyof EngagementModules
  ) => {
    return withLoading(() => engagementService.activateModule(engagementId, module));
  }, []);

  const deactivateModule = useCallback(async (
    engagementId: string, 
    module: keyof EngagementModules
  ) => {
    return withLoading(() => engagementService.deactivateModule(engagementId, module));
  }, []);

  return {
    activateModule,
    deactivateModule,
    loading,
    error,
  };
}

// ============================================================================
// Engagement Search Hook
// ============================================================================

interface UseEngagementSearchResult {
  results: Engagement[];
  search: (term: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
  clear: () => void;
}

/**
 * Hook for engagement search
 */
export function useEngagementSearch(maxResults: number = 10): UseEngagementSearchResult {
  const [results, setResults] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await engagementService.searchEngagements(term, maxResults);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setLoading(false);
    }
  }, [maxResults]);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    search,
    loading,
    error,
    clear,
  };
}

// ============================================================================
// Engagement Activity Hook
// ============================================================================

interface UseEngagementActivityResult {
  activities: ActivityLogEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching engagement activity log
 */
export function useEngagementActivity(
  engagementId: string | undefined,
  maxItems: number = 20
): UseEngagementActivityResult {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!engagementId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await engagementService.getRecentActivity(engagementId, maxItems);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch activities'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, maxItems]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    refresh: fetchActivities,
  };
}
