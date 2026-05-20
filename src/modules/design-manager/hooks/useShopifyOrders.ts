/**
 * useShopifyOrders Hook
 *
 * Real-time subscription to Shopify orders stored in Firestore.
 * Supports filtering by status, date range, and provides computed stats.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ShopifyOrder,
  ShopifyOrderFilters,
  ShopifyOrderStats,
  ShopifyFinancialStatus,
} from '../types/shopifyOrder';
import {
  subscribeToShopifyOrders,
  syncShopifyOrders,
} from '../services/shopifyOrderService';

interface UseShopifyOrdersOptions {
  filters?: ShopifyOrderFilters;
  autoSubscribe?: boolean;
}

interface UseShopifyOrdersReturn {
  orders: ShopifyOrder[];
  loading: boolean;
  error: string | null;
  orderStats: ShopifyOrderStats;
  syncOrders: () => Promise<{ total: number; created: number; updated: number }>;
  syncing: boolean;
}

export function useShopifyOrders(
  options: UseShopifyOrdersOptions = {}
): UseShopifyOrdersReturn {
  const { filters, autoSubscribe = true } = options;

  const [orders, setOrders] = useState<ShopifyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Subscribe to real-time order updates
  useEffect(() => {
    if (!autoSubscribe) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToShopifyOrders((updatedOrders) => {
      setOrders(updatedOrders);
      setLoading(false);
    }, filters);

    return () => unsubscribe();
  }, [
    autoSubscribe,
    filters?.financialStatus,
    filters?.fulfillmentStatus,
    filters?.limit,
  ]);

  // Compute order stats from current data
  const orderStats = useMemo<ShopifyOrderStats>(() => {
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
  }, [orders]);

  // Manual sync trigger
  const syncOrdersHandler = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncShopifyOrders();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setError(msg);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    orders,
    loading,
    error,
    orderStats,
    syncOrders: syncOrdersHandler,
    syncing,
  };
}
