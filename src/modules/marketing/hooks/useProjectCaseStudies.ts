/**
 * useProjectCaseStudies Hook
 * Subscribe to the case studies list for a subsidiary with real-time updates.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ProjectCaseStudy, CaseStudyFilters } from '../types';
import { subscribeCaseStudies } from '../services/projectCaseStudyService';

export interface UseProjectCaseStudiesResult {
  caseStudies: ProjectCaseStudy[];
  loading: boolean;
  error: Error | null;
}

export function useProjectCaseStudies(
  subsidiaryId: string | undefined,
  filters: CaseStudyFilters = {}
): UseProjectCaseStudiesResult {
  const [items, setItems] = useState<ProjectCaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!subsidiaryId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeCaseStudies(subsidiaryId, (data) => {
      setItems(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [subsidiaryId]);

  const caseStudies = useMemo(() => {
    let result = items;
    if (filters.status) result = result.filter((cs) => cs.status === filters.status);
    if (filters.category) result = result.filter((cs) => cs.category === filters.category);
    if (filters.authorId) result = result.filter((cs) => cs.authorId === filters.authorId);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (cs) =>
          cs.hero.title.toLowerCase().includes(q) ||
          (cs.hero.client || '').toLowerCase().includes(q) ||
          (cs.hero.location || '').toLowerCase().includes(q) ||
          cs.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [items, filters.status, filters.category, filters.authorId, filters.search]);

  return { caseStudies, loading, error };
}
