// ============================================================================
// REFUNDS PAGE
// ZeusOS v2.0 - Financial Management Module
// Full refund requests page with CRUD, filtering, and detail panel
// ============================================================================

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, RotateCcw, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { useRefundRequests } from '../hooks/useRefundRequests';
import {
  createRefundRequest,
  approveRefundRequest,
  rejectRefundRequest,
  completeRefundRequest,
} from '../services/refundService';
import type { RefundRequest, RefundCategory } from '../types/operations.types';
import { useAuth, useCurrentUserId } from '@/contexts/AuthContext';

const COMPANY_ID = 'zeus-group';

type StatusFilter = 'all' | RefundRequest['status'];

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_COLORS: Record<RefundRequest['status'], string> = {
  pending: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  approved: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  processing: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  completed: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  rejected: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

const STATUS_LABELS: Record<RefundRequest['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  processing: 'Processing',
  completed: 'Completed',
  rejected: 'Rejected',
};

const CATEGORY_COLORS: Record<RefundCategory, string> = {
  product_return: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  service_issue: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  billing_error: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  duplicate_charge: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  other: 'bg-[var(--bg-sunken)] text-muted-foreground',
};

const CATEGORY_LABELS: Record<RefundCategory, string> = {
  product_return: 'Product Return',
  service_issue: 'Service Issue',
  billing_error: 'Billing Error',
  duplicate_charge: 'Duplicate Charge',
  other: 'Other',
};

const REFUND_CATEGORIES: RefundCategory[] = [
  'product_return',
  'service_issue',
  'billing_error',
  'duplicate_charge',
  'other',
];

function formatCurrency(amount: number, _currency?: string) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '--';
  const date = timestamp?.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isThisMonth(timestamp: any): boolean {
  if (!timestamp) return false;
  const date = timestamp?.toDate?.() || new Date(timestamp);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export function RefundsPage() {
  const userId = useCurrentUserId();
  const { user } = useAuth();
  const userName = user?.displayName || user?.email || 'Unknown User';
  const { reports: requests, loading, error, refresh } = useRefundRequests({
    companyId: COMPANY_ID,
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);

  // Client-side filtering
  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  // KPI calculations
  const kpis = useMemo(() => {
    const thisMonthRequests = requests.filter((r) => isThisMonth(r.createdAt));
    const pending = requests.filter((r) => r.status === 'pending');
    const approvedThisMonth = thisMonthRequests.filter((r) => r.status === 'approved');
    const approvedAmount = approvedThisMonth.reduce((sum, r) => sum + r.amount, 0);
    const completedThisMonth = thisMonthRequests.filter((r) => r.status === 'completed');

    return {
      totalRequests: thisMonthRequests.length,
      pending: pending.length,
      approvedAmount,
      completedThisMonth: completedThisMonth.length,
    };
  }, [requests]);

  const handleApprove = async (request: RefundRequest) => {
    try {
      await approveRefundRequest(COMPANY_ID, request.id, userId);
      await refresh();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to approve refund:', err);
    }
  };

  const handleReject = async (request: RefundRequest, notes: string) => {
    if (!notes.trim()) return;
    try {
      await rejectRefundRequest(COMPANY_ID, request.id, userId, notes);
      await refresh();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to reject refund:', err);
    }
  };

  const handleComplete = async (request: RefundRequest) => {
    try {
      await completeRefundRequest(COMPANY_ID, request.id);
      await refresh();
      setSelectedRequest(null);
    } catch (err) {
      console.error('Failed to complete refund:', err);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/finance/operations" className="text-sm text-muted-foreground hover:text-muted-foreground">
            &larr; Operations
          </Link>
        </div>
        <div className="p-6 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg text-center">
          <p className="text-[var(--rag-red)]">{error}</p>
          <button
            onClick={refresh}
            className="mt-3 text-sm text-[var(--rag-red)] hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link to="/finance/operations" className="text-sm text-muted-foreground hover:text-muted-foreground">
          &larr; Operations
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Refund Requests</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage customer refund requests and processing</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--rag-green)] text-white text-sm font-medium rounded-lg hover:bg-[var(--rag-green)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-sunken)] rounded-lg overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.id
                ? 'bg-card text-[var(--rag-green)] shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3 text-[var(--rag-blue)]" /> Total Requests (This Month)
            </span>
          }
          value={loading ? <Skeleton className="h-7 w-16" /> : kpis.totalRequests}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[var(--rag-amber)]" /> Pending
            </span>
          }
          value={loading ? <Skeleton className="h-7 w-16" /> : kpis.pending}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-[var(--rag-green)]" /> Approved Amount (This Month)
            </span>
          }
          value={loading ? <Skeleton className="h-7 w-24" /> : formatCurrency(kpis.approvedAmount)}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-[var(--rag-blue)]" /> Completed (This Month)
            </span>
          }
          value={loading ? <Skeleton className="h-7 w-16" /> : kpis.completedThisMonth}
        />
      </KPIGrid>

      {/* Requests Table */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RotateCcw className="w-10 h-10 mx-auto mb-3 text-[var(--fg-tertiary)]" />
            <p className="text-sm text-muted-foreground">No refund requests found</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-[var(--rag-green)] hover:underline"
            >
              Create your first request
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[var(--bg-sunken)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer / Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requested By</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b last:border-b-0 hover:bg-[var(--bg-sunken)] cursor-pointer transition-colors"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {request.customerName || 'N/A'}
                        </p>
                        {(request.invoiceRef || request.projectRef) && (
                          <p className="text-xs text-muted-foreground">
                            {request.invoiceRef || request.projectRef}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            CATEGORY_COLORS[request.category]
                          }`}
                        >
                          {CATEGORY_LABELS[request.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {formatCurrency(request.amount, request.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{request.requestedByName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(request.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[request.status]
                          }`}
                        >
                          {STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="p-1 hover:bg-[var(--bg-sunken)] rounded-md text-[var(--fg-tertiary)]">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Request Form Modal */}
      {showForm && (
        <NewRefundFormModal
          onClose={() => setShowForm(false)}
          requestedBy={userId}
          requestedByName={userName}
          onSubmit={async (data) => {
            await createRefundRequest(COMPANY_ID, data);
            await refresh();
            setShowForm(false);
          }}
        />
      )}

      {/* Detail Panel (Slide-over) */}
      {selectedRequest && (
        <RefundDetailPanel
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={() => handleApprove(selectedRequest)}
          onReject={(notes) => handleReject(selectedRequest, notes)}
          onComplete={() => handleComplete(selectedRequest)}
        />
      )}
    </div>
  );
}

// ============================================================================
// NEW REFUND FORM MODAL
// ============================================================================

function NewRefundFormModal({
  onClose,
  onSubmit,
  requestedBy,
  requestedByName,
}: {
  onClose: () => void;
  onSubmit: (data: Omit<RefundRequest, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  requestedBy: string;
  requestedByName: string;
}) {
  const [customerName, setCustomerName] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<RefundCategory>('product_return');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !reason) return;
    setSubmitting(true);
    try {
      await onSubmit({
        companyId: COMPANY_ID,
        customerName: customerName || undefined,
        invoiceRef: invoiceRef || undefined,
        amount: parseFloat(amount),
        currency: 'UGX',
        category,
        reason,
        requestedBy,
        requestedByName,
        status: 'pending',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-foreground">New Refund Request</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-sunken)] rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Invoice / Project Ref
            </label>
            <input
              type="text"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              placeholder="e.g. INV-2026-001"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RefundCategory)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
            >
              {REFUND_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for this refund..."
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)] resize-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-[var(--rag-green)] text-white rounded-lg hover:bg-[var(--rag-green)] disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// REFUND DETAIL PANEL (Slide-over)
// ============================================================================

function RefundDetailPanel({
  request,
  onClose,
  onApprove,
  onReject,
  onComplete,
}: {
  request: RefundRequest;
  onClose: () => void;
  onApprove: () => void;
  onReject: (notes: string) => void;
  onComplete: () => void;
}) {
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const canApproveReject = request.status === 'pending';
  const canComplete = request.status === 'approved' || request.status === 'processing';

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await onApprove();
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) return;
    setProcessing(true);
    try {
      await onReject(rejectNotes);
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    setProcessing(true);
    try {
      await onComplete();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card shadow-xl h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-foreground">Refund Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-sunken)] rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer and Status */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-semibold text-foreground">
                {request.customerName || 'Refund Request'}
              </h4>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[request.status]
                }`}
              >
                {STATUS_LABELS[request.status]}
              </span>
            </div>
            {(request.invoiceRef || request.projectRef) && (
              <p className="text-sm text-muted-foreground mt-1">
                Ref: {request.invoiceRef || request.projectRef}
              </p>
            )}
          </div>

          {/* Amount and Category */}
          <div className="p-4 bg-[var(--bg-sunken)] rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Refund Amount</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(request.amount, request.currency)}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  CATEGORY_COLORS[request.category]
                }`}
              >
                {CATEGORY_LABELS[request.category]}
              </span>
            </div>
          </div>

          {/* Requested By */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Requested By</p>
            <p className="text-sm text-foreground">{request.requestedByName}</p>
            <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
          </div>

          {/* Reason */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.reason}</p>
          </div>

          {/* Approval Notes (if approved/rejected) */}
          {request.approvedBy && (
            <div className="p-4 bg-[var(--bg-sunken)] rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">Reviewed By</p>
              <p className="text-sm text-foreground">{request.approvedBy}</p>
              {request.approvalNotes && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{request.approvalNotes}</p>
                </>
              )}
            </div>
          )}

          {/* Processed Date */}
          {request.processedDate && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Processed Date</p>
              <p className="text-sm text-foreground">{formatDate(request.processedDate)}</p>
            </div>
          )}

          {/* Action Buttons */}
          {canApproveReject && (
            <div className="border-t pt-4 space-y-3">
              {!showRejectForm ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--rag-green)] text-white text-sm font-medium rounded-lg hover:bg-[var(--rag-green)] disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--rag-red-soft)] text-[var(--rag-red)] text-sm font-medium rounded-lg hover:bg-[var(--rag-red-soft)] disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Reason for rejection (required)..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-red)] resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={processing || !rejectNotes.trim()}
                      className="flex-1 px-4 py-2 text-sm bg-[var(--rag-red)] text-white rounded-lg hover:bg-[var(--rag-red)] disabled:opacity-50"
                    >
                      {processing ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canComplete && (
            <div className="border-t pt-4">
              <button
                onClick={handleComplete}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--rag-blue)] text-white text-sm font-medium rounded-lg hover:bg-[var(--rag-blue)] disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {processing ? 'Processing...' : 'Mark as Completed'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RefundsPage;
