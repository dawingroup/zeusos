/**
 * useTemplates Hook
 * Subscribe to content templates with real-time updates
 */

import { useState, useEffect } from 'react';
import type { ContentTemplate, TemplateFilters } from '../types';
import { subscribeToTemplates } from '../services/templateService';

export interface UseTemplatesResult {
  templates: ContentTemplate[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to templates list for a company
 */
export function useTemplates(
  companyId: string | undefined,
  filters: TemplateFilters = {}
): UseTemplatesResult {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToTemplates(
      companyId,
      (data) => {
        setTemplates(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      filters
    );

    return () => {
      unsubscribe();
    };
  }, [companyId, JSON.stringify(filters)]);

  return { templates, loading, error };
}
