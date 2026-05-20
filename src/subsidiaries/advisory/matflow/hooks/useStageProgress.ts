/**
 * Stage Progress Hooks
 * React hooks for stage progress tracking and management
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import {
  StageProgress,
  StageMilestone,
  StageTimelineEvent,
  ProjectStageOverview,
  UpdateStageStatusDTO,
  CreateMilestoneDTO,
  AddBlockerDTO,
  ResolveBlockerDTO,
  RequestApprovalDTO,
  ProcessApprovalDTO,
} from '../types/stageProgress';
import stageProgressService from '../services/stageProgressService';
// Toast notification helper
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  if (type === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
};

const DEFAULT_ORG_ID = 'default';

// ============================================================================
// MAIN HOOK: useStageProgress
// ============================================================================

export function useStageProgress(projectId: string | undefined) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [stages, setStages] = useState<StageProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [updating, setUpdating] = useState(false);

  // Real-time subscription
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = stageProgressService.subscribeToStageProgress(
      projectId,
      (stageData) => {
        setStages(stageData);
        setLoading(false);
      },
      orgId
    );

    return () => unsubscribe();
  }, [projectId, orgId]);

  // Update status
  const updateStatus = async (stageId: string, update: UpdateStageStatusDTO) => {
    if (!projectId || !user) return;
    
    setUpdating(true);
    try {
      await stageProgressService.updateStageStatus(
        projectId,
        stageId,
        update,
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      showToast('Stage status updated');
    } catch (err) {
      const error = err as Error;
      setError(error);
      showToast(`Failed to update status: ${error.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Add blocker
  const addBlocker = async (data: AddBlockerDTO) => {
    if (!projectId || !user) return;
    
    setUpdating(true);
    try {
      await stageProgressService.addBlocker(
        projectId,
        data,
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      showToast('Blocker added');
    } catch (err) {
      const error = err as Error;
      setError(error);
      showToast(`Failed to add blocker: ${error.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Resolve blocker
  const resolveBlocker = async (stageId: string, data: ResolveBlockerDTO) => {
    if (!projectId || !user) return;
    
    setUpdating(true);
    try {
      await stageProgressService.resolveBlocker(
        projectId,
        stageId,
        data,
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      showToast('Blocker resolved');
    } catch (err) {
      const error = err as Error;
      setError(error);
      showToast(`Failed to resolve blocker: ${error.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Request approval
  const requestApproval = async (data: RequestApprovalDTO) => {
    if (!projectId || !user) return;
    
    setUpdating(true);
    try {
      await stageProgressService.requestStageApproval(
        projectId,
        data,
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      showToast('Approval requested');
    } catch (err) {
      const error = err as Error;
      setError(error);
      showToast(`Failed to request approval: ${error.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Process approval
  const processApproval = async (data: ProcessApprovalDTO) => {
    if (!projectId || !user) return;
    
    setUpdating(true);
    try {
      await stageProgressService.processStageApproval(
        projectId,
        data,
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      showToast(data.approved ? 'Stage approved' : 'Stage approval rejected');
    } catch (err) {
      const error = err as Error;
      setError(error);
      showToast(`Failed to process approval: ${error.message}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Computed values
  const stagesByStatus = useMemo(() => {
    return stages.reduce(
      (acc, stage) => {
        acc[stage.status] = (acc[stage.status] || []).concat(stage);
        return acc;
      },
      {} as Record<string, StageProgress[]>
    );
  }, [stages]);

  const overallProgress = useMemo(() => {
    if (stages.length === 0) return 0;
    return stages.reduce((sum, s) => sum + s.overallProgress, 0) / stages.length;
  }, [stages]);

  return {
    stages,
    stagesByStatus,
    overallProgress,
    loading,
    error,
    updating,
    updateStatus,
    addBlocker,
    resolveBlocker,
    requestApproval,
    processApproval,
  };
}

// ============================================================================
// HOOK: useStageMilestones
// ============================================================================

export function useStageMilestones(projectId: string | undefined, stageId: string | undefined) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [milestones, setMilestones] = useState<StageMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!projectId || !stageId) {
      setLoading(false);
      return;
    }

    const loadMilestones = async () => {
      setLoading(true);
      try {
        const data = await stageProgressService.getStageMilestones(projectId, stageId, orgId);
        setMilestones(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadMilestones();
  }, [projectId, stageId, orgId]);

  const createMilestone = async (data: Omit<CreateMilestoneDTO, 'stageId'>) => {
    if (!projectId || !stageId || !user) return;
    
    setCreating(true);
    try {
      await stageProgressService.createMilestone(
        projectId,
        { ...data, stageId },
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      // Reload milestones
      const updated = await stageProgressService.getStageMilestones(projectId, stageId, orgId);
      setMilestones(updated);
      showToast('Milestone created');
    } catch (err) {
      setError(err as Error);
      showToast(`Failed to create milestone: ${(err as Error).message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const completeMilestone = async (milestoneId: string) => {
    if (!projectId || !stageId || !user) return;
    
    setCompleting(true);
    try {
      await stageProgressService.completeMilestone(
        projectId,
        milestoneId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        orgId
      );
      // Reload milestones
      const updated = await stageProgressService.getStageMilestones(projectId, stageId, orgId);
      setMilestones(updated);
      showToast('Milestone completed');
    } catch (err) {
      setError(err as Error);
      showToast(`Failed to complete milestone: ${(err as Error).message}`, 'error');
    } finally {
      setCompleting(false);
    }
  };

  const pendingMilestones = useMemo(
    () => milestones.filter((m) => m.status === 'pending'),
    [milestones]
  );

  const overdueMilestones = useMemo(
    () => milestones.filter((m) => m.status === 'overdue'),
    [milestones]
  );

  const completedMilestones = useMemo(
    () => milestones.filter((m) => m.status === 'completed'),
    [milestones]
  );

  return {
    milestones,
    pendingMilestones,
    overdueMilestones,
    completedMilestones,
    loading,
    error,
    createMilestone,
    creating,
    completeMilestone,
    completing,
  };
}

// ============================================================================
// HOOK: useStageTimeline
// ============================================================================

export function useStageTimeline(projectId: string | undefined, stageId: string | undefined) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [events, setEvents] = useState<StageTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId || !stageId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = stageProgressService.subscribeToStageTimeline(
      projectId,
      stageId,
      (eventData) => {
        setEvents(eventData);
        setLoading(false);
      },
      orgId
    );

    return () => unsubscribe();
  }, [projectId, stageId, orgId]);

  return {
    events,
    loading,
    error,
  };
}

// ============================================================================
// HOOK: useProjectStageOverview
// ============================================================================

export function useProjectStageOverview(projectId: string | undefined) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [overview, setOverview] = useState<ProjectStageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadOverview = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await stageProgressService.calculateProjectStageOverview(projectId, orgId);
      setOverview(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [projectId, orgId]);

  return {
    overview,
    loading,
    error,
    refresh: loadOverview,
  };
}

// ============================================================================
// HOOK: useSingleStageProgress
// ============================================================================

export function useSingleStageProgress(projectId: string | undefined, stageId: string | undefined) {
  const { stages, loading, error } = useStageProgress(projectId);

  const stage = useMemo(
    () => stages.find((s) => s.stageId === stageId),
    [stages, stageId]
  );

  return {
    stage,
    loading,
    error,
  };
}
