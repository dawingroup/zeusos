/**
 * useAutoSave — Debounced session persistence for all workstreams
 *
 * Watches material overrides, assembly groups, dimensions, and other state.
 * Saves to Firestore on a 1.5s debounce. Shows save status indicator.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { updateSessionWorkstreams } from '../services/workshopViewerService';
import type { ManagedDimension, DimensionOverrides } from '../types/dimension.types';
import type { AssemblyGroup } from '../types/workshop-viewer.types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  sessionId: string | null;
  materialOverrides: Map<string, string>;
  assemblyGroups: AssemblyGroup[];
  userDimensions: ManagedDimension[];
  dimensionOverrides: DimensionOverrides;
  /**
   * Gate that prevents saves until the caller has finished hydrating state
   * from Firestore. Without this, the debounced save can fire with a fresh
   * empty Map and overwrite stored overrides before the load completes.
   * Defaults to `true` so existing callers that don't hydrate keep working.
   */
  isHydrated?: boolean;
}

interface UseAutoSaveResult {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  forceSave: () => void;
}

const DEBOUNCE_MS = 1500;

export function useAutoSave({
  sessionId,
  materialOverrides,
  assemblyGroups,
  userDimensions,
  dimensionOverrides,
  isHydrated = true,
}: UseAutoSaveOptions): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const doSave = useCallback(async () => {
    if (!sessionId) return;
    setSaveStatus('saving');
    try {
      // Convert Map to Record for Firestore
      const matOverrides: Record<string, string> = {};
      materialOverrides.forEach((v, k) => { matOverrides[k] = v; });

      await updateSessionWorkstreams(sessionId, {
        materialSwapOverrides: matOverrides,
        assemblyGroupsData: assemblyGroups,
        userDimensions,
        dimensionOverrides,
      });

      if (isMounted.current) {
        setSaveStatus('saved');
        setLastSavedAt(new Date());
        // Reset to idle after 2s
        setTimeout(() => { if (isMounted.current) setSaveStatus('idle'); }, 2000);
      }
    } catch (err) {
      console.error('[useAutoSave] Save failed:', err);
      if (isMounted.current) setSaveStatus('error');
    }
  }, [sessionId, materialOverrides, assemblyGroups, userDimensions, dimensionOverrides]);

  // Debounced auto-save. `isHydrated` guards against the common "mount →
  // save-empty-over-stored" race: callers that load from Firestore flip
  // it to true only after the load resolves, at which point the first
  // render reflects the loaded state and a save is safe.
  useEffect(() => {
    if (!sessionId || !isHydrated) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId, isHydrated, materialOverrides, assemblyGroups, userDimensions, dimensionOverrides, doSave]);

  return { saveStatus, lastSavedAt, forceSave: doSave };
}
