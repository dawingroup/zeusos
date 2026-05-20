/**
 * Hook for workstation management with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import type { Workstation, WorkstationStatus } from '../types';
import { workstationService } from '../services/workstationService';

interface UseWorkstationsResult {
  workstations: Workstation[];
  isLoading: boolean;
  error: string | null;
  createWorkstation: (data: Omit<Workstation, 'id' | 'currentActiveJobs' | 'currentStepIds' | 'queuedStepCount' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => Promise<string>;
  updateWorkstation: (id: string, updates: Partial<Workstation>) => Promise<void>;
  setStatus: (id: string, status: WorkstationStatus) => Promise<void>;
  refreshLoad: (id: string) => Promise<void>;
}

export function useWorkstations(
  organizationId: string,
  subsidiaryId: string,
  userId: string,
): UseWorkstationsResult {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !subsidiaryId) {
      setWorkstations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = workstationService.subscribeToWorkstations(
      organizationId,
      subsidiaryId,
      (data) => {
        setWorkstations(data);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [organizationId, subsidiaryId]);

  const createWorkstation = useCallback(
    async (data: Omit<Workstation, 'id' | 'currentActiveJobs' | 'currentStepIds' | 'queuedStepCount' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => {
      try {
        return await workstationService.createWorkstation(data, userId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create workstation';
        setError(msg);
        throw err;
      }
    },
    [userId],
  );

  const updateWorkstation = useCallback(
    async (id: string, updates: Partial<Workstation>) => {
      try {
        await workstationService.updateWorkstation(id, updates, userId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update workstation';
        setError(msg);
        throw err;
      }
    },
    [userId],
  );

  const setStatus = useCallback(
    async (id: string, status: WorkstationStatus) => {
      try {
        await workstationService.setWorkstationStatus(id, status, userId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update status';
        setError(msg);
        throw err;
      }
    },
    [userId],
  );

  const refreshLoad = useCallback(
    async (id: string) => {
      await workstationService.updateWorkstationLoad(id);
    },
    [],
  );

  return {
    workstations,
    isLoading,
    error,
    createWorkstation,
    updateWorkstation,
    setStatus,
    refreshLoad,
  };
}
