/**
 * useComplianceObligations Hook
 * Manages compliance obligation state with CRUD and completion.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getComplianceObligations,
  createComplianceObligation,
  updateComplianceObligation,
  deleteComplianceObligation,
  completeObligation,
  scanUpcomingObligations,
} from '../services/complianceObligationService';
import type { ComplianceObligation, ComplianceObligationInput, ObligationFilters } from '../types';

interface UseComplianceObligationsReturn {
  obligations: ComplianceObligation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: Partial<ComplianceObligationInput>) => Promise<ComplianceObligation>;
  update: (id: string, updates: Partial<ComplianceObligation>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  complete: (id: string) => Promise<void>;
  scanUpcoming: () => Promise<{ due: ComplianceObligation[]; overdue: ComplianceObligation[] }>;
}

export function useComplianceObligations(
  companyId: string,
  filters?: ObligationFilters
): UseComplianceObligationsReturn {
  const [obligations, setObligations] = useState<ComplianceObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getComplianceObligations(companyId, filters);
      setObligations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load obligations');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters?.status, filters?.category, filters?.regulatoryBody, filters?.priority, filters?.search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: Partial<ComplianceObligationInput>) => {
      const obligation = await createComplianceObligation({ ...input, companyId });
      await refresh();
      return obligation;
    },
    [companyId, refresh]
  );

  const update = useCallback(
    async (id: string, updates: Partial<ComplianceObligation>) => {
      await updateComplianceObligation(id, updates);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteComplianceObligation(id);
      await refresh();
    },
    [refresh]
  );

  const completeFn = useCallback(
    async (id: string) => {
      await completeObligation(id, companyId);
      await refresh();
    },
    [companyId, refresh]
  );

  const scanUpcoming = useCallback(async () => {
    if (!companyId) return { due: [], overdue: [] };
    const result = await scanUpcomingObligations(companyId);
    return result;
  }, [companyId]);

  return {
    obligations,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    complete: completeFn,
    scanUpcoming,
  };
}
