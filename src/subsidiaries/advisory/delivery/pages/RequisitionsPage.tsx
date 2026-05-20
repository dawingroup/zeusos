/**
 * Requisitions Page - List and manage project requisitions
 */

import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Receipt,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Wallet,
  MinusCircle,
  Package,
  Hammer,
  Banknote,
  GitBranch,
} from 'lucide-react';
import { useProjectRequisitions } from '../hooks/payment-hooks';
import { useProjectManualRequisitions } from '../hooks/manual-requisition-hooks';
import { Requisition, AccountabilityStatus, RequisitionType, REQUISITION_TYPE_CONFIG, normalizeRequisitionType } from '../types/requisition';
import { ManualRequisition } from '../types/manual-requisition';
import { PaymentStatus } from '../types/payment';
import { db } from '@/core/services/firebase';
import { FileText } from 'lucide-react';

type FilterStatus = 'all' | PaymentStatus;
type AccountabilityFilter = 'all' | AccountabilityStatus;
type TypeFilter = 'all' | RequisitionType;

const TYPE_ICONS: Record<RequisitionType, React.ElementType> = {
  funds: Banknote,
  materials: Package,
  labour: Hammer,
};

const TYPE_COLORS: Record<RequisitionType, string> = {
  funds: 'bg-orange-100 text-orange-700',
  materials: 'bg-blue-100 text-blue-700',
  labour: 'bg-green-100 text-green-700',
};

const STATUS_COLORS: Record<PaymentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  processing: 'bg-purple-100 text-purple-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-200 text-gray-600',
};

const ACCOUNTABILITY_STATUS_CONFIG: Record<AccountabilityStatus, { color: string; icon: React.ElementType; label: string }> = {
  not_required: { color: 'bg-gray-100 text-gray-600', icon: MinusCircle, label: 'Not Required' },
  pending: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
  partial: { color: 'bg-blue-100 text-blue-700', icon: AlertTriangle, label: 'Partial' },
  complete: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Complete' },
  overdue: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Overdue' },
};

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatDate(date: Date | { toDate: () => Date } | undefined): string {
  if (!date) return '-';
  // Handle Firebase Timestamp objects
  const dateObj = date && typeof (date as any).toDate === 'function'
    ? (date as any).toDate()
    : new Date(date as Date);
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface RequisitionCardProps {
  requisition: Requisition;
}

function RequisitionCard({ requisition }: RequisitionCardProps) {
  const accountabilityConfig = ACCOUNTABILITY_STATUS_CONFIG[requisition.accountabilityStatus] ?? ACCOUNTABILITY_STATUS_CONFIG.not_required;
  const AccountabilityIcon = accountabilityConfig.icon;
  const reqType = normalizeRequisitionType(requisition.requisitionType || 'funds');
  const typeConfig = REQUISITION_TYPE_CONFIG[reqType];
  const TypeIcon = TYPE_ICONS[reqType];
  const typeColor = TYPE_COLORS[reqType];
  const isParent = reqType === 'funds';
  const isChild = !!requisition.parentRequisitionId;
  const childCount = requisition.childRequisitionIds?.length || 0;

  return (
    <Link
      to={`/advisory/delivery/requisitions/${requisition.id}`}
      className="block bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${reqType === 'funds' ? 'bg-orange-50' : reqType === 'materials' ? 'bg-blue-50' : 'bg-green-50'}`}>
          <TypeIcon className={`w-5 h-5 ${reqType === 'funds' ? 'text-orange-600' : reqType === 'materials' ? 'text-blue-600' : 'text-green-600'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-gray-900">{requisition.requisitionNumber}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${typeColor}`}>
              {typeConfig?.label || reqType}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[requisition.status]}`}>
              {requisition.status.replace('_', ' ')}
            </span>
            {isParent && childCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {childCount} child{childCount !== 1 ? 'ren' : ''}
              </span>
            )}
            {isChild && requisition.parentRequisitionNumber && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                Parent: {requisition.parentRequisitionNumber}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-2 line-clamp-1">{requisition.purpose}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Amount:</span>
              <span className="ml-1 font-medium">{formatCurrency(requisition.grossAmount, requisition.currency)}</span>
            </div>
            <div>
              <span className="text-gray-500">Items:</span>
              <span className="ml-1">{requisition.items?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Due:</span>
              <span className="ml-1">{formatDate(requisition.accountabilityDueDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <AccountabilityIcon className={`w-4 h-4 ${accountabilityConfig.color.split(' ')[1]}`} />
              <span className={`text-xs ${accountabilityConfig.color.split(' ')[1]}`}>
                {accountabilityConfig.label}
              </span>
            </div>
          </div>

          {isParent && requisition.childRequisitionsSummary && (
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
              <span>Allocated: {formatCurrency(requisition.childRequisitionsSummary.totalChildAmount, requisition.currency)}</span>
              <span className={requisition.childRequisitionsSummary.budgetExceeded ? 'text-red-600 font-medium' : 'text-green-600'}>
                Balance: {formatCurrency(requisition.childRequisitionsSummary.remainingFundsBalance, requisition.currency)}
              </span>
            </div>
          )}

          {requisition.unaccountedAmount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-amber-600">
                {formatCurrency(requisition.unaccountedAmount, requisition.currency)} unaccounted
              </span>
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </Link>
  );
}

// Manual Requisition Card - for backlog/historical entries linked to the project
interface ManualRequisitionCardProps {
  requisition: ManualRequisition;
}

function ManualRequisitionCard({ requisition }: ManualRequisitionCardProps) {
  const accountabilityConfig = ACCOUNTABILITY_STATUS_CONFIG[requisition.accountabilityStatus] ?? ACCOUNTABILITY_STATUS_CONFIG.not_required;
  const AccountabilityIcon = accountabilityConfig.icon;

  return (
    <Link
      to={`/advisory/delivery/backlog/${requisition.id}`}
      className="block bg-white border border-orange-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-orange-50 rounded-lg">
          <FileText className="w-5 h-5 text-orange-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">{requisition.referenceNumber}</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
              Manual Entry
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-2 line-clamp-1">{requisition.description}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Amount:</span>
              <span className="ml-1 font-medium">{formatCurrency(requisition.amount, requisition.currency)}</span>
            </div>
            <div>
              <span className="text-gray-500">Entries:</span>
              <span className="ml-1">{requisition.accountabilities?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-500">Due:</span>
              <span className="ml-1">{formatDate(requisition.accountabilityDueDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <AccountabilityIcon className={`w-4 h-4 ${accountabilityConfig.color.split(' ')[1]}`} />
              <span className={`text-xs ${accountabilityConfig.color.split(' ')[1]}`}>
                {accountabilityConfig.label}
              </span>
            </div>
          </div>

          {(requisition.unaccountedAmount || 0) > 0 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-amber-500" />
              <span className="text-amber-600">
                {formatCurrency(requisition.unaccountedAmount || 0, requisition.currency)} unaccounted
              </span>
            </div>
          )}
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </Link>
  );
}

export function RequisitionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [accountabilityFilter, setAccountabilityFilter] = useState<AccountabilityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualRequisitions, _setShowManualRequisitions] = useState(true);

  const { requisitions, byAccountabilityStatus, loading, error } = useProjectRequisitions(db, projectId || null);
  const {
    requisitions: manualRequisitions,
    summary: manualSummary,
    loading: manualLoading
  } = useProjectManualRequisitions(projectId);

  const filteredRequisitions = useMemo(() => {
    let result = [...requisitions];

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    if (accountabilityFilter !== 'all') {
      result = result.filter(r => r.accountabilityStatus === accountabilityFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter(r => {
        const normalizedType = normalizeRequisitionType(r.requisitionType || 'funds');
        return normalizedType === typeFilter;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.requisitionNumber.toLowerCase().includes(query) ||
        r.purpose.toLowerCase().includes(query)
      );
    }

    return result;
  }, [requisitions, statusFilter, accountabilityFilter, typeFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: requisitions.length,
    pending: byAccountabilityStatus.pending.length,
    partial: byAccountabilityStatus.partial.length,
    overdue: byAccountabilityStatus.overdue.length,
    complete: byAccountabilityStatus.complete.length,
    totalAmount: requisitions.reduce((sum, r) => sum + r.grossAmount, 0),
    unaccountedAmount: requisitions.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0),
  }), [requisitions, byAccountabilityStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading requisitions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requisitions</h1>
          <p className="text-gray-600">
            {stats.total} requisition{stats.total !== 1 ? 's' : ''} • 
            Total: {formatCurrency(stats.totalAmount)}
            {stats.unaccountedAmount > 0 && (
              <span className="text-amber-600 ml-2">
                ({formatCurrency(stats.unaccountedAmount)} unaccounted)
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => navigate(`/advisory/delivery/projects/${projectId}/requisitions/new/manual`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => setAccountabilityFilter('all')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            accountabilityFilter === 'all' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600">All</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </button>

        <button
          onClick={() => setAccountabilityFilter('pending')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            accountabilityFilter === 'pending' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-gray-600">Pending</span>
          </div>
          <div className="text-2xl font-bold">{stats.pending}</div>
        </button>

        <button
          onClick={() => setAccountabilityFilter('partial')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            accountabilityFilter === 'partial' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">Partial</span>
          </div>
          <div className="text-2xl font-bold">{stats.partial}</div>
        </button>

        <button
          onClick={() => setAccountabilityFilter('overdue')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            accountabilityFilter === 'overdue' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600">Overdue</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
        </button>

        <button
          onClick={() => setAccountabilityFilter('complete')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            accountabilityFilter === 'complete' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">Complete</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.complete}</div>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by requisition number or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="all">All Types</option>
            <option value="funds">Funds</option>
            <option value="materials">Materials</option>
            <option value="labour">Labour</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Formal Requisitions List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Formal Requisitions</h2>
        {filteredRequisitions.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center">
            <Receipt className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-gray-900 mb-1">
              {requisitions.length === 0 ? 'No Formal Requisitions' : 'No Results Found'}
            </h3>
            <p className="text-sm text-gray-600">
              {requisitions.length === 0
                ? 'No formal requisitions created yet.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequisitions.map(requisition => (
              <RequisitionCard key={requisition.id} requisition={requisition} />
            ))}
          </div>
        )}
      </div>

      {/* Manual/Backlog Requisitions Section */}
      {showManualRequisitions && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Linked Manual Requisitions</h2>
              {manualRequisitions.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
                  {manualRequisitions.length} linked
                </span>
              )}
            </div>
            {manualSummary.totalAmount > 0 && (
              <span className="text-sm text-gray-600">
                Total: {formatCurrency(manualSummary.totalAmount)}
                {manualSummary.unaccountedAmount > 0 && (
                  <span className="text-amber-600 ml-1">
                    • {formatCurrency(manualSummary.unaccountedAmount)} unaccounted
                  </span>
                )}
              </span>
            )}
          </div>

          {manualLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-gray-600">Loading manual requisitions...</span>
            </div>
          ) : manualRequisitions.length === 0 ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center">
              <FileText className="w-10 h-10 text-orange-400 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 mb-1">No Linked Manual Requisitions</h3>
              <p className="text-sm text-gray-600 mb-3">
                Link historical or backlog requisitions to this project for unified accountability tracking.
              </p>
              <button
                onClick={() => navigate('/advisory/delivery/backlog')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
              >
                <FileText className="w-4 h-4" />
                View Backlog
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {manualRequisitions.map(requisition => (
                <ManualRequisitionCard key={requisition.id} requisition={requisition} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RequisitionsPage;
