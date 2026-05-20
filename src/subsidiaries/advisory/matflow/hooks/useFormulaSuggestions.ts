/**
 * Formula Suggestions Hooks
 * React hooks for formula suggestion functionality
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  suggestFormulas,
  suggestFormulasQuick,
  recordFormulaSelection,
  autoAssignFormulas,
} from '../services/formulaSuggestionService';
import type { FormulaSuggestion, MatchOptions } from '../ai/matchers';
import type { BOQItem } from '../types';

/**
 * Simple debounce hook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for real-time formula suggestions as user types
 */
export function useFormulaSuggestions(
  description: string,
  unit: string,
  options?: {
    debounceMs?: number;
    minLength?: number;
    quickMode?: boolean;
    maxSuggestions?: number;
  }
) {
  const {
    debounceMs = 300,
    minLength = 5,
    quickMode = true,
    maxSuggestions = 5,
  } = options || {};

  const [suggestions, setSuggestions] = useState<FormulaSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Debounce the description to avoid too many API calls
  const debouncedDescription = useDebounce(description, debounceMs);

  // Track if component is mounted
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!debouncedDescription || debouncedDescription.length < minLength) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const results = quickMode
          ? await suggestFormulasQuick(debouncedDescription, unit, maxSuggestions)
          : await suggestFormulas(debouncedDescription, unit, { maxSuggestions });
        
        if (mountedRef.current) {
          setSuggestions(results);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
          setSuggestions([]);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchSuggestions();
  }, [debouncedDescription, unit, quickMode, maxSuggestions, minLength]);

  // Record when user selects a suggestion
  const selectSuggestion = useCallback(
    async (suggestion: FormulaSuggestion) => {
      await recordFormulaSelection(
        suggestion.formulaCode,
        description,
        suggestion.source !== 'keyword',
        suggestion.confidence
      );
      return suggestion.formulaCode;
    },
    [description]
  );

  return {
    suggestions,
    loading,
    error,
    selectSuggestion,
    hasSuggestions: suggestions.length > 0,
    topSuggestion: suggestions[0] || null,
  };
}

/**
 * Hook for full AI-powered suggestions (slower, more accurate)
 */
export function useAISuggestions(
  description: string,
  unit: string,
  options?: MatchOptions
) {
  const [suggestions, setSuggestions] = useState<FormulaSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!description || description.length < 5) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await suggestFormulas(description, unit, {
        ...options,
        enableSemantic: true,
      });
      setSuggestions(results);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [description, unit, options]);

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
  };
}

/**
 * Hook for auto-assigning formulas to BOQ items
 */
export function useAutoAssignFormulas() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    assigned: Array<{ itemId: string; formulaCode: string; confidence: number }>;
    unassigned: Array<{ itemId: string; reason: string }>;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const autoAssign = useCallback(async (
    items: BOQItem[],
    confidenceThreshold: number = 0.85
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await autoAssignFormulas(items, confidenceThreshold);
      setResults(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    autoAssign,
    results,
    loading,
    error,
    assignedCount: results?.assigned.length || 0,
    unassignedCount: results?.unassigned.length || 0,
  };
}
