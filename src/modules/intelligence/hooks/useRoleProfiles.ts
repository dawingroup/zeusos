/**
 * Role Profile Hooks - DawinOS v2.0
 * React hooks for role profile management
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import {
  RoleProfile,
  RoleProfileId,
  RoleAssignment,
  RoleMatchCriteria,
  RoleMatchResult,
} from '../types/role-profile.types';
import {
  getRoleProfile,
  findMatchingRoles,
  getEmployeeRoleAssignment,
} from '../services/role-profile.service';
import { SubsidiaryId } from '../config/constants';

/**
 * Async state interface for hooks
 */
interface AsyncState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Hook for managing role profiles
 */
export function useRoleProfiles(subsidiaryId?: SubsidiaryId) {
  const [state, setState] = useState<AsyncState<RoleProfile[]>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!subsidiaryId) {
      setState({ loading: false, data: [], error: null });
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.ROLE_PROFILES),
      where('status', '==', 'active'),
      where('subsidiaryId', 'in', [subsidiaryId, 'all']),
      orderBy('jobLevel'),
      orderBy('title')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const roles = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as RoleProfile));
        setState({ loading: false, data: roles, error: null });
      },
      (error) => {
        console.error('Error fetching role profiles:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [subsidiaryId]);

  const fetchRole = useCallback(async (id: RoleProfileId) => {
    return getRoleProfile(id);
  }, []);

  return {
    ...state,
    roles: state.data || [],
    fetchRole,
  };
}

/**
 * Hook for a single role profile
 */
export function useRoleProfile(roleId: RoleProfileId | undefined) {
  const [state, setState] = useState<AsyncState<RoleProfile>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!roleId) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.ROLE_PROFILES),
      {
        next: async () => {
          try {
            const role = await getRoleProfile(roleId);
            setState({ loading: false, data: role, error: null });
          } catch (error: any) {
            setState({ loading: false, data: null, error: error.message });
          }
        },
        error: (error) => {
          setState({ loading: false, data: null, error: error.message });
        },
      }
    );

    return () => unsubscribe();
  }, [roleId]);

  return {
    ...state,
    role: state.data,
  };
}

/**
 * Hook for employee role assignment
 */
export function useEmployeeRole(employeeId: string | undefined) {
  const [state, setState] = useState<AsyncState<{
    assignment: RoleAssignment | null;
    profile: RoleProfile | null;
  }>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!employeeId) {
      setState({ loading: false, data: { assignment: null, profile: null }, error: null });
      return;
    }

    async function fetchRoleData() {
      try {
        const assignment = await getEmployeeRoleAssignment(employeeId!);
        let profile: RoleProfile | null = null;

        if (assignment) {
          profile = await getRoleProfile(assignment.roleProfileId);
        }

        setState({
          loading: false,
          data: { assignment, profile },
          error: null,
        });
      } catch (error: any) {
        console.error('Error fetching employee role:', error);
        setState({
          loading: false,
          data: null,
          error: error.message,
        });
      }
    }

    fetchRoleData();
  }, [employeeId]);

  return {
    ...state,
    assignment: state.data?.assignment || null,
    profile: state.data?.profile || null,
  };
}

/**
 * Hook for role matching
 */
export function useRoleMatcher() {
  const [state, setState] = useState<AsyncState<RoleMatchResult[]>>({
    loading: false,
    data: null,
    error: null,
  });

  const findMatches = useCallback(async (criteria: RoleMatchCriteria) => {
    setState({ loading: true, data: null, error: null });

    try {
      const results = await findMatchingRoles(criteria);
      setState({ loading: false, data: results, error: null });
      return results;
    } catch (error: any) {
      console.error('Error matching roles:', error);
      setState({ loading: false, data: null, error: error.message });
      return [];
    }
  }, []);

  const clearMatches = useCallback(() => {
    setState({ loading: false, data: null, error: null });
  }, []);

  return {
    ...state,
    matches: state.data || [],
    findMatches,
    clearMatches,
  };
}

/**
 * Hook for role capabilities check
 */
export function useRoleCapabilities(roleId: RoleProfileId | undefined) {
  const { role, loading, error } = useRoleProfile(roleId);

  const canHandleEvent = useCallback((eventType: string) => {
    if (!role) return false;
    return role.taskCapabilities.some(cap => cap.eventType === eventType);
  }, [role]);

  const canExecuteTask = useCallback((eventType: string, taskType: string) => {
    if (!role) return false;
    const capability = role.taskCapabilities.find(cap => cap.eventType === eventType);
    return capability?.taskTypes.includes(taskType) && capability?.canExecute;
  }, [role]);

  const canApproveTask = useCallback((eventType: string, taskType: string) => {
    if (!role) return false;
    const capability = role.taskCapabilities.find(cap => cap.eventType === eventType);
    return capability?.taskTypes.includes(taskType) && capability?.canApprove;
  }, [role]);

  const hasAuthority = useCallback((authorityType: string) => {
    if (!role) return false;
    return role.approvalAuthorities.some(auth => auth.type === authorityType);
  }, [role]);

  const getApprovalLimit = useCallback((authorityType: string) => {
    if (!role) return null;
    const authority = role.approvalAuthorities.find(auth => auth.type === authorityType);
    return authority?.maxAmount || null;
  }, [role]);

  return {
    role,
    loading,
    error,
    canHandleEvent,
    canExecuteTask,
    canApproveTask,
    hasAuthority,
    getApprovalLimit,
  };
}
