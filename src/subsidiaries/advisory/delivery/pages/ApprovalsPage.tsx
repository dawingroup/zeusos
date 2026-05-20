/**
 * Approvals Page - Payment approval workflow for project managers and finance
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Receipt,
  Wallet,
  Loader2,
  AlertCircle,
  ChevronRight,
  Filter,
  Search,
} from 'lucide-react';
import { usePendingApprovals, usePaymentApproval } from '../hooks/payment-hooks';
import { Payment, PaymentType, PaymentStatus } from '../types/payment';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings/useSettings';

type FilterType = 'all' | PaymentType;
type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

const PAYMENT_TYPE_ICONS: Record<PaymentType, React.ElementType> = {
  ipc: FileText,
  requisition: Receipt,
  accountability: Wallet,
};

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  ipc: 'Interim Payment Certificate',
  requisition: 'Requisition',
  accountability: 'Accountability',
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

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface ApprovalCardProps {
  payment: Payment;
  onApprove: (paymentId: string, comments?: string) => Promise<void>;
  onReject: (paymentId: string, reason: string) => Promise<void>;
  loading: boolean;
}

function ApprovalCard({ payment, onApprove, onReject, loading }: ApprovalCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const Icon = PAYMENT_TYPE_ICONS[payment.paymentType];

  const handleApprove = async () => {
    await onApprove(payment.id, approvalComments || undefined);
    setShowActions(false);
    setApprovalComments('');
    setActionType(null);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await onReject(payment.id, rejectReason);
    setShowActions(false);
    setRejectReason('');
    setActionType(null);
  };

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">{payment.paymentNumber}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[payment.status]}`}>
              {payment.status.replace('_', ' ')}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-2">
            {PAYMENT_TYPE_LABELS[payment.paymentType]}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Project:</span>
              <Link
                to={`/advisory/delivery/projects/${payment.projectId}`}
                className="ml-1 text-primary hover:underline"
              >
                {payment.projectId.slice(0, 8)}...
              </Link>
            </div>
            <div>
              <span className="text-gray-500">Gross:</span>
              <span className="ml-1 font-medium">{formatCurrency(payment.grossAmount, payment.currency)}</span>
            </div>
            <div>
              <span className="text-gray-500">Net:</span>
              <span className="ml-1 font-medium text-green-600">{formatCurrency(payment.netAmount, payment.currency)}</span>
            </div>
            <div>
              <span className="text-gray-500">Submitted:</span>
              <span className="ml-1">{formatDate(payment.submittedAt?.toDate())}</span>
            </div>
          </div>

          {payment.paymentNumber && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">Payment #{payment.paymentNumber}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!showActions ? (
            <>
              <button
                onClick={() => { setShowActions(true); setActionType('approve'); }}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                title="Approve"
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setShowActions(true); setActionType('reject'); }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Reject"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <Link
                to={`/advisory/delivery/payments/${payment.id}`}
                className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </Link>
            </>
          ) : (
            <button
              onClick={() => { setShowActions(false); setActionType(null); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {showActions && actionType === 'approve' && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-start gap-3">
            <textarea
              placeholder="Optional comments..."
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none"
              rows={2}
            />
            <button
              onClick={handleApprove}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve
            </button>
          </div>
        </div>
      )}

      {showActions && actionType === 'reject' && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-start gap-3">
            <textarea
              placeholder="Reason for rejection (required)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none border-red-200 focus:border-red-400 focus:ring-red-200"
              rows={2}
              required
            />
            <button
              onClick={handleReject}
              disabled={loading || !rejectReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApprovalsPage() {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');

  const userRole = dawinUser?.globalRole || 'member';

  const { approvals, loading, error } = usePendingApprovals(db, userRole, { realtime: true });
  const { approve, reject, loading: actionLoading } = usePaymentApproval(
    db,
    user?.uid || '',
    user?.displayName || 'Unknown'
  );

  // Filter and sort approvals
  const filteredApprovals = useMemo(() => {
    let result = [...approvals];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(p => p.paymentType === filterType);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.paymentNumber.toLowerCase().includes(query) ||
        p.projectId.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'date_asc':
          return (a.submittedAt?.toMillis() || 0) - (b.submittedAt?.toMillis() || 0);
        case 'amount_desc':
          return b.netAmount - a.netAmount;
        case 'amount_asc':
          return a.netAmount - b.netAmount;
        case 'date_desc':
        default:
          return (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0);
      }
    });

    return result;
  }, [approvals, filterType, sortOption, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: approvals.length,
    ipcs: approvals.filter(p => p.paymentType === 'ipc').length,
    requisitions: approvals.filter(p => p.paymentType === 'requisition').length,
    accountabilities: approvals.filter(p => p.paymentType === 'accountability').length,
    totalValue: approvals.reduce((sum, p) => sum + p.netAmount, 0),
  }), [approvals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading approvals...</span>
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
          <h1 className="text-2xl font-bold text-gray-900">Payment Approvals</h1>
          <p className="text-gray-600">
            {stats.total} pending approval{stats.total !== 1 ? 's' : ''} • Total value: {formatCurrency(stats.totalValue)}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterType('all')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            filterType === 'all' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-gray-600">All Pending</span>
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </button>

        <button
          onClick={() => setFilterType('ipc')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            filterType === 'ipc' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">IPCs</span>
          </div>
          <div className="text-2xl font-bold">{stats.ipcs}</div>
        </button>

        <button
          onClick={() => setFilterType('requisition')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            filterType === 'requisition' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600">Requisitions</span>
          </div>
          <div className="text-2xl font-bold">{stats.requisitions}</div>
        </button>

        <button
          onClick={() => setFilterType('accountability')}
          className={`p-4 rounded-lg border text-left transition-colors ${
            filterType === 'accountability' ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">Accountabilities</span>
          </div>
          <div className="text-2xl font-bold">{stats.accountabilities}</div>
        </button>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by payment number, project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {approvals.length === 0 ? 'No Pending Approvals' : 'No Results Found'}
          </h3>
          <p className="text-gray-600">
            {approvals.length === 0
              ? 'All payment requests have been processed.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map(payment => (
            <ApprovalCard
              key={payment.id}
              payment={payment}
              onApprove={approve}
              onReject={reject}
              loading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
