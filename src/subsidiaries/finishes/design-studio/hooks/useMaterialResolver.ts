/**
 * useMaterialResolver — Resolve 3DS materials to Finish Library entries
 *
 * Subscribes to the Finish Library and auto-matches model materials.
 * Returns reactive material mappings that update when the finish library changes.
 *
 * P21.7: when a `materialPalette` is supplied (from the bound DesignProject
 * via `ProjectContext`), the resolver prefers finishes that the designer
 * has already chosen for this project — so AI recognition aims at known
 * choices before falling back to the full global library.
 */

import { useMemo } from 'react';
import { useFinishLibrary } from '@/modules/inventory/hooks/useFinishLibrary';
import {
  resolveFromThreeDSNames,
  paletteEntriesToFinishIds,
  type MaterialMapping,
} from '../services/materialResolverService';
import type { ParsedModel, MaterialPaletteEntry } from '../types/workshop-viewer.types';

interface UseMaterialResolverResult {
  mappings: MaterialMapping[];
  loading: boolean;
  matchedCount: number;
  unmatchedCount: number;
  /** How many of the returned mappings came from the project palette. */
  paletteMatchedCount: number;
}

export function useMaterialResolver(
  model: ParsedModel | null,
  materialPalette?: MaterialPaletteEntry[] | null,
): UseMaterialResolverResult {
  const { finishes, loading } = useFinishLibrary({ isActive: true });

  const preferredFinishIds = useMemo(
    () => paletteEntriesToFinishIds(materialPalette ?? [], finishes),
    [materialPalette, finishes],
  );

  const mappings = useMemo(() => {
    if (!model || finishes.length === 0) return [];
    return resolveFromThreeDSNames(model.materials, finishes, {
      preferredFinishIds,
    });
  }, [model, finishes, preferredFinishIds]);

  const matchedCount = mappings.filter(m => m.confidence > 0).length;
  const unmatchedCount = mappings.filter(m => m.confidence === 0).length;
  const paletteMatchedCount = mappings.filter(m => m.viaProjectPalette).length;

  return { mappings, loading, matchedCount, unmatchedCount, paletteMatchedCount };
}
