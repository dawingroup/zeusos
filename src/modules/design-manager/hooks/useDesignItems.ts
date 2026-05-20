/**
 * useDesignItems Hook
 * Subscribe to design items for a project with optional filters
 */

import { useState, useEffect, useMemo } from 'react';
import type { DesignItem, DesignStage, DesignCategory } from '../types';
import { subscribeToDesignItems, getDesignItems } from '../services/firestore';

export interface DesignItemsFilters {
  stage?: DesignStage;
  category?: DesignCategory;
  search?: string;
  sortBy?: 'name' | 'updatedAt' | 'readiness' | 'stage';
  sortOrder?: 'asc' | 'desc';
}

export interface UseDesignItemsReturn {
  items: DesignItem[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time design items subscription with filtering
 */
export function useDesignItems(
  projectId: string | null | undefined,
  filters?: DesignItemsFilters
): UseDesignItemsReturn {
  const [items, setItems] = useState<DesignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await getDesignItems(projectId, {
        stage: filters?.stage,
        category: filters?.category,
      });
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch items'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToDesignItems(
      projectId,
      (data) => {
        setItems(data);
        setLoading(false);
        setError(null);
      },
      {
        stage: filters?.stage,
        category: filters?.category,
      }
    );

    return () => unsubscribe();
  }, [projectId, filters?.stage, filters?.category]);

  // Apply client-side filtering and sorting
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.itemCode.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sorting
    if (filters?.sortBy) {
      const order = filters.sortOrder === 'asc' ? 1 : -1;
      result.sort((a, b) => {
        switch (filters.sortBy) {
          case 'name':
            return a.name.localeCompare(b.name) * order;
          case 'readiness':
            return (a.overallReadiness - b.overallReadiness) * order;
          case 'updatedAt':
            return (a.updatedAt.seconds - b.updatedAt.seconds) * order;
          default:
            return 0;
        }
      });
    } else {
      // Default: sort by sortOrder ascending (items without sortOrder go last)
      result.sort((a, b) => {
        const aOrder = a.sortOrder ?? Infinity;
        const bOrder = b.sortOrder ?? Infinity;
        return aOrder - bOrder;
      });
    }

    return result;
  }, [items, filters?.search, filters?.sortBy, filters?.sortOrder]);

  return { items: filteredItems, loading, error, refresh };
}

export default useDesignItems;
