// ============================================================================
// CASH PROJECTIONS PAGE
// 90-day cash flow projections with daily balance chart and breakdown table
// ============================================================================

import { useMemo } from 'react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useOptimizer } from '../hooks/useOptimizer';
import { ProjectionChart } from '../components/optimizer/ProjectionChart';
import type { DailySnapshot } from '../types/optimizer.types';
import { useAuth } from '@/shared/hooks/useAuth';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

function confidenceBadge(score: number) {
  if (score >= 80) return { label: 'High', color: 'text-green-700 bg-green-50' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-700 bg-amber-50' };
  return { label: 'Low', color: 'text-red-700 bg-red-50' };
}

export function CashProjectionsPage() {
  useAuth();
  const companyId = 'dawinos'; // From company context

  const {
    projection,
    config,
    isLoading,
    error,
    refresh,
  } = useOptimizer({ companyId });

  const bufferAmount = config?.cashBufferSettings?.minimumCashBuffer || 5_000_000;

  const stats = useMemo(() => {
    if (!projection?.dailySnapshots?.length) return null;

    const snapshots = projection.dailySnapshots;
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const minBalance = Math.min(...snapshots.map(s => s.closingBalance));
    const maxBalance = Math.max(...snapshots.map(s => s.closingBalance));
    const totalInflow = snapshots.reduce((s, d) => s + d.totalProjectedInflow, 0);
    const totalOutflow = snapshots.reduce((s, d) => s + d.totalProjectedOutflow, 0);
    const crisisDays = snapshots.filter(s => s.closingBalance < bufferAmount).length;

    return {
      startBalance: first.openingBalance,
      endBalance: last.closingBalance,
      minBalance,
      maxBalance,
      totalInflow,
      totalOutflow,
      netChange: last.closingBalance - first.openingBalance,
      crisisDays,
      dayCount: snapshots.length,
    };
  }, [projection, bufferAmount]);

  if (isLoading && !projection) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Cash Flow Projections</h2>
        </div>
        <div className="flex items-center gap-2">
          {projection && (
            <span className="text-xs text-gray-400">
              {(() => {
                const conf = confidenceBadge(projection.metadata?.confidenceScore || 50);
                return (
                  <span className={`px-2 py-0.5 rounded-full font-medium ${conf.color}`}>
                    {conf.label} confidence
                  </span>
                );
              })()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <KPIGrid cols={4}>
          <KPICard
            label="Net Change"
            value={`${stats.netChange >= 0 ? '+' : ''}${formatCompact(stats.netChange)}`}
            delta={`${stats.dayCount}-day period`}
            trend={stats.netChange >= 0 ? 'up' : 'down'}
          />
          <KPICard
            label="Minimum Balance"
            value={formatCompact(stats.minBalance)}
            delta={`Buffer: ${formatCompact(bufferAmount)}`}
            trend={stats.minBalance < bufferAmount ? 'down' : 'flat'}
          />
          <KPICard
            label="Total Inflow"
            value={formatCompact(stats.totalInflow)}
            delta="projected receipts"
            trend="up"
          />
          <KPICard
            label="Total Outflow"
            value={formatCompact(stats.totalOutflow)}
            delta="projected spend"
            trend="down"
          />
        </KPIGrid>
      )}

      {/* Crisis Days Warning */}
      {stats && stats.crisisDays > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {stats.crisisDays} day{stats.crisisDays > 1 ? 's' : ''} below minimum cash buffer
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Balance drops below {formatUGX(bufferAmount)} during the projection period
            </p>
          </div>
        </div>
      )}

      {stats && stats.crisisDays === 0 && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-700">
            Cash position stays above the minimum buffer throughout the projection period
          </p>
        </div>
      )}

      {/* Projection Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Cash Balance Projection</h3>
        <ProjectionChart
          projection={projection}
          bufferAmount={bufferAmount}
          height={400}
        />
      </Card>

      {/* Daily Breakdown Table */}
      {projection?.dailySnapshots && projection.dailySnapshots.length > 0 && (
        <Card>
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-900">Daily Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Inflow</TableHead>
                  <TableHead className="text-right">Outflow</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projection.dailySnapshots.map((snap: DailySnapshot) => {
                  const isCrisis = snap.closingBalance < bufferAmount;
                  return (
                    <TableRow
                      key={snap.date}
                      className={isCrisis ? 'bg-red-50/50' : ''}
                    >
                      <TableCell className="text-sm">
                        {new Date(snap.date).toLocaleDateString('en-UG', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCompact(snap.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-green-600">
                        +{formatCompact(snap.totalProjectedInflow)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-red-600">
                        -{formatCompact(snap.totalProjectedOutflow)}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${
                        isCrisis ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {formatCompact(snap.closingBalance)}
                      </TableCell>
                      <TableCell>
                        {isCrisis ? (
                          <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            Below buffer
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {!projection && (
        <Card className="p-8 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No projection data available</p>
          <p className="text-xs text-gray-400">
            Run the optimizer to generate cash flow projections
          </p>
        </Card>
      )}
    </div>
  );
}

export default CashProjectionsPage;
