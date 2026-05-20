/**
 * Consumable Service
 * Handles CRUD, stock operations, and AI integration for asset consumables.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp as FirestoreTimestamp,
  increment,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Asset, AssetCategory } from '@/shared/types';
import type {
  AssetConsumable,
  ConsumableFilters,
  ConsumableUsageRecord,
} from '../types/consumable';
import type { AIConsumableSuggestion } from '../types/assetIntelligence';

// ============================================================================
// Collection Reference
// ============================================================================

const COLLECTION = 'assetConsumables';

/** Remove keys whose value is undefined (Firestore rejects undefined) */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// ============================================================================
// Consumable Service Class
// ============================================================================

export class ConsumableService {
  // ------------------------------------------
  // CRUD
  // ------------------------------------------

  /** Get all consumables, optionally filtered */
  async getConsumables(filters?: ConsumableFilters): Promise<AssetConsumable[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.category) {
      constraints.push(where('compatibleCategories', 'array-contains', filters.category));
    }
    if (filters?.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters?.criticalOnly) {
      constraints.push(where('isCritical', '==', true));
    }

    constraints.push(orderBy('name', 'asc'));

    const q = query(collection(db, COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssetConsumable));

    // Client-side filters that Firestore can't handle in a single query
    if (filters?.lowStockOnly) {
      results = results.filter(c => c.quantityOnHand <= c.reorderLevel);
    }
    if (filters?.searchQuery) {
      const search = filters.searchQuery.toLowerCase();
      results = results.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.partNumber?.toLowerCase().includes(search) ||
        c.description?.toLowerCase().includes(search)
      );
    }

    return results;
  }

  /** Get consumables compatible with a specific asset */
  async getConsumablesForAsset(asset: Asset): Promise<AssetConsumable[]> {
    // Get by category match
    const categoryConsumables = await this.getConsumables({ category: asset.category });

    // Also get any specifically linked to this asset ID
    const specificQuery = query(
      collection(db, COLLECTION),
      where('compatibleAssetIds', 'array-contains', asset.id)
    );
    const specificSnapshot = await getDocs(specificQuery);
    const specificConsumables = specificSnapshot.docs.map(d =>
      ({ id: d.id, ...d.data() } as AssetConsumable)
    );

    // Merge and deduplicate
    const allIds = new Set(categoryConsumables.map(c => c.id));
    const merged = [...categoryConsumables];
    for (const c of specificConsumables) {
      if (!allIds.has(c.id)) {
        merged.push(c);
      }
    }

    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Get a single consumable by ID */
  async getConsumable(id: string): Promise<AssetConsumable | null> {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as AssetConsumable;
  }

  /** Create a new consumable */
  async createConsumable(
    data: Omit<AssetConsumable, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    userId: string
  ): Promise<string> {
    const now = FirestoreTimestamp.now();
    const docData = stripUndefined({
      ...data,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const docRef = await addDoc(collection(db, COLLECTION), docData);
    return docRef.id;
  }

  /** Update an existing consumable */
  async updateConsumable(
    id: string,
    updates: Partial<Omit<AssetConsumable, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, stripUndefined({
      ...updates,
      updatedAt: FirestoreTimestamp.now(),
    }));
  }

  /** Delete a consumable */
  async deleteConsumable(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  }

  // ------------------------------------------
  // Stock Operations
  // ------------------------------------------

  /** Record usage of a consumable (decrements stock) */
  async recordUsage(consumableId: string, quantity: number): Promise<void> {
    const docRef = doc(db, COLLECTION, consumableId);
    await updateDoc(docRef, {
      quantityOnHand: increment(-quantity),
      updatedAt: FirestoreTimestamp.now(),
    });
  }

  /** Restock a consumable (increments stock) */
  async restockConsumable(
    consumableId: string,
    quantity: number,
    unitCost?: number
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      quantityOnHand: increment(quantity),
      updatedAt: FirestoreTimestamp.now(),
    };
    if (unitCost !== undefined) {
      updates.unitCost = unitCost;
    }
    const docRef = doc(db, COLLECTION, consumableId);
    await updateDoc(docRef, updates);
  }

  /** Get consumables at or below reorder level */
  async getLowStockAlerts(): Promise<AssetConsumable[]> {
    const all = await this.getConsumables();
    return all.filter(c => c.quantityOnHand <= c.reorderLevel);
  }

  // ------------------------------------------
  // AI Integration
  // ------------------------------------------

  /** Bulk-create consumables from AI suggestions */
  async createFromAISuggestions(
    suggestions: AIConsumableSuggestion[],
    assetCategory: AssetCategory,
    userId: string
  ): Promise<string[]> {
    const ids: string[] = [];

    for (const suggestion of suggestions) {
      const id = await this.createConsumable({
        name: suggestion.name,
        type: suggestion.type || 'accessory',
        partNumber: suggestion.partNumber,
        description: suggestion.fitmentNotes,
        compatibleCategories: [assetCategory],
        fitmentNotes: suggestion.fitmentNotes,
        expectedLifeHours: suggestion.expectedLifeHours,
        replacementTrigger: suggestion.replacementTrigger,
        isCritical: suggestion.isCritical ?? false,
        quantityOnHand: 0,
        reorderLevel: 1,
        reorderQuantity: 2,
        unitOfMeasure: 'pcs',
        unitCost: suggestion.estimatedCost?.amount,
        currency: suggestion.estimatedCost?.currency || 'UGX',
        aiSuggested: true,
      }, userId);
      ids.push(id);
    }

    return ids;
  }

  /** Build ConsumableUsageRecord array from selected consumables */
  buildUsageRecords(
    consumables: AssetConsumable[],
    quantities: Record<string, number>
  ): ConsumableUsageRecord[] {
    return consumables
      .filter(c => (quantities[c.id] || 0) > 0)
      .map(c => ({
        consumableId: c.id,
        consumableName: c.name,
        quantity: quantities[c.id],
        unitCost: c.unitCost,
      }));
  }
}

// Singleton instance
export const consumableService = new ConsumableService();
