/**
 * IPCCard
 *
 * Card component for an Interim Payment Certificate.
 * Shows valuation breakdown, progress bar, approval chain, and QS certification.
 */

import { FileText, CheckCircle2 } from 'lucide-react';
import type { IPC } from '../../types/ipc';
import { formatIPCNumber } from '../../types/ipc';
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

// ─── Component ──────────────────────────────────────────────────────

interface IPCCardProps {
  ipc: IPC;
  currency?: string;
  onClick?: () => void;
}

export function IPCCard({ ipc, currency, onClick }: IPCCardProps) {
  const cur = currency || ipc.currency || 'UGX';
  const statusConfig = PAYMENT_STATUS_CONFIG[ipc.status];
  const statusColor = getPaymentStatusColor(ipc.status);
  const totalDeductions = ipc.deductions.reduce((s, d) => s + d.amount, 0);
  const percentComplete = Math.min(ipc.percentComplete, 100);

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`rounded-xl border bg-white shadow-sm transition-shadow ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          IPC
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {formatIPCNumber(ipc.ipcNumber)}
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
        {/* Dates */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-500">
          <span>
            Certificate Date:{' '}
            <span className="font-medium text-gray-700">{fmtDate(ipc.certificateDate)}</span>
          </span>
          <span>
            Period:{' '}
            <span className="font-medium text-gray-700">
              {fmtDate(ipc.periodFrom)} &ndash; {fmtDate(ipc.periodTo)}
            </span>
          </span>
        </div>

        {/* Valuation breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-gray-400">Works Done</p>
            <p className="font-semibold text-gray-800">
              {fmt(ipc.valuation.worksDone, cur)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Materials on Site</p>
            <p className="font-semibold text-gray-800">
              {fmt(ipc.valuation.materialsOnSite, cur)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Variations</p>
            <p className="font-semibold text-gray-800">
              {fmt(ipc.valuation.variationsApproved, cur)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">Progress</span>
            <span className="font-semibold text-gray-700">
              {percentComplete.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Amounts strip ── */}
      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div>
            <span className="text-gray-400">Gross </span>
            <span className="font-semibold text-gray-800">{fmt(ipc.grossAmount, cur)}</span>
          </div>
          <div>
            <span className="text-gray-400">Deductions </span>
            <span className="font-semibold text-red-600">{fmt(totalDeductions, cur)}</span>
          </div>
          <div>
            <span className="text-gray-400">Net </span>
            <span className="font-semibold text-green-700">{fmt(ipc.netAmount, cur)}</span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ExchangeRateIndicator exchangeRate={ipc.exchangeRate} />
          <FundLocationBadge
            locationName={(ipc as any).fundLocationName}
            locationType={(ipc as any).fundLocationType}
          />
        </div>
      </div>

      {/* ── Footer: Approval chain + QS ── */}
      <div className="flex items-center justify-between border-t px-4 py-2.5">
        {/* Approval chain dots */}
        <div className="flex items-center gap-1.5">
          {ipc.approvalChain.map((step: ApprovalStep, idx: number) => (
            <span
              key={idx}
              title={`${step.role}: ${step.status}${step.userName ? ` (${step.userName})` : ''}`}
              className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLORS[step.status]}`}
            />
          ))}
          {ipc.approvalChain.length === 0 && (
            <span className="text-xs text-gray-400">No approvals yet</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Certificate date */}
          <span className="text-xs text-gray-400">{fmtDate(ipc.certificateDate)}</span>

          {/* QS certified indicator */}
          {ipc.qsCertifiedBy && (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-green-600"
              title={`Certified by QS${ipc.qsCertifiedAt ? ` on ${fmtDate(ipc.qsCertifiedAt.toDate())}` : ''}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              QS
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
