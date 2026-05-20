import { useCallback, useEffect, useRef } from 'react';
import type { SearchQuery, SearchResponse, SearchScope } from '@/core/services/searchService';
import {
  globalSearch,
  saveRecentSearch,
  getRecentSearches,
  getSearchSuggestions,
} from '@/core/services/searchService';
import { useSearch as useGlobalSearchState } from '@/integration/store';

export interface UseSearchOptions {
  organizationId: string;
  subsidiaryId?: string;
  debounceMs?: number;
}

export function useGlobalSearch({ organizationId, subsidiaryId, debounceMs = 250 }: UseSearchOptions) {
  const {
    isOpen,
    query,
    results,
    isLoading,
    openSearch,
    closeSearch,
    setQuery,
    setResults,
    setLoading,
    addRecentSearch,
  } = useGlobalSearchState();

  const lastRunRef = useRef(0);

  const runSearch = useCallback(
    async (q: SearchQuery): Promise<SearchResponse> => {
      setLoading(true);
      try {
        const scope: SearchScope = { organizationId, subsidiaryId };
        const response = await globalSearch(scope, q);
        setResults(response.results);
        return response;
      } finally {
        setLoading(false);
      }
    },
    [organizationId, subsidiaryId, setLoading, setResults]
  );

  useEffect(() => {
    if (!isOpen) return;

    const text = query.trim();
    if (!text) {
      setResults([]);
      return;
    }

    const runId = window.setTimeout(async () => {
      lastRunRef.current = Date.now();
      try {
        await runSearch({ text });
      } catch (e) {
        console.error('[useGlobalSearch] search error', e);
      }
    }, debounceMs);

    return () => window.clearTimeout(runId);
  }, [debounceMs, isOpen, query, runSearch, setResults]);

  const commitSearch = useCallback(() => {
    const text = query.trim();
    if (!text) return;
    saveRecentSearch(text);
    addRecentSearch(text);
  }, [addRecentSearch, query]);

  return {
    isOpen,
    query,
    results,
    isLoading,
    openSearch,
    closeSearch,
    setQuery,
    commitSearch,
    runSearch,
    getRecentSearches,
    getSearchSuggestions: (partialText: string, maxSuggestions?: number) =>
      getSearchSuggestions(organizationId, partialText, maxSuggestions),
  };
}

export { useGlobalSearch as default };
