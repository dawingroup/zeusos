/**
 * Requisition Detail Page - View and manage a single requisition
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Send,
  Edit,
  Wallet,
  FileText,
  User,
  Calendar,
  Loader2,
  AlertCircle,
  MinusCircle,
  Package,
  Hammer,
} from 'lucide-react';
import { useRequisition, useRequisitionAccountabilities, useSubmitPayment, useChildRequisitions, useParentRequisition } from '../hooks/payment-hooks';
import { Requisition, AccountabilityStatus } from '../types/requisition';
import { Accountability } from '../types/accountability';
import { PaymentStatus } from '../types/payment';
import { ChildRequisitionsSummary } from '../components/requisitions/ChildRequisitionsSummary';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

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

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface ApprovalChainTimelineProps {
  approvalChain: Requisition['approvalChain'];
  currentLevel: number;
}

function ApprovalChainTimeline({ approvalChain, currentLevel }: ApprovalChainTimelineProps) {
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

interface AccountabilityCardProps {
  accountability: Accountability;
}

function AccountabilityCard({ accountability }: AccountabilityCardProps) {
  return (
    <Link
      to={`/advisory/delivery/accountabilities/${accountability.id}`}
      className="block bg-gray-50 border rounded-lg p-4 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-gray-900">
            {formatCurrency(accountability.totalExpenses, accountability.currency)}
          </div>
          <div className="text-sm text-gray-500">
            {accountability.expenses?.length || 0} expenses
          </div>
        </div>
        <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[accountability.status]}`}>
          {accountability.status.replace('_', ' ')}
        </span>
      </div>
      {accountability.verifiedBy && (
        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-500" />
          Verified by {accountability.verifiedBy}
        </div>
      )}
    </Link>
  );
}

export function RequisitionDetailPage() {
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { requisition, loading, error } = useRequisition(db, requisitionId || null);
  const { accountabilities, loading: accLoading } = useRequisitionAccountabilities(db, requisitionId || null);
  const { submitForApproval, loading: submitting } = useSubmitPayment(db, user?.uid || '');

  // Hierarchy hooks
  const isFundsRequisition = requisition?.requisitionType === 'funds' ||
    (requisition?.requisitionType as string) === 'materials_services' && !requisition?.parentRequisitionId;
  const isParentEligible = isFundsRequisition && ['approved', 'paid'].includes(requisition?.status || '');
  const { children: childRequisitions, loading: childrenLoading } = useChildRequisitions(
    db,
    isParentEligible ? (requisitionId || null) : null
  );
  const { parent: parentRequisition } = useParentRequisition(
    db,
    requisition?.parentRequisitionId || null
  );

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const handleSubmitForApproval = async () => {
    if (!requisitionId) return;
    try {
      await submitForApproval(requisitionId);
      setShowSubmitConfirm(false);
    } catch (err) {
      console.error('Failed to submit:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading requisition...</span>
      </div>
    );
  }

  if (error || !requisition) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error?.message || 'Requisition not found'}</span>
        </div>
      </div>
    );
  }

  const accountabilityConfig = ACCOUNTABILITY_STATUS_CONFIG[requisition.accountabilityStatus] ?? ACCOUNTABILITY_STATUS_CONFIG.not_required;
  const AccountabilityIcon = accountabilityConfig.icon;
  const canSubmit = requisition.status === 'draft';
  const canEdit = requisition.status === 'draft';
  const canAddAccountability = requisition.status === 'paid' && 
    requisition.accountabilityStatus !== 'complete';

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
            <h1 className="text-2xl font-bold text-gray-900">{requisition.requisitionNumber}</h1>
            <span className={`px-3 py-1 text-sm rounded-full ${STATUS_COLORS[requisition.status]}`}>
              {requisition.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-gray-600">{requisition.purpose}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => navigate(`/advisory/delivery/requisitions/${requisitionId}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {canSubmit && (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Send className="w-4 h-4" />
              Submit for Approval
            </button>
          )}
          {canAddAccountability && (
            <button
              onClick={() => navigate(`/advisory/delivery/requisitions/${requisitionId}/accountability/new`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Add Accountability
            </button>
          )}
          {isParentEligible && (
            <>
              <button
                onClick={() => navigate(`/advisory/delivery/projects/${requisition.projectId}/requisitions/new/child?parentId=${requisitionId}&type=materials`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Package className="w-4 h-4" />
                Material Requisition
              </button>
              <button
                onClick={() => navigate(`/advisory/delivery/projects/${requisition.projectId}/requisitions/new/child?parentId=${requisitionId}&type=labour`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <Hammer className="w-4 h-4" />
                Labour Requisition
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <KPIGrid cols={4}>
            <KPICard
              label="Amount"
              value={formatCurrency(requisition.grossAmount, requisition.currency)}
            />
            <KPICard
              label="Unaccounted"
              value={formatCurrency(requisition.unaccountedAmount || 0, requisition.currency)}
              trend={requisition.unaccountedAmount > 0 ? 'down' : 'up'}
            />
            <KPICard
              label="Due Date"
              value={
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(requisition.accountabilityDueDate)}
                </span>
              }
            />
            <KPICard
              label="Accountability"
              value={
                <span className="inline-flex items-center gap-2">
                  <AccountabilityIcon className="w-5 h-5" />
                  {accountabilityConfig.label}
                </span>
              }
            />
          </KPIGrid>

          {/* Parent Requisition Link (for child requisitions) */}
          {parentRequisition && (
            <Link
              to={`/advisory/delivery/requisitions/${parentRequisition.id}`}
              className="block bg-orange-50 border border-orange-200 rounded-lg p-4 hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-800">
                    Parent: {parentRequisition.requisitionNumber}
                  </p>
                  <p className="text-xs text-orange-600">{parentRequisition.purpose}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-800">
                    {formatCurrency(parentRequisition.grossAmount, parentRequisition.currency)}
                  </p>
                  {parentRequisition.childRequisitionsSummary && (
                    <p className="text-xs text-orange-600">
                      Remaining: {formatCurrency(parentRequisition.childRequisitionsSummary.remainingFundsBalance, parentRequisition.currency)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          )}

          {/* Child Requisitions Summary (for parent funds requisitions) */}
          {isParentEligible && (
            <ChildRequisitionsSummary
              parentRequisition={requisition}
              children={childRequisitions}
              loading={childrenLoading}
            />
          )}

          {/* Line Items */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Category</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Qty</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Unit Cost</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requisition.items?.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="px-4 py-3 text-sm">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 capitalize">
                        {item.category?.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(item.unitCost, requisition.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(item.totalCost, requisition.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">
                      Total
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right">
                      {formatCurrency(requisition.grossAmount, requisition.currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Accountabilities */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Accountabilities</h2>
              {canAddAccountability && (
                <button
                  onClick={() => navigate(`/advisory/delivery/requisitions/${requisitionId}/accountability/new`)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              )}
            </div>
            <div className="p-4">
              {accLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : accountabilities.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No accountabilities submitted yet</p>
                  {canAddAccountability && (
                    <button
                      onClick={() => navigate(`/advisory/delivery/requisitions/${requisitionId}/accountability/new`)}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Submit accountability
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {accountabilities.map(acc => (
                    <AccountabilityCard key={acc.id} accountability={acc} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Approval Chain */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Approval Chain</h2>
            </div>
            <div className="p-4">
              <ApprovalChainTimeline 
                approvalChain={requisition.approvalChain} 
                currentLevel={requisition.currentApprovalLevel || 0} 
              />
            </div>
          </div>

          {/* Details */}
          <div className="bg-white border rounded-lg">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Details</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm text-gray-500">Budget Line</div>
                <div className="font-medium">{requisition.budgetLineName || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Advance Type</div>
                <div className="font-medium capitalize">{requisition.advanceType?.replace('_', ' ') || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Created By</div>
                <div className="font-medium">{requisition.createdBy || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Created At</div>
                <div className="font-medium">{formatDate(requisition.createdAt?.toDate())}</div>
              </div>
              {requisition.submittedAt && (
                <div>
                  <div className="text-sm text-gray-500">Submitted At</div>
                  <div className="font-medium">{formatDate(requisition.submittedAt.toDate())}</div>
                </div>
              )}
              {requisition.paidAt && (
                <div>
                  <div className="text-sm text-gray-500">Paid At</div>
                  <div className="font-medium">{formatDate(requisition.paidAt.toDate())}</div>
                </div>
              )}
            </div>
          </div>

          {/* Project Link */}
          <Link
            to={`/advisory/delivery/projects/${requisition.projectId}`}
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
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSubmitConfirm(false)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Submit for Approval?</h3>
            <p className="text-gray-600 mb-4">
              This will submit the requisition for {formatCurrency(requisition.grossAmount, requisition.currency)} to the approval workflow.
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
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RequisitionDetailPage;
