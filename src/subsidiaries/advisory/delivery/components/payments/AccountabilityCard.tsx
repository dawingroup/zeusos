/**
 * AccountabilityCard
 *
 * Card component for an Accountability report.
 * Shows linked requisition, expense / document counts, financial breakdown,
 * variance severity badge, and approval chain.
 */

import type { ReactNode } from 'react';
import { Wallet, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { Accountability } from '../../types/accountability';
import {
  VARIANCE_STATUS_CONFIG as ACC_VARIANCE_STATUS_CONFIG,
  type VarianceStatus as AccVarianceStatus,
} from '../../types/accountability';
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

const VARIANCE_BADGE_COLORS: Record<string, string> = {
  green: 'text-green-700 bg-green-100',
  blue: 'text-blue-700 bg-blue-100',
  yellow: 'text-yellow-700 bg-yellow-100',
  red: 'text-red-700 bg-red-100',
};

const VARIANCE_ICONS: Record<AccVarianceStatus, ReactNode> = {
  compliant: <CheckCircle2 className="h-3.5 w-3.5" />,
  minor: <Info className="h-3.5 w-3.5" />,
  moderate: <AlertTriangle className="h-3.5 w-3.5" />,
  severe: <XCircle className="h-3.5 w-3.5" />,
};

// ─── Component ──────────────────────────────────────────────────────

interface AccountabilityCardProps {
  accountability: Accountability;
  currency?: string;
  onClick?: () => void;
}

export function AccountabilityCard({
  accountability,
  currency,
  onClick,
}: AccountabilityCardProps) {
  const cur = currency || accountability.currency || 'UGX';
  const statusConfig = PAYMENT_STATUS_CONFIG[accountability.status];
  const statusColor = getPaymentStatusColor(accountability.status);
  const totalDeductions = accountability.deductions.reduce((s, d) => s + d.amount, 0);

  const variance = accountability.variance;
  const varianceConfig = variance
    ? ACC_VARIANCE_STATUS_CONFIG[variance.varianceStatus]
    : null;
  const varianceBadgeColor = varianceConfig
    ? VARIANCE_BADGE_COLORS[varianceConfig.color] || VARIANCE_BADGE_COLORS.green
    : VARIANCE_BADGE_COLORS.green;

  // Total document count across all expenses
  const totalDocCount = accountability.expenses.reduce(
    (sum, exp) => sum + (exp.documents?.length || 0),
    0,
  );

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
        <Wallet className="h-4 w-4 text-purple-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Accountability
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {accountability.paymentNumber}
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
        {/* Linked requisition */}
        <p className="text-xs text-gray-600">
          <span className="text-gray-400">Linked Requisition: </span>
          <span className="font-medium text-gray-700">
            {accountability.requisitionNumber || '--'}
          </span>
        </p>

        {/* Counts */}
        <div className="flex items-center gap-6 text-xs text-gray-600">
          <span>
            Expenses:{' '}
            <span className="font-medium text-gray-800">
              {accountability.expenses.length}
            </span>
          </span>
          <span>
            Documents:{' '}
            <span className="font-medium text-gray-800">{totalDocCount}</span>
          </span>
        </div>
      </div>

      {/* ── Financial breakdown ── */}
      <div className="border-t px-4 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Requisition Amount</span>
            <span className="font-semibold text-gray-800">
              {fmt(accountability.requisitionAmount, cur)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Total Expenses</span>
            <span className="font-semibold text-gray-800">
              {fmt(accountability.totalExpenses, cur)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Unspent Returned</span>
            <span className="font-semibold text-gray-800">
              {fmt(accountability.unspentReturned, cur)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Balance Due</span>
            <span
              className={`font-semibold ${
                accountability.balanceDue > 0 ? 'text-red-600' : 'text-gray-800'
              }`}
            >
              {fmt(accountability.balanceDue, cur)}
            </span>
          </div>
        </div>

        {/* Variance badge */}
        {variance && (
          <div className="pt-1">
            {accountability.isZeroDiscrepancy ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Zero Discrepancy
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${varianceBadgeColor}`}
              >
                {VARIANCE_ICONS[variance.varianceStatus]}
                {varianceConfig?.label} ({variance.variancePercentage.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Amounts strip ── */}
      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div>
            <span className="text-gray-400">Gross </span>
            <span className="font-semibold text-gray-800">
              {fmt(accountability.grossAmount, cur)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Deductions </span>
            <span className="font-semibold text-red-600">{fmt(totalDeductions, cur)}</span>
          </div>
          <div>
            <span className="text-gray-400">Net </span>
            <span className="font-semibold text-green-700">
              {fmt(accountability.netAmount, cur)}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ExchangeRateIndicator exchangeRate={accountability.exchangeRate} />
          <FundLocationBadge
            locationName={(accountability as any).fundLocationName}
            locationType={(accountability as any).fundLocationType}
          />
        </div>
      </div>

      {/* ── Footer: Approval chain + date ── */}
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        {/* Approval chain dots */}
        <div className="flex items-center gap-1.5">
          {accountability.approvalChain.map((step: ApprovalStep, idx: number) => (
            <span
              key={idx}
              title={`${step.role}: ${step.status}${step.userName ? ` (${step.userName})` : ''}`}
              className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLORS[step.status]}`}
            />
          ))}
          {accountability.approvalChain.length === 0 && (
            <span className="text-xs text-gray-400">No approvals yet</span>
          )}
        </div>

        <span className="text-xs text-gray-400">
          {fmtDate(
            accountability.submittedAt?.toDate?.() ?? accountability.createdAt?.toDate?.(),
          )}
        </span>
      </div>
    </div>
  );
}
