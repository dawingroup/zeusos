/**
 * usePartInventoryResolver — scoped Materials-library resolver for
 * the Part Detail panel's hardware drill-through rows.
 *
 * Fetches only the inventoryItemIds referenced by the selected part's
 * boringSpec targets — so opening the drawer on a part with 2 dowel
 * holes fires 2 Firestore reads, not a library scan. Memoised by the
 * set of ids so switching between parts that share the same hardware
 * doesn't re-fetch.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ScenePart } from '../types/assembly.types';
import {
  createInventoryResolver,
  type InventoryResolver,
} from '../services/scheduleLibraryResolvers';
import { findPartConnections } from '../services/partConnections';

export function usePartInventoryResolver(
  part: ScenePart | null | undefined,
): InventoryResolver | undefined {
  // Collect the inventory ids the selected part's boring spec needs.
  // We call findPartConnections with no cabinet data (assemblies: [])
  // — it still extracts the hardware targets from the selected part
  // itself, which is all we need.
  const ids = useMemo(() => {
    if (!part) return [] as string[];
    const result = findPartConnections(part, { assemblies: [] });
    return Array.from(new Set(
      result.hardwareTargets
        .map(t => t.inventoryItemId)
        .filter((id): id is string => !!id),
    )).sort();
  }, [part]);

  const key = ids.join('|');
  const [resolver, setResolver] = useState<InventoryResolver | undefined>(undefined);

  useEffect(() => {
    if (ids.length === 0) {
      setResolver(() => () => undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await createInventoryResolver(ids);
        if (!cancelled) setResolver(() => r);
      } catch {
        if (!cancelled) setResolver(() => () => undefined);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key derives from ids
  }, [key]);

  return resolver;
}
