/**
 * useMaterialValidation — P13b/F15.
 *
 * Binds `useMaterialResolver`'s mappings to the inventory-aware
 * validator. The hook:
 *
 *   1. Subscribes to the finish library (via `useFinishLibrary`) so
 *      the validator has the `inventoryItemId` + `availability` fields
 *      for every mapped finish.
 *   2. Resolves aggregate stock for each *unique* linked
 *      `inventoryItemId` on demand. Unlike finishes, stock aggregates
 *      are fetched one-shot rather than streamed — the print gate
 *      just needs "zero or not" at click time, not a live feed.
 *   3. Feeds both lookups into `validateMaterialMappings` and returns
 *      the resulting exceptions + a stable `ready` flag for the UI.
 *
 * Contract:
 *   - `loading: true` while finishes or stock are still resolving.
 *     The UI MUST gate on `!loading && ready` before allowing export.
 *   - `exceptions` populates as soon as the non-stock checks can be
 *     evaluated (empty finish library still emits no_finish_match).
 *     Once stock resolves, zero_stock exceptions appear too.
 *   - `ready` = no exceptions AND not loading. The caller should
 *     disable the generate button on `!ready`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFinishLibrary } from '@/modules/inventory/hooks/useFinishLibrary';
import { getAggregatedStock } from '@/modules/inventory/services/stockLevelService';
import {
  validateMaterialMappings,
  type MaterialException,
  type StockAggregate,
} from '../services/materialValidationService';
import type { MaterialMapping } from '../services/materialResolverService';

interface UseMaterialValidationResult {
  exceptions: MaterialException[];
  loading: boolean;
  ready: boolean;
}

export function useMaterialValidation(
  mappings: MaterialMapping[],
): UseMaterialValidationResult {
  const { finishes, loading: finishesLoading } = useFinishLibrary({ isActive: true });

  const [stockByInventoryItemId, setStockByInventoryItemId] = useState<
    Map<string, StockAggregate>
  >(() => new Map());
  const [stockLoading, setStockLoading] = useState(false);

  // Index finishes by id for O(1) lookup. Map preserves insertion order
  // and is cheaper than `Object.fromEntries` when finishes is long.
  const finishById = useMemo(() => {
    const m = new Map<string, typeof finishes[number]>();
    for (const f of finishes) m.set(f.id, f);
    return m;
  }, [finishes]);

  // Collect the unique inventoryItemIds we actually need to look up.
  // Only finishes whose mappings survived past the `no_finish_match` /
  // `missing_inventory_link` checks — i.e. mapped AND linked — need a
  // stock query. Un-mapped or un-linked finishes are already blocked
  // by cheaper exceptions, so we don't burn Firestore reads on them.
  const requiredInventoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const mapping of mappings) {
      if (!mapping.finishLibraryId || mapping.confidence === 0) continue;
      const finish = finishById.get(mapping.finishLibraryId);
      if (!finish?.inventoryItemId) continue;
      // Discontinued finishes get flagged without needing stock.
      if (finish.availability === 'discontinued') continue;
      // Made-to-order explicitly opts out of stock gating.
      if (finish.availability === 'made_to_order') continue;
      ids.add(finish.inventoryItemId);
    }
    return ids;
  }, [mappings, finishById]);

  // `requestRef` gates race conditions: if the user loads a new model
  // while a previous fetch is in flight, we ignore the stale result.
  const requestRef = useRef(0);

  useEffect(() => {
    // Nothing to fetch — clear any stale aggregates and bail.
    if (requiredInventoryIds.size === 0) {
      setStockByInventoryItemId(new Map());
      setStockLoading(false);
      return;
    }

    const myRequest = ++requestRef.current;
    setStockLoading(true);

    const ids = Array.from(requiredInventoryIds);
    Promise.all(
      ids.map(async (id) => [id, await getAggregatedStock(id)] as const),
    )
      .then((entries) => {
        if (requestRef.current !== myRequest) return; // stale
        setStockByInventoryItemId(new Map(entries));
        setStockLoading(false);
      })
      .catch((err) => {
        if (requestRef.current !== myRequest) return;
        // Fail-soft: clear aggregates so the validator skips zero_stock
        // checks; the UI still gets a meaningful ready=false via loading.
        // eslint-disable-next-line no-console
        console.error('[useMaterialValidation] stock fetch failed', err);
        setStockByInventoryItemId(new Map());
        setStockLoading(false);
      });
  }, [requiredInventoryIds]);

  const exceptions = useMemo(() => {
    // If finishes haven't loaded yet, we'd emit spurious no_finish_match
    // for every mapping. Hold back until the finish library is present.
    if (finishesLoading) return [];
    return validateMaterialMappings({
      mappings,
      finishById,
      stockByInventoryItemId,
    });
  }, [mappings, finishById, stockByInventoryItemId, finishesLoading]);

  const loading = finishesLoading || stockLoading;
  const ready = !loading && exceptions.length === 0;

  return { exceptions, loading, ready };
}
