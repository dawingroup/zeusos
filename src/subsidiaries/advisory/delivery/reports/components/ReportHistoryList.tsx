/**
 * Report History List Component
 * Displays list of generated reports with actions
 */

import { format } from 'date-fns';
import type { GeneratedReport } from '../types';

interface ReportHistoryListProps {
  reports: GeneratedReport[];
  isLoading?: boolean;
  onOpen: (report: GeneratedReport) => void;
  onDelete: (report: GeneratedReport) => void;
  onStatusChange?: (report: GeneratedReport, status: 'draft' | 'final') => void;
  className?: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  generating: {
    label: 'Generating...',
    className: 'bg-yellow-100 text-yellow-800',
  },
  draft: {
    label: 'Draft',
    className: 'bg-blue-100 text-blue-800',
  },
  final: {
    label: 'Final',
    className: 'bg-green-100 text-green-800',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-800',
  },
};

export function ReportHistoryList({
  reports,
  isLoading = false,
  onOpen,
  onDelete,
  onStatusChange,
  className = '',
}: ReportHistoryListProps) {
  if (isLoading) {
    return (
      <div className={`report-history-list ${className}`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded-md"
            />
          ))}
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className={`report-history-list ${className}`}>
        <div className="text-center py-8 text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <p className="mt-2 text-sm">No reports generated yet</p>
          <p className="text-xs text-gray-400">
            Generate a report using the form above
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`report-history-list ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Generated Reports ({reports.length})
      </h3>
      <div className="space-y-2">
        {reports.map((report) => (
          <ReportHistoryItem
            key={report.id}
            report={report}
            onOpen={() => onOpen(report)}
            onDelete={() => onDelete(report)}
            onStatusChange={
              onStatusChange
                ? (status) => onStatusChange(report, status)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

interface ReportHistoryItemProps {
  report: GeneratedReport;
  onOpen: () => void;
  onDelete: () => void;
  onStatusChange?: (status: 'draft' | 'final') => void;
}

function ReportHistoryItem({
  report,
  onOpen,
  onDelete,
  onStatusChange,
}: ReportHistoryItemProps) {
  const statusBadge = STATUS_BADGES[report.status] || STATUS_BADGES.draft;
  const generatedDate = report.generatedAt?.toDate?.()
    ? format(report.generatedAt.toDate(), 'MMM d, yyyy h:mm a')
    : 'Unknown date';

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {report.templateName}
          </h4>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {report.reportPeriod.periodLabel}
          </span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">{generatedDate}</span>
          {report.generatedByName && (
            <>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">
                by {report.generatedByName}
              </span>
            </>
          )}
        </div>
        {report.errorMessage && (
          <p className="mt-1 text-xs text-red-600 truncate">
            Error: {report.errorMessage}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 ml-4">
        {/* Status toggle */}
        {onStatusChange && report.status !== 'error' && report.status !== 'generating' && (
          <button
            onClick={() =>
              onStatusChange(report.status === 'draft' ? 'final' : 'draft')
            }
            className="text-xs text-gray-500 hover:text-gray-700"
            title={
              report.status === 'draft'
                ? 'Mark as final'
                : 'Mark as draft'
            }
          >
            {report.status === 'draft' ? 'Finalize' : 'Revert'}
          </button>
        )}

        {/* Open button */}
        {report.googleDocUrl && report.status !== 'error' && (
          <button
            onClick={onOpen}
            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg
              className="w-3.5 h-3.5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
          title="Delete report"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ReportHistoryList;
