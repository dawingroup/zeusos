import { useState, useCallback, useEffect, useRef } from 'react';
import {
  UnifiedSearchQuery,
  UnifiedSearchResponse,
  EntityReference,
  ModuleType,
  LinkableEntityType
} from '../types/cross-module';
import { unifiedSearchService } from '../services/unified-search';

export function useUnifiedSearch(userId: string) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnifiedSearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<EntityReference[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<{
    modules?: ModuleType[];
    entityTypes?: LinkableEntityType[];
    dateRange?: { start: Date; end: Date };
  }>({});

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchRecent = async () => {
      const recent = await unifiedSearchService.getRecentSearches(userId);
      setRecentSearches(recent);
    };
    fetchRecent();
  }, [userId]);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length >= 2) {
      debounceTimer.current = setTimeout(async () => {
        const fetchedSuggestions = await unifiedSearchService.getSuggestions(
          query,
          filters.modules
        );
        setSuggestions(fetchedSuggestions);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, filters.modules]);

  const search = useCallback(
    async (searchQuery?: string) => {
      const q = searchQuery || query;
      if (!q.trim()) return;

      try {
        setLoading(true);
        setError(null);

        const searchParams: UnifiedSearchQuery = {
          query: q,
          modules: filters.modules,
          entityTypes: filters.entityTypes,
          dateRange: filters.dateRange
        };

        const response = await unifiedSearchService.search(searchParams, userId);
        setResults(response);

        setRecentSearches(prev => {
          const updated = [q, ...prev.filter(s => s !== q)].slice(0, 10);
          return updated;
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Search failed'));
      } finally {
        setLoading(false);
      }
    },
    [query, filters, userId]
  );

  const clearResults = useCallback(() => {
    setResults(null);
    setSuggestions([]);
    setQuery('');
  }, []);

  const updateFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      setFilters(prev => ({ ...prev, ...newFilters }));
    },
    []
  );

  return {
    query,
    setQuery,
    results,
    suggestions,
    recentSearches,
    loading,
    error,
    filters,
    updateFilters,
    search,
    clearResults
  };
}
