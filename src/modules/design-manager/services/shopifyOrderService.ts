/**
 * Shopify Order Service
 *
 * Queries and manages Shopify order data stored in the `shopifyOrders` Firestore collection.
 * Orders are written by webhooks (shopifyOrderCreate, shopifyOrderUpdate, shopifyOrderFulfilled)
 * and can be bulk-synced via the `/shopify/sync-orders` cloud function endpoint.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/services/firebase';
import type {
  ShopifyOrder,
  ShopifyOrderFilters,
  ShopifyOrderStats,
  ShopifyFinancialStatus,
} from '../types/shopifyOrder';

const SHOPIFY_ORDERS_COLLECTION = 'shopifyOrders';
const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

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
 * Get all Shopify orders from Firestore with optional filters
 */
export async function getShopifyOrders(
  filters?: ShopifyOrderFilters
): Promise<ShopifyOrder[]> {
  const constraints: ReturnType<typeof where>[] = [];

  if (filters?.financialStatus) {
    constraints.push(where('financialStatus', '==', filters.financialStatus));
  }

  if (filters?.fulfillmentStatus) {
    constraints.push(where('fulfillmentStatus', '==', filters.fulfillmentStatus));
  }

  if (filters?.customerId) {
    constraints.push(where('customer.shopifyCustomerId', '==', filters.customerId));
  }

  if (filters?.dateFrom) {
    constraints.push(
      where('shopifyCreatedAt', '>=', Timestamp.fromDate(filters.dateFrom))
    );
  }

  if (filters?.dateTo) {
    constraints.push(
      where('shopifyCreatedAt', '<=', Timestamp.fromDate(filters.dateTo))
    );
  }

  const q = query(
    collection(db, SHOPIFY_ORDERS_COLLECTION),
    ...constraints,
    orderBy('shopifyCreatedAt', 'desc'),
    firestoreLimit(filters?.limit || 100)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ShopifyOrder)
  );
}

/**
 * Subscribe to real-time Shopify order updates
 */
export function subscribeToShopifyOrders(
  callback: (orders: ShopifyOrder[]) => void,
  filters?: ShopifyOrderFilters
): Unsubscribe {
  const constraints: ReturnType<typeof where>[] = [];

  if (filters?.financialStatus) {
    constraints.push(where('financialStatus', '==', filters.financialStatus));
  }

  if (filters?.fulfillmentStatus) {
    constraints.push(where('fulfillmentStatus', '==', filters.fulfillmentStatus));
  }

  const q = query(
    collection(db, SHOPIFY_ORDERS_COLLECTION),
    ...constraints,
    orderBy('shopifyCreatedAt', 'desc'),
    firestoreLimit(filters?.limit || 100)
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as ShopifyOrder)
    );
    callback(orders);
  });
}

/**
 * Get a single Shopify order by its Firestore document ID
 */
export async function getShopifyOrder(orderId: string): Promise<ShopifyOrder | null> {
  const orderRef = doc(db, SHOPIFY_ORDERS_COLLECTION, orderId);
  const orderDoc = await getDoc(orderRef);

  if (!orderDoc.exists()) {
    return null;
  }

  return { id: orderDoc.id, ...orderDoc.data() } as ShopifyOrder;
}

/**
 * Get orders by customer (Shopify customer ID)
 */
export async function getOrdersByCustomer(
  shopifyCustomerId: string
): Promise<ShopifyOrder[]> {
  const q = query(
    collection(db, SHOPIFY_ORDERS_COLLECTION),
    where('customer.shopifyCustomerId', '==', shopifyCustomerId),
    orderBy('shopifyCreatedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ShopifyOrder)
  );
}

/**
 * Trigger bulk sync of Shopify orders via cloud function
 */
export async function syncShopifyOrders(
  sinceId?: string
): Promise<{ total: number; created: number; updated: number }> {
  const response = await authenticatedFetch(`${API_BASE}/shopify/sync-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sinceId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Order sync failed');
  }

  return { total: data.total, created: data.created, updated: data.updated };
}

/**
 * Compute aggregate order statistics
 */
export async function getOrderStats(): Promise<ShopifyOrderStats> {
  const q = query(
    collection(db, SHOPIFY_ORDERS_COLLECTION),
    orderBy('shopifyCreatedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const orders = snapshot.docs.map((d) => d.data());

  const byFinancialStatus: Record<string, number> = {};
  const byFulfillmentStatus: Record<string, number> = {};
  let totalRevenue = 0;
  let currency = 'UGX';

  for (const order of orders) {
    totalRevenue += order.totalPrice || 0;
    currency = order.currency || currency;

    const fs = (order.financialStatus || 'pending') as ShopifyFinancialStatus;
    byFinancialStatus[fs] = (byFinancialStatus[fs] || 0) + 1;

    const ffs = (order.fulfillmentStatus || 'unfulfilled') as string;
    byFulfillmentStatus[ffs] = (byFulfillmentStatus[ffs] || 0) + 1;
  }

  return {
    totalOrders: orders.length,
    totalRevenue,
    currency,
    byFinancialStatus,
    byFulfillmentStatus,
  };
}
