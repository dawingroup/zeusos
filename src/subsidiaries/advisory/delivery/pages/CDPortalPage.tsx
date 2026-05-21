/**
 * CDPortalPage - Country Director Portal
 *
 * A public-facing portal for Country Directors to view curated accountability
 * information. Accessed via token-based URL without authentication.
 *
 * Designed as a standalone full-page experience without backend navigation,
 * similar to the client portal used in Zeus Group.
 *
 * URL format: /advisory/delivery/cd-portal?token=<access_token>
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PortalFilterBar, PortalFilters, PortalSort } from '../components/cd-portal/PortalFilterBar';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Download,
  ExternalLink,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  FileImage,
  Receipt,
  Mail,
  Phone,
  BarChart3,
  MinusCircle,
  Eye,
  Paperclip,
  FolderOpen,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import { getCDPortalService } from '../services/cd-portal.service';
import { PdfViewerModal } from '@/shared/components/PdfViewerModal';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  PortalSession,
  PortalRequisitionDetail,
  PortalAccountabilityEntry,
  CountryDirectorSummary,
  ComplianceAlert,
  ComplianceScore,
  getAlertSeverityStyles,
  getAlertTypeLabel,
} from '../types/country-director-dashboard';
import { AccountabilityStatus } from '../types/requisition';
import { VarianceStatus, VARIANCE_STATUS_CONFIG } from '../types/accountability';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusConfig(status: AccountabilityStatus) {
  const config: Record<AccountabilityStatus, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: 'Pending', color: 'text-amber-600 bg-amber-100', icon: Clock },
    partial: { label: 'Partial', color: 'text-blue-600 bg-blue-100', icon: AlertTriangle },
    complete: { label: 'Complete', color: 'text-green-600 bg-green-100', icon: CheckCircle },
    overdue: { label: 'Overdue', color: 'text-red-600 bg-red-100', icon: XCircle },
    not_required: { label: 'Not Required', color: 'text-gray-600 bg-gray-100', icon: MinusCircle },
  };
  return config[status];
}

/**
 * Groups requisitions by year and sorts them in descending order within each year.
 * Years are also sorted in descending order (most recent first).
 */
function groupRequisitionsByYear(requisitions: PortalRequisitionDetail[]): Map<number, PortalRequisitionDetail[]> {
  const grouped = new Map<number, PortalRequisitionDetail[]>();

  // Group by year
  requisitions.forEach((req) => {
    const year = req.requisitionDate.getFullYear();
    if (!grouped.has(year)) {
      grouped.set(year, []);
    }
    grouped.get(year)!.push(req);
  });

  // Sort requisitions within each year (descending by date)
  grouped.forEach((reqs, year) => {
    reqs.sort((a, b) => b.requisitionDate.getTime() - a.requisitionDate.getTime());
    grouped.set(year, reqs);
  });

  // Return a new map with years sorted in descending order
  const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
  const sortedMap = new Map<number, PortalRequisitionDetail[]>();
  sortedYears.forEach((year) => {
    sortedMap.set(year, grouped.get(year)!);
  });

  return sortedMap;
}

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

function ActionItemsSection({
  alerts,
  onViewRequisition,
}: {
  alerts: ComplianceAlert[];
  onViewRequisition: (id: string) => void;
}) {
  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="font-semibold text-green-800 text-lg">All Clear</h3>
        <p className="text-green-600 mt-2">No action items requiring your attention.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const styles = getAlertSeverityStyles(alert.severity);
        return (
          <div
            key={alert.id}
            className={`${styles.bg} ${styles.border} border rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all duration-200`}
            onClick={() => onViewRequisition(alert.entityId)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${
                  alert.severity === 'critical' ? 'bg-red-200' : 'bg-amber-200'
                }`}>
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      alert.severity === 'critical' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold ${styles.text}`}>
                      {getAlertTypeLabel(alert.type)}
                    </span>
                    {alert.severity === 'critical' && (
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                        Critical
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">{alert.message}</p>
                  {alert.projectName && (
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {alert.projectName}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {alert.amount && (
                  <div className="font-bold text-gray-900 text-lg">
                    {formatCurrency(alert.amount)}
                  </div>
                )}
                {alert.deadline && (
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-1 justify-end">
                    <Calendar className="w-4 h-4" />
                    Due: {formatDate(alert.deadline)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200/50 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">{alert.actionRequired}</span>
              <span className="text-sm text-primary font-medium flex items-center gap-1">
                View Details
                <ExternalLink className="w-4 h-4" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryMetrics({
  summary,
  complianceScore,
}: {
  summary: CountryDirectorSummary;
  complianceScore: ComplianceScore | null;
}) {
  const complianceTrend: 'up' | 'down' | 'flat' | undefined = complianceScore
    ? complianceScore.overallScore >= 80
      ? 'up'
      : complianceScore.overallScore >= 60
      ? 'flat'
      : 'down'
    : undefined;

  return (
    <KPIGrid cols={4}>
      <KPICard
        label={
          <span className="inline-flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-600" />
            Total Disbursed
          </span>
        }
        value={formatCurrency(summary.totalDisbursed)}
        delta={`${summary.totalRequisitions} requisitions`}
      />
      <KPICard
        label={
          <span className="inline-flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Accounted
          </span>
        }
        value={formatCurrency(summary.totalAccounted)}
        delta={`${summary.completeCount} complete`}
      />
      <KPICard
        label={
          <span className="inline-flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Pending
          </span>
        }
        value={formatCurrency(summary.totalUnaccounted)}
        delta={`${summary.pendingCount + summary.partialCount} in progress`}
      />
      <KPICard
        label={
          <span className="inline-flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-600" />
            Compliance
          </span>
        }
        value={complianceScore ? `${complianceScore.overallScore.toFixed(0)}%` : '-'}
        delta="ADD-FIN-001 Score"
        trend={complianceTrend}
      />
    </KPIGrid>
  );
}

function StatusBreakdown({ summary }: { summary: CountryDirectorSummary }) {
  const statuses = [
    { label: 'Complete', count: summary.completeCount, color: 'bg-green-500', textColor: 'text-green-600' },
    { label: 'Partial', count: summary.partialCount, color: 'bg-blue-500', textColor: 'text-blue-600' },
    { label: 'Pending', count: summary.pendingCount, color: 'bg-amber-500', textColor: 'text-amber-600' },
    { label: 'Overdue', count: summary.overdueCount, color: 'bg-red-500', textColor: 'text-red-600' },
  ];

  const total = summary.totalRequisitions || 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-gray-100 rounded-lg">
          <BarChart3 className="w-5 h-5 text-gray-600" />
        </div>
        <h3 className="font-semibold text-gray-900">Accountability Status Overview</h3>
      </div>

      {/* Progress bar */}
      <div className="h-4 rounded-full bg-gray-100 flex overflow-hidden mb-5">
        {statuses.map((status) => (
          <div
            key={status.label}
            className={`${status.color} transition-all`}
            style={{ width: `${(status.count / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statuses.map((status) => (
          <div key={status.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${status.color}`} />
              <span className="text-sm text-gray-600">{status.label}</span>
            </div>
            <span className={`text-lg font-bold ${status.textColor}`}>{status.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function YearSection({
  year,
  requisitions,
  isCollapsed,
  onToggleCollapse,
  expandedRequisitionId,
  onToggleRequisition,
}: {
  year: number;
  requisitions: PortalRequisitionDetail[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  expandedRequisitionId: string | null;
  onToggleRequisition: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Year Header - Clickable to collapse/expand */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-3 group cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          )}
          <Calendar className="w-5 h-5 text-gray-600" />
          <span className="font-bold text-gray-900 text-lg">{year}</span>
        </div>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full group-hover:bg-gray-200 transition-colors">
          {requisitions.length} {requisitions.length === 1 ? 'requisition' : 'requisitions'}
        </span>
      </button>

      {/* Requisitions for this year - collapsible */}
      {!isCollapsed && (
        <div className="space-y-4 pl-2">
          {requisitions.map((req) => (
            <div key={req.id} id={`requisition-${req.id}`}>
              <RequisitionCard
                requisition={req}
                isExpanded={expandedRequisitionId === req.id}
                onToggle={() => onToggleRequisition(req.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequisitionCard({
  requisition,
  isExpanded,
  onToggle,
}: {
  requisition: PortalRequisitionDetail;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = getStatusConfig(requisition.accountabilityStatus);
  const StatusIcon = statusConfig.icon;

  // PDF Viewer Modal state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState('');
  const [pdfViewerFileName, setPdfViewerFileName] = useState('');

  const openPdfViewer = (url: string, fileName: string) => {
    setPdfViewerUrl(url);
    setPdfViewerFileName(fileName);
    setPdfViewerOpen(true);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header - Always visible */}
      <div
        className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span className="font-semibold text-gray-900 text-lg">{requisition.referenceNumber}</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
              >
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </span>
              {requisition.varianceStatus && requisition.varianceStatus !== 'compliant' && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    requisition.varianceStatus === 'severe'
                      ? 'bg-red-100 text-red-700'
                      : requisition.varianceStatus === 'moderate'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {VARIANCE_STATUS_CONFIG[requisition.varianceStatus].label}
                </span>
              )}
            </div>
            <p className="text-gray-600 line-clamp-2">{requisition.description}</p>
            <div className="flex items-center flex-wrap gap-4 mt-3 text-sm text-gray-500">
              {requisition.projectName && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {requisition.projectName}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(requisition.requisitionDate)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(requisition.amount, requisition.currency)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {formatCurrency(requisition.totalAccountedAmount, requisition.currency)} accounted
            </div>
            <div className="mt-3">
              {isExpanded ? (
                <ChevronUp className="w-6 h-6 text-gray-400 ml-auto" />
              ) : (
                <ChevronDown className="w-6 h-6 text-gray-400 ml-auto" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50">
          {/* Requisition Details */}
          <div className="p-5 border-b border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4">Requisition Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Purpose</span>
                <p className="font-medium text-gray-900 mt-1">{requisition.purpose || '-'}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Advance Type</span>
                <p className="font-medium text-gray-900 mt-1 capitalize">
                  {requisition.advanceType?.replace('_', ' ') || '-'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Due Date</span>
                <p className="font-medium text-gray-900 mt-1">
                  {requisition.accountabilityDueDate
                    ? formatDate(requisition.accountabilityDueDate)
                    : '-'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Variance</span>
                <p className={`font-medium mt-1 ${
                  requisition.varianceStatus === 'compliant'
                    ? 'text-green-600'
                    : requisition.varianceStatus === 'severe'
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}>
                  {requisition.variancePercentage !== undefined
                    ? `${requisition.variancePercentage.toFixed(1)}%`
                    : '-'}
                </p>
              </div>
            </div>

          </div>

          {/* General Documents Section */}
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="w-5 h-5 text-gray-500" />
              <h4 className="font-semibold text-gray-900">General Documents</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Funds Received Acknowledgement */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${requisition.acknowledgementDocumentUrl ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <FileText className={`w-5 h-5 ${requisition.acknowledgementDocumentUrl ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-gray-900">Funds Received Acknowledgement</h5>
                    <p className="text-sm text-gray-500 mt-0.5">Signed confirmation of funds receipt</p>
                    {requisition.acknowledgementDocumentUrl ? (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPdfViewer(
                              requisition.acknowledgementDocumentUrl!,
                              `${requisition.referenceNumber}-Funds-Acknowledgement.pdf`
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <a
                          href={requisition.acknowledgementDocumentUrl}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600 mt-2">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Report */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${requisition.activityReportUrl ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <FileText className={`w-5 h-5 ${requisition.activityReportUrl ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-gray-900">Activity Report</h5>
                    <p className="text-sm text-gray-500 mt-0.5">Summary of activities and expenditure</p>
                    {requisition.activityReportUrl ? (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPdfViewer(
                              requisition.activityReportUrl!,
                              `${requisition.referenceNumber}-Activity-Report.pdf`
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <a
                          href={requisition.activityReportUrl}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600 mt-2">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Accountability Entries */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-gray-500" />
                <h4 className="font-semibold text-gray-900">Accountability Entries</h4>
              </div>
              <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {requisition.accountabilities.length} {requisition.accountabilities.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {requisition.accountabilities.length === 0 ? (
              <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h5 className="font-medium text-gray-700">No Accountability Entries</h5>
                <p className="text-gray-500 text-sm mt-1">No expenditure records have been submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requisition.accountabilities.map((entry, index) => (
                  <AccountabilityEntryCard
                    key={entry.id}
                    entry={entry}
                    index={index + 1}
                    onViewDocument={openPdfViewer}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        url={pdfViewerUrl}
        fileName={pdfViewerFileName}
      />
    </div>
  );
}

function AccountabilityEntryCard({
  entry,
  index,
  onViewDocument,
}: {
  entry: PortalAccountabilityEntry;
  index: number;
  onViewDocument: (url: string, fileName: string) => void;
}) {
  const getDocIcon = (category?: string) => {
    switch (category) {
      case 'photo':
        return <FileImage className="w-4 h-4 text-purple-600" />;
      case 'receipt':
        return <Receipt className="w-4 h-4 text-green-600" />;
      case 'invoice':
        return <FileText className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  const getDocBgColor = (category?: string) => {
    switch (category) {
      case 'photo':
        return 'bg-purple-50 border-purple-200';
      case 'receipt':
        return 'bg-green-50 border-green-200';
      case 'invoice':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Entry Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {index}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-semibold text-gray-900">
                  {entry.description}
                </span>
                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600 capitalize">
                  {entry.category.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-4 text-sm text-gray-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(entry.date)}
                </span>
                {entry.vendor && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {entry.vendor}
                  </span>
                )}
                {entry.receiptNumber && (
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    Rcpt: {entry.receiptNumber}
                  </span>
                )}
                {entry.invoiceNumber && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Inv: {entry.invoiceNumber}
                  </span>
                )}
                {entry.paymentMethod && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                    <DollarSign className="w-3 h-3" />
                    {entry.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                     entry.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Cash'}
                  </span>
                )}
                {entry.contractOrPONumber && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                    <FileText className="w-3 h-3" />
                    PO/Contract: {entry.contractOrPONumber}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-gray-900 text-lg">{formatCurrency(entry.amount)}</div>
          </div>
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Paperclip className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Supporting Documents</span>
          <span className="text-xs text-gray-400">({entry.documents.length})</span>
        </div>

        {entry.documents.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-2">No supporting documents attached</div>
        ) : (
          <div className="space-y-2">
            {entry.documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${getDocBgColor(doc.category)}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm">
                    {getDocIcon(doc.category)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {doc.category?.replace('_', ' ') || 'Document'}
                      {doc.size && ` • ${(doc.size / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onViewDocument(doc.url, doc.name)}
                    className="p-2 text-gray-600 hover:text-primary hover:bg-white rounded-lg transition-colors"
                    title="View document"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={doc.url}
                    download
                    className="p-2 text-gray-600 hover:text-primary hover:bg-white rounded-lg transition-colors"
                    title="Download document"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Entry Activity Report */}
        {entry.activityReportUrl && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white rounded-lg shadow-sm">
                  <FileText className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Entry Activity Report</p>
                  <p className="text-xs text-gray-500">Detailed activity documentation</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onViewDocument(entry.activityReportUrl!, 'Activity-Report.pdf')}
                  className="p-2 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                  title="View report"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <a
                  href={entry.activityReportUrl}
                  download
                  className="p-2 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                  title="Download report"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export function CDPortalPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // State
  const [session, setSession] = useState<PortalSession | null>(null);
  const [summary, setSummary] = useState<CountryDirectorSummary | null>(null);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);
  const [actionItems, setActionItems] = useState<ComplianceAlert[]>([]);
  const [requisitions, setRequisitions] = useState<PortalRequisitionDetail[]>([]);
  const [expandedRequisitionId, setExpandedRequisitionId] = useState<string | null>(null);
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'actions' | 'all'>('all');

  // Filter state
  const [filters, setFilters] = useState<PortalFilters>({
    searchQuery: '',
    status: 'all',
    variance: 'all',
  });

  // Sort state
  const [sort, setSort] = useState<PortalSort>({
    field: 'date',
    direction: 'desc',
  });

  // Filter and sort requisitions
  const filteredRequisitions = useMemo(() => {
    let result = [...requisitions];

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((r) => {
        // Search in main fields
        const matchesMain =
          r.referenceNumber.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.projectName?.toLowerCase().includes(query);

        // Search in accountability entries (vendor names)
        const matchesVendor = r.accountabilities?.some(
          (a) => a.vendor?.toLowerCase().includes(query)
        );

        return matchesMain || matchesVendor;
      });
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter((r) => r.accountabilityStatus === filters.status);
    }

    // Variance filter
    if (filters.variance !== 'all') {
      result = result.filter((r) => r.varianceStatus === filters.variance);
    }

    // Sorting
    const statusOrder: Record<AccountabilityStatus, number> = {
      overdue: 0,
      pending: 1,
      partial: 2,
      complete: 3,
      not_required: 4,
    };

    const varianceOrder: Record<VarianceStatus, number> = {
      severe: 0,
      moderate: 1,
      minor: 2,
      compliant: 3,
    };

    result.sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'date':
          comparison = a.requisitionDate.getTime() - b.requisitionDate.getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'status':
          comparison =
            (statusOrder[a.accountabilityStatus] || 4) -
            (statusOrder[b.accountabilityStatus] || 4);
          break;
        case 'variance':
          comparison =
            (varianceOrder[a.varianceStatus || 'compliant'] || 3) -
            (varianceOrder[b.varianceStatus || 'compliant'] || 3);
          break;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [requisitions, filters, sort]);

  // Load data
  useEffect(() => {
    async function loadPortalData() {
      if (!token) {
        setError('No access token provided. Please use a valid portal link.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const service = getCDPortalService(db);

        // Validate token
        let validSession: PortalSession | null;
        try {
          validSession = await service.validateToken(token);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Authentication error';
          setError(message);
          setLoading(false);
          return;
        }
        if (!validSession) {
          setError('Invalid or expired access token. Please contact your administrator.');
          setLoading(false);
          return;
        }

        setSession(validSession);

        // Load all data in parallel
        const [summaryData, scoreData, alertsData, requisitionsData] = await Promise.all([
          service.getPortalSummary(validSession.programId),
          service.getComplianceScore(validSession.programId),
          service.getActionItems(validSession.programId),
          service.getPortalRequisitions(validSession.programId),
        ]);

        setSummary(summaryData);
        setComplianceScore(scoreData);
        setActionItems(alertsData);
        setRequisitions(requisitionsData);
      } catch (err) {
        console.error('Error loading portal data:', err);
        setError('Failed to load portal data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, [token]);

  const handleRefresh = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const service = getCDPortalService(db);
      const [summaryData, scoreData, alertsData, requisitionsData] = await Promise.all([
        service.getPortalSummary(session.programId),
        service.getComplianceScore(session.programId),
        service.getActionItems(session.programId),
        service.getPortalRequisitions(session.programId),
      ]);

      setSummary(summaryData);
      setComplianceScore(scoreData);
      setActionItems(alertsData);
      setRequisitions(requisitionsData);
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequisition = (id: string) => {
    setExpandedRequisitionId(id);
    setActiveSection('all');
    // Scroll to requisition
    setTimeout(() => {
      const element = document.getElementById(`requisition-${id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md text-center shadow-xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h1>
          <p className="text-gray-600 leading-relaxed">{error}</p>
          <p className="text-sm text-gray-400 mt-6">
            If you believe this is an error, please contact your program administrator.
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading portal...</p>
          <p className="text-gray-400 text-sm mt-1">Please wait while we verify your access</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo/Brand */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Country Director Portal</h1>
                  {session && (
                    <p className="text-sm text-gray-500">{session.programName}</p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Summary Metrics */}
        {summary && <SummaryMetrics summary={summary} complianceScore={complianceScore} />}

        {/* Status Breakdown */}
        {summary && <StatusBreakdown summary={summary} />}

        {/* Filter Bar */}
        {requisitions.length > 0 && (
          <PortalFilterBar
            filters={filters}
            onChange={setFilters}
            sort={sort}
            onSortChange={setSort}
            totalCount={requisitions.length}
            filteredCount={filteredRequisitions.length}
          />
        )}

        {/* Section Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveSection('all')}
              className={`flex-1 py-4 px-6 font-medium text-sm transition-colors ${
                activeSection === 'all'
                  ? 'bg-primary/5 text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" />
                All Requisitions
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  activeSection === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {filteredRequisitions.length !== requisitions.length
                    ? `${filteredRequisitions.length}/${requisitions.length}`
                    : requisitions.length}
                </span>
              </div>
            </button>
            <button
              onClick={() => setActiveSection('actions')}
              className={`flex-1 py-4 px-6 font-medium text-sm transition-colors ${
                activeSection === 'actions'
                  ? 'bg-primary/5 text-primary border-b-2 border-primary'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Action Items
                {actionItems.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    activeSection === 'actions'
                      ? 'bg-primary text-white'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {actionItems.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Section Content */}
          <div className="p-6">
            {activeSection === 'all' && (
              <div className="space-y-6">
                {requisitions.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-gray-900 text-lg">No Requisitions</h3>
                    <p className="text-gray-500 mt-2">
                      No requisitions have been linked to this program yet.
                    </p>
                  </div>
                ) : filteredRequisitions.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-gray-900 text-lg">No Matching Requisitions</h3>
                    <p className="text-gray-500 mt-2">
                      No requisitions match your current filters. Try adjusting your search or filters.
                    </p>
                  </div>
                ) : (
                  Array.from(groupRequisitionsByYear(filteredRequisitions)).map(([year, yearRequisitions]) => (
                    <YearSection
                      key={year}
                      year={year}
                      requisitions={yearRequisitions}
                      isCollapsed={collapsedYears.has(year)}
                      onToggleCollapse={() => {
                        setCollapsedYears((prev) => {
                          const next = new Set(prev);
                          if (next.has(year)) {
                            next.delete(year);
                          } else {
                            next.add(year);
                          }
                          return next;
                        });
                      }}
                      expandedRequisitionId={expandedRequisitionId}
                      onToggleRequisition={(id) =>
                        setExpandedRequisitionId(expandedRequisitionId === id ? null : id)
                      }
                    />
                  ))
                )}
              </div>
            )}

            {activeSection === 'actions' && (
              <ActionItemsSection alerts={actionItems} onViewRequisition={handleViewRequisition} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Country Director Portal</p>
                <p className="text-sm text-gray-500">ADD-FIN-001 Compliance Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="mailto:support@dawin.ug" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Mail className="w-4 h-4" />
                support@dawin.ug
              </a>
              <a href="tel:+256700000000" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone className="w-4 h-4" />
                +256 700 000 000
              </a>
            </div>
          </div>

          {session?.expiresAt && (
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-400">
                Your access expires on {formatDate(session.expiresAt)}
              </p>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
