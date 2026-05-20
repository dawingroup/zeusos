/**
 * Hook for orchestrating the release-to-production flow
 * Enhanced with SO validation and batch manufacturing support
 */

import { useState, useCallback } from 'react';
import type {
  ReleaseToProductionOptions,
  ReleaseResult,
  BOMAvailabilityReport,
} from '../types';
import { designToManufacturingService } from '../services/designToManufacturingService';
import { getSalesOrderByProject } from '@/modules/sales-orders/services/salesOrderService';
import type { SalesOrder } from '@/modules/sales-orders/types';

interface UseReleaseToProductionResult {
  releaseItems: (options: ReleaseToProductionOptions) => Promise<ReleaseResult>;
  isReleasing: boolean;
  releaseResult: ReleaseResult | null;
  availabilityReport: BOMAvailabilityReport | null;
  error: string | null;
  reset: () => void;

  // SO validation
  salesOrder: SalesOrder | null;
  isFetchingSO: boolean;
  soError: string | null;
  fetchSalesOrder: (projectId: string) => Promise<SalesOrder | null>;
}

export function useReleaseToProduction(userId: string): UseReleaseToProductionResult {
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseResult, setReleaseResult] = useState<ReleaseResult | null>(null);
  const [availabilityReport, setAvailabilityReport] = useState<BOMAvailabilityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SO state
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [isFetchingSO, setIsFetchingSO] = useState(false);
  const [soError, setSoError] = useState<string | null>(null);

  const fetchSalesOrder = useCallback(
    async (projectId: string): Promise<SalesOrder | null> => {
      setIsFetchingSO(true);
      setSoError(null);

      try {
        const so = await getSalesOrderByProject(projectId);
        setSalesOrder(so);
        if (!so) {
          setSoError('No Sales Order found for this project. Create and confirm a Sales Order before releasing to production.');
        }
        return so;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch Sales Order';
        setSoError(msg);
        return null;
      } finally {
        setIsFetchingSO(false);
      }
    },
    [],
  );

  const releaseItems = useCallback(
    async (options: ReleaseToProductionOptions): Promise<ReleaseResult> => {
      setIsReleasing(true);
      setError(null);

      try {
        const result = await designToManufacturingService.releaseToProduction(options, userId);
        setReleaseResult(result);
        if (result.availabilityReport) {
          setAvailabilityReport(result.availabilityReport);
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Release failed';
        setError(msg);
        // Return a failure result instead of re-throwing so callers don't need try-catch
        return {
          success: false,
          manufacturingOrderIds: [],
          errors: [{ designItemId: '*', error: msg }],
          warnings: [],
        } as ReleaseResult;
      } finally {
        setIsReleasing(false);
      }
    },
    [userId],
  );

  const reset = useCallback(() => {
    setReleaseResult(null);
    setAvailabilityReport(null);
    setError(null);
    setSalesOrder(null);
    setSoError(null);
  }, []);

  return {
    releaseItems,
    isReleasing,
    releaseResult,
    availabilityReport,
    error,
    reset,
    salesOrder,
    isFetchingSO,
    soError,
    fetchSalesOrder,
  };
}
