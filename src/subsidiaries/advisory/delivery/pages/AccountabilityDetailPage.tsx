/**
 * AccountabilityDetailPage - Financial-Optimized View
 *
 * Designed for finance review with:
 * - Header summary: Requisition amount, expenses total, variance
 * - Expense line items in tabular format
 * - Expandable document viewer in continuous form
 */

import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Loader2,
  AlertCircle,
  ChevronRight,
  Receipt,
  FileText,
  Printer,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useAccountability, useExpenseVerification, useRequisition } from '../hooks/payment-hooks';
import {
  AccountabilityExpense,
  ExpenseStatus,
} from '../types/accountability';
import { PaymentStatus } from '../types/payment';
import { EXPENSE_CATEGORY_LABELS } from '../types/requisition';
import {
  DocumentViewerContinuous,
} from '../components/accountability/SupportingDocuments';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

// ─────────────────────────────────────────────────────────────────
// STATUS CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────

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

const EXPENSE_STATUS_ICONS: Record<ExpenseStatus, React.ElementType> = {
  pending: Clock,
  verified: CheckCircle,
  rejected: XCircle,
};

// ─────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, _currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyFull(amount: number, currency: string = 'UGX'): string {
  return `${currency} ${formatCurrency(amount, currency)}`;
}

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────
// SUMMARY HEADER COMPONENT
// ─────────────────────────────────────────────────────────────────

interface SummaryHeaderProps {
  requisitionAmount: number;
  totalExpenses: number;
  unspentReturned: number;
  currency: string;
}

function SummaryHeader({
  requisitionAmount,
  totalExpenses,
  unspentReturned,
  currency,
}: SummaryHeaderProps) {
  const totalAccounted = totalExpenses + unspentReturned;
  const variance = requisitionAmount - totalAccounted;
  const isBalanced = Math.abs(variance) < 1;
  const isUnder = variance > 0;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Main amounts row */}
      <div className="grid grid-cols-3 divide-x">
        <div className="p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">Requisition Amount</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrencyFull(requisitionAmount, currency)}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">Total Expenses</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrencyFull(totalExpenses, currency)}
          </div>
        </div>
        <div className="p-4 text-center">
          <div className="text-sm text-gray-500 mb-1">Variance</div>
          <div
            className={`text-2xl font-bold flex items-center justify-center gap-2 ${
              isBalanced
                ? 'text-green-600'
                : isUnder
                ? 'text-amber-600'
                : 'text-red-600'
            }`}
          >
            {isBalanced ? (
              <>
                <CheckCircle className="w-6 h-6" />
                <span>Balanced</span>
              </>
            ) : (
              <>
                {isUnder ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
                <span>
                  {isUnder ? '-' : '+'}
                  {formatCurrencyFull(Math.abs(variance), currency)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Unspent returned row (if applicable) */}
      {unspentReturned > 0 && (
        <div className="border-t bg-gray-50 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-gray-600">Unspent Amount Returned</span>
          <span className="font-medium text-gray-900">
            {formatCurrencyFull(unspentReturned, currency)}
          </span>
        </div>
      )}

      {/* Reconciliation bar */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Accountability Progress</span>
          <span>
            {formatCurrency(totalAccounted, currency)} / {formatCurrency(requisitionAmount, currency)} (
            {((totalAccounted / requisitionAmount) * 100).toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              isBalanced ? 'bg-green-500' : isUnder ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min((totalAccounted / requisitionAmount) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EXPENSE LINE ITEM ROW
// ─────────────────────────────────────────────────────────────────

interface ExpenseLineItemProps {
  expense: AccountabilityExpense;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onVerify: (expenseId: string, approved: boolean, reason?: string) => Promise<void>;
  canVerify: boolean;
  verifying: boolean;
  currency: string;
}

function ExpenseLineItem({
  expense,
  index,
  isExpanded,
  onToggle,
  onVerify,
  canVerify,
  verifying,
  currency,
}: ExpenseLineItemProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const StatusIcon = EXPENSE_STATUS_ICONS[expense.status];
  const categoryLabel =
    EXPENSE_CATEGORY_LABELS[expense.category as keyof typeof EXPENSE_CATEGORY_LABELS] ||
    expense.category;

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    await onVerify(expense.id, false, rejectReason);
    setShowRejectInput(false);
    setRejectReason('');
  };

  const documentCount = expense.documents?.length || 0;

  return (
    <div className={`border-b last:border-b-0 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
      {/* Main row */}
      <div
        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 cursor-pointer ${
          expense.status === 'rejected' ? 'bg-red-50/50' : ''
        }`}
        onClick={onToggle}
      >
        {/* Line # */}
        <div className="col-span-1 text-sm text-gray-500 font-mono">
          {(expense.lineNumber || index + 1).toString().padStart(2, '0')}
        </div>

        {/* Status */}
        <div className="col-span-1">
          <StatusIcon
            className={`w-5 h-5 ${
              expense.status === 'verified'
                ? 'text-green-500'
                : expense.status === 'rejected'
                ? 'text-red-500'
                : 'text-amber-500'
            }`}
          />
        </div>

        {/* Date */}
        <div className="col-span-1 text-sm text-gray-600">{formatDate(expense.date)}</div>

        {/* Description & Vendor */}
        <div className="col-span-3">
          <div className="text-sm font-medium text-gray-900 truncate">{expense.description}</div>
          {expense.vendor && (
            <div className="text-xs text-gray-500 truncate">{expense.vendor}</div>
          )}
        </div>

        {/* Category */}
        <div className="col-span-2 text-xs text-gray-600">{categoryLabel}</div>

        {/* Invoice/Receipt # */}
        <div className="col-span-1 text-xs text-gray-500 font-mono">
          {expense.invoiceNumber || expense.receiptNumber || '-'}
        </div>

        {/* Documents */}
        <div className="col-span-1 flex items-center gap-1">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className={`text-xs ${documentCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            {documentCount}
          </span>
        </div>

        {/* Amount */}
        <div className="col-span-2 text-right font-mono font-medium text-gray-900">
          {formatCurrency(expense.amount, currency)}
        </div>
      </div>

      {/* Rejection reason display */}
      {expense.status === 'rejected' && expense.rejectionReason && (
        <div className="px-4 pb-2">
          <div className="ml-8 p-2 bg-red-100 rounded text-xs text-red-700">
            <span className="font-medium">Rejected:</span> {expense.rejectionReason}
          </div>
        </div>
      )}

      {/* Verification actions */}
      {canVerify && expense.status === 'pending' && !isExpanded && (
        <div className="px-4 pb-2 flex items-center gap-2 ml-8">
          {!showRejectInput ? (
            <>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onVerify(expense.id, true);
                }}
                disabled={verifying}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
              >
                <CheckCircle className="w-3 h-3" />
                Verify
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setShowRejectInput(true);
                }}
                disabled={verifying}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
              >
                <XCircle className="w-3 h-3" />
                Reject
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="flex-1 px-2 py-1 text-xs border rounded"
                autoFocus
              />
              <button
                onClick={handleReject}
                disabled={verifying || !rejectReason.trim()}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expanded documents view */}
      {isExpanded && (
        <div className="px-4 pb-4 ml-8">
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Supporting Documents for Line {expense.lineNumber || index + 1}
            </h4>

            {expense.documents && expense.documents.length > 0 ? (
              <DocumentViewerContinuous
                documents={expense.documents}
                expenseDescription={expense.description}
              />
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No documents attached to this expense</p>
              </div>
            )}

            {/* Verification actions inside expanded view */}
            {canVerify && expense.status === 'pending' && (
              <div className="mt-4 pt-4 border-t flex items-center gap-3">
                <button
                  onClick={() => onVerify(expense.id, true)}
                  disabled={verifying}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Verify This Expense
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  disabled={verifying}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────

export function AccountabilityDetailPage() {
  const { accountabilityId } = useParams<{ accountabilityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { accountability, loading, error } = useAccountability(db, accountabilityId || null);
  const { requisition } = useRequisition(db, accountability?.requisitionId || null);
  const { verifyExpense, completeVerification, loading: verifying } = useExpenseVerification(
    db,
    accountabilityId || null,
    user?.uid || ''
  );

  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Sort expenses by line number
  const sortedExpenses = useMemo(() => {
    if (!accountability?.expenses) return [];
    return [...accountability.expenses].sort(
      (a, b) => (a.lineNumber || 0) - (b.lineNumber || 0)
    );
  }, [accountability?.expenses]);

  const handleVerifyExpense = async (expenseId: string, approved: boolean, reason?: string) => {
    try {
      await verifyExpense(expenseId, approved, reason);
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  const handleCompleteVerification = async () => {
    try {
      await completeVerification(verificationNotes || undefined);
      setShowCompleteModal(false);
    } catch (err) {
      console.error('Failed to complete verification:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading accountability...</span>
      </div>
    );
  }

  if (error || !accountability) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error?.message || 'Accountability not found'}</span>
        </div>
      </div>
    );
  }

  const pendingCount = sortedExpenses.filter(e => e.status === 'pending').length;
  const verifiedCount = sortedExpenses.filter(e => e.status === 'verified').length;
  const rejectedCount = sortedExpenses.filter(e => e.status === 'rejected').length;
  const canVerify =
    accountability.status === 'submitted' || accountability.status === 'under_review';
  const canComplete = canVerify && pendingCount === 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900">Accountability Report</h1>
                  <span
                    className={`px-3 py-1 text-sm rounded-full ${
                      STATUS_COLORS[accountability.status]
                    }`}
                  >
                    {accountability.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  <span>
                    For {accountability.requisitionNumber || requisition?.requisitionNumber}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>
                    {sortedExpenses.length} line item{sortedExpenses.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Verification status badges */}
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  {verifiedCount} verified
                </span>
                {pendingCount > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                    {pendingCount} pending
                  </span>
                )}
                {rejectedCount > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                    {rejectedCount} rejected
                  </span>
                )}
              </div>

              <button className="p-2 hover:bg-gray-100 rounded-lg" title="Print">
                <Printer className="w-5 h-5 text-gray-500" />
              </button>

              <button className="p-2 hover:bg-gray-100 rounded-lg" title="Export">
                <Download className="w-5 h-5 text-gray-500" />
              </button>

              {canComplete && (
                <button
                  onClick={() => setShowCompleteModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Verification
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Header */}
        <SummaryHeader
          requisitionAmount={accountability.requisitionAmount}
          totalExpenses={accountability.totalExpenses}
          unspentReturned={accountability.unspentReturned || 0}
          currency={accountability.currency}
        />

        {/* Expense Line Items */}
        <div className="bg-white border rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div className="col-span-1">#</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-1">Ref #</div>
            <div className="col-span-1">Docs</div>
            <div className="col-span-2 text-right">Amount ({accountability.currency})</div>
          </div>

          {/* Expense rows */}
          <div className="divide-y">
            {sortedExpenses.map((expense, index) => (
              <ExpenseLineItem
                key={expense.id}
                expense={expense}
                index={index}
                isExpanded={expandedExpenseId === expense.id}
                onToggle={() =>
                  setExpandedExpenseId(expandedExpenseId === expense.id ? null : expense.id)
                }
                onVerify={handleVerifyExpense}
                canVerify={canVerify}
                verifying={verifying}
                currency={accountability.currency}
              />
            ))}
          </div>

          {/* Footer totals */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-t font-medium">
            <div className="col-span-10 text-right text-gray-700">Total Expenses:</div>
            <div className="col-span-2 text-right font-mono text-gray-900">
              {formatCurrency(accountability.totalExpenses, accountability.currency)}
            </div>
          </div>
        </div>

        {/* Audit Trail & Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audit Trail */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Audit Trail</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">Submitted</div>
                  <div className="text-xs text-gray-500">{accountability.createdBy || 'Unknown'}</div>
                  <div className="text-xs text-gray-400">
                    {formatDate(accountability.createdAt?.toDate())}
                  </div>
                </div>
              </div>

              {accountability.verifiedBy && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Verified</div>
                    <div className="text-xs text-gray-500">{accountability.verifiedBy}</div>
                    <div className="text-xs text-gray-400">
                      {formatDate(accountability.verifiedAt?.toDate())}
                    </div>
                    {accountability.verificationNotes && (
                      <p className="text-xs text-gray-600 mt-1 italic">
                        "{accountability.verificationNotes}"
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Linked Requisition */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Linked Requisition</h3>
            <Link
              to={`/advisory/delivery/requisitions/${accountability.requisitionId}`}
              className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Receipt className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {accountability.requisitionNumber || requisition?.requisitionNumber}
                  </div>
                  <div className="text-sm text-gray-500">
                    Amount: {formatCurrencyFull(accountability.requisitionAmount, accountability.currency)}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Complete Verification Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCompleteModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Complete Verification?</h3>
            <p className="text-gray-600 mb-4">
              Mark this accountability as fully verified. {verifiedCount} expense
              {verifiedCount !== 1 ? 's' : ''} verified, total:{' '}
              {formatCurrencyFull(
                accountability.receiptsSummary?.totalVerifiedAmount || accountability.totalExpenses,
                accountability.currency
              )}
            </p>
            <textarea
              value={verificationNotes}
              onChange={e => setVerificationNotes(e.target.value)}
              placeholder="Optional verification notes..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteVerification}
                disabled={verifying}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountabilityDetailPage;
