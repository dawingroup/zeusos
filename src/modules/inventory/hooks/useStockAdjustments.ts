/**
 * Stock Adjustment React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  getStockAdjustmentById,
  getStockAdjustments,
  getAdjustmentsByItem,
  createStockAdjustment,
  updateStockAdjustment,
  submitStockAdjustment,
  approveStockAdjustment,
  rejectStockAdjustment,
  cancelStockAdjustment,
  subscribeToStockAdjustments,
  type StockAdjustmentFilters,
} from '../services/stockAdjustmentService';
import type { StockAdjustment, AdjustmentStatus } from '../types/stockAdjustment';
import type { StockAdjustmentFormData } from '../schemas/stockAdjustment.schema';

// ── Query Keys ───────────────────────────────────────────────────────────────

const QUERY_KEYS = {
  adjustments: (orgId: string) => ['stock-adjustments', orgId] as const,
  adjustment: (id: string) => ['stock-adjustment', id] as const,
  itemAdjustments: (orgId: string, itemId: string) =>
    ['stock-adjustments', orgId, 'item', itemId] as const,
};

// ── List Hook (React Query) ──────────────────────────────────────────────────

export function useStockAdjustments(
  orgId: string,
  filters?: StockAdjustmentFilters
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.adjustments(orgId), filters],
    queryFn: () => getStockAdjustments(orgId, filters),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Real-time Subscription Hook ──────────────────────────────────────────────

export function useStockAdjustmentsRealtime(
  orgId: string,
  statusFilter?: AdjustmentStatus
) {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgId) {
      setAdjustments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToStockAdjustments(
      orgId,
      (data) => {
        setAdjustments(data);
        setLoading(false);
        setError(null);
      },
      statusFilter ? { status: statusFilter } : undefined,
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orgId, statusFilter]);

  return { adjustments, loading, error };
}

// ── Single Adjustment Hook ───────────────────────────────────────────────────

export function useStockAdjustment(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adjustment(id),
    queryFn: () => getStockAdjustmentById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Item Adjustments Hook ────────────────────────────────────────────────────

export function useItemAdjustments(orgId: string, itemId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.itemAdjustments(orgId, itemId),
    queryFn: () => getAdjustmentsByItem(orgId, itemId),
    enabled: !!orgId && !!itemId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutation Hooks ───────────────────────────────────────────────────────────

export function useCreateStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      data: StockAdjustmentFormData;
      userId: string;
      orgId: string;
      subsidiaryId?: string;
    }) =>
      createStockAdjustment(
        params.data,
        params.userId,
        params.orgId,
        params.subsidiaryId
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustments(vars.orgId) });
    },
  });
}

export function useUpdateStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      data: Partial<StockAdjustmentFormData>;
      userId: string;
    }) => updateStockAdjustment(params.id, params.data, params.userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustment(vars.id) });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
  });
}

export function useSubmitStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; userId: string }) =>
      submitStockAdjustment(params.id, params.userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustment(vars.id) });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
  });
}

export function useApproveStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; userId: string }) =>
      approveStockAdjustment(params.id, params.userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustment(vars.id) });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
    onError: (_, vars) => {
      // Refetch on error to get latest status (e.g., auto-approved by cloud function)
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustment(vars.id) });
    },
  });
}

export function useRejectStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; userId: string; reason: string }) =>
      rejectStockAdjustment(params.id, params.userId, params.reason),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustment(vars.id) });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
  });
}

export function useCancelStockAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; userId: string }) =>
      cancelStockAdjustment(params.id, params.userId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.adjustment(vars.id) });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
  });
}
