/**
 * Requisition Summary Card - Aggregate accountability stats across all projects
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, AlertCircle, ChevronRight } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface RequisitionSummaryCardProps {
  projects: Project[];
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `UGX ${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `UGX ${(amount / 1000000).toFixed(1)}M`;
  return `UGX ${amount.toLocaleString()}`;
}

export function RequisitionSummaryCard({ projects }: RequisitionSummaryCardProps) {
  const stats = useMemo(() => {
    let totalDisbursed = 0;
    let totalAccounted = 0;
    let totalUnaccounted = 0;
    let overdueCount = 0;
    let projectsWithData = 0;

    projects.forEach(p => {
      const summary = p.accountabilitySummary;
      if (!summary) return;
      projectsWithData++;
      totalDisbursed += summary.totalDisbursed || 0;
      totalAccounted += summary.totalAccounted || 0;
      totalUnaccounted += summary.unaccountedAmount || 0;
      overdueCount += summary.overdueCount || 0;
    });

    const accountabilityRate = totalDisbursed > 0
      ? Math.round((totalAccounted / totalDisbursed) * 100)
      : 0;

    return {
      totalDisbursed,
      totalAccounted,
      totalUnaccounted,
      overdueCount,
      accountabilityRate,
      projectsWithData,
    };
  }, [projects]);

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Accountability</h2>
        <Link
          to="/advisory/delivery/accountability"
          className="text-primary text-sm hover:underline flex items-center"
        >
          Details <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {stats.projectsWithData === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No accountability data yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Accountability rate */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Accountability Rate</span>
              <span className={`font-medium ${
                stats.accountabilityRate >= 80 ? 'text-green-600' :
                stats.accountabilityRate >= 60 ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {stats.accountabilityRate}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.accountabilityRate >= 80 ? 'bg-green-500' :
                  stats.accountabilityRate >= 60 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${stats.accountabilityRate}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Disbursed</div>
              <div className="text-sm font-semibold text-gray-900">{formatCurrency(stats.totalDisbursed)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Accounted</div>
              <div className="text-sm font-semibold text-green-600">{formatCurrency(stats.totalAccounted)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Unaccounted</div>
              <div className="text-sm font-semibold text-amber-600">{formatCurrency(stats.totalUnaccounted)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500">Overdue</div>
              <div className={`text-sm font-semibold ${stats.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {stats.overdueCount > 0 && <AlertCircle className="w-3.5 h-3.5 inline mr-1" />}
                {stats.overdueCount}
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseCard>
  );
}
