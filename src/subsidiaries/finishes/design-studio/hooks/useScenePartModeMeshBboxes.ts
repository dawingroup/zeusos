/**
 * When selection mode is "Part", mesh picking may target a cabinet that is
 * not the roster-selected one. Preload an AABB map per cabinet so
 * `handleMeshClick` can run the bbox containment fallback for any hit.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SceneCabinet } from '../types/scene.types';
import { loadParsedModelForCabinetGlb } from './useCabinetParsedModel';
import { buildMeshBboxMap } from './useMeshBboxes';
import type { GeomBox } from '../services/partGeometryClassifier';

function cabinetMeshKey(cab: SceneCabinet): string {
  const url = cab.sourceModelUrl || cab.glbUrl || '';
  const mesh = (cab.sourceMeshNames ?? []).join('|');
  return `${cab.id}::${url}::${mesh}`;
}

export function useScenePartModeMeshBboxIndex(
  sceneId: string | null,
  cabinets: SceneCabinet[],
  enabled: boolean,
): (cabinetId: string, meshNodeId: string) => GeomBox | undefined {
  const [byCabinet, setByCabinet] = useState<Map<string, Map<string, GeomBox>> | null>(null);

  const sceneKey = useMemo(
    () => cabinets.map(cabinetMeshKey).join(';;'),
    [cabinets],
  );

  useEffect(() => {
    if (!enabled || !sceneId) {
      setByCabinet(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const next = new Map<string, Map<string, GeomBox>>();
      await Promise.all(
        cabinets.map(async cab => {
          const url = cab.sourceModelUrl || cab.glbUrl;
          if (!url) return;
          try {
            const model = await loadParsedModelForCabinetGlb(url, cab.sourceMeshNames);
            if (cancelled) return;
            next.set(cab.id, buildMeshBboxMap(model));
          } catch (e) {
            console.warn(`[useScenePartModeMeshBboxIndex] ${cab.id}:`, e);
          }
        }),
      );
      if (!cancelled) setByCabinet(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, sceneId, sceneKey, cabinets]);

  return useCallback(
    (cabinetId: string, meshNodeId: string) => {
      const m = byCabinet?.get(cabinetId);
      if (!m) return undefined;
      if (m.has(meshNodeId)) return m.get(meshNodeId);
      const n = meshNodeId.trim().toLowerCase().replace(/\s+/g, '_');
      for (const [k, v] of m) {
        if (k.trim().toLowerCase().replace(/\s+/g, '_') === n) return v;
      }
      return undefined;
    },
    [byCabinet],
  );
}
