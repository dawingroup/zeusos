/**
 * useMaterialSwap — Manage material override state for live finish swapping
 *
 * Tracks overrides (mesh material name → finish library ID) and provides
 * methods to apply, reset, and query override state.
 *
 * Persistence hydration is handled OUTSIDE this hook (callers seed the
 * initial Map via parameters passed to their own state). Keeping this
 * hook's shape minimal (single useState + useCallbacks) avoids changing
 * hook count for components that consumed the pre-persistence version.
 */

import { useState, useCallback } from 'react';

interface UseMaterialSwapResult {
  /** Map of 3DS material name → overridden finish library ID */
  overrides: Map<string, string>;
  /** Apply a material override */
  applyOverride: (materialName: string, finishId: string) => void;
  /** Reset a single material to its original */
  resetOverride: (materialName: string) => void;
  /** Reset all overrides */
  resetAll: () => void;
  /** Check if a material is overridden */
  isOverridden: (materialName: string) => boolean;
  /** Count of active overrides */
  overrideCount: number;
  /**
   * Replace the entire override Map. Callers use this to hydrate from
   * persisted storage (e.g. `scene.materialOverrides` or session) once
   * the load resolves. Accepts either a plain object or another Map.
   */
  setAllOverrides: (next: Record<string, string> | Map<string, string>) => void;
}

export function useMaterialSwap(): UseMaterialSwapResult {
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  const applyOverride = useCallback((materialName: string, finishId: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.set(materialName, finishId);
      return next;
    });
  }, []);

  const resetOverride = useCallback((materialName: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      next.delete(materialName);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides(new Map());
  }, []);

  const isOverridden = useCallback((materialName: string) => {
    return overrides.has(materialName);
  }, [overrides]);

  const setAllOverrides = useCallback((next: Record<string, string> | Map<string, string>) => {
    setOverrides(next instanceof Map ? new Map(next) : new Map(Object.entries(next)));
  }, []);

  return {
    overrides,
    applyOverride,
    resetOverride,
    resetAll,
    isOverridden,
    overrideCount: overrides.size,
    setAllOverrides,
  };
}
