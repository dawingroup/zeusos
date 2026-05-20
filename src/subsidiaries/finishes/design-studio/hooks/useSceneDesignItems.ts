/**
 * useSceneDesignItems — Hydrates DesignItem metadata for a scene's cabinets
 *
 * P2 Slice 4: `SceneCabinet.designItemId` is an FK only — the UI needs the
 * DesignItem's `name`, `itemCode`, `category` etc. to render filter chips,
 * group headers, and detail-panel context without every consumer reaching
 * into design-manager directly.
 *
 * Given a set of cabinets, loads each referenced DesignItem from
 * `designProjects/{projectId}/designItems/{itemId}` and returns:
 *   - `byId`: Map<designItemId, DesignItem> for O(1) lookup
 *   - `unique`: sorted array of distinct DesignItems that appear in the
 *     scene (useful for filter toolbars)
 *   - `unassigned`: count of cabinets without a designItemId, surfaced
 *     so the roster can show an "unassigned" bucket until Slice 6.
 *
 * Keeps a simple in-hook cache to avoid re-fetching when the cabinet list
 * shrinks/grows but references the same items.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDesignItem } from '@/modules/design-manager/services';
import type { DesignItem } from '@/modules/design-manager/types';
import type { SceneCabinet } from '../types/scene.types';
import { isProjectBoundProjectId } from '../utils/sceneProjectUtils';

interface UseSceneDesignItemsResult {
  byId: Map<string, DesignItem>;
  unique: DesignItem[];
  unassignedCount: number;
  isLoading: boolean;
  error: Error | null;
}

export function useSceneDesignItems(
  projectId: string | null | undefined,
  cabinets: SceneCabinet[],
): UseSceneDesignItemsResult {
  const [byId, setById] = useState<Map<string, DesignItem>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Cache across renders so we don't refetch an item we've already loaded.
  const cacheRef = useRef<Map<string, DesignItem>>(new Map());

  // Collect unique designItemIds from the current cabinets.
  const referencedIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of cabinets) {
      if (c.designItemId) set.add(c.designItemId);
    }
    return Array.from(set).sort();
  }, [cabinets]);

  const unassignedCount = useMemo(
    () => cabinets.filter(c => !c.designItemId).length,
    [cabinets],
  );

  useEffect(() => {
    if (!isProjectBoundProjectId(projectId)) {
      setById(new Map());
      return;
    }
    if (referencedIds.length === 0) {
      setById(new Map());
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const missing = referencedIds.filter(id => !cacheRef.current.has(id));

    const load = async () => {
      try {
        const fetched = await Promise.all(
          missing.map(async id => {
            const item = await getDesignItem(projectId, id);
            return item ? ([id, item] as const) : null;
          }),
        );
        if (cancelled) return;
        for (const entry of fetched) {
          if (entry) cacheRef.current.set(entry[0], entry[1]);
        }
        // Build the "active" map from cache, limited to referenced ids.
        const next = new Map<string, DesignItem>();
        for (const id of referencedIds) {
          const item = cacheRef.current.get(id);
          if (item) next.set(id, item);
        }
        setById(next);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Fast path: nothing new to fetch, just reproject from cache.
    if (missing.length === 0) {
      const next = new Map<string, DesignItem>();
      for (const id of referencedIds) {
        const item = cacheRef.current.get(id);
        if (item) next.set(id, item);
      }
      setById(next);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, referencedIds]);

  const unique = useMemo(() => {
    return Array.from(byId.values()).sort((a, b) => {
      const an = (a.name ?? '').toLowerCase();
      const bn = (b.name ?? '').toLowerCase();
      return an.localeCompare(bn);
    });
  }, [byId]);

  return { byId, unique, unassignedCount, isLoading, error };
}
