import { useCallback, useEffect, useRef, useState } from 'react';
import type { MaterialMappingLite } from '../types/modelPackage.types';
import { loadPartsReviewMaterialMappings } from '../services/partsReviewMaterialMappings';

type CabinetRef = { id: string };

interface UsePartsReviewMaterialMappingsResult {
  mappings: MaterialMappingLite[];
  isLoading: boolean;
  error: Error | null;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  refetch: () => Promise<void>;
}

/**
 * Loads and deduplicates persisted material mappings used by Parts Review.
 * Re-fetches only when the scene or cabinet id set changes.
 */
export function usePartsReviewMaterialMappings(
  sceneId: string,
  cabinets: ReadonlyArray<CabinetRef>,
): UsePartsReviewMaterialMappingsResult {
  const [mappings, setMappings] = useState<MaterialMappingLite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastAttemptAt, setLastAttemptAt] = useState<Date | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  const requestIdRef = useRef(0);

  // Keep dependencies stable to avoid rerunning when cabinet object references
  // change but ids stay the same.
  const cabinetKey = cabinets.map(c => c.id).join('\u0000');

  const refetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    setLastAttemptAt(new Date());
    try {
      const cabinetRefs = cabinetKey
        ? cabinetKey.split('\u0000').map(id => ({ id }))
        : [];
      const loaded = await loadPartsReviewMaterialMappings(sceneId, cabinetRefs);
      if (requestIdRef.current !== requestId) return;
      setMappings(loaded);
      setLastSuccessAt(new Date());
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err as Error);
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, [sceneId, cabinetKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { mappings, isLoading, error, lastAttemptAt, lastSuccessAt, refetch };
}
