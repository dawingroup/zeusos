/**
 * useAMHReport Hook
 *
 * React hook for AMH report generation — client-side preview and
 * server-side PDF generation via Cloud Function.
 */

import { useState, useCallback, useEffect } from 'react';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AMHReportService } from '../services/amh-report-service';
import type { ReportPeriod } from '../reports/types/report.types';
import type {
  AMHReport,
  AMHReportSections,
  AMHSectionKey,
} from '../types/amh-report.types';

export interface UseAMHReportReturn {
  generatePreview: (
    projectIds: string[],
    period: ReportPeriod,
    sections?: AMHSectionKey[]
  ) => Promise<AMHReportSections>;
  generateReport: (
    projectIds: string[],
    period: ReportPeriod,
    sections: AMHSectionKey[],
    format: 'pdf' | 'docx'
  ) => Promise<{ reportId: string; pdfUrl: string }>;
  previewData: AMHReportSections | null;
  reports: AMHReport[];
  isGenerating: boolean;
  isLoading: boolean;
  error: Error | null;
  loadReports: () => Promise<void>;
}

export function useAMHReport(orgId: string, userId: string): UseAMHReportReturn {
  const [previewData, setPreviewData] = useState<AMHReportSections | null>(null);
  const [reports, setReports] = useState<AMHReport[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const db = getFirestore();
  const service = AMHReportService.getInstance(db);

  // Load past reports on mount
  const loadReports = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const result = await service.listReports(orgId);
      setReports(result);
    } catch (err) {
      console.error('Failed to load AMH reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, service]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Generate client-side preview
  const generatePreview = useCallback(
    async (
      projectIds: string[],
      period: ReportPeriod,
      sections?: AMHSectionKey[]
    ): Promise<AMHReportSections> => {
      setIsGenerating(true);
      setError(null);
      try {
        const data = await service.generateFullReport(
          orgId,
          projectIds,
          period,
          userId,
          sections
        );
        setPreviewData(data);
        return data;
      } catch (err) {
        const reportError = err instanceof Error ? err : new Error('Preview generation failed');
        setError(reportError);
        throw reportError;
      } finally {
        setIsGenerating(false);
      }
    },
    [orgId, userId, service]
  );

  // Generate server-side report (Cloud Function)
  const generateReport = useCallback(
    async (
      projectIds: string[],
      period: ReportPeriod,
      sections: AMHSectionKey[],
      format: 'pdf' | 'docx'
    ): Promise<{ reportId: string; pdfUrl: string }> => {
      setIsGenerating(true);
      setError(null);
      try {
        const functions = getFunctions();
        const generateAMHReport = httpsCallable<
          {
            organizationId: string;
            projectIds: string[];
            period: { startDate: string; endDate: string; label: string };
            sections: string[];
            outputFormat: string;
          },
          { reportId: string; pdfUrl: string }
        >(functions, 'generateAMHReport');

        const result = await generateAMHReport({
          organizationId: orgId,
          projectIds,
          period: {
            startDate: period.startDate.toISOString(),
            endDate: period.endDate.toISOString(),
            label: period.periodLabel,
          },
          sections,
          outputFormat: format,
        });

        // Refresh reports list
        await loadReports();

        return result.data;
      } catch (err) {
        const reportError = err instanceof Error ? err : new Error('Report generation failed');
        setError(reportError);
        throw reportError;
      } finally {
        setIsGenerating(false);
      }
    },
    [orgId, loadReports]
  );

  return {
    generatePreview,
    generateReport,
    previewData,
    reports,
    isGenerating,
    isLoading,
    error,
    loadReports,
  };
}
