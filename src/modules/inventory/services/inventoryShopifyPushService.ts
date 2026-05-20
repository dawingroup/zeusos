/**
 * Inventory Shopify Push Service
 *
 * Pushes DawinOS inventory stock levels to Shopify.
 * One-way sync: DawinOS → Shopify only.
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/services/firebase';
import type { InventoryItem } from '../types/inventory';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';
const INVENTORY_COLLECTION = 'inventoryItems';
const STOCK_LEVELS_COLLECTION = 'stockLevels';

/**
 * Get Firebase ID token for authenticated API calls
 */
async function getAuthToken(): Promise<string | null> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * Make authenticated API request
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Shopify location info
 */
export interface ShopifyLocation {
  id: string;
  name: string;
  address1?: string;
  city?: string;
  country?: string;
  active: boolean;
}

/**
 * Result of an inventory push operation
 */
export interface InventoryPushResult {
  success: boolean;
  inventoryItemId: string;
  availableQuantity?: number;
  error?: string;
}

/**
 * Get aggregated stock for an inventory item across all warehouses
 */
async function getAggregatedAvailable(inventoryItemId: string): Promise<number> {
  const stockQuery = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('inventoryItemId', '==', inventoryItemId)
  );
  const snapshot = await getDocs(stockQuery);

  let totalAvailable = 0;
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const onHand = data.quantityOnHand || 0;
    const reserved = data.quantityReserved || 0;
    totalAvailable += Math.max(0, onHand - reserved);
  });

  return totalAvailable;
}

/**
 * Push stock level for a single inventory item to Shopify
 */
export async function pushStockToShopify(
  inventoryItemId: string
): Promise<InventoryPushResult> {
  const itemRef = doc(db, INVENTORY_COLLECTION, inventoryItemId);
  const itemDoc = await getDoc(itemRef);

  if (!itemDoc.exists()) {
    return { success: false, inventoryItemId, error: 'Inventory item not found' };
  }

  const item = itemDoc.data() as InventoryItem;

  // Skip family/parent records — only SKU-level items sync to external systems
  if (item.isFamily) {
    return {
      success: false,
      inventoryItemId,
      error: 'Family records are not synced to Shopify. Only SKU-level items are pushed.',
    };
  }

  if (!(item as any).shopifyInventoryItemId) {
    return {
      success: false,
      inventoryItemId,
      error: 'Item not linked to Shopify inventory. Sync the product first.',
    };
  }

  if (!(item as any).shopifyLocationId) {
    return {
      success: false,
      inventoryItemId,
      error: 'No Shopify location mapped. Set a location first.',
    };
  }

  // Get aggregated available stock
  const availableQuantity = await getAggregatedAvailable(inventoryItemId);

  try {
    const response = await authenticatedFetch(`${API_BASE}/shopify/update-inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopifyInventoryItemId: (item as any).shopifyInventoryItemId,
        shopifyLocationId: (item as any).shopifyLocationId,
        availableQuantity,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, inventoryItemId, error: data.error || 'Push failed' };
    }

    // Update last push timestamp
    await updateDoc(itemRef, {
      shopifyLastSyncAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true, inventoryItemId, availableQuantity };
  } catch (error) {
    return {
      success: false,
      inventoryItemId,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Push stock levels for multiple inventory items to Shopify
 */
export async function bulkPushStock(
  inventoryItemIds: string[]
): Promise<InventoryPushResult[]> {
  const results: InventoryPushResult[] = [];

  for (const id of inventoryItemIds) {
    const result = await pushStockToShopify(id);
    results.push(result);
  }

  return results;
}

/**
 * Fetch available Shopify locations
 */
export async function getShopifyLocations(): Promise<ShopifyLocation[]> {
  const response = await authenticatedFetch(`${API_BASE}/shopify/locations`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch Shopify locations');
  }

  return data.locations || [];
}

/**
 * Map a Shopify location to an inventory item for stock push
 */
export async function setShopifyLocationMapping(
  inventoryItemId: string,
  shopifyLocationId: string
): Promise<void> {
  const itemRef = doc(db, INVENTORY_COLLECTION, inventoryItemId);
  await updateDoc(itemRef, {
    shopifyLocationId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Enable or disable automatic inventory push for an item
 */
export async function setInventoryPushEnabled(
  inventoryItemId: string,
  enabled: boolean
): Promise<void> {
  const itemRef = doc(db, INVENTORY_COLLECTION, inventoryItemId);
  await updateDoc(itemRef, {
    shopifyInventoryPushEnabled: enabled,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all inventory items with Shopify push enabled
 */
export async function getPushEnabledItems(): Promise<InventoryItem[]> {
  const q = query(
    collection(db, INVENTORY_COLLECTION),
    where('shopifyInventoryPushEnabled', '==', true)
  );
  const snapshot = await getDocs(q);
  // Filter out family records — only SKU-level items are synced
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
    .filter((item) => !item.isFamily);
}

/**
 * Push all enabled items to Shopify
 */
export async function pushAllEnabledStock(): Promise<InventoryPushResult[]> {
  const items = await getPushEnabledItems();
  return bulkPushStock(items.map((item) => item.id));
}
