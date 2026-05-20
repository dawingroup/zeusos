/**
 * Hook for BOM management with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { BOMLine, BOMCostSummary, BOMAvailabilityReport } from '../types';
import { bomService } from '../services/bomService';

interface UseBOMResult {
  bomLines: BOMLine[];
  costSummary: BOMCostSummary | null;
  isLoading: boolean;
  error: string | null;
  addLine: (line: Omit<BOMLine, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLine: (lineId: string, updates: Partial<BOMLine>) => Promise<void>;
  removeLine: (lineId: string) => Promise<void>;
  checkAvailability: () => Promise<BOMAvailabilityReport>;
  reserveMaterials: () => Promise<void>;
  recordConsumption: (lineId: string, quantity: number, wasteQty?: number, wasteReason?: string) => Promise<void>;
  refreshBOM: () => void;
}

export function useBOM(orderId: string | null): UseBOMResult {
  const queryClient = useQueryClient();

  const bomQuery = useQuery({
    queryKey: ['manufacturing-bom', orderId],
    queryFn: () => bomService.getBOM(orderId!),
    enabled: !!orderId,
  });

  const costQuery = useQuery({
    queryKey: ['manufacturing-bom-cost', orderId],
    queryFn: () => bomService.getBOMCostSummary(orderId!),
    enabled: !!orderId,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['manufacturing-bom', orderId] });
    queryClient.invalidateQueries({ queryKey: ['manufacturing-bom-cost', orderId] });
  }, [queryClient, orderId]);

  const addLineMutation = useMutation({
    mutationFn: (line: Omit<BOMLine, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>) =>
      bomService.addBOMLine(orderId!, line),
    onSuccess: invalidate,
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, updates }: { lineId: string; updates: Partial<BOMLine> }) =>
      bomService.updateBOMLine(orderId!, lineId, updates),
    onSuccess: invalidate,
  });

  const removeLineMutation = useMutation({
    mutationFn: (lineId: string) => bomService.removeBOMLine(orderId!, lineId),
    onSuccess: invalidate,
  });

  const consumptionMutation = useMutation({
    mutationFn: ({ lineId, quantity, wasteQty, wasteReason }: {
      lineId: string; quantity: number; wasteQty?: number; wasteReason?: string;
    }) => bomService.recordConsumption(orderId!, lineId, quantity, wasteQty, wasteReason),
    onSuccess: invalidate,
  });

  const addLine = useCallback(
    async (line: Omit<BOMLine, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>) => {
      if (!orderId) throw new Error('No order ID');
      return addLineMutation.mutateAsync(line);
    },
    [orderId, addLineMutation],
  );

  const updateLine = useCallback(
    async (lineId: string, updates: Partial<BOMLine>) => {
      if (!orderId) throw new Error('No order ID');
      await updateLineMutation.mutateAsync({ lineId, updates });
    },
    [orderId, updateLineMutation],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!orderId) throw new Error('No order ID');
      await removeLineMutation.mutateAsync(lineId);
    },
    [orderId, removeLineMutation],
  );

  const checkAvailability = useCallback(async () => {
    if (!orderId) throw new Error('No order ID');
    return bomService.checkMaterialAvailability(orderId);
  }, [orderId]);

  const reserveMaterials = useCallback(async () => {
    if (!orderId) throw new Error('No order ID');
    await bomService.reserveMaterials(orderId);
    invalidate();
  }, [orderId, invalidate]);

  const recordConsumption = useCallback(
    async (lineId: string, quantity: number, wasteQty?: number, wasteReason?: string) => {
      if (!orderId) throw new Error('No order ID');
      await consumptionMutation.mutateAsync({ lineId, quantity, wasteQty, wasteReason });
    },
    [orderId, consumptionMutation],
  );

  return {
    bomLines: bomQuery.data ?? [],
    costSummary: costQuery.data ?? null,
    isLoading: bomQuery.isLoading,
    error: bomQuery.error?.message ?? null,
    addLine,
    updateLine,
    removeLine,
    checkAvailability,
    reserveMaterials,
    recordConsumption,
    refreshBOM: invalidate,
  };
}
