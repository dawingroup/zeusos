/**
 * useCabinet — Single cabinet with full detail
 *
 * Loads a single cabinet from a scene. Used by CabinetDetailPanel
 * and PDF generation.
 */
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SceneCabinet } from '../types/scene.types';

interface UseCabinetResult {
  cabinet: SceneCabinet | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCabinet(sceneId: string | null, cabinetId: string | null): UseCabinetResult {
  const [cabinet, setCabinet] = useState<SceneCabinet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!sceneId || !cabinetId) {
      setCabinet(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const snap = await getDoc(doc(db, 'designScenes', sceneId, 'cabinets', cabinetId));
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        setCabinet({
          id: snap.id,
          ...data,
          assemblies: Array.isArray(data.assemblies) ? data.assemblies : [],
        } as SceneCabinet);
      } else {
        setCabinet(null);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [sceneId, cabinetId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { cabinet, isLoading, error, refetch: fetch };
}
