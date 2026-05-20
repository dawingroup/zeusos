/**
 * UnifiedRequisitionTable - Combined view of manual and system requisitions
 */

import { useState } from 'react';
import {
  ArrowUpDown,
  ExternalLink,
  FileText,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';
import {
  UnifiedRequisitionSummary,
  RequisitionSource,
  getSourceBadgeStyles,
} from '../../types/country-director-dashboard';
import { AccountabilityStatus } from '../../types/requisition';
import { VarianceStatus, VARIANCE_STATUS_CONFIG } from '../../types/accountability';

interface UnifiedRequisitionTableProps {
  requisitions: UnifiedRequisitionSummary[];
  onRowClick?: (requisition: UnifiedRequisitionSummary) => void;
  currency?: string;
}

type SortField = 'referenceNumber' | 'amount' | 'requisitionDate' | 'accountabilityStatus' | 'varianceStatus';
type SortDirection = 'asc' | 'desc';

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

function getAccountabilityStatusConfig(status: AccountabilityStatus) {
  const config: Record<AccountabilityStatus, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: 'Pending', color: 'text-amber-600 bg-amber-100', icon: Clock },
    partial: { label: 'Partial', color: 'text-blue-600 bg-blue-100', icon: AlertTriangle },
    complete: { label: 'Complete', color: 'text-green-600 bg-green-100', icon: CheckCircle },
    overdue: { label: 'Overdue', color: 'text-red-600 bg-red-100', icon: XCircle },
    not_required: { label: 'N/A', color: 'text-gray-600 bg-gray-100', icon: Clock },
  };
  return config[status];
}

function getVarianceStatusColor(status: VarianceStatus): string {
  const colorMap: Record<string, string> = {
    green: 'text-green-600 bg-green-100',
    blue: 'text-blue-600 bg-blue-100',
    yellow: 'text-amber-600 bg-amber-100',
    red: 'text-red-600 bg-red-100',
  };
  return colorMap[VARIANCE_STATUS_CONFIG[status].color] || colorMap.green;
}

export function UnifiedRequisitionTable({
  requisitions,
  onRowClick,
  currency = 'UGX',
}: UnifiedRequisitionTableProps) {
  const [sortField, setSortField] = useState<SortField>('requisitionDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sourceFilter, setSourceFilter] = useState<RequisitionSource | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AccountabilityStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter requisitions
  let filtered = requisitions;

  if (sourceFilter !== 'all') {
    filtered = filtered.filter((r) => r.source === sourceFilter);
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter((r) => r.accountabilityStatus === statusFilter);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.referenceNumber.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.projectName?.toLowerCase().includes(query)
    );
  }

  // Sort requisitions
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'referenceNumber':
        comparison = a.referenceNumber.localeCompare(b.referenceNumber);
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'requisitionDate':
        comparison = a.requisitionDate.getTime() - b.requisitionDate.getTime();
        break;
      case 'accountabilityStatus':
        comparison = a.accountabilityStatus.localeCompare(b.accountabilityStatus);
        break;
      case 'varianceStatus':
        comparison = (a.varianceStatus || '').localeCompare(b.varianceStatus || '');
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-gray-900"
    >
      {children}
      <ArrowUpDown
        className={`w-4 h-4 ${
          sortField === field ? 'text-gray-900' : 'text-gray-400'
        }`}
      />
    </button>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requisitions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as RequisitionSource | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual Entries</option>
            <option value="system">System Generated</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AccountabilityStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="complete">Complete</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Results count */}
          <span className="text-sm text-gray-500">
            {sorted.length} of {requisitions.length} requisitions
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-sm text-gray-600">
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">
                <SortHeader field="referenceNumber">Reference</SortHeader>
              </th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">
                <SortHeader field="amount">Amount</SortHeader>
              </th>
              <th className="px-4 py-3 font-medium">
                <SortHeader field="requisitionDate">Date</SortHeader>
              </th>
              <th className="px-4 py-3 font-medium">
                <SortHeader field="accountabilityStatus">Status</SortHeader>
              </th>
              <th className="px-4 py-3 font-medium">
                <SortHeader field="varianceStatus">Variance</SortHeader>
              </th>
              <th className="px-4 py-3 font-medium">Days</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No requisitions found matching your filters.
                </td>
              </tr>
            ) : (
              sorted.map((req) => {
                const sourceStyles = getSourceBadgeStyles(req.source);
                const statusConfig = getAccountabilityStatusConfig(req.accountabilityStatus);
                const StatusIcon = statusConfig.icon;

                return (
                  <tr
                    key={req.id}
                    onClick={() => onRowClick?.(req)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    {/* Source */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sourceStyles.bg} ${sourceStyles.text}`}
                      >
                        {req.source === 'manual' ? (
                          <FileText className="w-3 h-3" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        {req.source === 'manual' ? 'Manual' : 'System'}
                      </span>
                    </td>

                    {/* Reference */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{req.referenceNumber}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">
                        {req.description}
                      </div>
                    </td>

                    {/* Project */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{req.projectName || '-'}</div>
                      <div className="text-xs text-gray-500">{req.programName}</div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(req.amount, currency)}
                      </div>
                      {req.unaccountedAmount > 0 && (
                        <div className="text-xs text-amber-600">
                          {formatCurrency(req.unaccountedAmount, currency)} pending
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(req.requisitionDate)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </td>

                    {/* Variance */}
                    <td className="px-4 py-3">
                      {req.varianceStatus ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getVarianceStatusColor(
                            req.varianceStatus
                          )}`}
                        >
                          {VARIANCE_STATUS_CONFIG[req.varianceStatus].label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>

                    {/* Days */}
                    <td className="px-4 py-3">
                      {req.daysUntilDue !== undefined && (
                        <span
                          className={`text-sm ${
                            req.daysUntilDue < 0
                              ? 'text-red-600 font-medium'
                              : req.daysUntilDue <= 7
                              ? 'text-amber-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {req.daysUntilDue < 0
                            ? `${Math.abs(req.daysUntilDue)}d overdue`
                            : `${req.daysUntilDue}d left`}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
