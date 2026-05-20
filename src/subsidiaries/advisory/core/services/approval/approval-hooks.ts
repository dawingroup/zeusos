/**
 * APPROVAL HOOKS
 * 
 * React hooks for consuming approval engine functionality.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  approvalEngine,
  CreateApprovalRequestData,
} from './approval-engine';
import { 
  ApprovalRequest, 
  ApprovalStatus, 
  ApprovalType,
  ApprovalDecisionType,
} from '../../types/approval';

// ============================================================================
// Single Request Hook
// ============================================================================

interface UseApprovalRequestResult {
  request: ApprovalRequest | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and optionally subscribe to a single approval request
 */
export function useApprovalRequest(
  engagementId: string | undefined,
  requestId: string | undefined,
  options: { realtime?: boolean } = {}
): UseApprovalRequestResult {
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { realtime = false } = options;

  const fetchRequest = useCallback(async () => {
    if (!engagementId || !requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await approvalEngine.getRequest(engagementId, requestId);
      setRequest(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch request'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, requestId]);

  useEffect(() => {
    if (!engagementId || !requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    if (realtime) {
      setLoading(true);
      const unsubscribe = approvalEngine.subscribeToRequest(
        engagementId,
        requestId,
        (data) => {
          setRequest(data);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      fetchRequest();
    }
  }, [engagementId, requestId, realtime, fetchRequest]);

  return {
    request,
    loading,
    error,
    refresh: fetchRequest,
  };
}

// ============================================================================
// Engagement Requests Hook
// ============================================================================

interface UseEngagementApprovalsResult {
  requests: ApprovalRequest[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch approval requests for an engagement
 */
export function useEngagementApprovals(
  engagementId: string | undefined,
  filters?: { status?: ApprovalStatus; type?: ApprovalType },
  options: { realtime?: boolean } = {}
): UseEngagementApprovalsResult {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { realtime = false } = options;
  const filtersKey = JSON.stringify(filters);

  const fetchRequests = useCallback(async () => {
    if (!engagementId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await approvalEngine.getEngagementRequests(engagementId, filters);
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch requests'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, filtersKey]);

  useEffect(() => {
    if (!engagementId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    if (realtime) {
      setLoading(true);
      const unsubscribe = approvalEngine.subscribeToEngagementRequests(
        engagementId,
        (data) => {
          setRequests(data);
          setLoading(false);
        },
        filters
      );
      return () => unsubscribe();
    } else {
      fetchRequests();
    }
  }, [engagementId, realtime, filtersKey, fetchRequests]);

  return {
    requests,
    loading,
    error,
    refresh: fetchRequests,
  };
}

// ============================================================================
// My Pending Approvals Hook
// ============================================================================

interface UseMyPendingApprovalsResult {
  requests: ApprovalRequest[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch pending approvals for current user
 */
export function useMyPendingApprovals(
  userId: string | undefined
): UseMyPendingApprovalsResult {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await approvalEngine.getPendingApprovals(userId);
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending approvals'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    loading,
    error,
    refresh: fetchRequests,
  };
}

// ============================================================================
// Approval Mutations Hook
// ============================================================================

interface UseApprovalMutationsResult {
  createRequest: (data: CreateApprovalRequestData) => Promise<ApprovalRequest>;
  approveStep: (
    engagementId: string, 
    requestId: string, 
    comments?: string, 
    conditions?: string[]
  ) => Promise<ApprovalRequest>;
  rejectRequest: (
    engagementId: string, 
    requestId: string, 
    comments: string
  ) => Promise<ApprovalRequest>;
  returnRequest: (
    engagementId: string, 
    requestId: string, 
    comments: string
  ) => Promise<ApprovalRequest>;
  delegateApproval: (
    engagementId: string, 
    requestId: string, 
    delegateToUserId: string, 
    comments?: string
  ) => Promise<ApprovalRequest>;
  escalateRequest: (
    engagementId: string, 
    requestId: string, 
    reason: string
  ) => Promise<ApprovalRequest>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for approval mutations
 */
export function useApprovalMutations(): UseApprovalMutationsResult {
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

  const createRequest = useCallback(async (data: CreateApprovalRequestData) => {
    return withLoading(() => approvalEngine.createRequest(data));
  }, []);

  const approveStep = useCallback(async (
    engagementId: string,
    requestId: string,
    comments?: string,
    conditions?: string[]
  ) => {
    return withLoading(() => approvalEngine.processAction({
      engagementId,
      requestId,
      decision: 'approved' as ApprovalDecisionType,
      comments,
      conditions,
    }));
  }, []);

  const rejectRequest = useCallback(async (
    engagementId: string,
    requestId: string,
    comments: string
  ) => {
    return withLoading(() => approvalEngine.processAction({
      engagementId,
      requestId,
      decision: 'rejected' as ApprovalDecisionType,
      comments,
    }));
  }, []);

  const returnRequest = useCallback(async (
    engagementId: string,
    requestId: string,
    comments: string
  ) => {
    return withLoading(() => approvalEngine.processAction({
      engagementId,
      requestId,
      decision: 'returned' as ApprovalDecisionType,
      comments,
    }));
  }, []);

  const delegateApproval = useCallback(async (
    engagementId: string,
    requestId: string,
    delegateToUserId: string,
    comments?: string
  ) => {
    return withLoading(() => approvalEngine.processAction({
      engagementId,
      requestId,
      decision: 'delegated',
      delegateToUserId,
      comments,
    }));
  }, []);

  const escalateRequest = useCallback(async (
    engagementId: string,
    requestId: string,
    reason: string
  ) => {
    return withLoading(() => approvalEngine.escalateRequest(engagementId, requestId, reason));
  }, []);

  return {
    createRequest,
    approveStep,
    rejectRequest,
    returnRequest,
    delegateApproval,
    escalateRequest,
    loading,
    error,
  };
}

// ============================================================================
// Can Approve Hook
// ============================================================================

interface UseCanApproveResult {
  canApprove: boolean;
  currentStep: {
    sequence: number;
    name: string;
  } | null;
  isMyTurn: boolean;
  loading: boolean;
}

/**
 * Hook to check if user can approve current step
 */
export function useCanApprove(
  request: ApprovalRequest | null,
  userId: string | undefined
): UseCanApproveResult {
  return useMemo(() => {
    if (!request || !userId) {
      return { 
        canApprove: false, 
        currentStep: null, 
        isMyTurn: false, 
        loading: false 
      };
    }

    if (request.status !== 'pending' && request.status !== 'in_review') {
      return { 
        canApprove: false, 
        currentStep: null, 
        isMyTurn: false, 
        loading: false 
      };
    }

    const currentStep = request.approvalChain[request.currentStepIndex];
    if (!currentStep) {
      return { 
        canApprove: false, 
        currentStep: null, 
        isMyTurn: false, 
        loading: false 
      };
    }

    // Check if user is the designated approver
    const isMyTurn = 
      (currentStep.approverType === 'user' && currentStep.approverId === userId) ||
      currentStep.approverType === 'role' || // Would need role check
      currentStep.approverType === 'team_lead'; // Would need lead check

    return {
      canApprove: isMyTurn,
      currentStep: {
        sequence: currentStep.sequence,
        name: currentStep.name,
      },
      isMyTurn,
      loading: false,
    };
  }, [request, userId]);
}

// ============================================================================
// Approval Progress Hook
// ============================================================================

interface UseApprovalProgressResult {
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  progress: number;
  isComplete: boolean;
  status: ApprovalStatus | null;
}

/**
 * Hook to get approval progress
 */
export function useApprovalProgress(
  request: ApprovalRequest | null
): UseApprovalProgressResult {
  return useMemo(() => {
    if (!request) {
      return {
        totalSteps: 0,
        completedSteps: 0,
        currentStepIndex: 0,
        progress: 0,
        isComplete: false,
        status: null,
      };
    }

    const totalSteps = request.approvalChain.length;
    const completedSteps = request.approvalChain.filter(
      s => s.status === 'approved' || s.status === 'skipped'
    ).length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      totalSteps,
      completedSteps,
      currentStepIndex: request.currentStepIndex,
      progress,
      isComplete: request.isComplete,
      status: request.status,
    };
  }, [request]);
}

// ============================================================================
// Approval Summary Hook
// ============================================================================

interface ApprovalSummary {
  pending: number;
  approved: number;
  rejected: number;
  returned: number;
  total: number;
}

interface UseApprovalSummaryResult {
  summary: ApprovalSummary;
  loading: boolean;
}

/**
 * Hook to get approval summary for engagement
 */
export function useApprovalSummary(
  requests: ApprovalRequest[]
): UseApprovalSummaryResult {
  const summary = useMemo(() => {
    const pending = requests.filter(r => 
      r.status === 'pending' || r.status === 'in_review'
    ).length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const returned = requests.filter(r => r.status === 'returned').length;

    return {
      pending,
      approved,
      rejected,
      returned,
      total: requests.length,
    };
  }, [requests]);

  return {
    summary,
    loading: false,
  };
}
