/**
 * PROGRAM HOOKS
 * 
 * React hooks for consuming program service functionality.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import {
  Program,
  CreateProgramData,
  UpdateProgramData,
  ProgramStatus,
} from '../types/program';
import { BudgetAllocation } from '../types/program-budget';
import { ProgramTeamMember, ProgramTeamRole } from '../types/program-team';
import { ProgramService } from '../services/program-service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface UseProgramResult {
  program: Program | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseProgramsResult {
  programs: Program[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UseProgramMutationsResult {
  createProgram: (data: CreateProgramData) => Promise<Program>;
  updateProgram: (programId: string, data: UpdateProgramData) => Promise<void>;
  updateStatus: (programId: string, status: ProgramStatus, reason?: string) => Promise<void>;
  deleteProgram: (programId: string, reason?: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

interface UseTeamManagementResult {
  addMember: (member: Omit<ProgramTeamMember, 'addedBy' | 'addedAt'>) => Promise<void>;
  updateMember: (memberId: string, updates: Partial<ProgramTeamMember>) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

interface UseBudgetManagementResult {
  updateAllocation: (allocation: BudgetAllocation) => Promise<void>;
  updateAllocated: (data: { amount: number; currency: string }) => Promise<void>;
  recalculate: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

interface UseProgramExtensionsResult {
  requestExtension: (newEndDate: Date, reason: string) => Promise<string>;
  approveExtension: (extensionId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgram
// ─────────────────────────────────────────────────────────────────

/**
 * Hook to fetch and subscribe to a single program
 */
export function useProgram(
  db: Firestore,
  programId: string | null,
  options: { realtime?: boolean } = {}
): UseProgramResult {
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);

  const fetchProgram = useCallback(async () => {
    if (!programId) {
      setProgram(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getProgram(programId);
      setProgram(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch program'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    if (!programId) {
      setProgram(null);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToProgram(programId, (data) => {
        setProgram(data);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      fetchProgram();
    }
  }, [programId, options.realtime, service, fetchProgram]);

  return {
    program,
    loading,
    error,
    refresh: fetchProgram,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramsForEngagement
// ─────────────────────────────────────────────────────────────────

/**
 * Hook to fetch programs for an engagement
 */
export function useProgramsForEngagement(
  db: Firestore,
  engagementId: string | null,
  options: {
    status?: ProgramStatus[];
    orderBy?: 'name' | 'createdAt' | 'startDate';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    realtime?: boolean;
  } = {}
): UseProgramsResult {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);
  const optionsKey = JSON.stringify(options);

  const fetchPrograms = useCallback(async () => {
    if (!engagementId) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getProgramsForEngagement(engagementId, {
        status: options.status,
        orderByField: options.orderBy,
        orderDirection: options.orderDirection,
        limitCount: options.limit,
      });
      setPrograms(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch programs'));
    } finally {
      setLoading(false);
    }
  }, [service, engagementId, optionsKey]);

  useEffect(() => {
    if (!engagementId) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToProgramsForEngagement(engagementId, (data) => {
        let filtered = data;
        if (options.status?.length) {
          filtered = data.filter(p => options.status!.includes(p.status));
        }
        setPrograms(filtered);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      fetchPrograms();
    }
  }, [engagementId, options.realtime, optionsKey, service, fetchPrograms]);

  return {
    programs,
    loading,
    error,
    refresh: fetchPrograms,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useAllPrograms
// ─────────────────────────────────────────────────────────────────

/**
 * Hook to fetch all programs
 */
export function useAllPrograms(
  db: Firestore,
  options: {
    status?: ProgramStatus[];
    orderBy?: 'name' | 'createdAt' | 'startDate' | 'updatedAt';
    orderDirection?: 'asc' | 'desc';
    limit?: number;
  } = {}
): UseProgramsResult {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);
  const optionsKey = JSON.stringify(options);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await service.getAllPrograms({
        status: options.status,
        orderByField: options.orderBy,
        orderDirection: options.orderDirection,
        limitCount: options.limit,
      });
      setPrograms(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch programs'));
    } finally {
      setLoading(false);
    }
  }, [service, optionsKey]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  return {
    programs,
    loading,
    error,
    refresh: fetchPrograms,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useMyPrograms
// ─────────────────────────────────────────────────────────────────

/**
 * Hook to fetch programs for current user
 */
export function useMyPrograms(
  db: Firestore,
  userId: string | null,
  options: {
    status?: ProgramStatus[];
    role?: 'manager' | 'team';
    limit?: number;
  } = {}
): UseProgramsResult {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);
  const optionsKey = JSON.stringify(options);

  const fetchPrograms = useCallback(async () => {
    if (!userId) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result: Program[];
      
      if (options.role === 'manager') {
        result = await service.getProgramsForManager(userId, {
          status: options.status,
          limitCount: options.limit,
        });
      } else {
        const [managerPrograms, teamPrograms] = await Promise.all([
          service.getProgramsForManager(userId, {
            status: options.status,
            limitCount: options.limit,
          }),
          service.getProgramsForTeamMember(userId, {
            status: options.status,
            limitCount: options.limit,
          }),
        ]);
        
        const programMap = new Map<string, Program>();
        [...managerPrograms, ...teamPrograms].forEach(p => {
          programMap.set(p.id, p);
        });
        result = Array.from(programMap.values());
      }

      setPrograms(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch programs'));
    } finally {
      setLoading(false);
    }
  }, [service, userId, optionsKey]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  return {
    programs,
    loading,
    error,
    refresh: fetchPrograms,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramMutations
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for program mutations
 */
export function useProgramMutations(
  db: Firestore,
  userId: string
): UseProgramMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);

  const createProgram = useCallback(
    async (data: CreateProgramData): Promise<Program> => {
      setLoading(true);
      setError(null);

      try {
        const result = await service.createProgram(data, userId);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create program');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateProgram = useCallback(
    async (programId: string, data: UpdateProgramData): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateProgram(programId, data, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update program');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateStatus = useCallback(
    async (programId: string, status: ProgramStatus, reason?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateStatus(programId, status, userId, reason);
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

  const deleteProgram = useCallback(
    async (programId: string, reason?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.deleteProgram(programId, userId, reason);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete program');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return {
    createProgram,
    updateProgram,
    updateStatus,
    deleteProgram,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useTeamManagement
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for team management
 */
export function useTeamManagement(
  db: Firestore,
  programId: string | null,
  userId: string
): UseTeamManagementResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);

  const addMember = useCallback(
    async (member: Omit<ProgramTeamMember, 'addedBy' | 'addedAt'>): Promise<void> => {
      if (!programId) throw new Error('No program selected');
      
      setLoading(true);
      setError(null);

      try {
        await service.addTeamMember(programId, member, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add team member');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  const updateMember = useCallback(
    async (memberId: string, updates: Partial<ProgramTeamMember>): Promise<void> => {
      if (!programId) throw new Error('No program selected');
      
      setLoading(true);
      setError(null);

      try {
        await service.updateTeamMember(programId, memberId, updates, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update team member');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  const removeMember = useCallback(
    async (memberId: string): Promise<void> => {
      if (!programId) throw new Error('No program selected');
      
      setLoading(true);
      setError(null);

      try {
        await service.removeTeamMember(programId, memberId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to remove team member');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  return {
    addMember,
    updateMember,
    removeMember,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useBudgetManagement
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for budget management
 */
export function useBudgetManagement(
  db: Firestore,
  programId: string | null,
  userId: string
): UseBudgetManagementResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);

  const updateAllocation = useCallback(
    async (allocation: BudgetAllocation): Promise<void> => {
      if (!programId) throw new Error('No program selected');
      
      setLoading(true);
      setError(null);

      try {
        await service.updateBudgetAllocation(programId, allocation, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update allocation');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  const updateAllocated = useCallback(
    async (data: { amount: number; currency: string }): Promise<void> => {
      if (!programId) throw new Error('No program selected');

      setLoading(true);
      setError(null);

      try {
        await service.updateBudgetAllocated(programId, data, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update budget');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  const recalculate = useCallback(async (): Promise<void> => {
    if (!programId) throw new Error('No program selected');

    setLoading(true);
    setError(null);

    try {
      await service.recalculateBudget(programId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to recalculate budget');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  return {
    updateAllocation,
    updateAllocated,
    recalculate,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramExtensions
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for managing program extensions
 */
export function useProgramExtensions(
  db: Firestore,
  programId: string | null,
  userId: string
): UseProgramExtensionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgramService.getInstance(db), [db]);

  const requestExtension = useCallback(
    async (newEndDate: Date, reason: string): Promise<string> => {
      if (!programId) throw new Error('No program selected');
      
      setLoading(true);
      setError(null);

      try {
        const extensionId = await service.requestExtension(programId, newEndDate, reason, userId);
        return extensionId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to request extension');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  const approveExtension = useCallback(
    async (extensionId: string): Promise<void> => {
      if (!programId) throw new Error('No program selected');
      
      setLoading(true);
      setError(null);

      try {
        await service.approveExtension(programId, extensionId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to approve extension');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, programId, userId]
  );

  return {
    requestExtension,
    approveExtension,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramStats
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for program statistics
 */
export function useProgramStats(program: Program | null) {
  return useMemo(() => {
    if (!program) {
      return {
        projectCount: 0,
        activeProjects: 0,
        completedProjects: 0,
        budgetUtilization: 0,
        physicalProgress: 0,
        financialProgress: 0,
        health: 'healthy' as const,
      };
    }

    const stats = program.projectStats;
    const budget = program.budget;

    const activeProjects = stats.byStatus.construction + stats.byStatus.mobilization;
    const completedProjects = stats.byStatus.completed;

    const budgetUtilization = budget.allocated.amount > 0
      ? (budget.spent.amount / budget.allocated.amount) * 100
      : 0;

    let health: 'healthy' | 'at_risk' | 'critical' = 'healthy';
    if (stats.total > 0) {
      const delayedPercent = (stats.byHealth.delayed / stats.total) * 100;
      const atRiskPercent = (stats.byHealth.atRisk / stats.total) * 100;
      if (delayedPercent > 30) health = 'critical';
      else if (delayedPercent > 10 || atRiskPercent > 30) health = 'at_risk';
    }

    return {
      projectCount: stats.total,
      activeProjects,
      completedProjects,
      budgetUtilization,
      physicalProgress: stats.progress.weightedPhysical,
      financialProgress: stats.progress.weightedFinancial,
      health,
    };
  }, [program]);
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramTeam
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for accessing program team
 */
export function useProgramTeam(program: Program | null) {
  return useMemo(() => {
    if (!program) {
      return {
        members: [],
        manager: null,
        byRole: {} as Record<ProgramTeamRole, ProgramTeamMember[]>,
        activeCount: 0,
      };
    }

    const activeMembers = program.team.filter(m => m.isActive);
    const manager = activeMembers.find(m => m.role === 'program_manager');

    const byRole: Record<string, ProgramTeamMember[]> = {};
    activeMembers.forEach(m => {
      if (!byRole[m.role]) byRole[m.role] = [];
      byRole[m.role].push(m);
    });

    return {
      members: activeMembers,
      manager,
      byRole: byRole as Record<ProgramTeamRole, ProgramTeamMember[]>,
      activeCount: activeMembers.length,
    };
  }, [program]);
}
