/**
 * RequisitionCard
 *
 * Card component for a Requisition (funds / materials / labour).
 * Shows type badge, budget line, accountability progress, and approval chain.
 */

import { Receipt } from 'lucide-react';
import type { Requisition } from '../../types/requisition';
import {
  REQUISITION_TYPE_CONFIG,
  ACCOUNTABILITY_STATUS_CONFIG,
  calculateAccountabilityPercentage,
} from '../../types/requisition';
import {
  PAYMENT_STATUS_CONFIG,
  getPaymentStatusColor,
  type ApprovalStep,
  type ApprovalStepStatus,
} from '../../types/payment';
import { ExchangeRateIndicator } from './ExchangeRateIndicator';
import { FundLocationBadge } from './FundLocationBadge';

// ─── Helpers ────────────────────────────────────────────────────────

function fmt(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(date: Date | string | undefined): string {
  if (!date) return '--';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const DOT_COLORS: Record<ApprovalStepStatus, string> = {
  approved: 'bg-green-500',
  pending: 'bg-yellow-400',
  rejected: 'bg-red-500',
  skipped: 'bg-gray-300',
};

/** Map the REQUISITION_TYPE_CONFIG color names to Tailwind badge classes. */
const TYPE_BADGE_COLORS: Record<string, string> = {
  orange: 'text-orange-700 bg-orange-100',
  blue: 'text-blue-700 bg-blue-100',
  green: 'text-green-700 bg-green-100',
};

const ACCOUNTABILITY_BADGE_COLORS: Record<string, string> = {
  gray: 'text-gray-600 bg-gray-100',
  yellow: 'text-yellow-600 bg-yellow-100',
  blue: 'text-blue-600 bg-blue-100',
  green: 'text-green-600 bg-green-100',
  red: 'text-red-600 bg-red-100',
};

// ─── Component ──────────────────────────────────────────────────────

interface RequisitionCardProps {
  requisition: Requisition;
  currency?: string;
  onClick?: () => void;
}

export function RequisitionCard({
  requisition,
  currency,
  onClick,
}: RequisitionCardProps) {
  const cur = currency || requisition.currency || 'UGX';
  const typeConfig = REQUISITION_TYPE_CONFIG[requisition.requisitionType] ?? REQUISITION_TYPE_CONFIG.funds;
  const statusConfig = PAYMENT_STATUS_CONFIG[requisition.status];
  const statusColor = getPaymentStatusColor(requisition.status);
  const totalDeductions = requisition.deductions?.reduce((s, d) => s + d.amount, 0) ?? 0;
  const accountabilityPct = calculateAccountabilityPercentage(requisition);
  const accStatusConfig = ACCOUNTABILITY_STATUS_CONFIG[requisition.accountabilityStatus] ?? ACCOUNTABILITY_STATUS_CONFIG.not_required;
  const accBadgeColor =
    ACCOUNTABILITY_BADGE_COLORS[accStatusConfig.color] || ACCOUNTABILITY_BADGE_COLORS.gray;
  const typeBadgeColor =
    TYPE_BADGE_COLORS[typeConfig.color] || TYPE_BADGE_COLORS.blue;

  const truncatedPurpose = requisition.purpose
    ? requisition.purpose.length > 100
      ? `${requisition.purpose.slice(0, 100)}...`
      : requisition.purpose
    : '--';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      className={`rounded-xl border bg-white shadow-sm transition-shadow ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Receipt className="h-4 w-4 text-orange-500 shrink-0" />
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeColor}`}
        >
          {typeConfig.label}
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {requisition.requisitionNumber || requisition.paymentNumber}
        </span>
        <span className="ml-auto">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {statusConfig.label}
          </span>
        </span>
      </div>

      {/* ── Body ── */}
      <div className="space-y-3 px-4 py-3">
        {/* Purpose */}
        <p className="text-xs text-gray-600 leading-snug">
          <span className="text-gray-400">Purpose: </span>
          {truncatedPurpose}
        </p>

        {/* Budget line */}
        <p className="text-xs text-gray-600">
          <span className="text-gray-400">Budget Line: </span>
          <span className="font-medium text-gray-700">
            {requisition.budgetLineName || '--'}
          </span>
        </p>

        {/* Parent requisition (if child) */}
        {requisition.parentRequisitionNumber && (
          <p className="text-xs text-gray-600">
            <span className="text-gray-400">Parent: </span>
            <span className="font-medium text-gray-700">
              {requisition.parentRequisitionNumber}
            </span>
          </p>
        )}

        {/* Accountability progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">Accountability</span>
            <span className="font-semibold text-gray-700">
              {accountabilityPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                requisition.accountabilityStatus === 'overdue'
                  ? 'bg-red-500'
                  : requisition.accountabilityStatus === 'complete'
                    ? 'bg-green-500'
                    : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(accountabilityPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Amounts strip ── */}
      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div>
            <span className="text-gray-400">Gross </span>
            <span className="font-semibold text-gray-800">{fmt(requisition.grossAmount, cur)}</span>
          </div>
          <div>
            <span className="text-gray-400">Deductions </span>
            <span className="font-semibold text-red-600">{fmt(totalDeductions, cur)}</span>
          </div>
          <div>
            <span className="text-gray-400">Net </span>
            <span className="font-semibold text-green-700">{fmt(requisition.netAmount, cur)}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ExchangeRateIndicator exchangeRate={requisition.exchangeRate} />
          <FundLocationBadge
            locationName={(requisition as any).fundLocationName}
            locationType={(requisition as any).fundLocationType}
          />
        </div>
      </div>

      {/* ── Footer: Approval chain + accountability status ── */}
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        {/* Approval chain dots */}
        <div className="flex items-center gap-1.5">
          {requisition.approvalChain.map((step: ApprovalStep, idx: number) => (
            <span
              key={idx}
              title={`${step.role}: ${step.status}${step.userName ? ` (${step.userName})` : ''}`}
              className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLORS[step.status]}`}
            />
          ))}
          {requisition.approvalChain.length === 0 && (
            <span className="text-xs text-gray-400">No approvals yet</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {fmtDate(requisition.submittedAt?.toDate?.() ?? requisition.createdAt?.toDate?.())}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${accBadgeColor}`}
          >
            {accStatusConfig.label}
          </span>
        </div>
      </div>
    </div>
  );
}
