/**
 * useNLQuery Hook
 * Natural language query interface
 */

import { useState, useCallback } from 'react';
import { nlQueryService } from '../services/nl-query-service';
import { NLQueryResponse, ParsedNLQuery } from '../types/ai-extensions';
import { ModuleType } from '../../../subsidiaries/advisory/cross-module/types/cross-module';

interface UseNLQueryReturn {
  query: string;
  setQuery: (query: string) => void;
  parsedQuery: ParsedNLQuery | null;
  response: NLQueryResponse | null;
  isProcessing: boolean;
  error: Error | null;
  executeQuery: () => Promise<void>;
  clearResults: () => void;
  history: NLQueryResponse[];
  suggestions: string[];
}

export function useNLQuery(
  module: ModuleType,
  userId: string
): UseNLQueryReturn {
  const [query, setQuery] = useState('');
  const [parsedQuery, setParsedQuery] = useState<ParsedNLQuery | null>(null);
  const [response, setResponse] = useState<NLQueryResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [history, setHistory] = useState<NLQueryResponse[]>([]);

  // Get suggestions for this module
  const suggestions = nlQueryService.getQuerySuggestions(module);

  const executeQuery = useCallback(async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await nlQueryService.processQuery(query, module, userId);
      setParsedQuery(result.query);
      setResponse(result);
      setHistory(prev => [result, ...prev].slice(0, 20));
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsProcessing(false);
    }
  }, [query, module, userId]);

  const clearResults = useCallback(() => {
    setQuery('');
    setParsedQuery(null);
    setResponse(null);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    parsedQuery,
    response,
    isProcessing,
    error,
    executeQuery,
    clearResults,
    history,
    suggestions,
  };
}

/**
 * Hook for quick queries without full state management
 */
export function useQuickQuery(module: ModuleType, userId: string): {
  executeQuery: (query: string) => Promise<NLQueryResponse | null>;
  isProcessing: boolean;
} {
  const [isProcessing, setIsProcessing] = useState(false);

  const executeQuery = useCallback(async (query: string): Promise<NLQueryResponse | null> => {
    if (!query.trim()) return null;

    setIsProcessing(true);
    try {
      const result = await nlQueryService.processQuery(query, module, userId);
      return result;
    } catch (error) {
      console.error('Query error:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [module, userId]);

  return { executeQuery, isProcessing };
}
