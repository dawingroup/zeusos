/**
 * Payment Detail Page
 *
 * Polymorphic detail page that renders differently based on payment type
 * (IPC or Requisition). Supports co-investment tagging for projects with
 * co-investment entries.
 *
 * Route: /advisory/delivery/projects/:projectId/payments/:paymentId
 */

import { useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Loader2,
  AlertCircle,
  FileText,
  Send,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import {
  usePayment,
  useUpdatePaymentCoInvestment,
  useSubmitPayment,
  useIPC,
  useRequisition,
} from '../hooks/payment-hooks';
import { useProject } from '../hooks/project-hooks';
import {
  Payment,
  PaymentStatus,
  PAYMENT_STATUS_CONFIG,
  getPaymentTypeLabel,
  DEDUCTION_TYPE_LABELS,
} from '../types/payment';
import type { IPC } from '../types/ipc';
import type { Requisition } from '../types/requisition';
import { REQUISITION_TYPE_CONFIG } from '../types/requisition';
import { CoInvestmentSourceSelector } from '../components/payments';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

// ─────────────────────────────────────────────────────────────────
// HELPERS
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

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

function formatDate(date: Date | undefined | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────
// APPROVAL CHAIN TIMELINE (reused pattern from RequisitionDetailPage)
// ─────────────────────────────────────────────────────────────────

function ApprovalChainTimeline({
  approvalChain,
  currentLevel,
}: {
  approvalChain: Payment['approvalChain'];
  currentLevel: number;
}) {
  if (!approvalChain || approvalChain.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No approval chain defined yet. Submit for approval to initiate.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {approvalChain.map((step, index) => {
        const isComplete = step.status === 'approved';
        const isRejected = step.status === 'rejected';
        const isCurrent = index === currentLevel && step.status === 'pending';

        return (
          <div key={index} className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isComplete ? 'bg-green-100' :
              isRejected ? 'bg-red-100' :
              isCurrent ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {isComplete ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : isRejected ? (
                <XCircle className="w-4 h-4 text-red-600" />
              ) : isCurrent ? (
                <Clock className="w-4 h-4 text-blue-600" />
              ) : (
                <span className="text-xs text-gray-500">{index + 1}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm capitalize">
                  {step.role?.replace('_', ' ') || `Level ${index + 1}`}
                </span>
                {isCurrent && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                    Pending
                  </span>
                )}
              </div>
              {step.userName && (
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3" />
                  {step.userName}
                  {step.timestamp && (
                    <span className="ml-1">• {formatDate(step.timestamp.toDate())}</span>
                  )}
                </div>
              )}
              {step.comments && (
                <p className="text-xs text-gray-600 mt-1 italic">"{step.comments}"</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// IPC DETAIL SECTION
// ─────────────────────────────────────────────────────────────────

function IPCDetailSection({ ipc, currency }: { ipc: IPC; currency: string }) {
  return (
    <div className="space-y-6">
      {/* Certificate Summary Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Certificate Details</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">IPC Number</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                IPC {String(ipc.ipcNumber).padStart(2, '0')}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Certificate Date</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatDate(ipc.certificateDate)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Contract Value</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                {formatCurrency(ipc.contractValue, currency)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">% Complete</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {ipc.percentComplete.toFixed(1)}%
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Previous Certified</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">
                {formatCurrency(ipc.previousCertified, currency)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">This Certificate</td>
              <td className="px-4 py-3 text-right font-semibold text-blue-600 font-mono">
                {formatCurrency(ipc.thisCertified, currency)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 bg-gray-50">
              <td className="px-4 py-3 text-gray-900 font-semibold">Cumulative Certified</td>
              <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                {formatCurrency(ipc.cumulativeCertified, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Valuation Breakdown */}
      {ipc.valuation && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Valuation Summary</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">Works Done</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">
                  {formatCurrency(ipc.valuation.worksDone, currency)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">Materials on Site</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">
                  {formatCurrency(ipc.valuation.materialsOnSite, currency)}
                </td>
              </tr>
              {ipc.valuation.variationsApproved > 0 && (
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">Variations Approved</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">
                    {formatCurrency(ipc.valuation.variationsApproved, currency)}
                  </td>
                </tr>
              )}
              <tr className="hover:bg-gray-50 bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-semibold">Gross Valuation</td>
                <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                  {formatCurrency(ipc.valuation.grossValuation, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Bill Items */}
      {ipc.valuation?.billItems && ipc.valuation.billItems.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Bill Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">This Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">This Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ipc.valuation.billItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.billReference}</td>
                    <td className="px-4 py-3 text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {item.thisQuantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {formatCurrency(item.contractRate, currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                      {formatCurrency(item.thisAmount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QS Certification */}
      {ipc.qsCertifiedBy && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium text-sm">QS Certified by {ipc.qsCertifiedBy}</span>
            {ipc.qsCertifiedAt && (
              <span className="text-xs text-green-600 ml-2">
                {formatDate(ipc.qsCertifiedAt.toDate())}
              </span>
            )}
          </div>
          {ipc.qsComments && (
            <p className="text-sm text-green-600 mt-1 italic">"{ipc.qsComments}"</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION DETAIL SECTION
// ─────────────────────────────────────────────────────────────────

function RequisitionDetailSection({ requisition, currency }: { requisition: Requisition; currency: string }) {
  const typeConfig = REQUISITION_TYPE_CONFIG[requisition.requisitionType] || REQUISITION_TYPE_CONFIG.funds;

  return (
    <div className="space-y-6">
      {/* Requisition Summary Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Requisition Details</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Requisition Number</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {requisition.requisitionNumber}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Type</td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-gray-900">{typeConfig.label}</span>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Purpose</td>
              <td className="px-4 py-3 text-right text-gray-900">{requisition.purpose}</td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Budget Line</td>
              <td className="px-4 py-3 text-right text-gray-900">{requisition.budgetLineName || '—'}</td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Accountability Status</td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold capitalize text-gray-900">
                  {requisition.accountabilityStatus?.replace('_', ' ') || '—'}
                </span>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Accountability Due</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {formatDate(requisition.accountabilityDueDate)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-600">Unaccounted</td>
              <td className={`px-4 py-3 text-right font-semibold font-mono ${
                (requisition.unaccountedAmount || 0) > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {formatCurrency(requisition.unaccountedAmount || 0, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Line Items */}
      {requisition.items && requisition.items.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Line Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requisition.items.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{item.category?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(item.unitCost, currency)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCurrency(item.totalCost, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-right font-mono">
                    {formatCurrency(requisition.grossAmount, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* BOQ Items */}
      {requisition.boqItems && requisition.boqItems.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">BOQ Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requisition.boqItems.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.boqItemCode}</td>
                    <td className="px-4 py-3 text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantityRequested} {item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(item.rate, currency)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCurrency(item.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Source Document Link */}
      <Link
        to={`/advisory/delivery/projects/${requisition.projectId}/requisitions/${requisition.id}`}
        className="block bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3 text-blue-700">
          <ExternalLink className="w-5 h-5" />
          <span className="font-medium text-sm">View Full Requisition Detail</span>
        </div>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────

export function PaymentDetailPage() {
  const { projectId, paymentId } = useParams<{ projectId: string; paymentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || '';

  // Fetch payment
  const { payment, loading, error, refresh } = usePayment(db, paymentId || null);

  // Fetch project (for programId and currency)
  const { project } = useProject(db, projectId || null);
  const currency = project?.budget?.currency || payment?.currency || 'UGX';
  const programId = project?.programId || payment?.programId || '';

  // Type-specific data
  const { ipc } = useIPC(db, payment?.paymentType === 'ipc' ? paymentId || null : null);
  const { requisition } = useRequisition(db, payment?.paymentType === 'requisition' ? paymentId || null : null);

  // Mutation hooks
  const { submitForApproval, markAsPaid, loading: submitLoading } = useSubmitPayment(db, userId);
  const { updateCoInvestment, loading: coInvestmentLoading } = useUpdatePaymentCoInvestment(db, userId);

  // Local state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const handleCoInvestmentChange = useCallback(
    async (entryId: string | null, sourceName: string | null) => {
      if (!paymentId) return;
      await updateCoInvestment(paymentId, entryId, sourceName);
      await refresh();
    },
    [paymentId, updateCoInvestment, refresh]
  );

  const handleSubmitForApproval = async () => {
    if (!paymentId) return;
    try {
      await submitForApproval(paymentId);
      setShowSubmitConfirm(false);
      await refresh();
    } catch (err) {
      console.error('Failed to submit:', err);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!paymentId) return;
    try {
      await markAsPaid(paymentId);
      await refresh();
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  // ── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading payment...</span>
      </div>
    );
  }

  // ── Error / Not Found ──────────────────────────────────────────
  if (error || !payment) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error?.message || 'Payment not found'}</span>
        </div>
      </div>
    );
  }

  const statusConfig = PAYMENT_STATUS_CONFIG[payment.status];
  const canSubmit = payment.status === 'draft';
  const canMarkPaid = payment.status === 'approved';

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{payment.paymentNumber}</h1>
            <span className={`px-3 py-1 text-sm rounded-full ${STATUS_COLORS[payment.status]}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-gray-600">{getPaymentTypeLabel(payment.paymentType)}</p>
        </div>
        <div className="flex items-center gap-2">
          {canSubmit && (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
              Submit for Approval
            </button>
          )}
          {canMarkPaid && (
            <button
              onClick={handleMarkAsPaid}
              disabled={submitLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              Mark as Paid
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column (Main Content) ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Summary Table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Payment Summary</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">Payment Number</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                    {payment.paymentNumber}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">Type</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {getPaymentTypeLabel(payment.paymentType)}
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">Gross Amount</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                    {formatCurrency(payment.grossAmount, currency)}
                  </td>
                </tr>
                {payment.deductions.length > 0 && payment.deductions.map((ded, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 pl-8">
                      Less: {DEDUCTION_TYPE_LABELS[ded.type] || ded.description}
                      {ded.rate ? ` (${ded.rate}%)` : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-mono">
                      ({formatCurrency(ded.amount, currency)})
                    </td>
                  </tr>
                ))}
                <tr className="hover:bg-gray-50 bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-semibold">Net Amount</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                    {formatCurrency(payment.netAmount, currency)}
                  </td>
                </tr>
                {payment.periodFrom && (
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">Period</td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatDate(payment.periodFrom)} — {formatDate(payment.periodTo)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Type-specific sections */}
          {payment.paymentType === 'ipc' && ipc && (
            <IPCDetailSection ipc={ipc} currency={currency} />
          )}
          {payment.paymentType === 'requisition' && requisition && (
            <RequisitionDetailSection requisition={requisition} currency={currency} />
          )}

          {/* Supporting Documents */}
          {payment.supportingDocs && payment.supportingDocs.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">Supporting Documents</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payment.supportingDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{doc.name}</td>
                      <td className="px-4 py-3 text-gray-500">{doc.type}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(doc.uploadedAt?.toDate())}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Status & Dates */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Status & Dates</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-4 py-3 text-gray-600">Status</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[payment.status]}`}>
                      {statusConfig.label}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-600">Created</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatDate(payment.createdAt?.toDate())}</td>
                </tr>
                {payment.submittedAt && (
                  <tr>
                    <td className="px-4 py-3 text-gray-600">Submitted</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatDate(payment.submittedAt.toDate())}</td>
                  </tr>
                )}
                {payment.approvedAt && (
                  <tr>
                    <td className="px-4 py-3 text-gray-600">Approved</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatDate(payment.approvedAt.toDate())}</td>
                  </tr>
                )}
                {payment.paidAt && (
                  <tr>
                    <td className="px-4 py-3 text-gray-600">Paid</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{formatDate(payment.paidAt.toDate())}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-3 text-gray-600">Created By</td>
                  <td className="px-4 py-3 text-right text-gray-900">{payment.createdBy || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Co-Investment Source Selector */}
          {programId && projectId && (
            <CoInvestmentSourceSelector
              programId={programId}
              projectId={projectId}
              currentEntryId={payment.coInvestmentEntryId}
              onSelect={handleCoInvestmentChange}
              disabled={coInvestmentLoading}
            />
          )}

          {/* Co-Investment Tag (if already tagged) */}
          {payment.coInvestmentSourceName && !programId && (
            <div className="bg-white border rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-1">Co-Investment Source</div>
              <div className="font-medium text-gray-900">{payment.coInvestmentSourceName}</div>
            </div>
          )}

          {/* Approval Chain */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Approval Chain</h2>
            </div>
            <div className="p-4">
              <ApprovalChainTimeline
                approvalChain={payment.approvalChain}
                currentLevel={payment.currentApprovalLevel || 0}
              />
            </div>
          </div>

          {/* Project Link */}
          <Link
            to={`/advisory/delivery/projects/${payment.projectId}`}
            className="block bg-white border rounded-lg p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Project</div>
                <div className="font-medium text-primary">View Project Details</div>
              </div>
            </div>
          </Link>

          {/* Related Payment Link */}
          {payment.relatedPaymentId && (
            <Link
              to={`/advisory/delivery/projects/${payment.projectId}/payments/${payment.relatedPaymentId}`}
              className="block bg-white border rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Related Payment</div>
                  <div className="font-medium text-primary">View Related Payment</div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSubmitConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Submit for Approval?</h3>
            <p className="text-gray-600 mb-4">
              This will submit the payment for {formatCurrency(payment.grossAmount, currency)} to the approval workflow.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForApproval}
                disabled={submitLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {submitLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentDetailPage;
