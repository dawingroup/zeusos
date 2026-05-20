/**
 * useAutoPartsSync — P4.1 debounced auto-sync hook
 *
 * Watches assembly-level changes on project-bound cabinets and
 * triggers `writeSceneOriginParts` after a configurable debounce.
 * Intended for use in scene-level layout pages so any cabinet
 * edit (AI grouping confirm, manual part merge, material swap)
 * propagates to Design Manager without a manual "Sync" click.
 *
 * Safety rails:
 *  - Debounce (default 3 s) collapses rapid successive edits.
 *  - Lock guard: skipped for locked cabinets.
 *  - Concurrent-sync guard: only one sync per DesignItem in flight.
 *  - Errors are logged, never thrown — auto-sync is best-effort.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { writeSceneOriginParts } from '../services/designItemPartsSyncFromScene';
import type { SceneCabinet } from '../types/scene.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoPartsSyncOptions {
  /** Scene id. */
  sceneId: string | undefined;
  /** All cabinets currently loaded for this scene. */
  cabinets: SceneCabinet[];
  /** Current user id. */
  userId: string | undefined;
  /** Debounce interval in ms. Default 3000. */
  debounceMs?: number;
  /** Disable auto-sync entirely (e.g. while a bulk operation is in progress). */
  disabled?: boolean;
}

export interface AutoPartsSyncState {
  /** DesignItem ids currently syncing. */
  syncing: Set<string>;
  /** Last sync results keyed by DesignItem id. */
  lastResults: Map<string, { synced: number; at: Date }>;
  /** Last errors keyed by DesignItem id. */
  lastErrors: Map<string, string>;
  /** Force an immediate sync for a specific DesignItem. */
  forceSyncItem: (designItemId: string) => void;
}

const DEFAULT_DEBOUNCE_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAutoPartsSync({
  sceneId,
  cabinets,
  userId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  disabled = false,
}: AutoPartsSyncOptions): AutoPartsSyncState {
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [lastResults, setLastResults] = useState<Map<string, { synced: number; at: Date }>>(new Map());
  const [lastErrors, setLastErrors] = useState<Map<string, string>>(new Map());

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inflightRef = useRef<Set<string>>(new Set());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // -----------------------------------------------------------------------
  // Core sync runner — one DesignItem at a time
  // -----------------------------------------------------------------------
  const runSync = useCallback(async (designItemId: string) => {
    if (!sceneId || !userId) return;
    if (inflightRef.current.has(designItemId)) return; // already running

    inflightRef.current.add(designItemId);
    if (isMounted.current) {
      setSyncing(prev => new Set(prev).add(designItemId));
    }

    try {
      const res = await writeSceneOriginParts(sceneId, designItemId, userId, {
        pairingStrategy: 'auto',
      });
      if (isMounted.current) {
        setLastResults(prev => {
          const next = new Map(prev);
          next.set(designItemId, { synced: res.synced, at: new Date() });
          return next;
        });
        setLastErrors(prev => {
          if (!prev.has(designItemId)) return prev;
          const next = new Map(prev);
          next.delete(designItemId);
          return next;
        });
      }
    } catch (err) {
      console.warn(`[useAutoPartsSync] Sync failed for ${designItemId}:`, err);
      if (isMounted.current) {
        setLastErrors(prev => {
          const next = new Map(prev);
          next.set(designItemId, (err as Error).message || 'Sync failed');
          return next;
        });
      }
    } finally {
      inflightRef.current.delete(designItemId);
      if (isMounted.current) {
        setSyncing(prev => {
          const next = new Set(prev);
          next.delete(designItemId);
          return next;
        });
      }
    }
  }, [sceneId, userId]);

  // -----------------------------------------------------------------------
  // Debounced schedule — keyed by DesignItem
  // -----------------------------------------------------------------------
  const scheduleSyncForItem = useCallback((designItemId: string) => {
    const existing = timersRef.current.get(designItemId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timersRef.current.delete(designItemId);
      runSync(designItemId);
    }, debounceMs);

    timersRef.current.set(designItemId, timer);
  }, [debounceMs, runSync]);

  // -----------------------------------------------------------------------
  // Watch assembly fingerprints — trigger debounced sync on change
  // -----------------------------------------------------------------------
  // Build a fingerprint per DesignItem: total parts count + updatedAt
  // millis across all cabinets bound to that item. Fast ≈ O(cabinets).
  const fingerprintRef = useRef<string>('');

  useEffect(() => {
    if (disabled || !sceneId || !userId) return;

    // Group unlocked, project-bound cabinets by designItemId.
    const byItem = new Map<string, SceneCabinet[]>();
    for (const cab of cabinets) {
      if (!cab.designItemId || cab.isLocked) continue;
      const bucket = byItem.get(cab.designItemId);
      if (bucket) bucket.push(cab);
      else byItem.set(cab.designItemId, [cab]);
    }

    // Fingerprint = sorted designItemId:totalParts:maxUpdatedAt
    const parts: string[] = [];
    for (const [itemId, cabs] of byItem) {
      let totalParts = 0;
      let maxUpdated = 0;
      for (const c of cabs) {
        for (const a of c.assemblies ?? []) {
          totalParts += (a.parts ?? []).length;
        }
        const ts = (c.updatedAt as unknown as { seconds?: number })?.seconds ?? 0;
        if (ts > maxUpdated) maxUpdated = ts;
      }
      parts.push(`${itemId}:${totalParts}:${maxUpdated}`);
    }
    parts.sort();
    const fp = parts.join('|');

    if (fp === fingerprintRef.current) return; // nothing changed
    const isFirst = fingerprintRef.current === '';
    fingerprintRef.current = fp;

    // Don't sync on first mount — only on subsequent assembly changes.
    if (isFirst) return;

    // Schedule sync for each affected DesignItem.
    for (const itemId of byItem.keys()) {
      scheduleSyncForItem(itemId);
    }
  }, [cabinets, sceneId, userId, disabled, scheduleSyncForItem]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  const forceSyncItem = useCallback((designItemId: string) => {
    // Cancel any pending debounce and run immediately.
    const existing = timersRef.current.get(designItemId);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(designItemId);
    }
    runSync(designItemId);
  }, [runSync]);

  return { syncing, lastResults, lastErrors, forceSyncItem };
}
