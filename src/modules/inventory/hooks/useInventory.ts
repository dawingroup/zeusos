/**
 * useInventory Hook
 * Subscribe to inventory items with filtering and search
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  subscribeToInventory,
  searchInventory,
} from '../services/inventoryService';
import type {
  InventoryListItem,
  InventoryCategory,
  InventoryTier,
  InventorySource,
  InventoryStatus,
} from '../types';

interface UseInventoryOptions {
  category?: InventoryCategory;
  tier?: InventoryTier;
  source?: InventorySource;
  status?: InventoryStatus;
  standardOnly?: boolean;
}

interface UseInventoryResult {
  items: InventoryListItem[];
  loading: boolean;
  error: Error | null;
  search: (term: string) => Promise<void>;
  searchResults: InventoryListItem[];
  isSearching: boolean;
  clearSearch: () => void;
  stats: {
    total: number;
    byCategory: Record<InventoryCategory, number>;
    bySource: Record<InventorySource, number>;
  };
}

export function useInventory(options: UseInventoryOptions = {}): UseInventoryResult {
  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchResults, setSearchResults] = useState<InventoryListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Subscribe to inventory
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToInventory(
      (inventoryItems) => {
        setItems(inventoryItems);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      options
    );

    return () => unsubscribe();
  }, [
    options.category,
    options.tier,
    options.source,
    options.status,
    options.standardOnly,
  ]);

  // Search function
  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchInventory(term, {
        category: options.category,
      });
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, [options.category]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

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

    const bySource: Record<InventorySource, number> = {
      'manual': 0,
      'parts-promotion': 0,
    };

    for (const item of items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      bySource[item.source] = (bySource[item.source] || 0) + 1;
    }

    return {
      total: items.length,
      byCategory,
      bySource,
    };
  }, [items]);

  return {
    items,
    loading,
    error,
    search,
    searchResults,
    isSearching,
    clearSearch,
    stats,
  };
}

export default useInventory;
