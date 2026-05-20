/**
 * Accountability Summary Card - Project accountability overview
 */

import { Link, useParams } from 'react-router-dom';
import { Wallet, AlertCircle, ChevronRight, CheckCircle } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface AccountabilitySummaryCardProps {
  project: Project;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `UGX ${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(0)}M`;
  return `UGX ${amount.toLocaleString()}`;
}

export function AccountabilitySummaryCard({ project }: AccountabilitySummaryCardProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const summary = project.accountabilitySummary;

  if (!summary) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-400" />
          Accountability
        </h3>
        <div className="text-center py-4 text-gray-500">
          <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No accountability data yet</p>
        </div>
      </BaseCard>
    );
  }

  const statusColors = {
    healthy: 'text-green-700 bg-green-100',
    warning: 'text-amber-700 bg-amber-100',
    critical: 'text-red-700 bg-red-100',
  };

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-gray-400" />
          Accountability
        </h3>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[summary.status] || ''}`}>
            {summary.status === 'healthy' && <CheckCircle className="w-3 h-3 mr-1" />}
            {summary.status === 'critical' && <AlertCircle className="w-3 h-3 mr-1" />}
            {summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}
          </span>
          <Link
            to={`/advisory/delivery/projects/${projectId}/requisitions`}
            className="text-primary text-xs hover:underline flex items-center"
          >
            View <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {/* Accountability rate progress */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Accountability Rate</span>
            <span className={`font-medium ${
              summary.accountabilityRate >= 80 ? 'text-green-600' :
              summary.accountabilityRate >= 60 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {summary.accountabilityRate?.toFixed(0) || 0}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                summary.accountabilityRate >= 80 ? 'bg-green-500' :
                summary.accountabilityRate >= 60 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${summary.accountabilityRate || 0}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Disbursed</div>
            <div className="text-sm font-semibold text-gray-900">{formatCurrency(summary.totalDisbursed || 0)}</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Accounted</div>
            <div className="text-sm font-semibold text-green-600">{formatCurrency(summary.totalAccounted || 0)}</div>
          </div>
          <div className="text-center bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Unaccounted</div>
            <div className="text-sm font-semibold text-amber-600">{formatCurrency(summary.unaccountedAmount || 0)}</div>
          </div>
        </div>

        {/* Counts */}
        <div className="flex items-center justify-between text-sm pt-2 border-t">
          <span className="text-gray-500">
            {summary.requisitionCount || 0} requisitions
            {summary.manualRequisitionCount ? ` + ${summary.manualRequisitionCount} manual` : ''}
          </span>
          {summary.overdueCount > 0 && (
            <span className="text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {summary.overdueCount} overdue
            </span>
          )}
        </div>
      </div>
    </BaseCard>
  );
}
