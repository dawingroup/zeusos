// ============================================================================
// WIN/LOSS ANALYSIS
// ZeusOS v2.0 - Market Intelligence Module
// Dashboard for win/loss analysis
// ============================================================================

import React from 'react';
import {
  Trophy,
  XCircle,
  Users,
  BarChart3,
} from 'lucide-react';
import { WinLossRecord } from '../../types/competitor.types';
import {
  WIN_LOSS_OUTCOME_LABELS,
  WIN_LOSS_OUTCOME_COLORS,
  WIN_LOSS_REASON_LABELS,
  WinLossOutcome,
  WinLossReason,
} from '../../constants/competitor.constants';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface WinLossAnalysisProps {
  records: WinLossRecord[];
  onViewRecord?: (record: WinLossRecord) => void;
}

const formatCurrency = (amount: number, currency = 'USD'): string => {
  if (amount >= 1000000) {
    return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${currency} ${(amount / 1000).toFixed(0)}K`;
  }
  return `${currency} ${amount}`;
};

export const WinLossAnalysis: React.FC<WinLossAnalysisProps> = ({
  records,
  onViewRecord,
}) => {
  // Calculate stats
  const total = records.length;
  const wins = records.filter(r => r.outcome === 'won').length;
  const losses = records.filter(r => r.outcome === 'lost').length;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';
  const totalValue = records.reduce((sum, r) => sum + r.estimatedValue, 0);
  const avgDealSize = total > 0 ? totalValue / total : 0;

  // Count by reason
  const reasonCounts: Record<string, { wins: number; losses: number }> = {};
  records.forEach(r => {
    r.primaryReasons.forEach(reason => {
      if (!reasonCounts[reason]) {
        reasonCounts[reason] = { wins: 0, losses: 0 };
      }
      if (r.outcome === 'won') {
        reasonCounts[reason].wins++;
      } else if (r.outcome === 'lost') {
        reasonCounts[reason].losses++;
      }
    });
  });

  // Count by competitor
  const competitorCounts: Record<string, { wins: number; losses: number; value: number }> = {};
  records.forEach(r => {
    if (!competitorCounts[r.competitorName]) {
      competitorCounts[r.competitorName] = { wins: 0, losses: 0, value: 0 };
    }
    competitorCounts[r.competitorName].value += r.estimatedValue;
    if (r.outcome === 'won') {
      competitorCounts[r.competitorName].wins++;
    } else if (r.outcome === 'lost') {
      competitorCounts[r.competitorName].losses++;
    }
  });

  const topCompetitors = Object.entries(competitorCounts)
    .map(([name, stats]) => ({
      name,
      ...stats,
      winRate: (stats.wins + stats.losses) > 0 
        ? (stats.wins / (stats.wins + stats.losses)) * 100 
        : 0,
    }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 5);

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No win/loss data</p>
          <p className="text-sm text-gray-500 mt-1">
            Record competitive outcomes to see analysis
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard label="Wins" value={wins} trend="up" />
        <KPICard label="Losses" value={losses} trend={losses > 0 ? 'down' : undefined} />
        <KPICard label="Win Rate" value={`${winRate}%`} />
        <KPICard label="Avg Deal Size" value={formatCurrency(avgDealSize)} />
      </KPIGrid>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Reason */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Win/Loss by Reason</h3>
          <div className="space-y-3">
            {Object.entries(reasonCounts)
              .sort((a, b) => (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses))
              .slice(0, 8)
              .map(([reason, counts]) => {
                const total = counts.wins + counts.losses;
                const winPct = total > 0 ? (counts.wins / total) * 100 : 0;
                return (
                  <div key={reason}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">
                        {WIN_LOSS_REASON_LABELS[reason as WinLossReason]}
                      </span>
                      <span className="text-gray-500">
                        {counts.wins}W / {counts.losses}L
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400"
                        style={{ width: `${winPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* By Competitor */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">By Competitor</h3>
          <div className="space-y-3">
            {topCompetitors.map((comp) => (
              <div
                key={comp.name}
                className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{comp.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(comp.value)} total value
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">{comp.wins}W</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-red-600 font-medium">{comp.losses}L</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {comp.winRate.toFixed(0)}% win rate
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Records */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Outcomes</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {records.slice(0, 5).map((record) => (
            <div
              key={record.id}
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => onViewRecord?.(record)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: `${WIN_LOSS_OUTCOME_COLORS[record.outcome as WinLossOutcome]}20`,
                    }}
                  >
                    {record.outcome === 'won' ? (
                      <Trophy
                        className="w-4 h-4"
                        style={{ color: WIN_LOSS_OUTCOME_COLORS[record.outcome as WinLossOutcome] }}
                      />
                    ) : (
                      <XCircle
                        className="w-4 h-4"
                        style={{ color: WIN_LOSS_OUTCOME_COLORS[record.outcome as WinLossOutcome] }}
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{record.opportunityName}</p>
                    <p className="text-sm text-gray-500">
                      {record.clientName} • vs {record.competitorName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: `${WIN_LOSS_OUTCOME_COLORS[record.outcome as WinLossOutcome]}20`,
                      color: WIN_LOSS_OUTCOME_COLORS[record.outcome as WinLossOutcome],
                    }}
                  >
                    {WIN_LOSS_OUTCOME_LABELS[record.outcome as WinLossOutcome]}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatCurrency(record.estimatedValue, record.currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WinLossAnalysis;
