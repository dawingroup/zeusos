/**
 * PROJECT HOOKS
 * 
 * React hooks for project data and operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import {
  Project,
  ProjectFormData,
  ProjectStatus,
  ProjectSummary,
  getProjectSummary,
} from '../types/project';
import { ProjectLocation } from '../types/project-location';
import { ProjectBudget } from '../types/project-budget';
import { ProgressRecord } from '../types/project-progress';
import { ExtensionReason } from '../types/project-timeline';
import { ProjectService } from '../services/project-service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface UseProjectResult {
  project: Project | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseProjectsResult {
  projects: Project[];
  summaries: ProjectSummary[];
  stats: ProjectStats;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface ProjectStats {
  total: number;
  byStatus: Record<ProjectStatus, number>;
  totalBudget: number;
  totalSpent: number;
  avgProgress: number;
}

interface UseProjectMutationsResult {
  createProject: (data: ProjectFormData) => Promise<Project>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  updateStatus: (projectId: string, status: ProjectStatus, notes?: string) => Promise<void>;
  deleteProject: (projectId: string, reason?: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

interface UseProgressRecordingResult {
  recordProgress: (record: Omit<ProgressRecord, 'id' | 'recordedBy' | 'recordedAt'>) => Promise<string>;
  loading: boolean;
  error: Error | null;
}

interface UseTimelineExtensionsResult {
  requestExtension: (data: {
    requestDate: Date;
    requestedDays: number;
    reason: ExtensionReason;
    justification: string;
    supportingDocs?: string[];
  }) => Promise<string>;
  approveExtension: (extensionId: string, approvedDays: number) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProject
// ─────────────────────────────────────────────────────────────────

export function useProject(
  db: Firestore,
  projectId: string | null,
  options: { realtime?: boolean } = {}
): UseProjectResult {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getProject(projectId);
      setProject(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch project'));
    } finally {
      setLoading(false);
    }
  }, [service, projectId]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToProject(projectId, (data) => {
        setProject(data);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      fetchProject();
    }
  }, [projectId, options.realtime, service, fetchProject]);

  return { project, loading, error, refresh: fetchProject };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useAllProjects
// ─────────────────────────────────────────────────────────────────

export function useAllProjects(
  db: Firestore,
  options: {
    status?: ProjectStatus[];
    orderBy?: 'name' | 'createdAt' | 'status';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  } = {}
): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);
  const optionsKey = JSON.stringify(options);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await service.getAllProjects({
        status: options.status,
        orderByField: options.orderBy,
        orderDirection: options.orderDirection,
        limitCount: options.limit,
      });
      setProjects(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch projects'));
    } finally {
      setLoading(false);
    }
  }, [service, optionsKey]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Computed summaries
  const summaries = useMemo<ProjectSummary[]>(() => {
    return projects.map(p => getProjectSummary(p));
  }, [projects]);

  // Stats
  const stats = useMemo<ProjectStats>(() => {
    const byStatus = projects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<ProjectStatus, number>);

    return {
      total: projects.length,
      byStatus,
      totalBudget: projects.reduce((sum, p) => sum + (p.budget?.totalBudget || 0), 0),
      totalSpent: projects.reduce((sum, p) => sum + (p.budget?.spent || 0), 0),
      avgProgress: projects.length
        ? projects.reduce((sum, p) => sum + (p.progress?.physicalProgress || 0), 0) / projects.length
        : 0,
    };
  }, [projects]);

  return { projects, summaries, stats, loading, error, refresh: fetchProjects };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjects
// ─────────────────────────────────────────────────────────────────

export function useProjects(
  db: Firestore,
  programId: string | null,
  options: {
    status?: ProjectStatus[];
    realtime?: boolean;
  } = {}
): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const fetchProjects = useCallback(async () => {
    if (!programId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getProjectsByProgram(programId, {
        status: options.status,
      });
      setProjects(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch projects'));
    } finally {
      setLoading(false);
    }
  }, [service, programId, options.status]);

  useEffect(() => {
    if (!programId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToProjectsByProgram(programId, (data) => {
        let filtered = data;
        if (options.status?.length) {
          filtered = data.filter(p => options.status!.includes(p.status));
        }
        setProjects(filtered);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      fetchProjects();
    }
  }, [programId, options.realtime, options.status, service, fetchProjects]);

  // Computed summaries
  const summaries = useMemo<ProjectSummary[]>(() => {
    return projects.map(p => getProjectSummary(p));
  }, [projects]);

  // Stats
  const stats = useMemo<ProjectStats>(() => {
    const byStatus = projects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<ProjectStatus, number>);

    return {
      total: projects.length,
      byStatus,
      totalBudget: projects.reduce((sum, p) => sum + p.budget.totalBudget, 0),
      totalSpent: projects.reduce((sum, p) => sum + p.budget.spent, 0),
      avgProgress: projects.length
        ? projects.reduce((sum, p) => sum + p.progress.physicalProgress, 0) / projects.length
        : 0,
    };
  }, [projects]);

  return { projects, summaries, stats, loading, error, refresh: fetchProjects };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectMutations
// ─────────────────────────────────────────────────────────────────

export function useProjectMutations(
  db: Firestore,
  userId: string
): UseProjectMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const createProject = useCallback(
    async (data: ProjectFormData): Promise<Project> => {
      setLoading(true);
      setError(null);

      try {
        const result = await service.createProject(data, userId);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create project');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateProject(projectId, updates, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update project');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateStatus = useCallback(
    async (projectId: string, status: ProjectStatus, _notes?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateProjectStatus(projectId, status, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update status');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const deleteProject = useCallback(
    async (projectId: string, _reason?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.deleteProject(projectId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete project');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { createProject, updateProject, updateStatus, deleteProject, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgressRecording
// ─────────────────────────────────────────────────────────────────

export function useProgressRecording(
  db: Firestore,
  projectId: string | null,
  userId: string
): UseProgressRecordingResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const recordProgress = useCallback(
    async (record: Omit<ProgressRecord, 'id' | 'recordedBy' | 'recordedAt'>): Promise<string> => {
      if (!projectId) throw new Error('No project selected');

      setLoading(true);
      setError(null);

      try {
        const id = await service.recordProgress(projectId, record, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to record progress');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  return { recordProgress, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useTimelineExtensions
// ─────────────────────────────────────────────────────────────────

export function useTimelineExtensions(
  db: Firestore,
  projectId: string | null,
  userId: string
): UseTimelineExtensionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const requestExtension = useCallback(
    async (data: {
      requestDate: Date;
      requestedDays: number;
      reason: ExtensionReason;
      justification: string;
      supportingDocs?: string[];
    }): Promise<string> => {
      if (!projectId) throw new Error('No project selected');

      setLoading(true);
      setError(null);

      try {
        const id = await service.requestExtension(projectId, data as any, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to request extension');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  const approveExtension = useCallback(
    async (extensionId: string, approvedDays: number): Promise<void> => {
      if (!projectId) throw new Error('No project selected');

      setLoading(true);
      setError(null);

      try {
        await service.approveExtension(projectId, extensionId, approvedDays, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to approve extension');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  return { requestExtension, approveExtension, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useLocationUpdate
// ─────────────────────────────────────────────────────────────────

export function useLocationUpdate(
  db: Firestore,
  projectId: string | null,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const updateLocation = useCallback(
    async (location: Partial<ProjectLocation>): Promise<void> => {
      if (!projectId) throw new Error('No project selected');

      setLoading(true);
      setError(null);

      try {
        await service.updateLocation(projectId, location, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update location');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  return { updateLocation, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useBudgetUpdate
// ─────────────────────────────────────────────────────────────────

export function useBudgetUpdate(
  db: Firestore,
  projectId: string | null,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const updateBudget = useCallback(
    async (budgetUpdates: Partial<ProjectBudget>): Promise<void> => {
      if (!projectId) throw new Error('No project selected');

      setLoading(true);
      setError(null);

      try {
        await service.updateBudget(projectId, budgetUpdates, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update budget');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  return { updateBudget, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useMatFlowLink
// ─────────────────────────────────────────────────────────────────

export function useMatFlowLink(
  db: Firestore,
  projectId: string | null,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProjectService.getInstance(db), [db]);

  const linkToMatFlow = useCallback(
    async (boqId: string): Promise<void> => {
      if (!projectId) throw new Error('No project selected');

      setLoading(true);
      setError(null);

      try {
        await service.linkToMatFlow(projectId, boqId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to link to MatFlow');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  return { linkToMatFlow, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectFilters
// ─────────────────────────────────────────────────────────────────

export function useProjectFilters(projects: Project[]) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'progress' | 'budget'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Region filter
    if (regionFilter !== 'all') {
      result = result.filter(p => p.location.region === regionFilter);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.projectCode.toLowerCase().includes(query) ||
        p.location.siteName.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'progress':
          comparison = a.progress.physicalProgress - b.progress.physicalProgress;
          break;
        case 'budget':
          comparison = a.budget.totalBudget - b.budget.totalBudget;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [projects, statusFilter, regionFilter, searchQuery, sortBy, sortOrder]);

  const regions = useMemo(() => {
    const uniqueRegions = new Set(projects.map(p => p.location.region));
    return Array.from(uniqueRegions).sort();
  }, [projects]);

  return {
    filteredProjects,
    filters: {
      statusFilter,
      setStatusFilter,
      regionFilter,
      setRegionFilter,
      searchQuery,
      setSearchQuery,
      sortBy,
      setSortBy,
      sortOrder,
      setSortOrder,
    },
    filterOptions: {
      regions,
      statuses: [
        'planning', 'procurement', 'mobilization', 'active',
        'substantial_completion', 'defects_liability', 'completed',
        'suspended', 'cancelled'
      ] as ProjectStatus[],
    },
  };
}
