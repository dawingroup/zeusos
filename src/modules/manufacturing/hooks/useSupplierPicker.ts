/**
 * useSupplierPicker
 * Hook for searching and selecting suppliers from subsidiary-specific supplier systems
 */

import { useState, useCallback, useRef } from 'react';
import type { Supplier } from '@/subsidiaries/advisory/matflow/types/supplier';
import { searchSuppliers, getActiveSuppliers } from '../services/supplierBridgeService';

interface UseSupplierPickerOptions {
  subsidiaryId?: string;
}

export function useSupplierPicker(options: UseSupplierPickerOptions = {}) {
  const { subsidiaryId } = options;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

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
          .then(setSuppliers)
          .catch(() => setSuppliers([]))
          .finally(() => setLoading(false));
        return;
      }

      debounceTimer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const results = await searchSuppliers(query, subsidiaryId);
          setSuppliers(results);
        } catch {
          setSuppliers([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [subsidiaryId],
  );

  /**
   * Load all active suppliers (for initial dropdown)
   */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await getActiveSuppliers(subsidiaryId);
      setSuppliers(results);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [subsidiaryId]);

  return {
    suppliers,
    loading,
    search,
    loadAll,
    subsidiaryId,
  };
}
