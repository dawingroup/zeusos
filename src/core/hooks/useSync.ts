import { useCallback, useEffect, useState } from 'react';
import {
  getPendingSyncTasks,
  subscribeToSyncQueue,
  type SyncTask,
} from '@/core/services/syncService';

export interface UseSyncOptions {
  organizationId: string;
  realtime?: boolean;
}

export function useSync({ organizationId, realtime = true }: UseSyncOptions) {
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getPendingSyncTasks(organizationId);
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load sync tasks'));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!realtime || !organizationId) return;

    const unsubscribe = subscribeToSyncQueue(organizationId, setTasks);
    return () => unsubscribe();
  }, [organizationId, realtime]);

  return { tasks, loading, error, refresh };
}
