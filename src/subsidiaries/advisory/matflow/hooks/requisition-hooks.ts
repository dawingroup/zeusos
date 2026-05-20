/**
 * Requisition Hooks
 * 
 * React hooks for requisition management.
 */

import { useState, useEffect, useCallback } from 'react';
import { requisitionService } from '../services/requisition-service';
import type {
  Requisition,
  RequisitionStatus,
  CreateRequisitionInput,
  CreateRequisitionItemInput
} from '../types/requisition';
import type { BOQMoney } from '../types/boq';

// ============================================================================
// REQUISITION FETCH HOOKS
// ============================================================================

/**
 * Hook for fetching a single requisition
 */
export function useRequisition(requisitionId: string | undefined) {
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchRequisition = useCallback(async () => {
    if (!requisitionId) {
      setRequisition(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await requisitionService.getRequisition(requisitionId);
      setRequisition(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch requisition'));
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);
  
  useEffect(() => {
    fetchRequisition();
  }, [fetchRequisition]);
  
  return { requisition, loading, error, refetch: fetchRequisition };
}

/**
 * Hook for fetching project requisitions
 */
export function useProjectRequisitions(projectId: string | undefined) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchRequisitions = useCallback(async () => {
    if (!projectId) {
      setRequisitions([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await requisitionService.getRequisitionsForProject(projectId);
      setRequisitions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch requisitions'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);
  
  return { requisitions, loading, error, refetch: fetchRequisitions };
}

/**
 * Hook for fetching requisitions by status
 */
export function useRequisitionsByStatus(status: RequisitionStatus) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await requisitionService.getRequisitionsByStatus(status);
      setRequisitions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch requisitions'));
    } finally {
      setLoading(false);
    }
  }, [status]);
  
  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);
  
  return { requisitions, loading, error, refetch: fetchRequisitions };
}

/**
 * Hook for pending approval requisitions
 */
export function usePendingApprovalRequisitions() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await requisitionService.getPendingApprovalRequisitions();
      setRequisitions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pending requisitions'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);
  
  return { requisitions, loading, error, refetch: fetchRequisitions };
}

// ============================================================================
// REQUISITION MUTATION HOOKS
// ============================================================================

/**
 * Hook for requisition mutations
 */
export function useRequisitionMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createRequisition = useCallback(async (
    input: CreateRequisitionInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await requisitionService.createRequisition(input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateRequisition = useCallback(async (
    requisitionId: string,
    updates: Partial<Pick<Requisition, 'description' | 'priority' | 'requiredDate'>>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.updateRequisition(requisitionId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createRequisition,
    updateRequisition
  };
}

/**
 * Hook for requisition item mutations
 */
export function useRequisitionItemMutations(requisitionId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const addItem = useCallback(async (
    input: CreateRequisitionItemInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await requisitionService.addItem(requisitionId, input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add item');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);
  
  const updateItem = useCallback(async (
    itemId: string,
    updates: Partial<CreateRequisitionItemInput>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.updateItem(requisitionId, itemId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update item');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);
  
  const deleteItem = useCallback(async (itemId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.deleteItem(requisitionId, itemId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete item');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);
  
  const bulkAddItems = useCallback(async (
    inputs: CreateRequisitionItemInput[],
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const ids = await requisitionService.bulkAddItems(requisitionId, inputs, userId);
      return ids;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to bulk add items');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);
  
  return {
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    bulkAddItems
  };
}

// ============================================================================
// WORKFLOW HOOKS
// ============================================================================

/**
 * Hook for requisition workflow actions
 */
export function useRequisitionWorkflow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const submitRequisition = useCallback(async (
    requisitionId: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.submitRequisition(requisitionId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const technicalReview = useCallback(async (
    requisitionId: string,
    approved: boolean,
    notes: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.technicalReview(requisitionId, approved, notes, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to complete technical review');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const budgetReview = useCallback(async (
    requisitionId: string,
    approved: boolean,
    notes: string,
    approvedCost: BOQMoney | undefined,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.budgetReview(requisitionId, approved, notes, approvedCost, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to complete budget review');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const approveRequisition = useCallback(async (
    requisitionId: string,
    notes: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.approveRequisition(requisitionId, notes, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const rejectRequisition = useCallback(async (
    requisitionId: string,
    reason: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.rejectRequisition(requisitionId, reason, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reject requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateItemFulfillment = useCallback(async (
    requisitionId: string,
    itemId: string,
    fulfilledQuantity: number,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await requisitionService.updateItemFulfillment(requisitionId, itemId, fulfilledQuantity, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update fulfillment');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    submitRequisition,
    technicalReview,
    budgetReview,
    approveRequisition,
    rejectRequisition,
    updateItemFulfillment
  };
}
