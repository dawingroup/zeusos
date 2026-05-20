/**
 * Report Generator Panel Component
 * Main UI panel for generating reports
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Settings, Loader2 } from 'lucide-react';
import { useReportGeneration, createReportPeriod } from '../hooks';
import { ReportTemplateSelector } from './ReportTemplateSelector';
import { ReportPeriodSelector } from './ReportPeriodSelector';
import { ReportHistoryList } from './ReportHistoryList';
import type { ReportTemplate, ReportPeriod, ReportType } from '../types';

interface ReportGeneratorPanelProps {
  orgId: string;
  projectId: string;
  userName: string;
  filterByType?: ReportType;
  showHistory?: boolean;
  className?: string;
  onReportGenerated?: (reportUrl: string) => void;
}

export function ReportGeneratorPanel({
  orgId,
  projectId,
  userName,
  filterByType,
  showHistory = true,
  className = '',
  onReportGenerated,
}: ReportGeneratorPanelProps) {
  // Use the report generation hook
  const {
    isGenerating,
    isLoading,
    error,
    templates,
    reportHistory,
    isLoadingHistory,
    generateReport,
    deleteReport,
    updateReportStatus,
  } = useReportGeneration({ orgId, projectId });

  // Local state
  const [selectedTemplate, setSelectedTemplate] =
    useState<ReportTemplate | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod | null>(null);
  const [customData, setCustomData] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );

  // Handle template selection
  const handleTemplateSelect = useCallback(
    (template: ReportTemplate | null) => {
      setSelectedTemplate(template);
      // Reset period when template changes
      if (template) {
        const period = createReportPeriod(template.defaultPeriodType);
        setReportPeriod(period);
      } else {
        setReportPeriod(null);
      }
      // Reset custom data
      setCustomData({});
    },
    []
  );

  // Handle report generation
  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate || !reportPeriod) return;

    const result = await generateReport(
      {
        templateId: selectedTemplate.id,
        projectId,
        reportPeriod,
        customData: Object.keys(customData).length > 0 ? customData : undefined,
        saveToFolder: true,
      },
      userName
    );

    if (result.success && result.googleDocUrl) {
      // Open the generated report in a new tab
      window.open(result.googleDocUrl, '_blank');
      onReportGenerated?.(result.googleDocUrl);
    }
  }, [
    selectedTemplate,
    reportPeriod,
    projectId,
    customData,
    userName,
    generateReport,
    onReportGenerated,
  ]);

  // Handle opening a report
  const handleOpenReport = useCallback((report: { googleDocUrl: string }) => {
    if (report.googleDocUrl) {
      window.open(report.googleDocUrl, '_blank');
    }
  }, []);

  // Handle delete confirmation
  const handleDeleteReport = useCallback(
    async (reportId: string, deleteGoogleDoc: boolean = false) => {
      await deleteReport(reportId, deleteGoogleDoc);
      setShowDeleteConfirm(null);
    },
    [deleteReport]
  );

  // Check if form is valid
  const isFormValid = selectedTemplate && reportPeriod;

  return (
    <div
      className={`report-generator-panel bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Generate Report</h2>
        <p className="text-sm text-gray-500">
          Create Google Docs reports with auto-populated project data
        </p>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-gray-600">Loading templates...</span>
          </div>
        )}

        {/* No templates message */}
        {!isLoading && templates.length === 0 && (
          <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Report Templates Available
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You need to set up report templates before generating reports.
            </p>
            <Link
              to="/advisory/delivery/templates"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Settings className="w-4 h-4" />
              Set Up Templates
            </Link>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Template selector - only show if templates exist */}
        {!isLoading && templates.length > 0 && (
          <ReportTemplateSelector
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelect={handleTemplateSelect}
            filterByType={filterByType}
            disabled={isGenerating || isLoading}
          />
        )}

        {/* Period selector - only show if template selected */}
        {!isLoading && templates.length > 0 && selectedTemplate && (
          <ReportPeriodSelector
            periodType={selectedTemplate.defaultPeriodType}
            value={reportPeriod}
            onChange={setReportPeriod}
            disabled={isGenerating}
          />
        )}

        {/* Custom data inputs (for activity completion) */}
        {!isLoading && templates.length > 0 && selectedTemplate?.type === 'activity_completion' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Activity Details
            </label>
            <input
              type="text"
              placeholder="Activity Name"
              value={customData.activityName || ''}
              onChange={(e) =>
                setCustomData((prev) => ({
                  ...prev,
                  activityName: e.target.value,
                }))
              }
              disabled={isGenerating}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            />
            <input
              type="text"
              placeholder="Activity Stage (e.g., Substructure, Superstructure)"
              value={customData.activityStage || ''}
              onChange={(e) =>
                setCustomData((prev) => ({
                  ...prev,
                  activityStage: e.target.value,
                }))
              }
              disabled={isGenerating}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            />
          </div>
        )}

        {/* Generate button - only show if templates exist */}
        {!isLoading && templates.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={!isFormValid || isGenerating}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
          {isGenerating ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Generating Report...
            </>
          ) : (
            <>
              <svg
                className="-ml-1 mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate Report
            </>
          )}
          </button>
        )}
      </div>

      {/* Report History */}
      {showHistory && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200">
          <ReportHistoryList
            reports={reportHistory}
            isLoading={isLoadingHistory}
            onOpen={handleOpenReport}
            onDelete={(report) => setShowDeleteConfirm(report.id)}
            onStatusChange={(report, status) =>
              updateReportStatus(report.id, status)
            }
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900">Delete Report</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete this report? This action cannot be
              undone.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => handleDeleteReport(showDeleteConfirm, true)}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete Report & Google Doc
              </button>
              <button
                onClick={() => handleDeleteReport(showDeleteConfirm, false)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Delete Record Only (Keep Doc)
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="w-full px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportGeneratorPanel;
