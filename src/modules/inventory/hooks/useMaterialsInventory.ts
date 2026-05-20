/**
 * useMaterialsInventory Hook
 * Subscribe to inventory items classified as 'material' (raw materials for manufacturing)
 */

import { useState, useEffect, useMemo } from 'react';
import { subscribeToInventory } from '../services/inventoryService';
import type { InventoryListItem, InventoryCategory } from '../types';

interface UseMaterialsInventoryOptions {
  category?: InventoryCategory;
  hasMaterialLink?: boolean;
  hasSupplierPricing?: boolean;
}

interface MaterialInventoryItem extends InventoryListItem {
  linkedMaterialIds?: string[];
  supplierPricingCount?: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
}

interface UseMaterialsInventoryResult {
  materials: MaterialInventoryItem[];
  loading: boolean;
  error: Error | null;
  stats: {
    total: number;
    linkedToMaterialLibrary: number;
    withSupplierPricing: number;
    byCategory: Record<InventoryCategory, number>;
  };
}

export function useMaterialsInventory(
  options: UseMaterialsInventoryOptions = {}
): UseMaterialsInventoryResult {
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

  // Filter to materials only — explicit classification wins over Shopify heuristic.
  // Children of a parent (variants / family SKUs) are excluded so the count and the
  // visible table stay consistent — the table hides children and renders them inline
  // when their parent is expanded.
  const materials = useMemo(() => {
    let filtered = allItems.filter((item) => {
      // Hide children — they're rolled up under their parent
      if (item.parentItemId || item.familyId) return false;

      const classification = (item as any).classification;
      const hasShopifyLink = !!(item as any).shopifyProductId;
      // Explicit classification always takes priority
      if (classification === 'material') return true;
      if (classification === 'product') return false;
      // Fallback: no explicit classification — material if no Shopify link
      return !hasShopifyLink;
    });

    if (options.hasMaterialLink !== undefined) {
      filtered = filtered.filter((item) => {
        const hasMaterialLink = ((item as any).linkedMaterialIds?.length ?? 0) > 0;
        return options.hasMaterialLink ? hasMaterialLink : !hasMaterialLink;
      });
    }

    if (options.hasSupplierPricing !== undefined) {
      filtered = filtered.filter((item) => {
        const hasSupplierPricing = ((item as any).supplierPricing?.length ?? 0) > 0;
        return options.hasSupplierPricing ? hasSupplierPricing : !hasSupplierPricing;
      });
    }

    return filtered as MaterialInventoryItem[];
  }, [allItems, options.hasMaterialLink, options.hasSupplierPricing]);

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

    let linkedToMaterialLibrary = 0;
    let withSupplierPricing = 0;

    for (const material of materials) {
      byCategory[material.category] = (byCategory[material.category] || 0) + 1;
      if ((material as any).linkedMaterialIds?.length > 0) linkedToMaterialLibrary++;
      if ((material as any).supplierPricing?.length > 0) withSupplierPricing++;
    }

    return {
      total: materials.length,
      linkedToMaterialLibrary,
      withSupplierPricing,
      byCategory,
    };
  }, [materials]);

  return {
    materials,
    loading,
    error,
    stats,
  };
}

export default useMaterialsInventory;
