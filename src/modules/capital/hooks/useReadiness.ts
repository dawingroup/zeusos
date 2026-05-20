import { useState, useEffect, useCallback } from 'react';
import type { ReadinessAssessment, ChecklistItem } from '../types/capital.types';
import { readinessService } from '../services/readinessService';

export function useReadiness(companyId: string) {
  const [assessment, setAssessment] = useState<ReadinessAssessment | null>(null);
  const [history, setHistory] = useState<ReadinessAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [latest, hist] = await Promise.all([
        readinessService.getLatestAssessment(companyId),
        readinessService.getAssessmentHistory(companyId, 5),
      ]);
      setAssessment(latest);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load readiness data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generateAssessment = useCallback(async () => {
    setLoading(true);
    try {
      const newAssessment = await readinessService.generateAssessment(companyId);
      setAssessment(newAssessment);
      setHistory(prev => [newAssessment, ...prev]);
      return newAssessment;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const updateChecklistItem = useCallback(
    async (
      section: 'documentReadiness' | 'complianceStatus',
      itemId: string,
      updates: Partial<ChecklistItem>,
    ) => {
      if (!assessment) return;
      await readinessService.updateChecklistItem(
        companyId,
        assessment.id,
        section,
        itemId,
        updates,
      );
      await refresh();
    },
    [companyId, assessment, refresh],
  );

  return {
    assessment,
    history,
    loading,
    error,
    refresh,
    generateAssessment,
    updateChecklistItem,
  };
}
