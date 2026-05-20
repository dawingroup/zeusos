/**
 * useSceneBOMRollup — Aggregated BOM at requested scope
 */
import { useState, useEffect } from 'react';
import type { SceneBOMRollup, SceneAssembly } from '../types/assembly.types';
import type { SceneCabinet } from '../types/scene.types';
import { getProjectRollup, getCabinetRollup, getAssemblyRollup } from '../services/sceneBomRollup.service';

interface UseSceneBOMRollupResult {
  rollup: SceneBOMRollup | null;
  isLoading: boolean;
}

export function useSceneBOMRollup(
  level: 'project' | 'cabinet' | 'assembly',
  cabinets: SceneCabinet[],
  assembliesByCabinet: Record<string, SceneAssembly[]>,
  scopeId?: string,
): UseSceneBOMRollupResult {
  const [rollup, setRollup] = useState<SceneBOMRollup | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    try {
      if (level === 'project') {
        setRollup(getProjectRollup(cabinets, assembliesByCabinet));
      } else if (level === 'cabinet' && scopeId) {
        const cab = cabinets.find(c => c.id === scopeId);
        const assemblies = assembliesByCabinet[scopeId] ?? [];
        if (cab) setRollup(getCabinetRollup(cab, assemblies));
      } else if (level === 'assembly' && scopeId) {
        for (const assemblies of Object.values(assembliesByCabinet)) {
          const assembly = assemblies.find(a => a.id === scopeId);
          if (assembly) {
            const cab = cabinets.find(c => c.id === assembly.cabinetId);
            setRollup(getAssemblyRollup(assembly, cab?.displayName ?? ''));
            break;
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [level, cabinets, assembliesByCabinet, scopeId]);

  return { rollup, isLoading };
}
