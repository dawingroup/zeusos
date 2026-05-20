/**
 * useProjectCutList — Returns the ProjectCutList for a scene
 */
import { useState, useEffect } from 'react';
import type { ProjectCutList, SceneAssembly } from '../types/assembly.types';
import type { SceneCabinet } from '../types/scene.types';
import { getProjectCutList } from '../services/sceneBomRollup.service';

export function useProjectCutList(
  sceneId: string | null,
  cabinets: SceneCabinet[],
  assembliesByCabinet: Record<string, SceneAssembly[]>,
) {
  const [cutList, setCutList] = useState<ProjectCutList | null>(null);

  useEffect(() => {
    if (!sceneId || cabinets.length === 0) {
      setCutList(null);
      return;
    }
    setCutList(getProjectCutList(cabinets, assembliesByCabinet, sceneId));
  }, [sceneId, cabinets, assembliesByCabinet]);

  return cutList;
}
