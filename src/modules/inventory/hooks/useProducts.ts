/**
 * useProducts Hook
 * Subscribe to inventory items classified as 'product' (finished goods for retail/projects)
 */

import { useState, useEffect, useMemo } from 'react';
import { subscribeToInventory } from '../services/inventoryService';
import type { InventoryListItem, InventoryCategory, ShopifySyncStatus } from '../types';

interface UseProductsOptions {
  category?: InventoryCategory;
  shopifySynced?: boolean;
  hasProjectLinks?: boolean;
}

interface ProductListItem extends InventoryListItem {
  shopifySyncStatus?: ShopifySyncStatus;
  shopifyProductId?: string;
  linkedProjectCount?: number;
}

interface UseProductsResult {
  products: ProductListItem[];
  loading: boolean;
  error: Error | null;
  stats: {
    total: number;
    syncedToShopify: number;
    linkedToProjects: number;
    byCategory: Record<InventoryCategory, number>;
  };
}

export function useProducts(options: UseProductsOptions = {}): UseProductsResult {
  const [allItems, setAllItems] = useState<InventoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to inventory
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToInventory(
      (inventoryItems) => {
        setAllItems(inventoryItems);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      { category: options.category }
    );

    return () => unsubscribe();
  }, [options.category]);

  // Filter to products only — explicit classification wins over Shopify heuristic.
  // Children of a parent (variants / family SKUs) are excluded so the count and the
  // visible table stay consistent — the table hides children and renders them inline
  // when their parent is expanded.
  const products = useMemo(() => {
    let filtered = allItems.filter((item) => {
      // Hide children — they're rolled up under their parent
      if (item.parentItemId || item.familyId) return false;

      const classification = (item as any).classification;
      const hasShopifyLink = !!(item as any).shopifyProductId;
      // Explicit classification always takes priority
      if (classification === 'product') return true;
      if (classification === 'material') return false;
      // Fallback: no explicit classification — use Shopify heuristic
      return hasShopifyLink;
    });

    if (options.shopifySynced !== undefined) {
      filtered = filtered.filter((item) => {
        const synced = !!(item as any).shopifyProductId;
        return options.shopifySynced ? synced : !synced;
      });
    }

    return filtered as ProductListItem[];
  }, [allItems, options.shopifySynced]);

  // Calculate stats
  const stats = useMemo(() => {
    const byCategory: Record<InventoryCategory, number> = {
      'sheet-goods': 0,
      'solid-wood': 0,
      'hardware': 0,
      'edge-banding': 0,
      'finishing': 0,
      'adhesives': 0,
      'fasteners': 0,
      'upholstery': 0,
      'other': 0,
    };

    let syncedToShopify = 0;
    let linkedToProjects = 0;

    for (const product of products) {
      byCategory[product.category] = (byCategory[product.category] || 0) + 1;
      if (product.shopifyProductId) syncedToShopify++;
      if ((product as any).linkedProjectIds?.length > 0) linkedToProjects++;
    }

    return {
      total: products.length,
      syncedToShopify,
      linkedToProjects,
      byCategory,
    };
  }, [products]);

  return {
    products,
    loading,
    error,
    stats,
  };
}

export default useProducts;
