/**
 * Export and Reporting Hooks
 * React hooks for report generation and data export
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateReport,
  getProjectReports,
  deleteReport,
  incrementDownloadCount,
  saveReportTemplate,
  getReportTemplates,
  deleteReportTemplate,
  quickExportData,
} from '../services/exportService';
import {
  ReportConfig,
  ReportRecord,
  ReportTemplate,
  ReportType,
  ExportFormat,
  DataExportConfig,
} from '../types/export';
import { useAuth } from '@/shared/hooks/useAuth';

// Simple toast helper
const showToast = (title: string, description: string, variant?: 'default' | 'destructive') => {
  if (variant === 'destructive') {
    console.error(`[Toast] ${title}: ${description}`);
  } else {
    console.log(`[Toast] ${title}: ${description}`);
  }
};

/**
 * Main export hook
 */
export function useExport(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Get all reports for project
  const {
    data: reports = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reports', projectId],
    queryFn: () => getProjectReports(projectId),
    enabled: !!projectId,
  });
  
  // Generate report mutation
  const generateMutation = useMutation({
    mutationFn: async (config: ReportConfig) => {
      if (!user?.uid) throw new Error('Not authenticated');
      return generateReport(config, user.uid);
    },
    onSuccess: (report: ReportRecord) => {
      queryClient.invalidateQueries({ queryKey: ['reports', projectId] });
      
      if (report.status === 'ready') {
        showToast('Report Ready', `${report.config.title} has been generated`);
      }
    },
    onError: (error: Error) => {
      showToast('Report Generation Failed', error.message, 'destructive');
    },
  });
  
  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return deleteReport(projectId, reportId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports', projectId] });
      showToast('Report Deleted', 'The report has been removed');
    },
  });
  
  // Download handler
  const handleDownload = useCallback(async (report: ReportRecord) => {
    if (!report.downloadUrl) {
      showToast(
        'Download Not Available',
        'Report file is not ready or has expired',
        'destructive'
      );
      return;
    }
    
    // Increment count
    await incrementDownloadCount(projectId, report.id);
    
    // Open download URL
    window.open(report.downloadUrl, '_blank');
  }, [projectId]);
  
  return {
    reports,
    isLoading,
    error,
    refetch,
    generateReport: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    deleteReport: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    downloadReport: handleDownload,
  };
}

/**
 * Hook for report templates
 */
export function useReportTemplates() {
  const queryClient = useQueryClient();
  
  const {
    data: templates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['report-templates'],
    queryFn: getReportTemplates,
  });
  
  const saveMutation = useMutation({
    mutationFn: async (template: Omit<ReportTemplate, 'id' | 'createdAt'>) => {
      return saveReportTemplate(template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      showToast('Template Saved', 'Report template has been saved');
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: deleteReportTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      showToast('Template Deleted', 'Report template has been removed');
    },
  });
  
  return {
    templates,
    isLoading,
    error,
    saveTemplate: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    deleteTemplate: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook for quick data export
 */
export function useQuickExport() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  
  const exportData = useCallback(async (config: DataExportConfig) => {
    if (!user?.uid) {
      showToast(
        'Not Authenticated',
        'Please log in to export data',
        'destructive'
      );
      return;
    }
    
    setIsExporting(true);
    
    try {
      const { blob, fileName } = await quickExportData(config, user.uid);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('Export Complete', `Downloaded ${fileName}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      showToast('Export Failed', errorMessage, 'destructive');
    } finally {
      setIsExporting(false);
    }
  }, [user]);
  
  return {
    exportData,
    isExporting,
  };
}

/**
 * Hook for report configuration builder
 */
export function useReportConfigBuilder(
  initialType: ReportType = 'project_overview'
) {
  const [config, setConfig] = useState<Partial<ReportConfig>>({
    type: initialType,
    includeSummary: true,
    includeDetails: true,
    includeCharts: false,
    includeAppendix: false,
    format: 'pdf',
    paperSize: 'a4',
    orientation: 'portrait',
  });
  
  const updateConfig = useCallback((updates: Partial<ReportConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);
  
  const setType = useCallback((type: ReportType) => {
    setConfig(prev => ({
      ...prev,
      type,
      title: getDefaultTitle(type),
    }));
  }, []);
  
  const setFormat = useCallback((format: ExportFormat) => {
    setConfig(prev => ({
      ...prev,
      format,
      // Adjust orientation for Excel
      orientation: format === 'xlsx' ? 'landscape' : prev.orientation,
    }));
  }, []);
  
  const setDateRange = useCallback((startDate: string, endDate: string) => {
    setConfig(prev => ({
      ...prev,
      dateRange: { startDate, endDate },
    }));
  }, []);
  
  const applyTemplate = useCallback((template: ReportTemplate) => {
    setConfig(prev => ({
      ...prev,
      ...template.config,
      type: template.type,
    }));
  }, []);
  
  const reset = useCallback(() => {
    setConfig({
      type: initialType,
      includeSummary: true,
      includeDetails: true,
      includeCharts: false,
      includeAppendix: false,
      format: 'pdf',
      paperSize: 'a4',
      orientation: 'portrait',
    });
  }, [initialType]);
  
  const isValid = Boolean(
    config.type &&
    config.projectId &&
    config.title &&
    config.format
  );
  
  return {
    config,
    updateConfig,
    setType,
    setFormat,
    setDateRange,
    applyTemplate,
    reset,
    isValid,
  };
}

/**
 * Get default title for report type
 */
function getDefaultTitle(type: ReportType): string {
  const titles: Record<ReportType, string> = {
    boq_summary: 'Bill of Quantities Summary',
    material_requirements: 'Material Requirements Report',
    procurement_log: 'Procurement Log Report',
    variance_analysis: 'Variance Analysis Report',
    stage_progress: 'Stage Progress Report',
    tax_compliance: 'Tax Compliance Report',
    project_overview: 'Project Overview Report',
    delivery_summary: 'Delivery Summary Report',
    cost_breakdown: 'Cost Breakdown Report',
    custom: 'Custom Report',
  };
  return titles[type] || 'Report';
}

export { getDefaultTitle };
