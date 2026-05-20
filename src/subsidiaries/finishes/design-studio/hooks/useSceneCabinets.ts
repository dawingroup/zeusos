/**
 * useSceneCabinets — Subscribes to cabinets for a scene
 *
 * Returns ordered cabinet array. Refetches on add/remove/position-change.
 */
import { useState, useEffect, useCallback } from 'react';
import type { SceneCabinet } from '../types/scene.types';
import { getSceneCabinets } from '../services/scene.service';

interface UseSceneCabinetsResult {
  cabinets: SceneCabinet[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useSceneCabinets(sceneId: string | null): UseSceneCabinetsResult {
  const [cabinets, setCabinets] = useState<SceneCabinet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!sceneId) {
      setCabinets([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const cabs = await getSceneCabinets(sceneId);
      setCabinets(cabs);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [sceneId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { cabinets, isLoading, error, refetch: fetch };
}
