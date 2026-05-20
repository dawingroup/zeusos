/**
 * RequisitionFlowCard - Expandable card showing requisition timeline with accountabilities
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Wallet,
  Eye,
  Bell,
  Flag,
} from 'lucide-react';
import { RequisitionWithAccountabilities } from '../../hooks/accountability-hooks';
import { AccountabilityStatus } from '../../types/requisition';
import { Accountability } from '../../types/accountability';

interface RequisitionFlowCardProps {
  requisition: RequisitionWithAccountabilities;
  currency?: string;
  onSendReminder?: (requisitionId: string) => void;
  onFlagIssue?: (requisitionId: string) => void;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
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

const STATUS_CONFIG: Record<
  AccountabilityStatus,
  { color: string; bgColor: string; icon: typeof Clock; label: string }
> = {
  not_required: { color: 'text-gray-600', bgColor: 'bg-gray-100', icon: CheckCircle, label: 'Not Required' },
  pending: { color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Clock, label: 'Pending' },
  partial: { color: 'text-blue-600', bgColor: 'bg-blue-100', icon: AlertTriangle, label: 'Partial' },
  complete: { color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle, label: 'Complete' },
  overdue: { color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle, label: 'Overdue' },
};

interface TimelineStepProps {
  label: string;
  date?: string;
  user?: string;
  isComplete: boolean;
  isCurrent?: boolean;
  isLast?: boolean;
}

function TimelineStep({ label, date, user, isComplete, isCurrent, isLast }: TimelineStepProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${
            isComplete
              ? 'bg-green-100'
              : isCurrent
              ? 'bg-blue-100'
              : 'bg-gray-100'
          }`}
        >
          {isComplete ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : isCurrent ? (
            <Clock className="w-4 h-4 text-blue-600" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-gray-300" />
          )}
        </div>
        {!isLast && <div className="w-0.5 h-8 bg-gray-200 my-1" />}
      </div>
      <div className="min-w-0 pb-2">
        <div className="font-medium text-sm text-gray-900">{label}</div>
        {date && <div className="text-xs text-gray-500">{date}</div>}
        {user && <div className="text-xs text-gray-400">{user}</div>}
      </div>
    </div>
  );
}

function AccountabilityItem({ accountability, currency }: { accountability: Accountability; currency: string }) {
  const isVerified = accountability.verifiedBy;

  return (
    <Link
      to={`/advisory/delivery/accountabilities/${accountability.id}`}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
    >
      <div className="flex items-center gap-3">
        <Wallet className="w-4 h-4 text-gray-400" />
        <div>
          <div className="text-sm font-medium">
            {formatCurrency(accountability.totalExpenses, currency)}
          </div>
          <div className="text-xs text-gray-500">
            {accountability.expenses?.length || 0} expenses
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isVerified ? (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            Verified
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </Link>
  );
}

export function RequisitionFlowCard({
  requisition,
  currency = 'UGX',
  onSendReminder,
  onFlagIssue,
}: RequisitionFlowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = STATUS_CONFIG[requisition.accountabilityStatus];
  const StatusIcon = statusConfig.icon;

  const isOverdue = requisition.accountabilityStatus === 'overdue';
  const isDueSoon = requisition.daysUntilDue <= 7 && requisition.daysUntilDue > 0;
  const needsAttention = isOverdue || isDueSoon;

  const totalAccounted = requisition.accountabilities.reduce(
    (sum, acc) => sum + acc.totalExpenses + (acc.unspentReturned || 0),
    0
  );

  return (
    <div
      className={`bg-white rounded-lg border overflow-hidden ${
        isOverdue ? 'border-red-200' : isDueSoon ? 'border-amber-200' : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {requisition.requisitionNumber}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                  <StatusIcon className="w-3 h-3 inline mr-1" />
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{requisition.purpose}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-semibold text-gray-900">
                {formatCurrency(requisition.grossAmount, currency)}
              </div>
              {requisition.unaccountedAmount > 0 && (
                <div className="text-sm text-amber-600">
                  {formatCurrency(requisition.unaccountedAmount, currency)} unaccounted
                </div>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Alert bar */}
        {needsAttention && (
          <div
            className={`mt-3 p-2 rounded-lg flex items-center gap-2 text-sm ${
              isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isOverdue ? (
              <>
                <XCircle className="w-4 h-4" />
                <span>
                  Overdue by {Math.abs(requisition.daysUntilDue)} day
                  {Math.abs(requisition.daysUntilDue) !== 1 ? 's' : ''}
                </span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>
                  Due in {requisition.daysUntilDue} day{requisition.daysUntilDue !== 1 ? 's' : ''} (
                  {formatDate(new Date(requisition.accountabilityDueDate))})
                </span>
              </>
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Document Flow</h4>
              <div className="space-y-0">
                <TimelineStep
                  label="Created"
                  date={formatDate(requisition.createdAt?.toDate())}
                  user={requisition.createdBy}
                  isComplete={true}
                />
                <TimelineStep
                  label="Approved"
                  date={
                    requisition.approvalChain?.find(a => a.status === 'approved')
                      ? formatDate(requisition.approvalChain.find(a => a.status === 'approved')?.timestamp?.toDate())
                      : undefined
                  }
                  user={requisition.approvalChain?.find(a => a.status === 'approved')?.userName}
                  isComplete={requisition.status !== 'draft' && requisition.status !== 'submitted'}
                />
                <TimelineStep
                  label="Paid"
                  date={formatDate(requisition.paidAt?.toDate())}
                  isComplete={requisition.status === 'paid'}
                />
                <TimelineStep
                  label="Accountability"
                  date={
                    requisition.accountabilities.length > 0
                      ? `${requisition.accountabilities.length} submitted`
                      : requisition.accountabilityStatus === 'overdue'
                      ? 'NOT SUBMITTED'
                      : 'Pending'
                  }
                  isComplete={requisition.accountabilityStatus === 'complete'}
                  isCurrent={
                    requisition.accountabilityStatus === 'pending' ||
                    requisition.accountabilityStatus === 'partial'
                  }
                  isLast
                />
              </div>
            </div>

            {/* Accountabilities */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Accountabilities ({requisition.accountabilities.length})
              </h4>
              {requisition.accountabilities.length > 0 ? (
                <div className="space-y-2">
                  {requisition.accountabilities.map(acc => (
                    <AccountabilityItem key={acc.id} accountability={acc} currency={currency} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <Wallet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No accountabilities submitted</p>
                </div>
              )}

              {/* Financial summary */}
              {requisition.accountabilities.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Requisition Amount</span>
                    <span className="font-medium">{formatCurrency(requisition.grossAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Total Accounted</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(totalAccounted, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 pt-1 border-t">
                    <span className="text-gray-600">Remaining</span>
                    <span
                      className={`font-medium ${
                        requisition.unaccountedAmount > 0 ? 'text-amber-600' : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(requisition.unaccountedAmount, currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <Link
              to={`/advisory/delivery/requisitions/${requisition.id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
            >
              <Eye className="w-4 h-4" />
              View Details
            </Link>
            {requisition.accountabilityStatus !== 'complete' && (
              <>
                {onSendReminder && (
                  <button
                    onClick={() => onSendReminder(requisition.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 ${
                      isOverdue ? 'border-red-200 text-red-700' : ''
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                    {isOverdue ? 'Send Urgent Reminder' : 'Send Reminder'}
                  </button>
                )}
                {isOverdue && onFlagIssue && (
                  <button
                    onClick={() => onFlagIssue(requisition.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
                  >
                    <Flag className="w-4 h-4" />
                    Flag Issue
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
