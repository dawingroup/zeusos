/**
 * Shopify Service
 * Client-side service for Shopify integration
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/services/firebase';
import type {
  ShopifyConfig,
  ShopifyProduct,
  ProductSyncMapping,
  ShopifyProductInput,
} from '../types/shopify';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';
const CONFIG_DOC = 'shopifyConfig';

/**
 * Get Firebase ID token for authenticated API calls
 */
async function getAuthToken(): Promise<string | null> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
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
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Get Shopify configuration
 */
export async function getShopifyConfig(): Promise<ShopifyConfig | null> {
  const docRef = doc(db, 'systemConfig', CONFIG_DOC);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ShopifyConfig;
}

/**
 * Connect to Shopify store
 */
export async function connectShopify(shopDomain: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await authenticatedFetch(`${API_BASE}/shopify/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopDomain, accessToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Connection failed' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

/**
 * Disconnect from Shopify
 * Note: This requires admin privileges (Firestore rules restrict systemConfig writes to admins)
 */
export async function disconnectShopify(): Promise<void> {
  const docRef = doc(db, 'systemConfig', CONFIG_DOC);
  await setDoc(docRef, {
    status: 'disconnected',
    accessToken: null,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

/**
 * Get Shopify products
 */
export async function getShopifyProducts(): Promise<ShopifyProduct[]> {
  try {
    const response = await authenticatedFetch(`${API_BASE}/shopify/products`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch products');
    }

    return data.products || [];
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return [];
  }
}

/**
 * Sync product to Shopify
 */
export async function syncProductToShopify(
  roadmapProductId: string,
  productData: ShopifyProductInput
): Promise<{ success: boolean; shopifyProductId?: string; error?: string }> {
  try {
    const response = await authenticatedFetch(`${API_BASE}/shopify/sync-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roadmapProductId, productData }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Sync failed' };
    }

    return { success: true, shopifyProductId: data.shopifyProductId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
  }
}

/**
 * Get product sync mappings
 */
export async function getProductSyncMappings(): Promise<ProductSyncMapping[]> {
  const q = query(collection(db, 'productSyncMappings'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ProductSyncMapping));
}

/**
 * Get sync mapping for a roadmap product
 */
export async function getSyncMappingForProduct(roadmapProductId: string): Promise<ProductSyncMapping | null> {
  const q = query(
    collection(db, 'productSyncMappings'),
    where('roadmapProductId', '==', roadmapProductId)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as ProductSyncMapping;
}
