// ============================================================================
// USE SECTION ASSESSMENT HOOK - Strategy Plan Update Tool
// React hook for section assessment and rewrite generation
// ============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assessSection,
  generateRewrite,
} from '../services/strategyAssessment.service';
import type { SectionAssessment } from '../types/documentSection.types';

export function useSectionAssessment(companyId: string, reviewId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['document-sections', companyId, reviewId];

  const assessMutation = useMutation({
    mutationFn: (params: { sectionId: string; dataPackage?: Record<string, unknown> }) =>
      assessSection(companyId, reviewId, params.sectionId, params.dataPackage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const rewriteMutation = useMutation({
    mutationFn: (params: { sectionId: string; assessment: SectionAssessment }) =>
      generateRewrite(companyId, reviewId, params.sectionId, params.assessment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    assessment: assessMutation.data ?? null,
    isAssessing: assessMutation.isPending,
    assessSection: assessMutation.mutateAsync,
    rewriteText: rewriteMutation.data ?? null,
    isRewriting: rewriteMutation.isPending,
    generateRewrite: rewriteMutation.mutateAsync,
  };
}
