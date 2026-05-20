/**
 * useRAGUpdate Hook
 * Handle RAG status updates for design items
 */

import { useState, useCallback } from 'react';
import type { RAGStatusValue } from '../types';
import { updateRAGAspect } from '../services/firestore';
import { useAuth } from '@/contexts/AuthContext';

export interface UseRAGUpdateReturn {
  updateAspect: (
    aspectPath: string, 
    status: RAGStatusValue, 
    notes: string
  ) => Promise<boolean>;
  updating: boolean;
  error: Error | null;
  clearError: () => void;
}

/**
 * Hook for updating RAG status aspects
 */
export function useRAGUpdate(
  projectId: string | null | undefined,
  itemId: string | null | undefined
): UseRAGUpdateReturn {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const updateAspectFn = useCallback(async (
    aspectPath: string,
    status: RAGStatusValue,
    notes: string
  ): Promise<boolean> => {
    if (!projectId || !itemId) {
      setError(new Error('Project ID and Item ID are required'));
      return false;
    }

    if (!user?.email) {
      setError(new Error('User must be authenticated'));
      return false;
    }

    try {
      setUpdating(true);
      setError(null);
      
      await updateRAGAspect(
        projectId,
        itemId,
        aspectPath,
        { status, notes },
        user.email
      );
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update RAG status'));
      return false;
    } finally {
      setUpdating(false);
    }
  }, [projectId, itemId, user?.email]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { updateAspect: updateAspectFn, updating, error, clearError };
}

export default useRAGUpdate;
