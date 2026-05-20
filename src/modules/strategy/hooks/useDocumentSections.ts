// ============================================================================
// USE DOCUMENT SECTIONS HOOK - Strategy Plan Update Tool
// React hook for managing document sections with TanStack Query
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSections,
  parseAndStoreSections,
} from '../services/strategyDocumentSection.service';
import type { DocumentSection } from '../types/documentSection.types';

export function useDocumentSections(companyId: string, reviewId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['document-sections', companyId, reviewId];

  const sectionsQuery = useQuery<DocumentSection[]>({
    queryKey,
    queryFn: () => getSections(companyId, reviewId),
    enabled: !!companyId && !!reviewId,
  });

  const parseMutation = useMutation({
    mutationFn: (params: { documentText: string; googleDocId?: string }) =>
      parseAndStoreSections(companyId, reviewId, params.documentText, params.googleDocId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    sections: sectionsQuery.data ?? [],
    isLoading: sectionsQuery.isLoading,
    error: sectionsQuery.error,
    parseDocument: parseMutation.mutateAsync,
    isParsing: parseMutation.isPending,
    refreshSections: () => queryClient.invalidateQueries({ queryKey }),
  };
}
