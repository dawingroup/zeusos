/**
 * useAssemblyExtractor — Triggers and tracks assembly extraction from GLB
 *
 * Returns extraction status, identified assemblies, and errors.
 */
import { useState, useCallback } from 'react';
import type { SceneAssembly } from '../types/assembly.types';
import { extractAssembliesFromParsedModel } from '../services/assembly.service';

interface UseAssemblyExtractorResult {
  assemblies: SceneAssembly[];
  isExtracting: boolean;
  error: Error | null;
  extract: (cabinetId: string, meshNames: string[], archetypeKey?: string) => void;
  clear: () => void;
}

export function useAssemblyExtractor(): UseAssemblyExtractorResult {
  const [assemblies, setAssemblies] = useState<SceneAssembly[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const extract = useCallback((cabinetId: string, meshNames: string[], archetypeKey?: string) => {
    setIsExtracting(true);
    setError(null);
    try {
      const result = extractAssembliesFromParsedModel(cabinetId, meshNames, archetypeKey);
      setAssemblies(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const clear = useCallback(() => {
    setAssemblies([]);
    setError(null);
  }, []);

  return { assemblies, isExtracting, error, extract, clear };
}
