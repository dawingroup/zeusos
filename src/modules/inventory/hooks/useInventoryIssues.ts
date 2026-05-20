/**
 * useInventoryIssues Hook
 * Subscribe to inventory issues (Issue from Stores) with real-time updates.
 */

import { useState, useEffect } from 'react';
import { subscribeToIssues } from '../services/inventoryIssueService';
import type { InventoryIssue } from '../types/inventoryIssue';

interface UseInventoryIssuesResult {
  issues: InventoryIssue[];
  loading: boolean;
  error: Error | null;
}

export function useInventoryIssues(organizationId: string): UseInventoryIssuesResult {
  const [issues, setIssues] = useState<InventoryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    const unsubscribe = subscribeToIssues(
      organizationId,
      (data) => {
        setIssues(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [organizationId]);

  return { issues, loading, error };
}
