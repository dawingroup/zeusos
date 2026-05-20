/**
 * useDesignSignOff — Subscribe to design sign-offs for a given sales order.
 */

import { useState, useEffect, useMemo } from 'react';
import type { DesignSignOff } from '../types';
import { subscribeToSignOffs } from '../services/designSignOffService';

export interface UseDesignSignOffResult {
  signOffs: DesignSignOff[];
  loading: boolean;
  error: string | null;
  currentSignOff: DesignSignOff | null;
  allApproved: boolean;
}

export function useDesignSignOff(salesOrderId: string | undefined): UseDesignSignOffResult {
  const [signOffs, setSignOffs] = useState<DesignSignOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salesOrderId) {
      setSignOffs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSignOffs(salesOrderId, (fetched) => {
      setSignOffs(fetched);
      setLoading(false);
    });

    return unsubscribe;
  }, [salesOrderId]);

  const currentSignOff = useMemo(
    () => signOffs.find((s) => s.isValid && s.status !== 'superseded') ?? null,
    [signOffs],
  );

  const allApproved = useMemo(
    () => signOffs.filter((s) => s.isValid).every((s) => s.status === 'approved'),
    [signOffs],
  );

  return { signOffs, loading, error, currentSignOff, allApproved };
}
