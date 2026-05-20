/**
 * Procurement Hooks
 * React hooks for procurement data management
 */

import { useState, useCallback, useEffect } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/core/hooks/useAuth';
import {
  createProcurementEntry,
  getProcurementEntry,
  updateProcurementEntry,
  deleteProcurementEntry,
  listProcurementEntries,
  performQualityCheck,
  confirmProcurementEntry,
  cancelProcurementEntry,
  disputeProcurementEntry,
  getMaterialProcurementSummary,
  getProjectProcurementSummary,
  bulkUpdateProcurementStatus,
  bulkDeleteProcurementEntries,
  getSupplierSummary,
} from '../services/procurementService';
import type {
  ProcurementEntry,
  CreateProcurementInput,
  UpdateProcurementInput,
  QualityCheckInput,
  ProcurementFilters,
  ProcurementSortOptions,
  ProcurementStatus,
  ProjectProcurementSummary,
  MaterialProcurementSummary,
} from '../types/procurement';

// Default organization ID
const DEFAULT_ORG_ID = 'default';

// ============================================================================
// LIST HOOK WITH PAGINATION
// ============================================================================

export function useProcurementEntries(
  projectId: string,
  filters?: ProcurementFilters,
  sort?: ProcurementSortOptions,
  pageSize: number = 20
) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [entries, setEntries] = useState<ProcurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadEntries = useCallback(async (reset = false) => {
    if (!projectId) return;
    
    if (reset) {
      setLoading(true);
      setLastDoc(null);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const result = await listProcurementEntries(
        projectId,
        filters,
        sort,
        pageSize,
        reset ? undefined : lastDoc || undefined,
        orgId
      );

      if (reset) {
        setEntries(result.entries);
      } else {
        setEntries(prev => [...prev, ...result.entries]);
      }
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId, filters, sort, pageSize, lastDoc, orgId]);

  // Initial load
  useEffect(() => {
    loadEntries(true);
  }, [projectId, filters, sort]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadEntries(false);
    }
  }, [loadingMore, hasMore, loadEntries]);

  const refresh = useCallback(() => {
    loadEntries(true);
  }, [loadEntries]);

  return {
    entries,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

// ============================================================================
// SINGLE ENTRY HOOK
// ============================================================================

export function useProcurementEntry(projectId: string, entryId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [entry, setEntry] = useState<ProcurementEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId || !entryId) {
      setLoading(false);
      return;
    }

    const loadEntry = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProcurementEntry(projectId, entryId, orgId);
        setEntry(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadEntry();
  }, [projectId, entryId, orgId]);

  return { entry, loading, error };
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useCreateProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;
  const userName = user?.displayName || 'Unknown';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (input: CreateProcurementInput): Promise<ProcurementEntry | null> => {
    if (!userId) {
      setError(new Error('User not authenticated'));
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const entry = await createProcurementEntry(projectId, input, userId, userName, orgId);
      return entry;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, userName, orgId]);

  return { create, loading, error };
}

export function useUpdateProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (entryId: string, input: UpdateProcurementInput): Promise<boolean> => {
    if (!userId) {
      setError(new Error('User not authenticated'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await updateProcurementEntry(projectId, entryId, input, userId, orgId);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, orgId]);

  return { update, loading, error };
}

export function useDeleteProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const remove = useCallback(async (entryId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await deleteProcurementEntry(projectId, entryId, orgId);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, orgId]);

  return { remove, loading, error };
}

// ============================================================================
// QUALITY CHECK HOOK
// ============================================================================

export function useQualityCheck(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async (entryId: string, input: QualityCheckInput): Promise<boolean> => {
    if (!userId) {
      setError(new Error('User not authenticated'));
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await performQualityCheck(projectId, entryId, input, userId, orgId);
      return true;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, orgId]);

  return { check, loading, error };
}

// ============================================================================
// STATUS HOOKS
// ============================================================================

export function useConfirmProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  const [loading, setLoading] = useState(false);

  const confirm = useCallback(async (entryId: string): Promise<boolean> => {
    if (!userId) return false;

    setLoading(true);
    try {
      await confirmProcurementEntry(projectId, entryId, userId, orgId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, orgId]);

  return { confirm, loading };
}

export function useCancelProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  const [loading, setLoading] = useState(false);

  const cancel = useCallback(async (entryId: string, reason: string): Promise<boolean> => {
    if (!userId) return false;

    setLoading(true);
    try {
      await cancelProcurementEntry(projectId, entryId, userId, reason, orgId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, orgId]);

  return { cancel, loading };
}

export function useDisputeProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  const [loading, setLoading] = useState(false);

  const dispute = useCallback(async (entryId: string, reason: string): Promise<boolean> => {
    if (!userId) return false;

    setLoading(true);
    try {
      await disputeProcurementEntry(projectId, entryId, userId, reason, orgId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, orgId]);

  return { dispute, loading };
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export function useBulkUpdateStatus(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;

  const [loading, setLoading] = useState(false);

  const bulkUpdate = useCallback(async (entryIds: string[], status: ProcurementStatus): Promise<boolean> => {
    if (!userId) return false;

    setLoading(true);
    try {
      await bulkUpdateProcurementStatus(projectId, entryIds, status, userId, orgId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, orgId]);

  return { bulkUpdate, loading };
}

export function useBulkDeleteProcurement(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [loading, setLoading] = useState(false);

  const bulkDelete = useCallback(async (entryIds: string[]): Promise<boolean> => {
    setLoading(true);
    try {
      await bulkDeleteProcurementEntries(projectId, entryIds, orgId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [projectId, orgId]);

  return { bulkDelete, loading };
}

// ============================================================================
// SUMMARY HOOKS
// ============================================================================

export function useProjectProcurementSummary(projectId: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [summary, setSummary] = useState<ProjectProcurementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectProcurementSummary(projectId, orgId);
        setSummary(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [projectId, orgId]);

  return { summary, loading, error };
}

export function useMaterialProcurementSummary(
  projectId: string,
  materialId: string,
  plannedQuantity: number,
  plannedCost: number
) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [summary, setSummary] = useState<MaterialProcurementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId || !materialId) {
      setLoading(false);
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMaterialProcurementSummary(
          projectId,
          materialId,
          plannedQuantity,
          plannedCost,
          orgId
        );
        setSummary(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [projectId, materialId, plannedQuantity, plannedCost, orgId]);

  return { summary, loading, error };
}

export function useSupplierSummary(projectId: string, supplierName: string) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [summary, setSummary] = useState<{
    totalOrders: number;
    totalAmount: number;
    qualityScore: number;
    materials: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId || !supplierName) {
      setLoading(false);
      return;
    }

    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSupplierSummary(projectId, supplierName, orgId);
        setSummary(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [projectId, supplierName, orgId]);

  return { summary, loading, error };
}
