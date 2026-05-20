// ============================================================================
// USE FULL ASSESSMENT CYCLE HOOK - Strategy Plan Update Tool
// React hook for running full section assessment cycles
// ============================================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runFullCycle } from '../services/strategyAssessment.service';
import type { SectionType, AssessmentCycleResult } from '../types/documentSection.types';

export function useFullAssessmentCycle(companyId: string, reviewId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const cycleMutation = useMutation({
    mutationFn: (options?: {
      rewriteThreshold?: number;
      autoApplyRewrites?: boolean;
      sectionIds?: string[];
      skipTypes?: SectionType[];
    }) =>
      runFullCycle(companyId, reviewId, {
        ...options,
        onProgress: (current, total) => setProgress({ current, total }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['document-sections', companyId, reviewId],
      });
      queryClient.invalidateQueries({
        queryKey: ['section-audit-log', companyId, reviewId],
      });
    },
  });

  return {
    cycleResult: cycleMutation.data as AssessmentCycleResult | undefined,
    isRunning: cycleMutation.isPending,
    runCycle: cycleMutation.mutateAsync,
    progress,
  };
}
