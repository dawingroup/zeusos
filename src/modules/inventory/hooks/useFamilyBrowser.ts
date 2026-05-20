/**
 * useFamilyBrowser
 * Hook for browsing inventory items in a two-level family/SKU tree.
 * Families are shown as expandable parent rows; SKUs are shown beneath.
 * Flat SKUs (no family) appear at the top level.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { InventoryItem, FamilyStockRollup, InventoryClassification } from '../types';
import {
  getFamilies,
  getFlatSkus,
  getFamilySkus,
  getFamilyStockRollup,
} from '../services/inventoryService';

interface UseFamilyBrowserOptions {
  classification?: InventoryClassification;
  maxFlatResults?: number;
}

interface UseFamilyBrowserResult {
  families: InventoryItem[];
  flatSkus: InventoryItem[];
  expandedFamilySkus: Record<string, InventoryItem[]>;
  familyRollups: Record<string, FamilyStockRollup>;
  expandedFamilyIds: Set<string>;
  expandFamily: (familyId: string) => Promise<void>;
  collapseFamily: (familyId: string) => void;
  toggleFamily: (familyId: string) => Promise<void>;
  loading: boolean;
  loadingSkus: Record<string, boolean>;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFamilyBrowser(
  options?: UseFamilyBrowserOptions,
): UseFamilyBrowserResult {
  const [families, setFamilies] = useState<InventoryItem[]>([]);
  const [flatSkus, setFlatSkus] = useState<InventoryItem[]>([]);
  const [expandedFamilySkus, setExpandedFamilySkus] = useState<
    Record<string, InventoryItem[]>
  >({});
  const [familyRollups, setFamilyRollups] = useState<
    Record<string, FamilyStockRollup>
  >({});
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [loadingSkus, setLoadingSkus] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [familyResults, flatResults] = await Promise.all([
        getFamilies(options?.classification),
        getFlatSkus({
          classification: options?.classification,
          maxResults: options?.maxFlatResults ?? 200,
        }),
      ]);

      if (!mountedRef.current) return;

      setFamilies(familyResults);
      setFlatSkus(flatResults);

      // Load rollups for all families in parallel
      const rollupResults = await Promise.all(
        familyResults.map((f) => getFamilyStockRollup(f.id)),
      );

      if (!mountedRef.current) return;

      const rollupMap: Record<string, FamilyStockRollup> = {};
      rollupResults.forEach((r) => {
        if (r) rollupMap[r.familyId] = r;
      });
      setFamilyRollups(rollupMap);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [options?.classification, options?.maxFlatResults]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  const expandFamily = useCallback(
    async (familyId: string) => {
      // Skip if already loaded
      if (expandedFamilySkus[familyId]) {
        setExpandedFamilyIds((prev) => new Set([...prev, familyId]));
        return;
      }

      setLoadingSkus((prev) => ({ ...prev, [familyId]: true }));

      try {
        const skus = await getFamilySkus(familyId);
        if (!mountedRef.current) return;

        setExpandedFamilySkus((prev) => ({ ...prev, [familyId]: skus }));
        setExpandedFamilyIds((prev) => new Set([...prev, familyId]));
      } catch (err) {
        console.error(`Failed to load SKUs for family ${familyId}:`, err);
      } finally {
        if (mountedRef.current) {
          setLoadingSkus((prev) => ({ ...prev, [familyId]: false }));
        }
      }
    },
    [expandedFamilySkus],
  );

  const collapseFamily = useCallback((familyId: string) => {
    setExpandedFamilyIds((prev) => {
      const next = new Set(prev);
      next.delete(familyId);
      return next;
    });
  }, []);

  const toggleFamily = useCallback(
    async (familyId: string) => {
      if (expandedFamilyIds.has(familyId)) {
        collapseFamily(familyId);
      } else {
        await expandFamily(familyId);
      }
    },
    [expandedFamilyIds, expandFamily, collapseFamily],
  );

  return {
    families,
    flatSkus,
    expandedFamilySkus,
    familyRollups,
    expandedFamilyIds,
    expandFamily,
    collapseFamily,
    toggleFamily,
    loading,
    loadingSkus,
    error,
    refresh: loadData,
  };
}
