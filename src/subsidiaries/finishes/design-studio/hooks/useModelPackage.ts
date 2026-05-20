/**
 * useModelPackage — Fetch the current ModelPackage for a cabinet
 */
import { useState, useEffect, useCallback } from 'react';
import type { ModelPackage } from '../types/modelPackage.types';
import { getModelPackage, getModelPackageVersions } from '../services/modelPackage.service';

interface UseModelPackageResult {
  modelPackage: ModelPackage | null;
  versions: ModelPackage[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadVersions: () => Promise<void>;
}

export function useModelPackage(
  sceneId: string | null,
  cabinetId: string | null,
): UseModelPackageResult {
  const [modelPackage, setModelPackage] = useState<ModelPackage | null>(null);
  const [versions, setVersions] = useState<ModelPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!sceneId || !cabinetId) {
      setModelPackage(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const pkg = await getModelPackage(sceneId, cabinetId);
      setModelPackage(pkg);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [sceneId, cabinetId]);

  const loadVersions = useCallback(async () => {
    if (!sceneId || !cabinetId) return;
    try {
      const list = await getModelPackageVersions(sceneId, cabinetId);
      setVersions(list);
    } catch (err) {
      setError(err as Error);
    }
  }, [sceneId, cabinetId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { modelPackage, versions, isLoading, error, refetch, loadVersions };
}
