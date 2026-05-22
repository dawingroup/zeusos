/**
 * useSuggestions Hook
 * Manage AI suggestions for entities
 */

import { useState, useEffect, useCallback } from 'react';
import { suggestionService } from '../services/suggestion-service';
import { AISuggestion, SuggestionContext, LinkableEntityType, ModuleType } from '../types/ai-extensions';

interface UseSuggestionsOptions {
  module: ModuleType;
  entityType: LinkableEntityType;
  entityId: string;
  autoGenerate?: boolean;
}

interface UseSuggestionsReturn {
  suggestions: AISuggestion[];
  isLoading: boolean;
  error: Error | null;
  generateSuggestions: (context: SuggestionContext) => Promise<void>;
  dismissSuggestion: (id: string, feedback?: 'not_helpful' | 'incorrect') => Promise<void>;
  applySuggestion: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSuggestions(
  userId: string,
  options: UseSuggestionsOptions
): UseSuggestionsReturn {
  const { module, entityId } = options;

  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to suggestions
  useEffect(() => {
    const unsubscribe = suggestionService.subscribeSuggestions(
      userId,
      module,
      setSuggestions
    );
    return unsubscribe;
  }, [userId, module]);

  // Generate suggestions
  const generateSuggestions = useCallback(async (context: SuggestionContext) => {
    setIsLoading(true);
    setError(null);
    try {
      const newSuggestions = await suggestionService.generateSuggestions(context);
      setSuggestions(prev => [...newSuggestions, ...prev]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Dismiss suggestion
  const dismissSuggestion = useCallback(async (
    id: string,
    feedback?: 'not_helpful' | 'incorrect'
  ) => {
    await suggestionService.dismissSuggestion(id, feedback);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  // Apply suggestion
  const applySuggestion = useCallback(async (id: string) => {
    await suggestionService.applySuggestion(id);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  // Refresh suggestions
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await suggestionService.getSuggestions(userId, module, entityId);
      setSuggestions(fetched);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, module, entityId]);

  return {
    suggestions,
    isLoading,
    error,
    generateSuggestions,
    dismissSuggestion,
    applySuggestion,
    refresh,
  };
}

/**
 * Hook to get suggestions for a specific entity
 */
export function useEntitySuggestions(
  userId: string,
  module: ModuleType,
  _entityType: LinkableEntityType,
  entityId: string
): {
  suggestions: AISuggestion[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const fetched = await suggestionService.getSuggestions(userId, module, entityId);
        setSuggestions(fetched);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [userId, module, entityId]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await suggestionService.getSuggestions(userId, module, entityId);
      setSuggestions(fetched);
    } catch (error) {
      console.error('Error refreshing suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, module, entityId]);

  return { suggestions, isLoading, refresh };
}
