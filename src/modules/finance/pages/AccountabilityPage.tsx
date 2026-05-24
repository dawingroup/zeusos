// ============================================================================
// ACCOUNTABILITY PAGE
// ZeusOS v2.0 - Financial Management Module
// Full accountability reports page with CRUD, filtering, and detail panel
// ============================================================================

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, FileText, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { useAccountabilityReports } from '../hooks/useAccountabilityReports';
import {
  createAccountabilityReport,
  approveAccountabilityReport,
  rejectAccountabilityReport,
} from '../services/accountabilityService';
import type { AccountabilityReport } from '../types/operations.types';
import { useAuth, useCurrentUserId } from '@/contexts/AuthContext';

const COMPANY_ID = 'dawinos';

type StatusFilter = 'all' | AccountabilityReport['status'];

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'Under Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_COLORS: Record<AccountabilityReport['status'], string> = {
  draft: 'bg-[var(--bg-sunken)] text-muted-foreground',
  submitted: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  under_review: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  approved: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  rejected: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

const STATUS_LABELS: Record<AccountabilityReport['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const DEPARTMENTS = ['Operations', 'Engineering', 'Marketing', 'Sales', 'Other'];

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

export function AccountabilityPage() {
  const userId = useCurrentUserId();
  const { user } = useAuth();
  const userName = user?.displayName || user?.email || 'Unknown User';
  const { reports, loading, error, refresh } = useAccountabilityReports({
    companyId: COMPANY_ID,
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AccountabilityReport | null>(null);

  // Client-side filtering
  const filteredReports = useMemo(() => {
    if (statusFilter === 'all') return reports;
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  // KPI calculations
  const kpis = useMemo(() => {
    const thisMonthReports = reports.filter((r) => isThisMonth(r.createdAt));
    const submitted = thisMonthReports.filter(
      (r) => r.status !== 'draft'
    );
    const pendingReview = reports.filter(
      (r) => r.status === 'submitted' || r.status === 'under_review'
    );
    const approvedThisMonth = thisMonthReports.filter((r) => r.status === 'approved');
    const totalAmountThisMonth = thisMonthReports.reduce((sum, r) => sum + r.amount, 0);

    return {
      totalSubmitted: submitted.length,
      pendingReview: pendingReview.length,
      approvedThisMonth: approvedThisMonth.length,
      totalAmountThisMonth,
    };
  }, [reports]);

  const handleApprove = async (report: AccountabilityReport) => {
    try {
      await approveAccountabilityReport(
        COMPANY_ID,
        report.id,
        userId,
        userName
      );
      await refresh();
      setSelectedReport(null);
    } catch (err) {
      console.error('Failed to approve report:', err);
    }
  };

  const handleReject = async (report: AccountabilityReport, notes: string) => {
    if (!notes.trim()) return;
    try {
      await rejectAccountabilityReport(
        COMPANY_ID,
        report.id,
        userId,
        userName,
        notes
      );
      await refresh();
      setSelectedReport(null);
    } catch (err) {
      console.error('Failed to reject report:', err);
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
          <h2 className="text-xl font-bold text-foreground">Accountability Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Track and review departmental expense accountability</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--rag-green)] text-white text-sm font-medium rounded-lg hover:bg-[var(--rag-green)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Report
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
          label="Submitted (This Month)"
          value={loading ? <Skeleton className="h-7 w-12" /> : kpis.totalSubmitted}
        />
        <KPICard
          label="Pending Review"
          value={loading ? <Skeleton className="h-7 w-12" /> : kpis.pendingReview}
          trend={!loading && kpis.pendingReview > 0 ? 'down' : 'flat'}
        />
        <KPICard
          label="Approved (This Month)"
          value={loading ? <Skeleton className="h-7 w-12" /> : kpis.approvedThisMonth}
          trend="up"
        />
        <KPICard
          label="Total Amount (This Month)"
          value={loading ? <Skeleton className="h-7 w-20" /> : formatCurrency(kpis.totalAmountThisMonth)}
          unit="UGX"
        />
      </KPIGrid>

      {/* Reports Table */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border-b last:border-b-0">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 text-[var(--fg-tertiary)]" />
            <p className="text-sm text-muted-foreground">No accountability reports found</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-[var(--rag-green)] hover:underline"
            >
              Create your first report
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Submitted By</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b last:border-b-0 hover:bg-[var(--bg-sunken)] cursor-pointer transition-colors"
                      onClick={() => setSelectedReport(report)}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{report.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{report.department}</td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {formatCurrency(report.amount, report.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{report.submittedByName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(report.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[report.status]
                          }`}
                        >
                          {STATUS_LABELS[report.status]}
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

      {/* New Report Form Modal */}
      {showForm && (
        <NewReportFormModal
          onClose={() => setShowForm(false)}
          submittedBy={userId}
          submittedByName={userName}
          onSubmit={async (data) => {
            await createAccountabilityReport(COMPANY_ID, data);
            await refresh();
            setShowForm(false);
          }}
        />
      )}

      {/* Detail Panel (Slide-over) */}
      {selectedReport && (
        <ReportDetailPanel
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onApprove={() => handleApprove(selectedReport)}
          onReject={(notes) => handleReject(selectedReport, notes)}
        />
      )}
    </div>
  );
}

// ============================================================================
// NEW REPORT FORM MODAL
// ============================================================================

function NewReportFormModal({
  onClose,
  onSubmit,
  submittedBy,
  submittedByName,
}: {
  onClose: () => void;
  onSubmit: (data: Omit<AccountabilityReport, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  submittedBy: string;
  submittedByName: string;
}) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount) return;
    setSubmitting(true);
    try {
      await onSubmit({
        companyId: COMPANY_ID,
        title,
        department,
        amount: parseFloat(amount),
        currency: 'UGX',
        description,
        submittedBy,
        submittedByName,
        lineItems: [],
        receipts: [],
        status: 'submitted',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-foreground">New Accountability Report</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-sunken)] rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Marketing Expenses"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)]"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the expenses and purpose..."
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-green)] resize-none"
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
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// REPORT DETAIL PANEL (Slide-over)
// ============================================================================

function ReportDetailPanel({
  report,
  onClose,
  onApprove,
  onReject,
}: {
  report: AccountabilityReport;
  onClose: () => void;
  onApprove: () => void;
  onReject: (notes: string) => void;
}) {
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const canReview = report.status === 'submitted' || report.status === 'under_review';

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card shadow-xl h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-card z-10">
          <h3 className="font-semibold text-foreground">Report Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-sunken)] rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title and Status */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-semibold text-foreground">{report.title}</h4>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[report.status]
                }`}
              >
                {STATUS_LABELS[report.status]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {report.department} &middot; {formatDate(report.createdAt)}
            </p>
          </div>

          {/* Amount */}
          <div className="p-4 bg-[var(--bg-sunken)] rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(report.amount, report.currency)}
            </p>
          </div>

          {/* Submitted By */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Submitted By</p>
            <p className="text-sm text-foreground">{report.submittedByName}</p>
          </div>

          {/* Description */}
          {report.description && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</p>
            </div>
          )}

          {/* Line Items */}
          {report.lineItems && report.lineItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Line Items</p>
              <div className="space-y-2">
                {report.lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[var(--bg-sunken)] rounded-lg text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <p className="font-medium text-foreground">
                      {formatCurrency(item.amount, report.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Notes (if reviewed) */}
          {report.reviewedByName && (
            <div className="p-4 bg-[var(--bg-sunken)] rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">Reviewed By</p>
              <p className="text-sm text-foreground">{report.reviewedByName}</p>
              {report.reviewNotes && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mt-2 mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{report.reviewNotes}</p>
                </>
              )}
            </div>
          )}

          {/* Approve / Reject Actions */}
          {canReview && (
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
        </div>
      </div>
    </div>
  );
}

export default AccountabilityPage;
