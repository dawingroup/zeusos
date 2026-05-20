/**
 * useOptimizedBOQ Hook
 *
 * React hook for optimized BOQ data fetching with:
 * - Pagination
 * - Search/filter
 * - Caching
 * - Virtual scrolling support
 * - Prefetching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { performanceOptimizationService } from '../core/services/performance-optimization.service';
import { ControlBOQItem } from '../types/control-boq';

interface UseBOQOptions {
  projectId: string;
  pageSize?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: {
    category?: string;
    status?: string[];
    searchTerm?: string;
  };
  enablePrefetch?: boolean;
  enableCache?: boolean;
}

interface UseBOQReturn {
  items: ControlBOQItem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;

  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  search: (term: string) => Promise<void>;
  updateFilters: (filters: UseBOQOptions['filters']) => void;

  // Pagination state
  currentPage: number;
  totalPages?: number;

  // Performance metrics
  cacheHitRate: number;
  loadTime: number;
}

export function useOptimizedBOQ(options: UseBOQOptions): UseBOQReturn {
  const {
    projectId,
    pageSize = 50,
    orderByField = 'itemNumber',
    orderDirection = 'asc',
    filters: initialFilters,
    enablePrefetch = true,
    enableCache = true,
  } = options;

  const [items, setItems] = useState<ControlBOQItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [loadTime, setLoadTime] = useState(0);
  const [cacheHitRate, setCacheHitRate] = useState(0);

  const lastVisibleRef = useRef<DocumentSnapshot | null>(null);
  const isInitialMount = useRef(true);

  /**
   * Load initial data
   */
  const loadInitialData = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      // Prefetch if enabled
      if (enablePrefetch && isInitialMount.current) {
        await performanceOptimizationService.prefetchProjectData(projectId);
      }

      const result = await performanceOptimizationService.getPaginatedBOQ(
        projectId,
        { pageSize, orderByField, orderDirection },
        filters,
        null
      );

      setItems(result.items);
      setHasMore(result.hasMore);
      lastVisibleRef.current = result.lastVisible;
      setCurrentPage(1);

      const duration = Date.now() - startTime;
      setLoadTime(duration);

      // Update cache stats
      const cacheStats = performanceOptimizationService.getCacheStats();
      setCacheHitRate(cacheStats.size > 0 ? (cacheStats.size / (cacheStats.size + 1)) * 100 : 0);

      console.log(`[useOptimizedBOQ] Initial load completed in ${duration}ms`);
    } catch (err) {
      setError(err as Error);
      console.error('[useOptimizedBOQ] Error loading data:', err);
    } finally {
      setLoading(false);
      isInitialMount.current = false;
    }
  }, [projectId, pageSize, orderByField, orderDirection, filters, enablePrefetch]);

  /**
   * Load more items (pagination)
   */
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    const startTime = Date.now();

    try {
      const result = await performanceOptimizationService.getPaginatedBOQ(
        projectId,
        { pageSize, orderByField, orderDirection },
        filters,
        lastVisibleRef.current
      );

      setItems(prev => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      lastVisibleRef.current = result.lastVisible;
      setCurrentPage(prev => prev + 1);

      const duration = Date.now() - startTime;
      console.log(`[useOptimizedBOQ] Load more completed in ${duration}ms`);
    } catch (err) {
      setError(err as Error);
      console.error('[useOptimizedBOQ] Error loading more:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, projectId, pageSize, orderByField, orderDirection, filters]);

  /**
   * Refresh data (clear cache and reload)
   */
  const refresh = useCallback(async () => {
    performanceOptimizationService.clearCache(`boq_${projectId}`);
    lastVisibleRef.current = null;
    await loadInitialData();
  }, [projectId, loadInitialData]);

  /**
   * Search BOQ items
   */
  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      // If empty search, reload with filters
      updateFilters({ ...filters, searchTerm: undefined });
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      const results = await performanceOptimizationService.searchBOQ(
        projectId,
        term,
        pageSize * 2 // Get more results for search
      );

      setItems(results);
      setHasMore(false); // Search doesn't support pagination yet
      lastVisibleRef.current = null;

      const duration = Date.now() - startTime;
      setLoadTime(duration);
      console.log(`[useOptimizedBOQ] Search completed in ${duration}ms`);
    } catch (err) {
      setError(err as Error);
      console.error('[useOptimizedBOQ] Error searching:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, pageSize, filters]);

  /**
   * Update filters and reload
   */
  const updateFilters = useCallback((newFilters: UseBOQOptions['filters']) => {
    setFilters(newFilters);
    lastVisibleRef.current = null;
    setCurrentPage(0);
  }, []);

  /**
   * Initial load on mount or filter change
   */
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData, filters]);

  /**
   * Save cache to localStorage on unmount (if enabled)
   */
  useEffect(() => {
    if (!enableCache) return;

    return () => {
      performanceOptimizationService.saveToLocalStorage(projectId);
    };
  }, [projectId, enableCache]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    search,
    updateFilters,
    currentPage,
    cacheHitRate,
    loadTime,
  };
}

/**
 * useOptimizedBOQItems Hook
 *
 * Fetch specific BOQ items by IDs with caching
 */
interface UseBOQItemsOptions {
  projectId: string;
  boqItemIds: string[];
}

interface UseBOQItemsReturn {
  items: ControlBOQItem[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useOptimizedBOQItems(options: UseBOQItemsOptions): UseBOQItemsReturn {
  const { projectId, boqItemIds } = options;

  const [items, setItems] = useState<ControlBOQItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadItems = useCallback(async () => {
    if (!projectId || boqItemIds.length === 0) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await performanceOptimizationService.getBOQItemsByIds(
        projectId,
        boqItemIds
      );

      setItems(results);
    } catch (err) {
      setError(err as Error);
      console.error('[useOptimizedBOQItems] Error loading items:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, boqItemIds]);

  const refresh = useCallback(async () => {
    performanceOptimizationService.clearCache(`boq_item_${projectId}`);
    await loadItems();
  }, [projectId, loadItems]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}

/**
 * usePrefetchProjectData Hook
 *
 * Prefetch project data on component mount for improved performance
 */
export function usePrefetchProjectData(projectId: string, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || !projectId) return;

    // Load cache from localStorage
    performanceOptimizationService.loadFromLocalStorage(projectId);

    // Prefetch fresh data in background
    performanceOptimizationService.prefetchProjectData(projectId).catch(error => {
      console.error('[usePrefetchProjectData] Error prefetching:', error);
    });
  }, [projectId, enabled]);
}
