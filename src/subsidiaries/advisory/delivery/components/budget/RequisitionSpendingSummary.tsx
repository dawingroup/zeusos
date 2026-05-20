/**
 * Requisition Spending Summary - Financial flow overview
 */

import { ArrowRight, FileText, Banknote, CheckCircle, Clock } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';

interface RequisitionSpendingSummaryProps {
  requisitionSummary: {
    totalRequisitioned: number;
    totalPaid: number;
    totalPending: number;
    totalAccountedFor: number;
    count: number;
  };
  currency: string;
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(0);
}

export function RequisitionSpendingSummary({
  requisitionSummary,
  currency,
}: RequisitionSpendingSummaryProps) {
  const { totalRequisitioned, totalPaid, totalPending, totalAccountedFor, count } = requisitionSummary;

  const accountabilityRate = totalPaid > 0
    ? ((totalAccountedFor / totalPaid) * 100).toFixed(0)
    : '0';

  return (
    <BaseCard padding="lg">
      <h3 className="text-base font-medium text-gray-900 mb-4">Requisition Flow</h3>

      {count === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          No requisitions submitted yet.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs text-blue-600 font-medium">Requisitioned</span>
              </div>
              <div className="text-lg font-semibold text-blue-800">
                {currency} {formatCompact(totalRequisitioned)}
              </div>
              <div className="text-xs text-blue-500">{count} requisitions</div>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-600 font-medium">Disbursed</span>
              </div>
              <div className="text-lg font-semibold text-green-800">
                {currency} {formatCompact(totalPaid)}
              </div>
              <div className="text-xs text-green-500">Total paid out</div>
            </div>

            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs text-amber-600 font-medium">Pending</span>
              </div>
              <div className="text-lg font-semibold text-amber-800">
                {currency} {formatCompact(totalPending)}
              </div>
              <div className="text-xs text-amber-500">Awaiting payment</div>
            </div>

            <div className="bg-indigo-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs text-indigo-600 font-medium">Accounted</span>
              </div>
              <div className="text-lg font-semibold text-indigo-800">
                {currency} {formatCompact(totalAccountedFor)}
              </div>
              <div className="text-xs text-indigo-500">{accountabilityRate}% accountability rate</div>
            </div>
          </div>

          {/* Flow diagram */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-2">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-1">
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <span>Requisition</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 mt-[-12px]" />
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-1">
                <Banknote className="w-4 h-4 text-green-500" />
              </div>
              <span>Disbursement</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 mt-[-12px]" />
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mb-1">
                <CheckCircle className="w-4 h-4 text-indigo-500" />
              </div>
              <span>Accountability</span>
            </div>
          </div>
        </div>
      )}
    </BaseCard>
  );
}
