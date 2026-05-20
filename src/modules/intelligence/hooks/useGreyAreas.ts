/**
 * Grey Area Hooks - DawinOS v2.0
 * React hooks for grey area detection and management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import {
  GreyArea,
  GreyAreaId,
  GreyAreaStatus,
  GreyAreaResolution,
  GreyAreaInput,
} from '../types/grey-area.types';
import {
  updateGreyAreaStatus,
  assignGreyArea,
  escalateGreyArea,
  resolveGreyArea,
  dismissGreyArea,
  requestGreyAreaInput,
  provideGreyAreaInput,
} from '../services/grey-area-detection.service';

/**
 * Async state interface for hooks
 */
interface AsyncState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Hook for employee's assigned grey areas
 */
export function useEmployeeGreyAreas(employeeId: string | null) {
  const [state, setState] = useState<AsyncState<GreyArea[]>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!employeeId) {
      setState({ loading: false, data: [], error: null });
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.GREY_AREAS),
      where('assignedTo.id', '==', employeeId),
      where('status', 'in', ['detected', 'under_review', 'pending_input', 'escalated']),
      orderBy('severity', 'desc'),
      orderBy('resolutionDeadline', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const greyAreas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as GreyArea[];

        setState({ loading: false, data: greyAreas, error: null });
      },
      (error) => {
        console.error('Error loading grey areas:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [employeeId]);

  // Computed properties
  const greyAreas = state.data || [];
  const criticalCount = greyAreas.filter(g => g.severity === 'critical').length;
  const overdueCount = greyAreas.filter(g => 
    g.resolutionDeadline && g.resolutionDeadline.toDate() < new Date()
  ).length;

  return {
    ...state,
    greyAreas,
    totalCount: greyAreas.length,
    criticalCount,
    overdueCount,
  };
}

/**
 * Hook for a single grey area with real-time updates
 */
export function useGreyArea(greyAreaId: GreyAreaId | null) {
  const [state, setState] = useState<AsyncState<GreyArea>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!greyAreaId) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.GREY_AREAS, greyAreaId),
      (snapshot) => {
        if (snapshot.exists()) {
          setState({
            loading: false,
            data: { id: snapshot.id, ...snapshot.data() } as GreyArea,
            error: null,
          });
        } else {
          setState({ loading: false, data: null, error: 'Grey area not found' });
        }
      },
      (error) => {
        console.error('Error loading grey area:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [greyAreaId]);

  return state;
}

/**
 * Hook for grey area actions
 */
export function useGreyAreaActions() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = useCallback(async <T>(
    action: () => Promise<T>
  ): Promise<T | null> => {
    setUpdating(true);
    setError(null);
    
    try {
      const result = await action();
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Update grey area status
   */
  const updateStatus = useCallback(async (
    greyAreaId: GreyAreaId,
    status: GreyAreaStatus,
    user: { id: string; name: string },
    notes?: string
  ) => {
    return handleAction(() => 
      updateGreyAreaStatus(greyAreaId, status, user.id, user.name, notes)
    );
  }, [handleAction]);

  /**
   * Assign grey area to someone
   */
  const assign = useCallback(async (
    greyAreaId: GreyAreaId,
    assignee: { id: string; name: string; email: string },
    assignedBy: { id: string; name: string }
  ) => {
    return handleAction(() =>
      assignGreyArea(greyAreaId, assignee, assignedBy)
    );
  }, [handleAction]);

  /**
   * Escalate grey area
   */
  const escalate = useCallback(async (
    greyAreaId: GreyAreaId,
    escalateTo: { id: string; name: string; email: string },
    reason: string,
    escalatedBy: { id: string; name: string }
  ) => {
    return handleAction(() =>
      escalateGreyArea(greyAreaId, escalateTo, reason, escalatedBy)
    );
  }, [handleAction]);

  /**
   * Resolve grey area
   */
  const resolve = useCallback(async (
    greyAreaId: GreyAreaId,
    resolution: Omit<GreyAreaResolution, 'resolvedAt' | 'resolvedBy'>,
    resolvedBy: { id: string; name: string }
  ) => {
    return handleAction(() =>
      resolveGreyArea(greyAreaId, resolution, resolvedBy)
    );
  }, [handleAction]);

  /**
   * Dismiss grey area
   */
  const dismiss = useCallback(async (
    greyAreaId: GreyAreaId,
    reason: string,
    dismissedBy: { id: string; name: string }
  ) => {
    return handleAction(() =>
      dismissGreyArea(greyAreaId, reason, dismissedBy)
    );
  }, [handleAction]);

  /**
   * Request additional input
   */
  const requestInput = useCallback(async (
    greyAreaId: GreyAreaId,
    question: string,
    inputType: 'text' | 'choice' | 'number' | 'date' | 'approval',
    required: boolean,
    requestedBy: { id: string; name: string },
    options?: string[]
  ) => {
    const input: Omit<GreyAreaInput, 'response'> = {
      requestedAt: Timestamp.now(),
      requestedBy: { userId: requestedBy.id, displayName: requestedBy.name, email: '' },
      question,
      inputType,
      options,
      required,
    };
    return handleAction(() =>
      requestGreyAreaInput(greyAreaId, input, requestedBy)
    );
  }, [handleAction]);

  /**
   * Provide requested input
   */
  const provideInput = useCallback(async (
    greyAreaId: GreyAreaId,
    inputIndex: number,
    value: any,
    providedBy: { id: string; name: string },
    notes?: string
  ) => {
    return handleAction(() =>
      provideGreyAreaInput(greyAreaId, inputIndex, value, providedBy, notes)
    );
  }, [handleAction]);

  return {
    updating,
    error,
    updateStatus,
    assign,
    escalate,
    resolve,
    dismiss,
    requestInput,
    provideInput,
  };
}

/**
 * Hook for grey area dashboard/overview
 */
export function useGreyAreaOverview(filters: {
  subsidiaryId?: string;
  departmentId?: string;
}) {
  const [state, setState] = useState<AsyncState<{
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    overdue: number;
    critical: number;
  }>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let q = query(
      collection(db, COLLECTIONS.GREY_AREAS),
      where('status', 'in', ['detected', 'under_review', 'pending_input', 'escalated'])
    );

    if (filters.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }

    if (filters.departmentId) {
      q = query(q, where('departmentId', '==', filters.departmentId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const greyAreas = snapshot.docs.map(doc => doc.data() as GreyArea);
        const nowTime = new Date();

        const overview = {
          total: greyAreas.length,
          byStatus: greyAreas.reduce((acc, g) => {
            acc[g.status] = (acc[g.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          bySeverity: greyAreas.reduce((acc, g) => {
            acc[g.severity] = (acc[g.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byType: greyAreas.reduce((acc, g) => {
            acc[g.type] = (acc[g.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          overdue: greyAreas.filter(g => 
            g.resolutionDeadline && g.resolutionDeadline.toDate() < nowTime
          ).length,
          critical: greyAreas.filter(g => g.severity === 'critical').length,
        };

        setState({ loading: false, data: overview, error: null });
      },
      (error) => {
        console.error('Error loading grey area overview:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [filters.subsidiaryId, filters.departmentId]);

  return state;
}

/**
 * Hook for grey areas by entity
 */
export function useGreyAreasByEntity(entityType: string | null, entityId: string | null) {
  const [state, setState] = useState<AsyncState<GreyArea[]>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!entityType || !entityId) {
      setState({ loading: false, data: [], error: null });
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.GREY_AREAS),
      where('detectionContext.entityType', '==', entityType),
      where('detectionContext.entityId', '==', entityId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const greyAreas = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as GreyArea[];

        setState({ loading: false, data: greyAreas, error: null });
      },
      (error) => {
        console.error('Error loading grey areas by entity:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [entityType, entityId]);

  return {
    ...state,
    greyAreas: state.data || [],
  };
}

/**
 * Hook for pending inputs on a grey area
 */
export function useGreyAreaInputs(greyAreaId: GreyAreaId | null) {
  const { data: greyArea, loading, error } = useGreyArea(greyAreaId);
  
  const pendingInputs = greyArea?.inputsRequired?.filter(i => !i.response) || [];
  const completedInputs = greyArea?.inputsRequired?.filter(i => i.response) || [];
  const allInputsComplete = pendingInputs.length === 0 && completedInputs.length > 0;
  
  return {
    loading,
    error,
    inputs: greyArea?.inputsRequired || [],
    pendingInputs,
    completedInputs,
    allInputsComplete,
  };
}
