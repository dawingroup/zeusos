/**
 * useClientInteractions Hook
 * Subscribe to client interactions for a project in real-time
 */

import { useState, useEffect, useCallback } from 'react';
import type { ClientInteraction, InteractionType } from '../types';
import {
  subscribeToClientInteractions,
  createClientInteraction,
  updateClientInteraction,
  deleteClientInteraction,
} from '../services/firestore';

export interface UseClientInteractionsReturn {
  interactions: ClientInteraction[];
  loading: boolean;
  error: Error | null;
  addInteraction: (
    data: Omit<ClientInteraction, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    userId: string
  ) => Promise<string>;
  editInteraction: (
    interactionId: string,
    data: Partial<ClientInteraction>,
    userId: string
  ) => Promise<void>;
  removeInteraction: (interactionId: string) => Promise<void>;
}

/**
 * Hook for real-time client interactions subscription with CRUD helpers
 */
export function useClientInteractions(
  projectId: string | null | undefined,
  filterType?: InteractionType
): UseClientInteractionsReturn {
  const [interactions, setInteractions] = useState<ClientInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setInteractions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToClientInteractions(
      projectId,
      (data) => {
        setInteractions(data);
        setLoading(false);
        setError(null);
      },
      filterType
    );

    return () => unsubscribe();
  }, [projectId, filterType]);

  const addInteraction = useCallback(
    async (
      data: Omit<ClientInteraction, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
      userId: string
    ) => {
      if (!projectId) throw new Error('No project ID');
      try {
        return await createClientInteraction(projectId, data, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to add interaction');
        setError(e);
        throw e;
      }
    },
    [projectId]
  );

  const editInteraction = useCallback(
    async (interactionId: string, data: Partial<ClientInteraction>, userId: string) => {
      if (!projectId) throw new Error('No project ID');
      try {
        await updateClientInteraction(projectId, interactionId, data, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update interaction');
        setError(e);
        throw e;
      }
    },
    [projectId]
  );

  const removeInteraction = useCallback(
    async (interactionId: string) => {
      if (!projectId) throw new Error('No project ID');
      try {
        await deleteClientInteraction(projectId, interactionId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to delete interaction');
        setError(e);
        throw e;
      }
    },
    [projectId]
  );

  return { interactions, loading, error, addInteraction, editInteraction, removeInteraction };
}

export default useClientInteractions;
