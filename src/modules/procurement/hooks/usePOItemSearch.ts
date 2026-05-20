/**
 * usePOItemSearch
 * Unified debounced search across inventory, materials, and products
 * for populating PO line items.
 */

import { useState, useRef, useCallback } from 'react';
import { searchInventory } from '@/modules/inventory/services/inventoryService';
import {
  searchMaterialsForLinking,
  getLinkedInventoryForMaterial,
} from '@/modules/inventory/services/materialInventoryLinkService';
import { createInventoryItem, generateSku } from '@/modules/inventory/services/inventoryService';
import { linkMaterialToInventory } from '@/modules/inventory/services/materialInventoryLinkService';
import type { InventoryListItem, InventoryCategory, InventoryUnit } from '@/modules/inventory/types';
import type { Material, MaterialCategory } from '@/modules/design-manager/types/materials';
import type { InventoryItem } from '@/modules/inventory/types';
import type { LaunchProduct } from '@/modules/launch-pipeline/types/product.types';
import { getProducts } from '@/modules/launch-pipeline/services/pipelineService';

// ============================================
// Unified search result type
// ============================================

export type UnifiedSearchResult =
  | { source: 'inventory'; item: InventoryListItem }
  | { source: 'material'; item: Material; linkedInventory: InventoryItem | null }
  | { source: 'product'; item: LaunchProduct };

/**
 * Resolved line item data from a search result selection
 */
export interface ResolvedLineItemData {
  inventoryItemId: string;
  materialId?: string;
  description: string;
  sku: string;
  unitCost: number;
  unit: string;
  currency: string;
  packagingQty?: number;
  packagingUnit?: string;
  derivedUnitCost?: number;
  baseUnit?: string;
}

// ============================================
// Category mapping
// ============================================

const MATERIAL_TO_INVENTORY_CATEGORY: Record<MaterialCategory, InventoryCategory> = {
  'sheet-goods': 'sheet-goods',
  'solid-wood': 'solid-wood',
  'hardware': 'hardware',
  'edge-banding': 'edge-banding',
  'finishing': 'finishing',
  'glass': 'other',
  'metal': 'other',
  'fabric-upholstery': 'other',
  'stone-composite': 'other',
  'other': 'other',
};

const MATERIAL_TO_INVENTORY_UNIT: Record<string, InventoryUnit> = {
  sheet: 'sheet',
  sqft: 'sqft',
  sqm: 'sqm',
  lft: 'lft',
  pcs: 'pcs',
  gal: 'gal',
  ea: 'ea',
  kg: 'kg',
  ltr: 'ltr',
};

// ============================================
// Hook
// ============================================

export function usePOItemSearch() {
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productsCache = useRef<LaunchProduct[] | null>(null);

  const search = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        // Search all three sources in parallel
        const [inventoryItems, materials, products] = await Promise.all([
          searchInventory(trimmed, { limit: 10 }),
          searchMaterialsForLinking(trimmed, [], 10),
          searchProductsCached(trimmed),
        ]);

        // Resolve material inventory links in parallel
        const materialsWithLinks = await Promise.all(
          materials.map(async (mat) => {
            let linkedInventory: InventoryItem | null = null;
            if (mat.inventoryItemId) {
              linkedInventory = await getLinkedInventoryForMaterial(mat.inventoryItemId);
            }
            return { source: 'material' as const, item: mat, linkedInventory };
          }),
        );

        // Filter out family/parent items — only SKU-level items are transactable
        const transactableInventoryItems = inventoryItems.filter(
          (item) => !item.isFamily && item.isOrderable !== false,
        );

        const unified: UnifiedSearchResult[] = [
          ...transactableInventoryItems.map((item) => ({ source: 'inventory' as const, item })),
          ...materialsWithLinks,
          ...products.map((item) => ({ source: 'product' as const, item })),
        ];

        setResults(unified);
      } catch (err) {
        console.error('PO item search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
    setLoading(false);
  }, []);

  /**
   * Search products with caching (products change infrequently)
   */
  async function searchProductsCached(term: string): Promise<LaunchProduct[]> {
    if (!productsCache.current) {
      try {
        productsCache.current = await getProducts();
      } catch {
        productsCache.current = [];
      }
    }

    const lower = term.toLowerCase();
    return productsCache.current
      .filter((p) => {
        const searchable = [
          p.name,
          p.description || '',
          p.category || '',
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(lower);
      })
      .slice(0, 10);
  }

  return { results, loading, search, clear };
}

// ============================================
// Resolution helpers
// ============================================

/**
 * Resolve an inventory search result to line item data
 */
export function resolveInventoryItem(
  item: InventoryListItem,
  fullInventoryItem?: InventoryItem | null,
): ResolvedLineItemData {
  const baseUnitCost =
    fullInventoryItem?.pricing?.costPerUnit ??
    item.costPerUnit ??
    0;
  const pricingUnit =
    fullInventoryItem?.pricing?.unit ||
    item.costUnit ||
    (item.category === 'sheet-goods' ? 'sheet' : 'pcs');
  const stockUnit = fullInventoryItem?.stockUom || pricingUnit;
  const purchaseUnit = fullInventoryItem?.purchaseUom || stockUnit;
  const conversionMultiplier =
    purchaseUnit !== stockUnit && (fullInventoryItem?.uomConversion ?? 0) > 0
      ? (fullInventoryItem?.uomConversion as number)
      : 1;
  const poUnitCost = baseUnitCost * conversionMultiplier;

  return {
    inventoryItemId: item.id,
    description: item.displayName || item.name,
    sku: item.sku,
    unitCost: poUnitCost,
    unit: purchaseUnit,
    currency: item.currency ?? 'UGX',
    packagingQty: conversionMultiplier,
    packagingUnit: purchaseUnit,
    derivedUnitCost: baseUnitCost,
    baseUnit: stockUnit,
  };
}

/**
 * Resolve a material with a linked inventory item to line item data
 */
export function resolveLinkedMaterial(
  material: Material,
  inventory: InventoryItem,
): ResolvedLineItemData {
  const baseUnitCost = inventory.pricing?.costPerUnit ?? material.pricing?.unitCost ?? 0;
  const stockUnit = inventory.stockUom || inventory.pricing?.unit || material.pricing?.unit || 'pcs';
  const purchaseUnit = inventory.purchaseUom || stockUnit;
  const conversionMultiplier =
    purchaseUnit !== stockUnit && (inventory.uomConversion ?? 0) > 0
      ? (inventory.uomConversion as number)
      : 1;
  const poUnitCost = baseUnitCost * conversionMultiplier;

  return {
    inventoryItemId: inventory.id,
    materialId: material.id,
    description: inventory.displayName || inventory.name,
    sku: inventory.sku,
    unitCost: poUnitCost,
    unit: purchaseUnit,
    currency: inventory.pricing?.currency ?? material.pricing?.currency ?? 'UGX',
    packagingQty: conversionMultiplier,
    packagingUnit: purchaseUnit,
    derivedUnitCost: baseUnitCost,
    baseUnit: stockUnit,
  };
}

/**
 * Resolve a material WITHOUT an inventory link by auto-creating an inventory item
 */
export async function resolveUnlinkedMaterial(
  material: Material,
  userId: string,
): Promise<ResolvedLineItemData> {
  const category = MATERIAL_TO_INVENTORY_CATEGORY[material.category] ?? 'other';
  const unit = MATERIAL_TO_INVENTORY_UNIT[material.pricing?.unit ?? 'pcs'] ?? 'pcs';
  const sku = material.inventoryItemSku || generateSku(material.name, category);

  const newItemId = await createInventoryItem(
    {
      sku,
      name: material.name,
      description: material.description || '',
      category,
      subcategory: material.subcategory,
      pricing: {
        costPerUnit: material.pricing?.unitCost ?? 0,
        currency: material.pricing?.currency ?? 'UGX',
        unit,
      },
      dimensions: material.dimensions,
      grainPattern: material.grainPattern,
      status: 'active',
    },
    userId,
  );

  // Create bidirectional link
  await linkMaterialToInventory(
    material.id,
    material.tier ?? 'global',
    undefined,
    newItemId,
    sku,
    userId,
  );

  return {
    inventoryItemId: newItemId,
    materialId: material.id,
    description: material.name,
    sku,
    unitCost: material.pricing?.unitCost ?? 0,
    unit: material.pricing?.unit ?? 'pcs',
    currency: material.pricing?.currency ?? 'UGX',
  };
}

/**
 * Resolve a product to line item data
 */
export function resolveProduct(product: LaunchProduct): Omit<ResolvedLineItemData, 'inventoryItemId'> & { inventoryItemId?: string } {
  const firstVariant = product.variants?.[0];
  return {
    description: product.name,
    sku: firstVariant?.sku ?? '',
    unitCost: product.pricing?.costPerItem ?? product.pricing?.basePrice ?? 0,
    unit: 'pcs',
    currency: product.pricing?.currency ?? 'USD',
  };
}
