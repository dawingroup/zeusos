/**
 * useBoundsCache — Lifecycle for the framing bounds cache
 *
 * The cache is mutable by design — bounds.service functions write into it
 * directly as they compute. The hook provides stable references and an
 * explicit invalidation API.
 */
import { useRef, useCallback } from 'react';
import type { BoundsCache } from '../types/framing.types';
import { createBoundsCache, invalidateBoundsCache } from '../services/bounds.service';

interface UseBoundsCacheResult {
  cache: BoundsCache;
  invalidate: (scope?: 'scene' | 'cabinet' | 'assembly' | 'part' | 'all', id?: string) => void;
  clear: () => void;
  geometryVersion: number;
}

export function useBoundsCache(): UseBoundsCacheResult {
  const cacheRef = useRef<BoundsCache>(createBoundsCache());

  const invalidate = useCallback((
    scope?: 'scene' | 'cabinet' | 'assembly' | 'part' | 'all',
    id?: string,
  ) => {
    cacheRef.current = invalidateBoundsCache(cacheRef.current, scope, id);
  }, []);

  const clear = useCallback(() => {
    cacheRef.current = createBoundsCache();
  }, []);

  return {
    cache: cacheRef.current,
    invalidate,
    clear,
    geometryVersion: cacheRef.current.geometryVersion,
  };
}
