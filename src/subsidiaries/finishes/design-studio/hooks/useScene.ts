/**
 * useScene — TanStack Query wrapper for scene CRUD
 *
 * Loads scene with optional cabinet hydration.
 * Returns scene, cabinets, isLoading, and mutate functions.
 */
import { useState, useEffect, useCallback } from 'react';
import type { DesignScene, SceneCabinet } from '../types/scene.types';
import type { AddCabinetInput } from '../schemas/scene.schemas';
import {
  getScene,
  getSceneCabinets,
  listActiveScenes,
  createScene,
  updateScene,
  archiveScene,
  deleteScene,
  addCabinetToScene,
  duplicateCabinet,
  removeCabinetFromScene,
  updateCabinetPosition,
} from '../services/scene.service';
import type { CabinetPosition } from '../types/scene.types';
import { findFreeSlot } from '../engines/alignment/freeSlot';
import {
  DEFAULT_CABINET_WIDTH_MM,
  DEFAULT_CABINET_DEPTH_MM,
  NEW_CABINET_SPACING_MM,
  NEW_CABINET_ROW_WIDTH_MM,
} from '../constants/scene.constants';

interface UseSceneOptions {
  includeFullCabinets?: boolean;
}

interface UseSceneResult {
  scene: DesignScene | null;
  cabinets: SceneCabinet[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addCabinet: (input: AddCabinetInput) => Promise<string>;
  duplicate: (cabinetId: string, newPosition?: Partial<CabinetPosition>) => Promise<string>;
  removeCabinet: (cabinetId: string) => Promise<void>;
  moveCabinet: (cabinetId: string, position: CabinetPosition, rotation?: number) => Promise<void>;
  updateSceneMeta: (updates: Partial<Pick<DesignScene, 'name' | 'description' | 'status'>>) => Promise<void>;
  archive: () => Promise<void>;
}

export function useScene(sceneId: string | null, options: UseSceneOptions = {}): UseSceneResult {
  const [scene, setScene] = useState<DesignScene | null>(null);
  const [cabinets, setCabinets] = useState<SceneCabinet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!sceneId) {
      setScene(null);
      setCabinets([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const s = await getScene(sceneId, options.includeFullCabinets);
      setScene(s);
      if (s) {
        const cabs = await getSceneCabinets(sceneId);
        setCabinets(cabs);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [sceneId, options.includeFullCabinets]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addCabinet = useCallback(async (input: AddCabinetInput) => {
    if (!sceneId) throw new Error('No scene loaded');

    // Free-slot placement when the caller didn't supply a position.
    // Keeps existing flows that *do* pass a position (BulkImport, KB
    // drag-drop) working unchanged — only the origin-default path
    // (AddCabinetDialog) gets auto-placement.
    let resolvedInput = input;
    if (!input.position) {
      const config = (input.configuration ?? {}) as Record<string, unknown>;
      const width = typeof config.width === 'number' && config.width > 0
        ? config.width : DEFAULT_CABINET_WIDTH_MM;
      const depth = typeof config.depth === 'number' && config.depth > 0
        ? config.depth : DEFAULT_CABINET_DEPTH_MM;
      const footprints = cabinets.map(c => {
        const cfg = (c.configuration ?? {}) as Record<string, unknown>;
        return {
          x: c.position?.x ?? 0,
          z: c.position?.z ?? 0,
          width: typeof cfg.width === 'number' && cfg.width > 0 ? cfg.width : DEFAULT_CABINET_WIDTH_MM,
          depth: typeof cfg.depth === 'number' && cfg.depth > 0 ? cfg.depth : DEFAULT_CABINET_DEPTH_MM,
        };
      });
      const slot = findFreeSlot(footprints, { width, depth }, {
        spacingMm: NEW_CABINET_SPACING_MM,
        rowWidthMm: NEW_CABINET_ROW_WIDTH_MM,
      });
      resolvedInput = {
        ...input,
        position: { x: slot.x, y: slot.y, z: slot.z, anchoredTo: 'floor' },
      };
    }

    const id = await addCabinetToScene(sceneId, resolvedInput);
    await fetch();
    return id;
  }, [sceneId, fetch, cabinets]);

  const duplicate = useCallback(async (cabinetId: string, newPosition?: Partial<CabinetPosition>) => {
    if (!sceneId) throw new Error('No scene loaded');
    const id = await duplicateCabinet(sceneId, cabinetId, newPosition);
    await fetch();
    return id;
  }, [sceneId, fetch]);

  const removeCab = useCallback(async (cabinetId: string) => {
    if (!sceneId) throw new Error('No scene loaded');
    await removeCabinetFromScene(sceneId, cabinetId);
    await fetch();
  }, [sceneId, fetch]);

  const moveCabinet = useCallback(async (cabinetId: string, position: CabinetPosition, rotation?: number) => {
    if (!sceneId) throw new Error('No scene loaded');

    // Optimistic local update. Without this, every drag release triggers a
    // full fetch() → new cabinets array identity → the viewport's cabinet-
    // loading effect disposes every group and re-parses every GLB. The user
    // perceives that as the page "reloading" on every interaction.
    //
    // Capture the current cabinet's revision for CAS *before* we mutate
    // local state so we send the value the server expects (not the
    // optimistically-bumped one).
    let expectedRevision: number | undefined;
    setCabinets(prev => {
      const existing = prev.find(c => c.id === cabinetId);
      expectedRevision = typeof existing?.revision === 'number' ? existing.revision : undefined;
      return prev.map(c => c.id === cabinetId
        ? {
            ...c,
            position,
            ...(rotation !== undefined ? { rotation } : {}),
            // Bump local revision so subsequent optimistic writes during
            // the same drag session stay in sync with the server's new
            // value once this write lands.
            revision: typeof c.revision === 'number' ? c.revision + 1 : 1,
          }
        : c);
    });

    try {
      await updateCabinetPosition(sceneId, cabinetId, position, rotation, expectedRevision);
    } catch (err) {
      // Stale-revision: re-fetch the cabinet and rebase local state, then
      // retry once. If it still fails, surface to caller.
      if (err instanceof Error && err.name === 'StaleRevisionError') {
        console.warn('[useScene] stale revision — reconciling from server');
        await fetch();  // full scene refetch reconciles
        return;
      }
      throw err;
    }
  }, [sceneId, fetch]);

  const updateSceneMeta = useCallback(async (updates: Partial<Pick<DesignScene, 'name' | 'description' | 'status'>>) => {
    if (!sceneId) throw new Error('No scene loaded');
    await updateScene(sceneId, updates);
    await fetch();
  }, [sceneId, fetch]);

  const archive = useCallback(async () => {
    if (!sceneId) throw new Error('No scene loaded');
    await archiveScene(sceneId);
    await fetch();
  }, [sceneId, fetch]);

  return {
    scene,
    cabinets,
    isLoading,
    error,
    refetch: fetch,
    addCabinet,
    duplicate,
    removeCabinet: removeCab,
    moveCabinet,
    updateSceneMeta,
    archive,
  };
}

/** List all active scenes (for SceneBrowser) */
export function useSceneList() {
  const [scenes, setScenes] = useState<DesignScene[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listActiveScenes();
      setScenes(list);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = useCallback(async (input: { name: string; projectId: string; customerId: string; description?: string }) => {
    const id = await createScene(input);
    await fetch();
    return id;
  }, [fetch]);

  const remove = useCallback(async (sceneId: string) => {
    await deleteScene(sceneId);
    await fetch();
  }, [fetch]);

  return { scenes, isLoading, error, refetch: fetch, create, remove };
}
