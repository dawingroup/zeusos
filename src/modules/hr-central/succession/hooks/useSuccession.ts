// ============================================================================
// SUCCESSION HOOK
// DawinOS v2.0 - HR Module
// React hook for Succession Planning
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  CriticalRole,
  DevelopmentPlan,
  TalentPool,
  SuccessionPlan,
  SuccessionAnalytics,
  CriticalRoleFilters,
  DevelopmentPlanFilters,
} from '../types/succession.types';
import {
  CriticalRoleInput,
  SuccessorCandidateInput,
  DevelopmentPlanInput,
  TalentPoolInput,
  TalentPoolMemberInput,
  SuccessionPlanInput,
} from '../schemas/succession.schemas';
import {
  getCriticalRoles,
  getCriticalRole,
  createCriticalRole,
  updateCriticalRole,
  deleteCriticalRole,
  addSuccessorCandidate,
  updateSuccessorCandidate,
  removeSuccessorCandidate,
  getDevelopmentPlans,
  getDevelopmentPlan,
  createDevelopmentPlan,
  updateDevelopmentPlan,
  updateDevelopmentActionProgress,
  activateDevelopmentPlan,
  deleteDevelopmentPlan,
  getTalentPools,
  createTalentPool,
  addTalentPoolMember,
  removeTalentPoolMember,
  deleteTalentPool,
  getSuccessionPlans,
  createSuccessionPlan,
  updateSuccessionPlanStatus,
  getSuccessionAnalytics,
} from '../services/successionService';
import {
  NineBoxCategory,
  ReadinessLevel,
  ActionStatus,
  SuccessionPlanStatus,
} from '../constants/succession.constants';
import { useAuth } from '@/core/hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

interface UseSuccessionOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseSuccessionReturn {
  // Data
  criticalRoles: CriticalRole[];
  currentRole: CriticalRole | null;
  developmentPlans: DevelopmentPlan[];
  currentPlan: DevelopmentPlan | null;
  talentPools: TalentPool[];
  successionPlans: SuccessionPlan[];
  analytics: SuccessionAnalytics | null;

  // State
  isLoading: boolean;
  error: string | null;

  // Critical Role Operations
  loadCriticalRoles: (filters?: CriticalRoleFilters) => Promise<void>;
  loadCriticalRole: (roleId: string) => Promise<CriticalRole | null>;
  addCriticalRole: (input: CriticalRoleInput, incumbentName?: string) => Promise<CriticalRole | null>;
  editCriticalRole: (roleId: string, updates: Partial<CriticalRoleInput>) => Promise<boolean>;
  removeCriticalRole: (roleId: string) => Promise<boolean>;
  setCurrentRole: (role: CriticalRole | null) => void;

  // Successor Operations
  addSuccessor: (roleId: string, input: SuccessorCandidateInput) => Promise<CriticalRole | null>;
  updateSuccessor: (roleId: string, successorId: string, updates: Partial<SuccessorCandidateInput>) => Promise<CriticalRole | null>;
  removeSuccessor: (roleId: string, successorId: string) => Promise<CriticalRole | null>;

  // Development Plan Operations
  loadDevelopmentPlans: (filters?: DevelopmentPlanFilters) => Promise<void>;
  loadDevelopmentPlan: (planId: string) => Promise<DevelopmentPlan | null>;
  addDevelopmentPlan: (input: DevelopmentPlanInput, employeeName: string) => Promise<DevelopmentPlan | null>;
  editDevelopmentPlan: (planId: string, updates: Partial<DevelopmentPlanInput>) => Promise<boolean>;
  updateActionProgress: (planId: string, actionId: string, progress: number, status?: ActionStatus, outcome?: string) => Promise<DevelopmentPlan | null>;
  activatePlan: (planId: string) => Promise<boolean>;
  removeDevelopmentPlan: (planId: string) => Promise<boolean>;
  setCurrentPlan: (plan: DevelopmentPlan | null) => void;

  // Talent Pool Operations
  loadTalentPools: () => Promise<void>;
  addTalentPool: (input: TalentPoolInput) => Promise<TalentPool | null>;
  addPoolMember: (poolId: string, input: TalentPoolMemberInput, nineBox: NineBoxCategory, readiness: ReadinessLevel) => Promise<TalentPool | null>;
  removePoolMember: (poolId: string, employeeId: string) => Promise<TalentPool | null>;
  removeTalentPool: (poolId: string) => Promise<boolean>;

  // Succession Plan Operations
  loadSuccessionPlans: () => Promise<void>;
  addSuccessionPlan: (input: SuccessionPlanInput) => Promise<SuccessionPlan | null>;
  updatePlanStatus: (planId: string, status: SuccessionPlanStatus) => Promise<boolean>;

  // Analytics
  loadAnalytics: () => Promise<void>;

  // Utility
  clearError: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export const useSuccession = ({
  companyId,
  autoLoad = true,
}: UseSuccessionOptions): UseSuccessionReturn => {
  const { user } = useAuth();

  // Data State
  const [criticalRoles, setCriticalRoles] = useState<CriticalRole[]>([]);
  const [currentRole, setCurrentRole] = useState<CriticalRole | null>(null);
  const [developmentPlans, setDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<DevelopmentPlan | null>(null);
  const [talentPools, setTalentPools] = useState<TalentPool[]>([]);
  const [successionPlans, setSuccessionPlans] = useState<SuccessionPlan[]>([]);
  const [analytics, setAnalytics] = useState<SuccessionAnalytics | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // =========================================================================
  // CRITICAL ROLE OPERATIONS
  // =========================================================================

  const loadCriticalRoles = useCallback(async (filters?: CriticalRoleFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const roles = await getCriticalRoles(companyId, filters);
      setCriticalRoles(roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load critical roles');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const loadCriticalRole = useCallback(async (roleId: string): Promise<CriticalRole | null> => {
    if (!companyId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const role = await getCriticalRole(companyId, roleId);
      if (role) setCurrentRole(role);
      return role;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load critical role');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addCriticalRole = useCallback(async (
    input: CriticalRoleInput,
    incumbentName?: string
  ): Promise<CriticalRole | null> => {
    if (!companyId) return null;
    setError(null);
    try {
      const role = await createCriticalRole(companyId, input, incumbentName, user?.uid);
      setCriticalRoles(prev => [...prev, role]);
      return role;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create critical role');
      return null;
    }
  }, [companyId, user?.uid]);

  const editCriticalRole = useCallback(async (
    roleId: string,
    updates: Partial<CriticalRoleInput>
  ): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await updateCriticalRole(companyId, roleId, updates);
      await loadCriticalRoles();
      if (currentRole?.id === roleId) {
        const updated = await getCriticalRole(companyId, roleId);
        setCurrentRole(updated);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update critical role');
      return false;
    }
  }, [companyId, currentRole?.id, loadCriticalRoles]);

  const removeCriticalRole = useCallback(async (roleId: string): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await deleteCriticalRole(companyId, roleId);
      setCriticalRoles(prev => prev.filter(r => r.id !== roleId));
      if (currentRole?.id === roleId) setCurrentRole(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete critical role');
      return false;
    }
  }, [companyId, currentRole?.id]);

  // =========================================================================
  // SUCCESSOR OPERATIONS
  // =========================================================================

  const addSuccessor = useCallback(async (
    roleId: string,
    input: SuccessorCandidateInput
  ): Promise<CriticalRole | null> => {
    if (!companyId || !user) return null;
    setError(null);
    try {
      const updated = await addSuccessorCandidate(companyId, roleId, input, user.uid);
      setCriticalRoles(prev => prev.map(r => r.id === roleId ? updated : r));
      if (currentRole?.id === roleId) setCurrentRole(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add successor');
      return null;
    }
  }, [companyId, user, currentRole?.id]);

  const updateSuccessor = useCallback(async (
    roleId: string,
    successorId: string,
    updates: Partial<SuccessorCandidateInput>
  ): Promise<CriticalRole | null> => {
    if (!companyId || !user) return null;
    setError(null);
    try {
      const updated = await updateSuccessorCandidate(companyId, roleId, successorId, updates, user.uid);
      setCriticalRoles(prev => prev.map(r => r.id === roleId ? updated : r));
      if (currentRole?.id === roleId) setCurrentRole(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update successor');
      return null;
    }
  }, [companyId, user, currentRole?.id]);

  const removeSuccessor = useCallback(async (
    roleId: string,
    successorId: string
  ): Promise<CriticalRole | null> => {
    if (!companyId) return null;
    setError(null);
    try {
      const updated = await removeSuccessorCandidate(companyId, roleId, successorId);
      setCriticalRoles(prev => prev.map(r => r.id === roleId ? updated : r));
      if (currentRole?.id === roleId) setCurrentRole(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove successor');
      return null;
    }
  }, [companyId, currentRole?.id]);

  // =========================================================================
  // DEVELOPMENT PLAN OPERATIONS
  // =========================================================================

  const loadDevelopmentPlans = useCallback(async (filters?: DevelopmentPlanFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const plans = await getDevelopmentPlans(companyId, filters);
      setDevelopmentPlans(plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load development plans');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const loadDevelopmentPlan = useCallback(async (planId: string): Promise<DevelopmentPlan | null> => {
    if (!companyId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const plan = await getDevelopmentPlan(companyId, planId);
      if (plan) setCurrentPlan(plan);
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load development plan');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addDevelopmentPlan = useCallback(async (
    input: DevelopmentPlanInput,
    employeeName: string
  ): Promise<DevelopmentPlan | null> => {
    if (!companyId || !user) return null;
    setError(null);
    try {
      const plan = await createDevelopmentPlan(companyId, input, employeeName, user.uid);
      setDevelopmentPlans(prev => [...prev, plan]);
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create development plan');
      return null;
    }
  }, [companyId, user]);

  const editDevelopmentPlan = useCallback(async (
    planId: string,
    updates: Partial<DevelopmentPlanInput>
  ): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await updateDevelopmentPlan(companyId, planId, updates);
      await loadDevelopmentPlans();
      if (currentPlan?.id === planId) {
        const updated = await getDevelopmentPlan(companyId, planId);
        setCurrentPlan(updated);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update development plan');
      return false;
    }
  }, [companyId, currentPlan?.id, loadDevelopmentPlans]);

  const updateActionProgress = useCallback(async (
    planId: string,
    actionId: string,
    progress: number,
    status?: ActionStatus,
    outcome?: string
  ): Promise<DevelopmentPlan | null> => {
    if (!companyId) return null;
    setError(null);
    try {
      const updated = await updateDevelopmentActionProgress(companyId, planId, actionId, progress, status, outcome);
      setDevelopmentPlans(prev => prev.map(p => p.id === planId ? updated : p));
      if (currentPlan?.id === planId) setCurrentPlan(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
      return null;
    }
  }, [companyId, currentPlan?.id]);

  const activatePlan = useCallback(async (planId: string): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await activateDevelopmentPlan(companyId, planId);
      setDevelopmentPlans(prev => prev.map(p =>
        p.id === planId ? { ...p, status: 'active' as const } : p
      ));
      if (currentPlan?.id === planId) {
        setCurrentPlan(prev => prev ? { ...prev, status: 'active' } : null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate plan');
      return false;
    }
  }, [companyId, currentPlan?.id]);

  const removeDevelopmentPlan = useCallback(async (planId: string): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await deleteDevelopmentPlan(companyId, planId);
      setDevelopmentPlans(prev => prev.filter(p => p.id !== planId));
      if (currentPlan?.id === planId) setCurrentPlan(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete development plan');
      return false;
    }
  }, [companyId, currentPlan?.id]);

  // =========================================================================
  // TALENT POOL OPERATIONS
  // =========================================================================

  const loadTalentPools = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const pools = await getTalentPools(companyId);
      setTalentPools(pools);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load talent pools');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addTalentPool = useCallback(async (input: TalentPoolInput): Promise<TalentPool | null> => {
    if (!companyId || !user) return null;
    setError(null);
    try {
      const pool = await createTalentPool(companyId, input, user.uid, user.displayName || 'Unknown');
      setTalentPools(prev => [...prev, pool]);
      return pool;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create talent pool');
      return null;
    }
  }, [companyId, user]);

  const addPoolMember = useCallback(async (
    poolId: string,
    input: TalentPoolMemberInput,
    nineBox: NineBoxCategory,
    readiness: ReadinessLevel
  ): Promise<TalentPool | null> => {
    if (!companyId || !user) return null;
    setError(null);
    try {
      const updated = await addTalentPoolMember(companyId, poolId, input, nineBox, readiness, user.uid);
      setTalentPools(prev => prev.map(p => p.id === poolId ? updated : p));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add pool member');
      return null;
    }
  }, [companyId, user]);

  const removePoolMember = useCallback(async (
    poolId: string,
    employeeId: string
  ): Promise<TalentPool | null> => {
    if (!companyId) return null;
    setError(null);
    try {
      const updated = await removeTalentPoolMember(companyId, poolId, employeeId);
      setTalentPools(prev => prev.map(p => p.id === poolId ? updated : p));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove pool member');
      return null;
    }
  }, [companyId]);

  const removeTalentPoolFn = useCallback(async (poolId: string): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await deleteTalentPool(companyId, poolId);
      setTalentPools(prev => prev.filter(p => p.id !== poolId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete talent pool');
      return false;
    }
  }, [companyId]);

  // =========================================================================
  // SUCCESSION PLAN OPERATIONS
  // =========================================================================

  const loadSuccessionPlans = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const plans = await getSuccessionPlans(companyId);
      setSuccessionPlans(plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load succession plans');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addSuccessionPlan = useCallback(async (
    input: SuccessionPlanInput
  ): Promise<SuccessionPlan | null> => {
    if (!companyId) return null;
    setError(null);
    try {
      const plan = await createSuccessionPlan(companyId, input, criticalRoles);
      setSuccessionPlans(prev => [...prev, plan]);
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create succession plan');
      return null;
    }
  }, [companyId, criticalRoles]);

  const updatePlanStatus = useCallback(async (
    planId: string,
    status: SuccessionPlanStatus
  ): Promise<boolean> => {
    if (!companyId) return false;
    setError(null);
    try {
      await updateSuccessionPlanStatus(companyId, planId, status, user?.uid);
      setSuccessionPlans(prev => prev.map(p =>
        p.id === planId ? { ...p, status } : p
      ));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan status');
      return false;
    }
  }, [companyId, user?.uid]);

  // =========================================================================
  // ANALYTICS
  // =========================================================================

  const loadAnalytics = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const data = await getSuccessionAnalytics(companyId);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    }
  }, [companyId]);

  // =========================================================================
  // AUTO-LOAD
  // =========================================================================

  useEffect(() => {
    if (autoLoad && companyId) {
      loadCriticalRoles();
      loadDevelopmentPlans();
      loadTalentPools();
      loadSuccessionPlans();
      loadAnalytics();
    }
  }, [autoLoad, companyId, loadCriticalRoles, loadDevelopmentPlans, loadTalentPools, loadSuccessionPlans, loadAnalytics]);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    // Data
    criticalRoles,
    currentRole,
    developmentPlans,
    currentPlan,
    talentPools,
    successionPlans,
    analytics,

    // State
    isLoading,
    error,

    // Critical Role Operations
    loadCriticalRoles,
    loadCriticalRole,
    addCriticalRole,
    editCriticalRole,
    removeCriticalRole,
    setCurrentRole,

    // Successor Operations
    addSuccessor,
    updateSuccessor,
    removeSuccessor,

    // Development Plan Operations
    loadDevelopmentPlans,
    loadDevelopmentPlan,
    addDevelopmentPlan,
    editDevelopmentPlan,
    updateActionProgress,
    activatePlan,
    removeDevelopmentPlan,
    setCurrentPlan,

    // Talent Pool Operations
    loadTalentPools,
    addTalentPool,
    addPoolMember,
    removePoolMember,
    removeTalentPool: removeTalentPoolFn,

    // Succession Plan Operations
    loadSuccessionPlans,
    addSuccessionPlan,
    updatePlanStatus,

    // Analytics
    loadAnalytics,

    // Utility
    clearError,
  };
};
