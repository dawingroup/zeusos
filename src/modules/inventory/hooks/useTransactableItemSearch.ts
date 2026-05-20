/**
 * useTransactableItemSearch
 * Debounced search that returns only transactable (SKU-level) inventory items,
 * grouped by family for display.
 */

import { useState, useRef, useCallback } from 'react';
import { searchInventory, getFamilySkus } from '../services/inventoryService';
import type { InventoryListItem, InventoryClassification } from '../types';

export type TransactableSearchMode = 'po' | 'bom' | 'stock-adjustment';

export interface GroupedSearchResult {
  type: 'family-header' | 'sku';
  familyId?: string;
  familyName?: string;
  item?: InventoryListItem;
  variantCount?: number;
}

interface UseTransactableItemSearchOptions {
  mode?: TransactableSearchMode;
  classification?: InventoryClassification;
  debounceMs?: number;
}

interface UseTransactableItemSearchResult {
  results: GroupedSearchResult[];
  loading: boolean;
  search: (term: string) => void;
  clear: () => void;
  expandFamily: (familyId: string) => Promise<void>;
  expandedFamilies: Set<string>;
}

export function useTransactableItemSearch(
  options?: UseTransactableItemSearchOptions,
): UseTransactableItemSearchResult {
  const [results, setResults] = useState<GroupedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(
    new Set(),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (term: string) => {
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
          const items = await searchInventory(trimmed, {
            itemScope: 'sku',
            isOrderable: true,
            isBomSelectable:
              options?.mode === 'bom' ? true : undefined,
            classification: options?.classification,
            limit: 50,
          });

          // Group by family
          const familyGroups = new Map<
            string,
            { familyName: string; skus: InventoryListItem[] }
          >();
          const ungrouped: InventoryListItem[] = [];

          for (const item of items) {
            if (item.familyId) {
              const existing = familyGroups.get(item.familyId);
              if (existing) {
                existing.skus.push(item);
              } else {
                // Derive family name from variant name (before " – ")
                const familyName =
                  item.name.split(' – ')[0] || item.name;
                familyGroups.set(item.familyId, {
                  familyName,
                  skus: [item],
                });
              }
            } else {
              ungrouped.push(item);
            }
          }

          // Build grouped results
          const grouped: GroupedSearchResult[] = [];

          // Family-grouped items
          for (const [familyId, group] of familyGroups) {
            grouped.push({
              type: 'family-header',
              familyId,
              familyName: group.familyName,
              variantCount: group.skus.length,
            });
            for (const sku of group.skus) {
              grouped.push({ type: 'sku', item: sku, familyId });
            }
          }

          // Ungrouped flat SKUs
          for (const item of ungrouped) {
            grouped.push({ type: 'sku', item });
          }

          setResults(grouped);
        } catch (err) {
          console.error('Transactable item search error:', err);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, options?.debounceMs ?? 300);
    },
    [options?.mode, options?.classification, options?.debounceMs],
  );

  const expandFamily = useCallback(
    async (familyId: string) => {
      if (expandedFamilies.has(familyId)) return;

      try {
        const skus = await getFamilySkus(familyId);
        const skuListItems: InventoryListItem[] = skus
          .filter((s) => {
            if (s.isOrderable === false) return false;
            if (options?.mode === 'bom' && s.isBomSelectable === false) return false;
            return s.status === 'active';
          })
          .map((s) => ({
            id: s.id,
            sku: s.sku,
            name: s.name,
            displayName: s.displayName,
            category: s.category,
            subcategory: s.subcategory,
            brand: s.brand,
            tier: s.tier,
            source: s.source,
            thickness: s.dimensions?.thickness,
            costPerUnit: s.pricing?.costPerUnit,
            currency: s.pricing?.currency,
            inStock: s.inventory?.inStock,
            status: s.status,
            isFamily: false,
            isOrderable: true,
            isBomSelectable: s.isBomSelectable,
            familyId: s.familyId,
            skuCount: 0,
            parentItemId: s.parentItemId,
            isVariantParent: false,
            variantCount: 0,
            itemType: s.itemType,
            classification: s.classification,
          }));

        // Insert expanded SKUs into results after the family header
        setResults((prev) => {
          const next: GroupedSearchResult[] = [];
          for (const r of prev) {
            next.push(r);
            if (
              r.type === 'family-header' &&
              r.familyId === familyId
            ) {
              // Remove any existing SKUs for this family first
              // then add the full set
              for (const sku of skuListItems) {
                next.push({ type: 'sku', item: sku, familyId });
              }
            }
          }
          // Remove duplicates — filter out old SKUs for this family
          // that were already in the list from the search
          const seen = new Set<string>();
          return next.filter((r) => {
            if (r.type === 'sku' && r.item && r.familyId === familyId) {
              if (seen.has(r.item.id)) return false;
              seen.add(r.item.id);
            }
            return true;
          });
        });

        setExpandedFamilies((prev) => new Set([...prev, familyId]));
      } catch (err) {
        console.error(`Failed to expand family ${familyId}:`, err);
      }
    },
    [expandedFamilies, options?.mode],
  );

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
    setLoading(false);
    setExpandedFamilies(new Set());
  }, []);

  return {
    results,
    loading,
    search,
    clear,
    expandFamily,
    expandedFamilies,
  };
}
