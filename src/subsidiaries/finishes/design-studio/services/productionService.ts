/**
 * Production Service — Firestore queries for Manufacturing Order context
 *
 * Fetches MO data, BOM entries with stock availability, and stage history
 * for display in the Workshop Viewer Production tab.
 */

import {
  doc, getDoc, collection, getDocs, onSnapshot,
  query, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  ProductionContext,
  ProductionBomEntry,
  ProductionStageTransition,
  ProductionDocument,
  StockBadge,
} from '../types/workshop-viewer.types';

/**
 * Compute stock badge from available vs required quantities.
 */
function computeStockBadge(available: number, required: number): StockBadge {
  if (available >= required) return 'available';
  if (available > 0) return 'partial';
  return 'out_of_stock';
}

/**
 * Fetch stock availability for a list of inventory item IDs.
 * Returns a map of inventoryItemId → total quantityAvailable across warehouses.
 */
async function fetchStockAvailability(
  inventoryItemIds: string[],
): Promise<Map<string, number>> {
  const availability = new Map<string, number>();
  if (inventoryItemIds.length === 0) return availability;

  // Firestore 'in' queries support max 30 items per query
  const chunks: string[][] = [];
  for (let i = 0; i < inventoryItemIds.length; i += 30) {
    chunks.push(inventoryItemIds.slice(i, i + 30));
  }

  for (const chunk of chunks) {
    try {
      const q = query(
        collection(db, 'stockLevels'),
        where('inventoryItemId', 'in', chunk),
      );
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const data = d.data();
        const itemId = data.inventoryItemId as string;
        const qty = (data.quantityAvailable as number) || 0;
        availability.set(itemId, (availability.get(itemId) || 0) + qty);
      }
    } catch (err) {
      console.warn('[productionService] Failed to fetch stock levels for chunk:', err);
    }
  }

  return availability;
}

/**
 * Fetch a Manufacturing Order with its BOM enriched with stock badges.
 */
export async function fetchMOWithBOM(moId: string): Promise<ProductionContext | null> {
  try {
    const moSnap = await getDoc(doc(db, 'manufacturingOrders', moId));
    if (!moSnap.exists()) return null;

    const mo = moSnap.data();

    // Extract BOM entries (stored as array on the MO document)
    const rawBom: Record<string, unknown>[] = mo.bom || mo.bomEntries || [];
    const inventoryItemIds = rawBom
      .map((b) => b.inventoryItemId as string)
      .filter(Boolean);

    // Fetch stock availability in parallel
    const stockMap = await fetchStockAvailability(inventoryItemIds);

    const bomEntries: ProductionBomEntry[] = rawBom.map((b, idx) => {
      const itemId = (b.inventoryItemId as string) || '';
      const qtyRequired = (b.quantityRequired as number) || 0;
      const qtyAvailable = stockMap.get(itemId) || 0;
      return {
        id: (b.id as string) || `bom-${idx}`,
        inventoryItemId: itemId,
        sku: (b.sku as string) || '',
        itemName: (b.itemName as string) || '',
        category: (b.category as string) || '',
        quantityRequired: qtyRequired,
        unit: (b.unit as string) || 'pcs',
        unitCost: (b.unitCost as number) || 0,
        totalCost: (b.totalCost as number) || 0,
        quantityAvailable: qtyAvailable,
        stockBadge: computeStockBadge(qtyAvailable, qtyRequired),
      };
    });

    // Extract stage history
    const stageHistory: ProductionStageTransition[] = (mo.stageHistory || []).map(
      (s: Record<string, unknown>) => ({
        from: (s.from as string) || '',
        to: (s.to as string) || '',
        at: s.at ? (s.at as { toDate?: () => Date }).toDate?.().toISOString?.() || String(s.at) : '',
        by: (s.by as string) || undefined,
        notes: (s.notes as string) || undefined,
      }),
    );

    // Extract linked documents (if any)
    const linkedDocuments: ProductionDocument[] = (mo.linkedDocuments || []).map(
      (d: Record<string, unknown>) => ({
        id: (d.id as string) || '',
        name: (d.name as string) || '',
        type: (d.type as string) || '',
        url: (d.url as string) || undefined,
      }),
    );

    return {
      moId,
      orderNumber: mo.moNumber || mo.orderNumber || '',
      status: mo.status || 'draft',
      currentStage: mo.currentStage || 'queued',
      priority: mo.priority || 'medium',
      itemName: mo.itemName || mo.name || '',
      quantity: mo.quantity || 1,
      bomEntries,
      stageHistory,
      linkedDocuments,
      targetCompletionDate: mo.targetCompletionDate
        ? (mo.targetCompletionDate as { toDate?: () => Date }).toDate?.().toISOString?.() || String(mo.targetCompletionDate)
        : undefined,
    };
  } catch (err) {
    console.error('[productionService] Failed to fetch MO with BOM:', err);
    return null;
  }
}

/**
 * Subscribe to real-time updates on a Manufacturing Order.
 * Returns an unsubscribe function.
 */
export function subscribeToMO(
  moId: string,
  callback: (context: ProductionContext | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'manufacturingOrders', moId),
    async (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      // Re-fetch full context with stock badges
      const context = await fetchMOWithBOM(moId);
      callback(context);
    },
    (err) => {
      console.error('[productionService] MO subscription error:', err);
      callback(null);
    },
  );
}
