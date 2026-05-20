/**
 * useSupplierPicker
 * Hook for searching and selecting suppliers from subsidiary-specific supplier systems
 */

import { useState, useCallback, useRef } from 'react';
import type { Supplier } from '@/subsidiaries/advisory/matflow/types/supplier';
import { searchSuppliers, getActiveSuppliers } from '../services/supplierBridgeService';

interface UseSupplierPickerOptions {
  subsidiaryId?: string;
  /** When set, suppliers whose categories include any of these are sorted to the top */
  preferredCategories?: string[];
}

export function useSupplierPicker(options: UseSupplierPickerOptions = {}) {
  const { subsidiaryId, preferredCategories } = options;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Sort suppliers so those matching preferredCategories come first, then alphabetically
   */
  const sortWithPreference = useCallback(
    (list: Supplier[]): Supplier[] => {
      if (!preferredCategories || preferredCategories.length === 0) return list;
      return [...list].sort((a, b) => {
        const aMatch = a.categories?.some((c) => preferredCategories.includes(c)) ? 1 : 0;
        const bMatch = b.categories?.some((c) => preferredCategories.includes(c)) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch; // preferred first
        return (a.name || '').localeCompare(b.name || '');
      });
    },
    [preferredCategories],
  );

  /**
   * Search suppliers with debounce
   */
  const search = useCallback(
    (query: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (!query.trim()) {
        // Load all active suppliers when search is empty
        setLoading(true);
        getActiveSuppliers(subsidiaryId)
          .then((results) => setSuppliers(sortWithPreference(results)))
          .catch(() => setSuppliers([]))
          .finally(() => setLoading(false));
        return;
      }

      debounceTimer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const results = await searchSuppliers(query, subsidiaryId);
          setSuppliers(sortWithPreference(results));
        } catch {
          setSuppliers([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [subsidiaryId, sortWithPreference],
  );

  /**
   * Load all active suppliers (for initial dropdown)
   */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await getActiveSuppliers(subsidiaryId);
      setSuppliers(sortWithPreference(results));
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [subsidiaryId, sortWithPreference]);

  return {
    suppliers,
    loading,
    search,
    loadAll,
    subsidiaryId,
  };
}
