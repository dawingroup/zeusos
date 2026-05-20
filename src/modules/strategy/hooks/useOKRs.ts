// ============================================================================
// USE OKRS HOOK - DawinOS CEO Strategy Command
// React hook for managing OKR objectives
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { okrService } from '../services/okr.service';
import {
  OKRObjective,
  KeyResult,
  KeyResultCheckIn,
  OKRFilters,
  OKRTreeNode,
  OKRSummary,
  CreateObjectiveInput,
  UpdateObjectiveInput,
  CreateKeyResultInput,
  UpdateKeyResultInput,
  CheckInInput,
} from '../types/okr.types';
import {
  OKRLevel,
  CONFIDENCE_LEVEL,
  OKR_DEFAULTS,
} from '../constants/okr.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseOKRsOptions {
  companyId: string;
  filters?: OKRFilters;
  autoFetch?: boolean;
}

export interface UseOKRsReturn {
  objectives: OKRObjective[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  // CRUD
  createObjective: (input: CreateObjectiveInput) => Promise<OKRObjective>;
  updateObjective: (id: string, input: UpdateObjectiveInput) => Promise<OKRObjective>;
  deleteObjective: (id: string) => Promise<void>;
  activateObjective: (id: string) => Promise<OKRObjective>;
  completeObjective: (id: string) => Promise<OKRObjective>;
  // Key Results
  addKeyResult: (okrId: string, input: CreateKeyResultInput) => Promise<KeyResult>;
  updateKeyResult: (okrId: string, krId: string, input: UpdateKeyResultInput) => Promise<KeyResult>;
  removeKeyResult: (okrId: string, krId: string) => Promise<void>;
  // Check-ins
  checkIn: (okrId: string, input: CheckInInput) => Promise<KeyResultCheckIn>;
  bulkCheckIn: (okrId: string, inputs: CheckInInput[]) => Promise<KeyResultCheckIn[]>;
  // Computed
  activeObjectives: OKRObjective[];
  draftObjectives: OKRObjective[];
  completedObjectives: OKRObjective[];
  objectivesByLevel: Record<OKRLevel, OKRObjective[]>;
  summaries: OKRSummary[];
  totalProgress: number;
  averageScore: number;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------
function getOverallConfidence(keyResults: KeyResult[]): typeof CONFIDENCE_LEVEL[keyof typeof CONFIDENCE_LEVEL] {
  if (keyResults.length === 0) return CONFIDENCE_LEVEL.ON_TRACK;
  const scores = keyResults.map((kr) => {
    if (kr.confidence === CONFIDENCE_LEVEL.ON_TRACK) return 3;
    if (kr.confidence === CONFIDENCE_LEVEL.AT_RISK) return 2;
    return 1;
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg > 2.5) return CONFIDENCE_LEVEL.ON_TRACK;
  if (avg > 1.5) return CONFIDENCE_LEVEL.AT_RISK;
  return CONFIDENCE_LEVEL.OFF_TRACK;
}

function objectiveToSummary(obj: OKRObjective): OKRSummary {
  const now = new Date();
  const staleThreshold = OKR_DEFAULTS.STALE_OKR_DAYS * 24 * 60 * 60 * 1000;
  const lastCheckIn = obj.lastCheckInDate?.toDate();
  const isStale = obj.status === 'active' && (!lastCheckIn || now.getTime() - lastCheckIn.getTime() > staleThreshold);
  const hasBlockers = obj.keyResults.some((kr) => kr.checkIns.some((ci) => ci.blockers.length > 0));

  return {
    id: obj.id,
    title: obj.title,
    level: obj.level,
    ownerName: obj.ownerName,
    ownerAvatarUrl: obj.ownerAvatarUrl,
    status: obj.status,
    score: obj.score,
    progress: obj.progress,
    keyResultCount: obj.keyResults.length,
    completedKeyResultCount: obj.keyResults.filter((kr) => kr.isComplete).length,
    overallConfidence: getOverallConfidence(obj.keyResults),
    lastCheckInDate: obj.lastCheckInDate,
    daysUntilNextCheckIn: obj.nextCheckInDate
      ? Math.ceil((obj.nextCheckInDate.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined,
    isStale,
    hasBlockers,
  };
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------
export function useOKRs(options: UseOKRsOptions): UseOKRsReturn {
  const { user } = useAuth();
  const { companyId, filters, autoFetch = true } = options;

  const [objectives, setObjectives] = useState<OKRObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // --------------------------------------------------------------------------
  // Fetch Objectives
  // --------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await okrService.getObjectives(companyId, filters);
      setObjectives(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch OKRs'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------
  const createObjective = useCallback(
    async (input: CreateObjectiveInput): Promise<OKRObjective> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const obj = await okrService.createObjective(companyId, input, user.uid);
      setObjectives((prev) => [obj, ...prev]);
      return obj;
    },
    [companyId, user?.uid]
  );

  const updateObjective = useCallback(
    async (id: string, input: UpdateObjectiveInput): Promise<OKRObjective> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await okrService.updateObjective(companyId, id, input, user.uid);
      setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const deleteObjective = useCallback(
    async (id: string): Promise<void> => {
      if (!companyId) {
        throw new Error('Company not available');
      }
      await okrService.deleteObjective(companyId, id);
      setObjectives((prev) => prev.filter((o) => o.id !== id));
    },
    [companyId]
  );

  const activateObjective = useCallback(
    async (id: string): Promise<OKRObjective> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const activated = await okrService.activateObjective(companyId, id, user.uid);
      setObjectives((prev) => prev.map((o) => (o.id === id ? activated : o)));
      return activated;
    },
    [companyId, user?.uid]
  );

  const completeObjective = useCallback(
    async (id: string): Promise<OKRObjective> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const completed = await okrService.completeObjective(companyId, id, user.uid);
      setObjectives((prev) => prev.map((o) => (o.id === id ? completed : o)));
      return completed;
    },
    [companyId, user?.uid]
  );

  // --------------------------------------------------------------------------
  // Key Result Operations
  // --------------------------------------------------------------------------
  const addKeyResult = useCallback(
    async (okrId: string, input: CreateKeyResultInput): Promise<KeyResult> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const kr = await okrService.addKeyResult(companyId, okrId, input, user.uid);
      await refresh();
      return kr;
    },
    [companyId, user?.uid, refresh]
  );

  const updateKeyResult = useCallback(
    async (okrId: string, krId: string, input: UpdateKeyResultInput): Promise<KeyResult> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const kr = await okrService.updateKeyResult(companyId, okrId, krId, input, user.uid);
      await refresh();
      return kr;
    },
    [companyId, user?.uid, refresh]
  );

  const removeKeyResult = useCallback(
    async (okrId: string, krId: string): Promise<void> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      await okrService.removeKeyResult(companyId, okrId, krId, user.uid);
      await refresh();
    },
    [companyId, user?.uid, refresh]
  );

  // --------------------------------------------------------------------------
  // Check-in Operations
  // --------------------------------------------------------------------------
  const checkIn = useCallback(
    async (okrId: string, input: CheckInInput): Promise<KeyResultCheckIn> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const ci = await okrService.createCheckIn(companyId, okrId, input, user.uid, user.displayName || undefined);
      await refresh();
      return ci;
    },
    [companyId, user?.uid, user?.displayName, refresh]
  );

  const bulkCheckIn = useCallback(
    async (okrId: string, inputs: CheckInInput[]): Promise<KeyResultCheckIn[]> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const results = await okrService.bulkCheckIn(companyId, okrId, inputs, user.uid, user.displayName || undefined);
      await refresh();
      return results;
    },
    [companyId, user?.uid, user?.displayName, refresh]
  );

  // --------------------------------------------------------------------------
  // Computed Values
  // --------------------------------------------------------------------------
  const activeObjectives = useMemo(
    () => objectives.filter((o) => o.status === 'active'),
    [objectives]
  );

  const draftObjectives = useMemo(
    () => objectives.filter((o) => o.status === 'draft'),
    [objectives]
  );

  const completedObjectives = useMemo(
    () => objectives.filter((o) => o.status === 'completed'),
    [objectives]
  );

  const objectivesByLevel = useMemo(() => {
    const byLevel: Record<string, OKRObjective[]> = {};
    objectives.forEach((obj) => {
      if (!byLevel[obj.level]) {
        byLevel[obj.level] = [];
      }
      byLevel[obj.level].push(obj);
    });
    return byLevel as Record<OKRLevel, OKRObjective[]>;
  }, [objectives]);

  const summaries = useMemo(
    () => objectives.map(objectiveToSummary),
    [objectives]
  );

  const totalProgress = useMemo(() => {
    const active = activeObjectives;
    if (active.length === 0) return 0;
    return Math.round(active.reduce((sum, o) => sum + o.progress, 0) / active.length);
  }, [activeObjectives]);

  const averageScore = useMemo(() => {
    const active = activeObjectives;
    if (active.length === 0) return 0;
    return active.reduce((sum, o) => sum + o.score, 0) / active.length;
  }, [activeObjectives]);

  return {
    objectives,
    loading,
    error,
    refresh,
    createObjective,
    updateObjective,
    deleteObjective,
    activateObjective,
    completeObjective,
    addKeyResult,
    updateKeyResult,
    removeKeyResult,
    checkIn,
    bulkCheckIn,
    activeObjectives,
    draftObjectives,
    completedObjectives,
    objectivesByLevel,
    summaries,
    totalProgress,
    averageScore,
  };
}

// ----------------------------------------------------------------------------
// ADDITIONAL HOOKS
// ----------------------------------------------------------------------------

/**
 * Hook for fetching user's own OKRs
 */
export function useMyOKRs(options: { companyId: string; cycleId?: string; autoFetch?: boolean }) {
  const { user } = useAuth();
  return useOKRs({
    companyId: options.companyId,
    filters: {
      ownerId: user?.uid,
      ownerType: 'user',
      cycleId: options.cycleId,
    },
    autoFetch: options.autoFetch,
  });
}

/**
 * Hook for fetching company-level OKRs
 */
export function useCompanyOKRs(options: { companyId: string; cycleId: string; autoFetch?: boolean }) {
  return useOKRs({
    companyId: options.companyId,
    filters: {
      cycleId: options.cycleId,
      level: 'company',
    },
    autoFetch: options.autoFetch,
  });
}

/**
 * Hook for fetching team OKRs
 */
export function useTeamOKRs(options: {
  companyId: string;
  teamId: string;
  cycleId?: string;
  autoFetch?: boolean;
}) {
  return useOKRs({
    companyId: options.companyId,
    filters: {
      ownerId: options.teamId,
      ownerType: 'team',
      cycleId: options.cycleId,
    },
    autoFetch: options.autoFetch,
  });
}

/**
 * Hook for fetching OKR alignment tree
 */
export function useOKRAlignmentTree(options: { companyId: string; cycleId: string }) {
  const [tree, setTree] = useState<OKRTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!options.companyId || !options.cycleId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await okrService.getAlignmentTree(options.companyId, options.cycleId);
      setTree(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alignment tree'));
    } finally {
      setLoading(false);
    }
  }, [options.companyId, options.cycleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tree, loading, error, refresh };
}
