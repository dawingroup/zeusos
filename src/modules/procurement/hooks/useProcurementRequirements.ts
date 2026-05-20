/**
 * useProcurementRequirements
 * Real-time subscription to procurement requirements with filtering
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  ProcurementRequirement,
  SupplierRequirementGroup,
  ProcurementFilters,
} from '../types/procurement';
import {
  subscribeToProcurementRequirements,
  getRequirementsGroupedBySupplier,
  consolidateIntoPO,
  cancelRequirement,
} from '../services/procurementRequirementService';

interface UseProcurementRequirementsOptions {
  subsidiaryId: string;
  filters?: ProcurementFilters;
}

export function useProcurementRequirements({
  subsidiaryId,
  filters = {},
}: UseProcurementRequirementsOptions) {
  const [requirements, setRequirements] = useState<ProcurementRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToProcurementRequirements(
      { subsidiaryId, ...filters },
      (data) => {
        setRequirements(data);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [subsidiaryId, filters.status, filters.supplierId, filters.moId, filters.search]);

  const handleConsolidate = useCallback(
    async (requirementIds: string[], supplierId: string, userId: string) => {
      try {
        setError(null);
        const poId = await consolidateIntoPO(requirementIds, supplierId, userId);
        return poId;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [],
  );

  const handleCancel = useCallback(async (requirementId: string) => {
    try {
      setError(null);
      await cancelRequirement(requirementId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  return {
    requirements,
    loading,
    error,
    consolidate: handleConsolidate,
    cancel: handleCancel,
  };
}

/**
 * useProcurementConsolidation
 * Groups pending requirements by supplier for the consolidation view
 */
export function useProcurementConsolidation(subsidiaryId: string) {
  const [groups, setGroups] = useState<SupplierRequirementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRequirementsGroupedBySupplier(subsidiaryId);
      setGroups(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [subsidiaryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { groups, loading, error, refresh };
}
