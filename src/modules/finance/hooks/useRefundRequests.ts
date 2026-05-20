// ============================================================================
// USE REFUND REQUESTS HOOK
// DawinOS v2.0 - Financial Management Module
// React hook for refund request management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { RefundRequest } from '../types/operations.types';
import { getRefundRequests } from '../services/refundService';

export interface UseRefundRequestsOptions {
  companyId: string;
  status?: string;
  autoLoad?: boolean;
}

export interface UseRefundRequestsReturn {
  reports: RefundRequest[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRefundRequests({
  companyId,
  status,
  autoLoad = true,
}: UseRefundRequestsOptions): UseRefundRequestsReturn {
  const [reports, setReports] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRefundRequests(companyId, status);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load refund requests');
    } finally {
      setLoading(false);
    }
  }, [companyId, status]);

  useEffect(() => {
    if (autoLoad && companyId) {
      refresh();
    }
  }, [autoLoad, companyId, refresh]);

  return {
    reports,
    loading,
    error,
    refresh,
  };
}
