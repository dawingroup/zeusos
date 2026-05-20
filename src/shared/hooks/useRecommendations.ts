/**
 * useRecommendations Hook
 * Provides contextual recommendations throughout the app
 * Automatically fetches and caches recommendations based on context
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getContextualRecommendations,
  getDesignItemRecommendations,
  getStrategyRecommendations,
  getPartsRecommendations,
  quickSearch,
  type RecommendationContext,
  type RecommendationItem,
  type ContextualRecommendations,
} from '../services/recommendationService';

interface UseRecommendationsOptions {
  context: RecommendationContext;
  autoFetch?: boolean;
  debounceMs?: number;
  maxResults?: number;
}

interface UseRecommendationsResult {
  recommendations: ContextualRecommendations;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<RecommendationItem[]>;
  suggestedActions: string[];
}

/**
 * Hook for fetching contextual recommendations
 */
export function useRecommendations(
  options: UseRecommendationsOptions,
  dependencies: Record<string, unknown> = {}
): UseRecommendationsResult {
  const { context, autoFetch = true, debounceMs = 500, maxResults = 5 } = options;
  
  const [recommendations, setRecommendations] = useState<ContextualRecommendations>({
    products: [],
    parts: [],
    inspirations: [],
    features: [],
    suggestedActions: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<string>('');

  const fetchRecommendations = useCallback(async () => {
    // Create a cache key from dependencies
    const cacheKey = JSON.stringify({ context, ...dependencies });
    
    // Skip if same request
    if (cacheKey === lastFetchRef.current) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const results = await getContextualRecommendations({
        context,
        searchText: dependencies.searchText as string,
        keywords: dependencies.keywords as string[],
        category: dependencies.category as string,
        projectType: dependencies.projectType as string,
        materials: dependencies.materials as string[],
        style: dependencies.style as string,
        budgetTier: dependencies.budgetTier as string,
        designItemId: dependencies.designItemId as string,
        projectId: dependencies.projectId as string,
        limit: maxResults,
      });
      
      setRecommendations(results);
      lastFetchRef.current = cacheKey;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [context, dependencies, maxResults]);

  // Auto-fetch with debounce when dependencies change
  useEffect(() => {
    if (!autoFetch) return;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      fetchRecommendations();
    }, debounceMs);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [autoFetch, debounceMs, fetchRecommendations]);

  const search = useCallback(async (query: string): Promise<RecommendationItem[]> => {
    return quickSearch(query, ['product', 'part', 'inspiration', 'feature'], maxResults);
  }, [maxResults]);

  return {
    recommendations,
    isLoading,
    error,
    refresh: fetchRecommendations,
    search,
    suggestedActions: recommendations.suggestedActions || [],
  };
}

/**
 * Hook specifically for design item context
 */
export function useDesignItemRecommendations(designItem: {
  name: string;
  category?: string;
  description?: string;
  materials?: string[];
  projectType?: string;
} | null) {
  const [recommendations, setRecommendations] = useState<ContextualRecommendations>({
    products: [],
    parts: [],
    inspirations: [],
    features: [],
    suggestedActions: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!designItem?.name) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await getDesignItemRecommendations(designItem);
        setRecommendations(results);
      } catch (error) {
        console.error('Design item recommendations error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [designItem?.name, designItem?.category, designItem?.projectType]);

  return { recommendations, isLoading };
}

/**
 * Hook specifically for strategy canvas context
 */
export function useStrategyRecommendations(strategyContext: {
  projectType?: string;
  style?: string;
  materials?: string[];
  budgetTier?: string;
  keywords?: string[];
} | null) {
  const [recommendations, setRecommendations] = useState<ContextualRecommendations>({
    products: [],
    parts: [],
    inspirations: [],
    features: [],
    suggestedActions: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!strategyContext) {
      return;
    }

    const hasContext = strategyContext.projectType || 
                       strategyContext.style || 
                       (strategyContext.keywords?.length ?? 0) > 0;
    
    if (!hasContext) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await getStrategyRecommendations(strategyContext);
        setRecommendations(results);
      } catch (error) {
        console.error('Strategy recommendations error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    strategyContext?.projectType,
    strategyContext?.style,
    strategyContext?.budgetTier,
    JSON.stringify(strategyContext?.keywords),
    JSON.stringify(strategyContext?.materials),
  ]);

  return { recommendations, isLoading };
}

/**
 * Hook specifically for parts list context
 */
export function usePartsRecommendations(partsContext: {
  itemName: string;
  category?: string;
  existingParts?: string[];
} | null) {
  const [recommendations, setRecommendations] = useState<ContextualRecommendations>({
    products: [],
    parts: [],
    inspirations: [],
    features: [],
    suggestedActions: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!partsContext?.itemName) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await getPartsRecommendations(partsContext);
        setRecommendations(results);
      } catch (error) {
        console.error('Parts recommendations error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [partsContext?.itemName, partsContext?.category]);

  return { recommendations, isLoading };
}
