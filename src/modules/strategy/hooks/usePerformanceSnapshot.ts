// ============================================================================
// USE PERFORMANCE SNAPSHOT HOOK
// DawinOS v2.0 - CEO Strategy Command Module
// React hook for performance snapshot management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { performanceSnapshotService } from '../services/performanceSnapshot.service';
import {
  PerformanceSnapshot,
  SnapshotFilters,
} from '../types/aggregation.types';
import {
  AggregationLevel,
  SnapshotFrequency,
} from '../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UsePerformanceSnapshotsOptions {
  companyId: string;
  filters?: SnapshotFilters;
  autoFetch?: boolean;
}

export interface UsePerformanceSnapshotsReturn {
  snapshots: PerformanceSnapshot[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createSnapshot: (
    level: AggregationLevel,
    entityId: string,
    entityName: string,
    frequency: SnapshotFrequency
  ) => Promise<PerformanceSnapshot>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  // Computed
  latestSnapshot: PerformanceSnapshot | null;
  snapshotsByFrequency: Record<SnapshotFrequency, PerformanceSnapshot[]>;
}

export interface UsePerformanceSnapshotOptions {
  companyId: string;
  snapshotId: string | null;
  autoFetch?: boolean;
}

export interface UsePerformanceSnapshotReturn {
  snapshot: PerformanceSnapshot | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ----------------------------------------------------------------------------
// usePerformanceSnapshots Hook
// ----------------------------------------------------------------------------

export function usePerformanceSnapshots(
  options: UsePerformanceSnapshotsOptions
): UsePerformanceSnapshotsReturn {
  const { user } = useAuth();
  const { companyId, filters, autoFetch = true } = options;

  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await performanceSnapshotService.getSnapshots(companyId, filters);
      setSnapshots(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch snapshots'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const createSnapshot = useCallback(
    async (
      level: AggregationLevel,
      entityId: string,
      entityName: string,
      frequency: SnapshotFrequency
    ): Promise<PerformanceSnapshot> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }

      const snapshot = await performanceSnapshotService.createSnapshot(
        companyId,
        level,
        entityId,
        entityName,
        frequency,
        user.uid
      );

      setSnapshots(prev => [snapshot, ...prev]);
      return snapshot;
    },
    [companyId, user?.uid]
  );

  const deleteSnapshot = useCallback(
    async (snapshotId: string): Promise<void> => {
      if (!companyId) {
        throw new Error('Company not available');
      }

      await performanceSnapshotService.deleteSnapshot(companyId, snapshotId);
      setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    },
    [companyId]
  );

  // Computed values
  const latestSnapshot = snapshots.length > 0 ? snapshots[0] : null;

  const snapshotsByFrequency: Record<SnapshotFrequency, PerformanceSnapshot[]> = {
    daily: snapshots.filter(s => s.frequency === 'daily'),
    weekly: snapshots.filter(s => s.frequency === 'weekly'),
    monthly: snapshots.filter(s => s.frequency === 'monthly'),
    quarterly: snapshots.filter(s => s.frequency === 'quarterly'),
  };

  return {
    snapshots,
    loading,
    error,
    refresh,
    createSnapshot,
    deleteSnapshot,
    latestSnapshot,
    snapshotsByFrequency,
  };
}

// ----------------------------------------------------------------------------
// usePerformanceSnapshot Hook (Single Snapshot)
// ----------------------------------------------------------------------------

export function usePerformanceSnapshot(
  options: UsePerformanceSnapshotOptions
): UsePerformanceSnapshotReturn {
  const { companyId, snapshotId, autoFetch = true } = options;

  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || !snapshotId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await performanceSnapshotService.getSnapshot(companyId, snapshotId);
      setSnapshot(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch snapshot'));
    } finally {
      setLoading(false);
    }
  }, [companyId, snapshotId]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  return {
    snapshot,
    loading,
    error,
    refresh,
  };
}

// ----------------------------------------------------------------------------
// useEntitySnapshots Hook (Convenience)
// ----------------------------------------------------------------------------

export interface UseEntitySnapshotsOptions {
  companyId: string;
  entityId: string;
  frequency?: SnapshotFrequency;
  fiscalYear?: number;
  limit?: number;
}

export function useEntitySnapshots(options: UseEntitySnapshotsOptions) {
  return usePerformanceSnapshots({
    companyId: options.companyId,
    filters: {
      entityId: options.entityId,
      frequency: options.frequency,
      fiscalYear: options.fiscalYear,
      limit: options.limit,
    },
  });
}
