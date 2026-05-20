/**
 * useFinishSearch Hook
 * Client-side debounced search across finish library.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FinishDocument, FinishCategory } from '../types';
import { searchFinishes } from '../services/finishLibraryService';

interface UseFinishSearchOptions {
  organizationId?: string;
  category?: FinishCategory;
  debounceMs?: number;
}

interface UseFinishSearchResult {
  results: FinishDocument[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clear: () => void;
}

export function useFinishSearch(options?: UseFinishSearchOptions): UseFinishSearchResult {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<FinishDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const debounceMs = options?.debounceMs ?? 300;

  const clear = useCallback(() => {
    setSearchTerm('');
    setResults([]);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchFinishes(searchTerm, {
          organizationId: options?.organizationId,
          category: options?.category,
        });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchTerm, options?.organizationId, options?.category, debounceMs]);

  return { results, loading, searchTerm, setSearchTerm, clear };
}
