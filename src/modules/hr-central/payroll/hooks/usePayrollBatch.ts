/**
 * Payroll Batch Hooks
 * DawinOS HR Central - Payroll Module
 * 
 * React hooks for managing payroll batches, including creation,
 * calculation, approval workflow, and list management.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  createPayrollBatch,
  calculateBatch,
  recalculateBatch,
  submitForReview,
  processApproval,
  processPayments,
  completePaymentBatch,
  cancelBatch,
  reverseBatch,
  getBatch,
  listBatches,
  getBatchPayrolls
} from '../services/payroll-batch.service';
import {
  PayrollBatch,
  CreatePayrollBatchInput,
  BatchCalculationProgress,
  PayrollBatchFilters,
  PayrollBatchSort,
  PaymentBatch
} from '../types/payroll-batch.types';
import { EmployeePayroll } from '../types/payroll.types';

// ============================================================================
// usePayrollBatch - Single Batch Management
// ============================================================================

interface UsePayrollBatchReturn {
  batch: PayrollBatch | null;
  payrolls: EmployeePayroll[];
  isLoading: boolean;
  error: string | null;
  calculationProgress: BatchCalculationProgress | null;
  isCalculating: boolean;
  createBatch: (input: CreatePayrollBatchInput) => Promise<PayrollBatch | null>;
  calculate: () => Promise<void>;
  recalculate: () => Promise<void>;
  submitForReview: () => Promise<void>;
  approve: (comments?: string) => Promise<void>;
  reject: (comments: string) => Promise<void>;
  returnBatch: (comments: string) => Promise<void>;
  processPayments: () => Promise<void>;
  completePayment: (paymentBatchId: string, result: {
    status: 'completed' | 'failed' | 'partial';
    processedCount: number;
    failedPayments?: PaymentBatch['failedPayments'];
    reference?: string;
  }) => Promise<void>;
  cancel: (reason: string) => Promise<void>;
  reverse: (reason: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing a single payroll batch
 */
export function usePayrollBatch(
  batchId?: string,
  userId?: string,
  userName?: string,
  userRole?: string
): UsePayrollBatchReturn {
  const [batch, setBatch] = useState<PayrollBatch | null>(null);
  const [payrolls, setPayrolls] = useState<EmployeePayroll[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculationProgress, setCalculationProgress] = useState<BatchCalculationProgress | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch batch data
  const fetchBatch = useCallback(async () => {
    if (!batchId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getBatch(batchId);
      setBatch(result);
      
      // Also fetch payrolls if batch exists
      if (result) {
        const batchPayrolls = await getBatchPayrolls(batchId);
        setPayrolls(batchPayrolls);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch batch');
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  // Create new batch
  const createBatchFn = useCallback(async (
    input: CreatePayrollBatchInput
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createPayrollBatch(input, userId, userName);
      setBatch(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId, userName]);

  // Calculate batch
  const calculateFn = useCallback(async () => {
    if (!batch || !userId) return;

    setIsCalculating(true);
    setError(null);

    try {
      const result = await calculateBatch(
        batch.id,
        userId,
        userName,
        setCalculationProgress
      );
      setBatch(result);
      
      // Refresh payrolls
      const batchPayrolls = await getBatchPayrolls(batch.id);
      setPayrolls(batchPayrolls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate batch');
    } finally {
      setIsCalculating(false);
      setCalculationProgress(null);
    }
  }, [batch, userId, userName]);

  // Recalculate (regenerate) — destructive: clears prior calculation
  // and snaps any pre-approval status back to draft.
  const recalculateFn = useCallback(async () => {
    if (!batch || !userId) return;

    setIsCalculating(true);
    setError(null);

    try {
      const result = await recalculateBatch(
        batch.id,
        userId,
        userName,
        setCalculationProgress
      );
      setBatch(result);
      const batchPayrolls = await getBatchPayrolls(batch.id);
      setPayrolls(batchPayrolls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate batch');
    } finally {
      setIsCalculating(false);
      setCalculationProgress(null);
    }
  }, [batch, userId, userName]);

  // Submit for review
  const submitForReviewFn = useCallback(async () => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await submitForReview(batch.id, userId, userName);
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for review');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName]);

  // Approve
  const approveFn = useCallback(async (comments?: string) => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await processApproval(
        batch.id,
        'approve',
        userId,
        userName || 'Unknown',
        userRole || 'Approver',
        comments
      );
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName, userRole]);

  // Reject
  const rejectFn = useCallback(async (comments: string) => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await processApproval(
        batch.id,
        'reject',
        userId,
        userName || 'Unknown',
        userRole || 'Approver',
        comments
      );
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName, userRole]);

  // Return batch
  const returnBatchFn = useCallback(async (comments: string) => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await processApproval(
        batch.id,
        'return',
        userId,
        userName || 'Unknown',
        userRole || 'Approver',
        comments
      );
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return batch');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName, userRole]);

  // Process payments
  const processPaymentsFn = useCallback(async () => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await processPayments(batch.id, userId, userName);
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payments');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName]);

  // Complete payment batch
  const completePaymentFn = useCallback(async (
    paymentBatchId: string,
    result: {
      status: 'completed' | 'failed' | 'partial';
      processedCount: number;
      failedPayments?: PaymentBatch['failedPayments'];
      reference?: string;
    }
  ) => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const updatedBatch = await completePaymentBatch(
        batch.id,
        paymentBatchId,
        result,
        userId,
        userName
      );
      setBatch(updatedBatch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete payment');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName]);

  // Cancel batch
  const cancelFn = useCallback(async (reason: string) => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await cancelBatch(batch.id, userId, userName || '', reason);
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel batch');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName]);

  // Reverse a paid batch — restores recoveries and flips status so the
  // batch can be regenerated for a correction.
  const reverseFn = useCallback(async (reason: string) => {
    if (!batch || !userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await reverseBatch(batch.id, userId, userName || '', reason);
      setBatch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reverse batch');
    } finally {
      setIsLoading(false);
    }
  }, [batch, userId, userName]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    batch,
    payrolls,
    isLoading,
    error,
    calculationProgress,
    isCalculating,
    createBatch: createBatchFn,
    calculate: calculateFn,
    recalculate: recalculateFn,
    submitForReview: submitForReviewFn,
    approve: approveFn,
    reject: rejectFn,
    returnBatch: returnBatchFn,
    processPayments: processPaymentsFn,
    completePayment: completePaymentFn,
    cancel: cancelFn,
    reverse: reverseFn,
    refresh: fetchBatch,
    clearError
  };
}

// ============================================================================
// usePayrollBatchList - Batch List Management
// ============================================================================

interface UsePayrollBatchListReturn {
  batches: PayrollBatch[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setFilters: (filters: PayrollBatchFilters) => void;
  setSort: (sort: PayrollBatchSort) => void;
  filters: PayrollBatchFilters;
  sort: PayrollBatchSort;
}

/**
 * Hook for managing payroll batch list
 */
export function usePayrollBatchList(
  initialFilters?: PayrollBatchFilters
): UsePayrollBatchListReturn {
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PayrollBatchFilters>(initialFilters || {});
  const [sort, setSort] = useState<PayrollBatchSort>({ field: 'createdAt', direction: 'desc' });

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listBatches(filters, sort);
      setBatches(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch batches');
    } finally {
      setIsLoading(false);
    }
  }, [filters, sort]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  return {
    batches,
    isLoading,
    error,
    refresh: fetchBatches,
    setFilters,
    setSort,
    filters,
    sort
  };
}

// ============================================================================
// usePayrollBatchActions - Batch Actions Without State
// ============================================================================

interface UsePayrollBatchActionsReturn {
  createBatch: (input: CreatePayrollBatchInput) => Promise<PayrollBatch | null>;
  calculateBatch: (batchId: string, progressCallback?: (p: BatchCalculationProgress) => void) => Promise<PayrollBatch | null>;
  submitForReview: (batchId: string) => Promise<PayrollBatch | null>;
  approve: (batchId: string, comments?: string) => Promise<PayrollBatch | null>;
  reject: (batchId: string, comments: string) => Promise<PayrollBatch | null>;
  returnBatch: (batchId: string, comments: string) => Promise<PayrollBatch | null>;
  processPayments: (batchId: string) => Promise<PayrollBatch | null>;
  cancelBatch: (batchId: string, reason: string) => Promise<PayrollBatch | null>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for batch actions without managing state
 * Useful for triggering actions from list views
 */
export function usePayrollBatchActions(
  userId?: string,
  userName?: string,
  userRole?: string
): UsePayrollBatchActionsReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBatchFn = useCallback(async (
    input: CreatePayrollBatchInput
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await createPayrollBatch(input, userId, userName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName]);

  const calculateBatchFn = useCallback(async (
    batchId: string,
    progressCallback?: (p: BatchCalculationProgress) => void
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await calculateBatch(batchId, userId, userName, progressCallback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate batch');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName]);

  const submitForReviewFn = useCallback(async (
    batchId: string
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await submitForReview(batchId, userId, userName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for review');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName]);

  const approveFn = useCallback(async (
    batchId: string,
    comments?: string
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await processApproval(
        batchId,
        'approve',
        userId,
        userName || 'Unknown',
        userRole || 'Approver',
        comments
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName, userRole]);

  const rejectFn = useCallback(async (
    batchId: string,
    comments: string
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await processApproval(
        batchId,
        'reject',
        userId,
        userName || 'Unknown',
        userRole || 'Approver',
        comments
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName, userRole]);

  const returnBatchFn = useCallback(async (
    batchId: string,
    comments: string
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await processApproval(
        batchId,
        'return',
        userId,
        userName || 'Unknown',
        userRole || 'Approver',
        comments
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return batch');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName, userRole]);

  const processPaymentsFn = useCallback(async (
    batchId: string
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await processPayments(batchId, userId, userName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payments');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName]);

  const cancelBatchFn = useCallback(async (
    batchId: string,
    reason: string
  ): Promise<PayrollBatch | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      return await cancelBatch(batchId, userId, userName || '', reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel batch');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [userId, userName]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createBatch: createBatchFn,
    calculateBatch: calculateBatchFn,
    submitForReview: submitForReviewFn,
    approve: approveFn,
    reject: rejectFn,
    returnBatch: returnBatchFn,
    processPayments: processPaymentsFn,
    cancelBatch: cancelBatchFn,
    isProcessing,
    error,
    clearError
  };
}
