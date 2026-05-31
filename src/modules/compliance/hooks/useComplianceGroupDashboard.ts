import { useState, useEffect, useCallback } from 'react';
import {
  complianceGroupService,
  GROUP_SUBSIDIARIES,
  type GroupComplianceDashboardData,
} from '../services/complianceGroupService';

/**
 * Consolidated compliance rollup for the Zeus Group (parent) view —
 * aggregates documents, obligations and the compliance score across the five
 * operating sibling brands. (Phase 2.1)
 */
export function useComplianceGroupDashboard() {
  const [data, setData] = useState<GroupComplianceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await complianceGroupService.getGroupDashboard(GROUP_SUBSIDIARIES));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
