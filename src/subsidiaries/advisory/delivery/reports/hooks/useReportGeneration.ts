/**
 * useReportGeneration Hook
 * React hook for report generation functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { getFirestore } from 'firebase/firestore';
import { getGoogleAccessToken } from '../../../../../core/services/firebase/auth';
import { useAuth } from '@/shared/hooks';
import {
  googleDocsService,
  TemplateManagerService,
  ReportDataAggregatorService,
  ReportGenerationService,
} from '../services';
import type {
  ReportTemplate,
  ReportType,
  ReportGenerationRequest,
  ReportGenerationResult,
  GeneratedReport,
  ReportHistoryOptions,
  ReportPeriod,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface UseReportGenerationOptions {
  orgId: string;
  projectId?: string;
}

export interface UseReportGenerationReturn {
  // State
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  lastGeneratedReport: GeneratedReport | null;

  // Templates
  templates: ReportTemplate[];
  loadTemplates: () => Promise<void>;
  getTemplatesByType: (type: ReportType) => ReportTemplate[];

  // Report generation
  generateReport: (
    request: ReportGenerationRequest,
    userName: string
  ) => Promise<ReportGenerationResult>;
  cancelGeneration: () => void;

  // Report history
  reportHistory: GeneratedReport[];
  loadReportHistory: (options?: ReportHistoryOptions) => Promise<void>;
  isLoadingHistory: boolean;

  // Report actions
  deleteReport: (reportId: string, deleteGoogleDoc?: boolean) => Promise<void>;
  updateReportStatus: (
    reportId: string,
    status: 'draft' | 'final'
  ) => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useReportGeneration(
  options: UseReportGenerationOptions
): UseReportGenerationReturn {
  const { orgId, projectId } = options;
  const { user } = useAuth();

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedReport, setLastGeneratedReport] =
    useState<GeneratedReport | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reportHistory, setReportHistory] = useState<GeneratedReport[]>([]);

  // Services (initialized lazily)
  const [services, setServices] = useState<{
    templateManager: TemplateManagerService;
    dataAggregator: ReportDataAggregatorService;
    reportGenerator: ReportGenerationService;
  } | null>(null);

  // Initialize services
  useEffect(() => {
    const db = getFirestore();
    const templateManager = TemplateManagerService.getInstance(db);
    const dataAggregator = ReportDataAggregatorService.getInstance(db);
    const reportGenerator = ReportGenerationService.getInstance(
      db,
      googleDocsService,
      templateManager,
      dataAggregator
    );

    setServices({ templateManager, dataAggregator, reportGenerator });
  }, []);

  // Load templates
  const loadTemplates = useCallback(async () => {
    if (!services) return;

    setIsLoading(true);
    setError(null);

    try {
      const loadedTemplates = await services.templateManager.getAllTemplates(
        orgId,
        true
      );
      setTemplates(loadedTemplates);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load templates'
      );
    } finally {
      setIsLoading(false);
    }
  }, [orgId, services]);

  // Get templates by type
  const getTemplatesByType = useCallback(
    (type: ReportType): ReportTemplate[] => {
      return templates.filter((t) => t.type === type);
    },
    [templates]
  );

  // Generate report
  const generateReport = useCallback(
    async (
      request: ReportGenerationRequest,
      userName: string
    ): Promise<ReportGenerationResult> => {
      if (!services) {
        return { success: false, error: 'Services not initialized' };
      }

      const accessToken = getGoogleAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: 'Google access token not available. Please sign in again.',
        };
      }

      setIsGenerating(true);
      setError(null);

      try {
        const result = await services.reportGenerator.generateReport(
          orgId,
          request,
          accessToken,
          user?.uid || 'unknown',
          userName
        );

        if (result.success && result.reportId) {
          // Fetch the generated report
          const report = await services.reportGenerator.getReport(
            orgId,
            result.reportId
          );
          setLastGeneratedReport(report);

          // Refresh history if projectId matches
          if (projectId && projectId === request.projectId) {
            await loadReportHistory();
          }
        } else {
          setError(result.error || 'Report generation failed');
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Report generation failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsGenerating(false);
      }
    },
    [orgId, projectId, services]
  );

  // Cancel generation (placeholder for future implementation)
  const cancelGeneration = useCallback(() => {
    // TODO: Implement cancellation logic if needed
    setIsGenerating(false);
  }, []);

  // Load report history
  const loadReportHistory = useCallback(
    async (historyOptions: ReportHistoryOptions = {}) => {
      if (!services || !projectId) return;

      setIsLoadingHistory(true);

      try {
        const history = await services.reportGenerator.getReportHistory(
          orgId,
          projectId,
          historyOptions
        );
        setReportHistory(history);
      } catch (err) {
        console.error('Failed to load report history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [orgId, projectId, services]
  );

  // Delete report
  const deleteReport = useCallback(
    async (reportId: string, deleteGoogleDoc: boolean = false) => {
      if (!services) return;

      const accessToken = deleteGoogleDoc ? getGoogleAccessToken() : undefined;

      try {
        await services.reportGenerator.deleteReport(
          orgId,
          reportId,
          deleteGoogleDoc,
          accessToken || undefined
        );

        // Refresh history
        if (projectId) {
          await loadReportHistory();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete report'
        );
        throw err;
      }
    },
    [orgId, projectId, services, loadReportHistory]
  );

  // Update report status
  const updateReportStatus = useCallback(
    async (reportId: string, status: 'draft' | 'final') => {
      if (!services) return;

      try {
        await services.reportGenerator.updateReportStatus(
          orgId,
          reportId,
          status
        );

        // Refresh history
        if (projectId) {
          await loadReportHistory();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update report status'
        );
        throw err;
      }
    },
    [orgId, projectId, services, loadReportHistory]
  );

  // Load templates on mount
  useEffect(() => {
    if (services) {
      loadTemplates();
    }
  }, [services, loadTemplates]);

  // Load history when projectId changes
  useEffect(() => {
    if (services && projectId) {
      loadReportHistory();
    }
  }, [services, projectId, loadReportHistory]);

  return {
    // State
    isGenerating,
    isLoading,
    error,
    lastGeneratedReport,

    // Templates
    templates,
    loadTemplates,
    getTemplatesByType,

    // Report generation
    generateReport,
    cancelGeneration,

    // Report history
    reportHistory,
    loadReportHistory,
    isLoadingHistory,

    // Report actions
    deleteReport,
    updateReportStatus,
  };
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Helper to create a report period
 */
export function createReportPeriod(
  type: 'monthly' | 'quarterly' | 'annual' | 'custom',
  date: Date = new Date()
): ReportPeriod {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  switch (type) {
    case 'monthly': {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      const periodLabel = startDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      return { type, startDate, endDate, periodLabel, year, month };
    }

    case 'quarterly': {
      const quarter = Math.ceil(month / 3);
      const startMonth = (quarter - 1) * 3;
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, startMonth + 3, 0);
      const periodLabel = `Q${quarter} ${year}`;
      return { type, startDate, endDate, periodLabel, year, quarter };
    }

    case 'annual': {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      const periodLabel = String(year);
      return { type, startDate, endDate, periodLabel, year };
    }

    case 'custom':
    default: {
      const startDate = new Date(date);
      const endDate = new Date(date);
      const periodLabel = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      return { type, startDate, endDate, periodLabel, year };
    }
  }
}

export default useReportGeneration;
