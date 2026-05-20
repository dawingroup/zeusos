/**
 * useStageTransition Hook
 * Handle stage transitions for design items
 */

import { useState, useCallback } from 'react';
import type { DesignStage } from '../types';
import { transitionStage } from '../services/firestore';
import { useAuth } from '@/contexts/AuthContext';

export interface UseStageTransitionReturn {
  transitionToStage: (
    targetStage: DesignStage, 
    notes?: string, 
    override?: boolean
  ) => Promise<boolean>;
  transitioning: boolean;
  error: Error | null;
  clearError: () => void;
}

/**
 * Hook for managing stage transitions
 */
export function useStageTransition(
  projectId: string | null | undefined,
  itemId: string | null | undefined
): UseStageTransitionReturn {
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const transitionToStage = useCallback(async (
    targetStage: DesignStage,
    notes: string = '',
    override: boolean = false
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
      setTransitioning(true);
      setError(null);
      
      await transitionStage(
        projectId,
        itemId,
        targetStage,
        user.email,
        notes,
        override
      );
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to transition stage'));
      return false;
    } finally {
      setTransitioning(false);
    }
  }, [projectId, itemId, user?.email]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { transitionToStage, transitioning, error, clearError };
}

export default useStageTransition;
