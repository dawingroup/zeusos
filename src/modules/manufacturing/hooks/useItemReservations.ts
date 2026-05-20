/**
 * Hook to look up which Manufacturing Orders hold active reservations
 * for a set of inventory item IDs.
 *
 * Queries the `manufacturingOrders` collection for MOs with status
 * 'approved' or 'in-progress' (the only statuses that hold reservations).
 * Parses each MO's `materialReservations` array to build a map:
 *   inventoryItemId → [{ moId, moNumber, quantityReserved }]
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ManufacturingOrder } from '../types';

export interface ReservationHolder {
  moId: string;
  moNumber: string;
  quantityReserved: number;
}

export interface ItemReservationMap {
  /** inventoryItemId → list of MOs holding active reservations */
  [inventoryItemId: string]: ReservationHolder[];
}

/** Default cap on active-MO scan. The hook only needs to find MOs that
 *  reserve the requested item IDs; for any realistic subsidiary the
 *  number of concurrently active MOs sits well under this. */
const DEFAULT_ACTIVE_MO_SCAN_LIMIT = 200;

/**
 * Subscribe to all MOs that currently hold active material reservations.
 * Returns a map from inventoryItemId to the MOs reserving that item.
 *
 * @param inventoryItemIds - The item IDs to check reservations for.
 *   If empty/null, returns empty map.
 * @param currentMoId - The current MO being viewed (so UI can differentiate
 *   "reserved by this MO" from "reserved by another MO").
 * @param subsidiaryId - Optional subsidiary scope. When provided, the
 *   underlying query is restricted to MOs in this subsidiary — strongly
 *   recommended on multi-subsidiary deployments to avoid a full scan.
 */
export function useItemReservations(
  inventoryItemIds: string[],
  _currentMoId?: string,
  subsidiaryId?: string,
): { reservationMap: ItemReservationMap; loading: boolean } {
  const [reservationMap, setReservationMap] = useState<ItemReservationMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inventoryItemIds || inventoryItemIds.length === 0) {
      setReservationMap({});
      setLoading(false);
      return;
    }

    // Query MOs that are in statuses where reservations are active. Scope
    // to the current subsidiary when available and apply a safety cap so a
    // very active backlog doesn't stream thousands of MOs into the client.
    const constraints: QueryConstraint[] = [];
    if (subsidiaryId) {
      constraints.push(where('subsidiaryId', '==', subsidiaryId));
    }
    constraints.push(where('status', 'in', ['approved', 'in-progress']));
    constraints.push(limit(DEFAULT_ACTIVE_MO_SCAN_LIMIT));

    const q = query(collection(db, 'manufacturingOrders'), ...constraints);

    const unsub = onSnapshot(q, (snapshot) => {
      const map: ItemReservationMap = {};

      // Initialize all requested IDs with empty arrays
      for (const itemId of inventoryItemIds) {
        map[itemId] = [];
      }

      for (const docSnap of snapshot.docs) {
        const mo = { id: docSnap.id, ...docSnap.data() } as ManufacturingOrder;
        if (!mo.materialReservations || mo.materialReservations.length === 0) continue;

        for (const res of mo.materialReservations) {
          if (res.status !== 'active') continue;
          if (!inventoryItemIds.includes(res.inventoryItemId)) continue;

          if (!map[res.inventoryItemId]) {
            map[res.inventoryItemId] = [];
          }

          map[res.inventoryItemId].push({
            moId: mo.id,
            moNumber: mo.moNumber,
            quantityReserved: res.quantityReserved,
          });
        }
      }

      if (snapshot.size >= DEFAULT_ACTIVE_MO_SCAN_LIMIT) {
        console.warn(
          `[manufacturing] useItemReservations hit the ${DEFAULT_ACTIVE_MO_SCAN_LIMIT}-MO scan cap. ` +
          `Some reservations may be missing from the result.`,
        );
      }

      setReservationMap(map);
      setLoading(false);
    });

    return () => unsub();
  }, [inventoryItemIds.join(','), subsidiaryId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { reservationMap, loading };
}
