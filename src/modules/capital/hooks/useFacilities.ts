import { useState, useEffect, useCallback } from 'react';
import type { CapitalFacility, CapitalFacilityFilters } from '../types/capital.types';
import type { CapitalFacilityInput } from '../schemas/capital.schemas';
import { facilityService } from '../services/facilityService';

export function useFacilities(companyId: string, filters: CapitalFacilityFilters = {}) {
  const [facilities, setFacilities] = useState<CapitalFacility[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof facilityService.getFacilitySummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        facilityService.getFacilities(companyId, filters),
        facilityService.getFacilitySummary(companyId),
      ]);
      setFacilities(list);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load facilities');
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createFacility = useCallback(
    async (input: CapitalFacilityInput, startDate: Date, maturityDate: Date) => {
      const facility = await facilityService.createFacility(
        companyId,
        input,
        startDate,
        maturityDate,
      );
      setFacilities(prev => [facility, ...prev]);
      return facility;
    },
    [companyId],
  );

  const recordRepayment = useCallback(
    async (facilityId: string, repaymentId: string, amountPaid: number) => {
      await facilityService.recordRepayment(companyId, facilityId, repaymentId, amountPaid);
      await refresh();
    },
    [companyId, refresh],
  );

  const deleteFacility = useCallback(
    async (facilityId: string) => {
      await facilityService.deleteFacility(companyId, facilityId);
      setFacilities(prev => prev.filter(f => f.id !== facilityId));
    },
    [companyId],
  );

  return {
    facilities,
    summary,
    loading,
    error,
    refresh,
    createFacility,
    recordRepayment,
    deleteFacility,
  };
}
