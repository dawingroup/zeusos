/**
 * Hook for real-time stock level subscriptions for BOM items
 *
 * Uses TWO data sources for maximum accuracy:
 * 1. `stockLevels` collection — per-warehouse stock (created by receiveStock/adjustStock)
 * 2. `inventoryItems` collection — aggregate inventory.inStock field (fallback)
 *
 * Also auto-resolves BOM entries that have no inventoryItemId by matching
 * their itemName or SKU against the inventoryItems collection.
 *
 * Both sources are real-time (onSnapshot), so updates from stock intake,
 * adjustments, transfers, or PO receipts are reflected immediately.
 */

import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  documentId,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { BOMEntry } from '../types';

export interface BOMItemStock {
  inventoryItemId: string;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  /** Available offcut pieces for this material (by name match) */
  offcutCount: number;
  source: 'stockLevels' | 'inventoryItem';
}

export interface BOMStockMap {
  /** Keyed by inventoryItemId OR by bomEntryId (for name-resolved items) */
  [key: string]: BOMItemStock;
}

/** Map from BOM entry id → resolved inventoryItemId (for entries that had no link) */
export interface ResolvedBOMMap {
  [bomEntryId: string]: string;
}

export function useBOMStockLevels(bom: BOMEntry[] | null): {
  stockMap: BOMStockMap;
  resolvedIds: ResolvedBOMMap;
  loading: boolean;
} {
  const [stockMap, setStockMap] = useState<BOMStockMap>({});
  const [resolvedIds, setResolvedIds] = useState<ResolvedBOMMap>({});
  const [loading, setLoading] = useState(true);
  const unsubscribesRef = useRef<(() => void)[]>([]);
  // Prevent duplicate batch-reported counting on re-fires
  const iiBatchReportedRef = useRef(new Set<number>());

  useEffect(() => {
    // Cleanup previous subscriptions
    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];
    iiBatchReportedRef.current = new Set();

    if (!bom || bom.length === 0) {
      setStockMap({});
      setResolvedIds({});
      setLoading(false);
      return;
    }

    // Split BOM into linked (has inventoryItemId or offcutId) and unlinked (name only)
    const linkedEntries = bom.filter(
      (e) => e.offcutId || (e.inventoryItemId && !e.inventoryItemId.includes(':')),
    );
    const unlinkedEntries = bom.filter(
      (e) => !e.offcutId && (!e.inventoryItemId || e.inventoryItemId.includes(':')),
    );

    // Offcut-backed entries are linked but don't need inventory stock lookups
    const uniqueIds = [...new Set(
      linkedEntries
        .filter((e) => !e.offcutId && e.inventoryItemId && !e.inventoryItemId.includes(':'))
        .map((e) => e.inventoryItemId)
    )];

    // We'll resolve unlinked entries by name, then subscribe to those too
    let allItemIds = [...uniqueIds]; // Will grow after name resolution

    const localMap: BOMStockMap = {};
    const localResolved: ResolvedBOMMap = {};
    const stockLevelData: Record<string, { onHand: number; reserved: number; available: number }> = {};
    const inventoryItemData: Record<string, number> = {};
    // Offcut counts keyed by inventoryItemId (resolved via itemName)
    const offcutData: Record<string, number> = {};
    let stockLevelsReported = false;
    let inventoryItemsReported = false;

    const mergeAndEmit = () => {
      for (const id of allItemIds) {
        const sl = stockLevelData[id];
        const itemInStock = inventoryItemData[id];
        const offcuts = offcutData[id] ?? 0;

        if (sl && (sl.onHand > 0 || sl.reserved > 0 || sl.available > 0)) {
          localMap[id] = {
            inventoryItemId: id,
            totalOnHand: sl.onHand,
            totalReserved: sl.reserved,
            totalAvailable: sl.available + offcuts,
            offcutCount: offcuts,
            source: 'stockLevels',
          };
        } else if (itemInStock !== undefined && itemInStock > 0) {
          localMap[id] = {
            inventoryItemId: id,
            totalOnHand: itemInStock,
            totalReserved: 0,
            totalAvailable: itemInStock + offcuts,
            offcutCount: offcuts,
            source: 'inventoryItem',
          };
        } else {
          localMap[id] = {
            inventoryItemId: id,
            totalOnHand: (sl?.onHand ?? 0),
            totalReserved: sl?.reserved ?? 0,
            totalAvailable: (sl?.available ?? 0) + offcuts,
            offcutCount: offcuts,
            source: 'stockLevels',
          };
        }
      }

      setStockMap({ ...localMap });
      setResolvedIds({ ...localResolved });

      if (stockLevelsReported && inventoryItemsReported) {
        setLoading(false);
      }
    };

    const subscribeToStockLevels = (ids: string[]) => {
      if (ids.length === 0) {
        stockLevelsReported = true;
        return;
      }

      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) {
        batches.push(ids.slice(i, i + 30));
      }

      let batchesReported = 0;
      for (const batch of batches) {
        const q = query(
          collection(db, 'stockLevels'),
          where('inventoryItemId', 'in', batch),
        );

        const unsub = onSnapshot(q, (snapshot) => {
          for (const id of batch) {
            stockLevelData[id] = { onHand: 0, reserved: 0, available: 0 };
          }
          for (const d of snapshot.docs) {
            const data = d.data();
            const itemId = data.inventoryItemId as string;
            if (!stockLevelData[itemId]) {
              stockLevelData[itemId] = { onHand: 0, reserved: 0, available: 0 };
            }
            stockLevelData[itemId].onHand += (data.quantityOnHand as number) ?? 0;
            stockLevelData[itemId].reserved += (data.quantityReserved as number) ?? 0;
            stockLevelData[itemId].available += (data.quantityAvailable as number) ?? 0;
          }

          batchesReported++;
          if (batchesReported >= batches.length) {
            stockLevelsReported = true;
          }
          mergeAndEmit();
        });

        unsubscribesRef.current.push(unsub);
      }
    };

    const subscribeToInventoryItems = (ids: string[]) => {
      if (ids.length === 0) {
        inventoryItemsReported = true;
        return;
      }

      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) {
        batches.push(ids.slice(i, i + 30));
      }

      // One batched `in` query listener per chunk of 30 — replaces the prior
      // pattern of one doc-listener per inventoryItemId (which meant a 60-line
      // BOM kept 60 concurrent listeners open per MO view).
      let batchesFullyReported = 0;
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        const q = query(
          collection(db, 'inventoryItems'),
          where(documentId(), 'in', batch),
        );

        const capturedIdx = batchIdx;
        const unsub = onSnapshot(q, (snapshot) => {
          // Default to 0 for every id in this batch so missing docs don't
          // leak stale data from a prior subscription.
          for (const id of batch) {
            inventoryItemData[id] = 0;
          }
          for (const d of snapshot.docs) {
            const data = d.data();
            const inv = data.inventory as Record<string, unknown> | undefined;
            inventoryItemData[d.id] = (inv?.inStock as number) ?? 0;
          }

          if (!iiBatchReportedRef.current.has(capturedIdx)) {
            iiBatchReportedRef.current.add(capturedIdx);
            batchesFullyReported++;
            if (batchesFullyReported >= batches.length) {
              inventoryItemsReported = true;
            }
          }
          mergeAndEmit();
        });

        unsubscribesRef.current.push(unsub);
      }
    };

    // ── Phase 1: Resolve unlinked BOM entries by name/SKU ──
    const resolveUnlinkedEntries = async () => {
      if (unlinkedEntries.length === 0) return;

      // Collect unique item names to search for
      const namesToResolve = [
        ...new Set(unlinkedEntries.map((e) => e.itemName).filter(Boolean)),
      ];
      const skusToResolve = [
        ...new Set(unlinkedEntries.map((e) => e.sku).filter(Boolean)),
      ];

      const resolvedMap = new Map<string, string>(); // itemName → inventoryItemId

      // Search by name (batched, max 30 per `in` query)
      for (let i = 0; i < namesToResolve.length; i += 30) {
        const batch = namesToResolve.slice(i, i + 30);
        try {
          const q = query(
            collection(db, 'inventoryItems'),
            where('name', 'in', batch),
          );
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            const data = d.data();
            resolvedMap.set(data.name as string, d.id);
          }
        } catch {
          // Ignore query errors, we'll also try displayName and SKU
        }
      }

      // Search by displayName for names not yet resolved
      const unresolvedNames = namesToResolve.filter((n) => !resolvedMap.has(n));
      for (let i = 0; i < unresolvedNames.length; i += 30) {
        const batch = unresolvedNames.slice(i, i + 30);
        try {
          const q = query(
            collection(db, 'inventoryItems'),
            where('displayName', 'in', batch),
          );
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            const data = d.data();
            const displayName = data.displayName as string;
            if (displayName && !resolvedMap.has(displayName)) {
              resolvedMap.set(displayName, d.id);
            }
          }
        } catch {
          // Ignore
        }
      }

      // Search by SKU for entries that still aren't resolved
      const skuMap = new Map<string, string>(); // sku → inventoryItemId
      for (let i = 0; i < skusToResolve.length; i += 30) {
        const batch = skusToResolve.slice(i, i + 30);
        try {
          const q = query(
            collection(db, 'inventoryItems'),
            where('sku', 'in', batch),
          );
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            const data = d.data();
            skuMap.set(data.sku as string, d.id);
          }
        } catch {
          // Ignore
        }
      }

      // Map BOM entries to resolved IDs
      const newIds: string[] = [];
      for (const entry of unlinkedEntries) {
        const resolvedId =
          resolvedMap.get(entry.itemName) ?? skuMap.get(entry.sku);
        if (resolvedId) {
          localResolved[entry.id] = resolvedId;
          if (!allItemIds.includes(resolvedId)) {
            allItemIds.push(resolvedId);
            newIds.push(resolvedId);
          }
        }
      }

      return newIds;
    };

    // ── Offcut subscriptions: subscribe by material name for each BOM entry ──
    const subscribeToOffcuts = () => {
      // Build map: inventoryItemId → materialName from BOM entries
      const idToName: Record<string, string> = {};
      for (const entry of bom) {
        if (entry.offcutId) continue; // Skip already-offcut-backed entries
        const eid = entry.inventoryItemId || localResolved[entry.id];
        if (eid && !eid.includes(':') && entry.itemName) {
          idToName[eid] = entry.itemName;
        }
      }

      // Subscribe to available offcuts for each unique material name
      const subscribedNames = new Set<string>();
      for (const [, materialName] of Object.entries(idToName)) {
        if (subscribedNames.has(materialName)) continue;
        subscribedNames.add(materialName);

        const q = query(
          collection(db, 'offcuts'),
          where('status', '==', 'available'),
          where('materialName', '==', materialName),
        );

        const unsub = onSnapshot(q, (snap) => {
          // Map offcut count to all item IDs with this material name
          const count = snap.size;
          for (const [id, name] of Object.entries(idToName)) {
            if (name === materialName) {
              offcutData[id] = count;
            }
          }
          mergeAndEmit();
        });

        unsubscribesRef.current.push(unsub);
      }
    };

    // ── Execute: resolve first, then subscribe ──
    const init = async () => {
      await resolveUnlinkedEntries();

      // Subscribe to all item IDs (original linked + newly resolved)
      subscribeToStockLevels(allItemIds);
      subscribeToInventoryItems(allItemIds);
      subscribeToOffcuts();

      // If no IDs at all, mark as done
      if (allItemIds.length === 0) {
        stockLevelsReported = true;
        inventoryItemsReported = true;
        setLoading(false);
      }
    };

    init();

    return () => {
      unsubscribesRef.current.forEach((unsub) => unsub());
      unsubscribesRef.current = [];
    };
  }, [bom]);

  return { stockMap, resolvedIds, loading };
}
