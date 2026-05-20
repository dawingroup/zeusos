/**
 * ALLOCATION HOOKS
 *
 * React hooks for multi-project allocation operations.
 * Uses useState + useCallback pattern matching useQuickCapture.ts.
 */

import { useState, useCallback, useEffect } from 'react';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AllocationService } from '../services/allocation-service';
import type { CreateAllocationInput } from '../services/allocation-service';
import type { AllocationGroup, AllocationSuggestion } from '../types/allocation';

function getService() {
  return AllocationService.getInstance(getFirestore());
}

// ─────────────────────────────────────────────────────────────────
// useCreateAllocationGroup
// ─────────────────────────────────────────────────────────────────

export function useCreateAllocationGroup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createAllocation = useCallback(
    async (
      data: CreateAllocationInput,
      userId: string,
      orgId: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const id = await getService().createAllocationGroup(data, userId, orgId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create allocation');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createAllocation, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// useAllocationGroup
// ─────────────────────────────────────────────────────────────────

export function useAllocationGroup(groupId: string | undefined, orgId: string | undefined) {
  const [group, setGroup] = useState<AllocationGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroup = useCallback(async () => {
    if (!groupId || !orgId) {
      setGroup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getService().getAllocationGroup(groupId, orgId);
      setGroup(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch allocation group'));
    } finally {
      setLoading(false);
    }
  }, [groupId, orgId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  return { group, loading, error, refresh: fetchGroup };
}

// ─────────────────────────────────────────────────────────────────
// useAllocationGroupsForProject
// ─────────────────────────────────────────────────────────────────

export function useAllocationGroupsForProject(
  projectId: string | undefined,
  orgId: string | undefined
) {
  const [groups, setGroups] = useState<AllocationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!projectId || !orgId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getService().getAllocationGroupsForProject(orgId, projectId);
      setGroups(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch allocation groups'));
    } finally {
      setLoading(false);
    }
  }, [projectId, orgId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, error, refresh: fetchGroups };
}

// ─────────────────────────────────────────────────────────────────
// useVendorAllocationHistory
// ─────────────────────────────────────────────────────────────────

export function useVendorAllocationHistory(
  vendorName: string | undefined,
  orgId: string | undefined
) {
  const [suggestions, setSuggestions] = useState<AllocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!vendorName || !orgId || vendorName.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getService().getVendorAllocationHistory(orgId, vendorName);
      setSuggestions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch vendor history'));
    } finally {
      setLoading(false);
    }
  }, [vendorName, orgId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { suggestions, loading, error, refresh: fetchHistory };
}

// ─────────────────────────────────────────────────────────────────
// useVoidAllocationGroup
// ─────────────────────────────────────────────────────────────────

export function useVoidAllocationGroup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const voidGroup = useCallback(
    async (
      groupId: string,
      reason: string,
      userId: string,
      orgId: string
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await getService().voidAllocationGroup(groupId, reason, userId, orgId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to void allocation');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { voidGroup, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// useGenerateAllocationMemo
// ─────────────────────────────────────────────────────────────────

export function useGenerateAllocationMemo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateMemo = useCallback(
    async (allocationGroupId: string, organizationId: string): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const functions = getFunctions();
        const callable = httpsCallable<
          { allocationGroupId: string; organizationId: string },
          { memoUrl: string }
        >(functions, 'generateAllocationMemo');
        const result = await callable({ allocationGroupId, organizationId });
        return result.data.memoUrl;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to generate memo');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { generateMemo, loading, error };
}
