/**
 * Material-Inventory Linking Service
 * Manages bidirectional links between Materials and InventoryItems
 */

import {
  doc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  collection,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Material, MaterialTier, MaterialWithInventory, SupplierPricingSummary } from '@/modules/design-manager/types/materials';
import type { InventoryItem } from '../types';

// Collection references
const inventoryRef = collection(db, 'inventoryItems');
const globalMaterialsRef = collection(db, 'materials');

function getCustomerMaterialsRef(customerId: string) {
  return collection(db, 'customers', customerId, 'materials');
}

function getProjectMaterialsRef(projectId: string) {
  return collection(db, 'designProjects', projectId, 'materials');
}

/**
 * Get the document reference for a material based on tier
 */
function getMaterialDocRef(tier: MaterialTier, scopeId: string | undefined, materialId: string) {
  switch (tier) {
    case 'global':
      return doc(globalMaterialsRef, materialId);
    case 'customer':
      if (!scopeId) throw new Error('customerId required for customer materials');
      return doc(getCustomerMaterialsRef(scopeId), materialId);
    case 'project':
      if (!scopeId) throw new Error('projectId required for project materials');
      return doc(getProjectMaterialsRef(scopeId), materialId);
    default:
      throw new Error('Invalid tier');
  }
}

/**
 * Link a material to an inventory item
 * Updates both sides of the relationship
 */
export async function linkMaterialToInventory(
  materialId: string,
  materialTier: MaterialTier,
  scopeId: string | undefined,
  inventoryItemId: string,
  inventoryItemSku: string,
  userId: string
): Promise<void> {
  const materialRef = getMaterialDocRef(materialTier, scopeId, materialId);
  const invRef = doc(inventoryRef, inventoryItemId);

  // Update material with inventory link
  await updateDoc(materialRef, {
    inventoryItemId,
    inventoryItemSku,
    linkedAt: serverTimestamp(),
    linkedBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Update inventory item with reverse link
  await updateDoc(invRef, {
    linkedMaterialIds: arrayUnion(materialId),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Unlink a material from an inventory item
 */
export async function unlinkMaterialFromInventory(
  materialId: string,
  materialTier: MaterialTier,
  scopeId: string | undefined,
  inventoryItemId: string,
  userId: string
): Promise<void> {
  const materialRef = getMaterialDocRef(materialTier, scopeId, materialId);
  const invRef = doc(inventoryRef, inventoryItemId);

  // Clear material link
  await updateDoc(materialRef, {
    inventoryItemId: null,
    inventoryItemSku: null,
    linkedAt: null,
    linkedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Remove from inventory's reverse link array
  await updateDoc(invRef, {
    linkedMaterialIds: arrayRemove(materialId),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Get inventory item by ID
 */
export async function getLinkedInventoryForMaterial(
  inventoryItemId: string
): Promise<InventoryItem | null> {
  const snap = await getDoc(doc(inventoryRef, inventoryItemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as InventoryItem;
}

/**
 * Convert supplier pricing array to summary format
 */
function mapSupplierPricing(inventory: InventoryItem): SupplierPricingSummary[] {
  if (!inventory.supplierPricing || inventory.supplierPricing.length === 0) {
    // If no multi-supplier pricing, use preferred supplier if available
    if (inventory.preferredSupplierId && inventory.preferredSupplierName) {
      return [{
        supplierId: inventory.preferredSupplierId,
        supplierName: inventory.preferredSupplierName,
        unitPrice: inventory.pricing?.costPerUnit || 0,
        currency: inventory.pricing?.currency || 'UGX',
        isPreferred: true,
      }];
    }
    return [];
  }

  return inventory.supplierPricing.map(sp => ({
    supplierId: sp.supplierId,
    supplierName: sp.supplierName,
    unitPrice: sp.unitPrice,
    currency: sp.currency,
    leadTimeDays: sp.leadTimeDays,
    isPreferred: sp.isPreferred,
  }));
}

/**
 * Resolve a single material with full inventory and supplier data
 */
export async function resolveMaterialWithInventory(
  material: Material
): Promise<MaterialWithInventory> {
  if (!material.inventoryItemId) {
    return material as MaterialWithInventory;
  }

  const inventory = await getLinkedInventoryForMaterial(material.inventoryItemId);
  if (!inventory) {
    return material as MaterialWithInventory;
  }

  const suppliers = mapSupplierPricing(inventory);

  return {
    ...material,
    inventory: {
      id: inventory.id,
      sku: inventory.sku,
      name: inventory.name,
      inStock: inventory.inventory?.inStock || 0,
      reorderLevel: inventory.inventory?.reorderLevel,
      costPerUnit: inventory.pricing?.costPerUnit || 0,
      currency: inventory.pricing?.currency || 'UGX',
      status: inventory.status,
      preferredSupplierId: inventory.preferredSupplierId,
      preferredSupplierName: inventory.preferredSupplierName,
    },
    suppliers,
  };
}

/**
 * Utility to chunk an array for batched operations
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch fetch inventory items by IDs
 * Firestore allows up to 30 items in 'in' query
 */
export async function batchResolveInventory(
  inventoryIds: string[]
): Promise<Map<string, InventoryItem>> {
  const unique = [...new Set(inventoryIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const results = new Map<string, InventoryItem>();

  // Firestore 'in' query allows up to 30 items
  const chunks = chunkArray(unique, 30);

  for (const chunk of chunks) {
    const q = query(inventoryRef, where('__name__', 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((docSnap) => {
      results.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as InventoryItem);
    });
  }

  return results;
}

/**
 * Resolve multiple materials with inventory data in batch
 * More efficient than resolving one at a time
 */
export async function batchResolveMaterialsWithInventory(
  materials: Material[]
): Promise<MaterialWithInventory[]> {
  // Collect all inventory IDs
  const inventoryIds = materials
    .filter((m) => m.inventoryItemId)
    .map((m) => m.inventoryItemId!);

  // Batch fetch all inventory items
  const inventoryMap = await batchResolveInventory(inventoryIds);

  // Map materials to enriched versions
  return materials.map((material) => {
    if (!material.inventoryItemId) {
      return material as MaterialWithInventory;
    }

    const inventory = inventoryMap.get(material.inventoryItemId);
    if (!inventory) {
      return material as MaterialWithInventory;
    }

    const suppliers = mapSupplierPricing(inventory);

    return {
      ...material,
      inventory: {
        id: inventory.id,
        sku: inventory.sku,
        name: inventory.name,
        inStock: inventory.inventory?.inStock || 0,
        reorderLevel: inventory.inventory?.reorderLevel,
        costPerUnit: inventory.pricing?.costPerUnit || 0,
        currency: inventory.pricing?.currency || 'UGX',
        status: inventory.status,
        preferredSupplierId: inventory.preferredSupplierId,
        preferredSupplierName: inventory.preferredSupplierName,
      },
      suppliers,
    };
  });
}

/**
 * Get all materials linked to a specific inventory item (lightweight summary)
 */
export async function getMaterialsLinkedToInventory(
  inventoryItemId: string
): Promise<{ materialId: string; tier: MaterialTier; name: string }[]> {
  const inventoryDoc = await getDoc(doc(inventoryRef, inventoryItemId));
  if (!inventoryDoc.exists()) return [];

  const data = inventoryDoc.data();
  const linkedMaterialIds = data.linkedMaterialIds || [];

  if (linkedMaterialIds.length === 0) return [];

  // Search for materials in global collection (most common case)
  // For a complete implementation, would need to search customer/project collections too
  const results: { materialId: string; tier: MaterialTier; name: string }[] = [];

  // Search global materials
  const globalChunks = chunkArray(linkedMaterialIds, 30);
  for (const chunk of globalChunks) {
    const q = query(globalMaterialsRef, where('__name__', 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((docSnap) => {
      results.push({
        materialId: docSnap.id,
        tier: 'global',
        name: docSnap.data().name || 'Unknown',
      });
    });
  }

  return results;
}

/**
 * Get full Material objects linked to an inventory item
 */
export async function getFullMaterialsLinkedToInventory(
  inventoryItemId: string
): Promise<Material[]> {
  const inventoryDoc = await getDoc(doc(inventoryRef, inventoryItemId));
  if (!inventoryDoc.exists()) return [];

  const data = inventoryDoc.data();
  const linkedMaterialIds: string[] = data.linkedMaterialIds || [];

  if (linkedMaterialIds.length === 0) return [];

  const results: Material[] = [];

  const globalChunks = chunkArray(linkedMaterialIds, 30);
  for (const chunk of globalChunks) {
    const q = query(globalMaterialsRef, where('__name__', 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...docSnap.data() } as Material);
    });
  }

  return results;
}

/**
 * Search materials for linking to an inventory item
 * Returns materials that match the search term by name or code
 */
export async function searchMaterialsForLinking(
  searchTerm: string,
  excludeIds: string[] = [],
  limit: number = 20
): Promise<Material[]> {
  const snap = await getDocs(globalMaterialsRef);

  const term = searchTerm.toLowerCase().trim();
  const excludeSet = new Set(excludeIds);

  return snap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Material))
    .filter((mat) => {
      if (excludeSet.has(mat.id)) return false;
      if (mat.status !== 'active') return false;
      const searchable = [mat.name, mat.code, mat.description || ''].join(' ').toLowerCase();
      return searchable.includes(term);
    })
    .slice(0, limit);
}

/**
 * Search inventory items for linking
 * Returns items that match the search term by name or SKU
 */
export async function searchInventoryForLinking(
  searchTerm: string,
  limit: number = 20
): Promise<{ id: string; sku: string; name: string; inStock: number; costPerUnit: number; currency: string }[]> {
  // Firestore doesn't support full-text search, so we fetch all and filter client-side
  // For production, consider Algolia or Typesense
  const snap = await getDocs(inventoryRef);

  const term = searchTerm.toLowerCase().trim();
  const results = snap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        sku: data.sku || '',
        name: data.name || '',
        displayName: data.displayName || '',
        inStock: data.inventory?.inStock || 0,
        costPerUnit: data.pricing?.costPerUnit || 0,
        currency: data.pricing?.currency || 'UGX',
        status: data.status,
      };
    })
    .filter((item) => {
      if (item.status !== 'active') return false;
      const searchable = [item.sku, item.name, item.displayName].join(' ').toLowerCase();
      return searchable.includes(term);
    })
    .slice(0, limit);

  return results;
}
