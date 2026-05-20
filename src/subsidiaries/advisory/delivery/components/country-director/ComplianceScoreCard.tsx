/**
 * ComplianceScoreCard - Visual compliance score display with breakdown
 */

import { TrendingUp, TrendingDown, Minus, Shield, Target, FileCheck, Clock } from 'lucide-react';
import { ComplianceScore } from '../../types/country-director-dashboard';

interface ComplianceScoreCardProps {
  score: ComplianceScore;
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-green-100';
  if (score >= 70) return 'bg-amber-100';
  return 'bg-red-100';
}

function getTrendIcon(trend: 'improving' | 'stable' | 'declining') {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    case 'declining':
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    default:
      return <Minus className="w-4 h-4 text-gray-400" />;
  }
}

function getTrendLabel(trend: 'improving' | 'stable' | 'declining') {
  switch (trend) {
    case 'improving':
      return 'Improving';
    case 'declining':
      return 'Declining';
    default:
      return 'Stable';
  }
}

export function ComplianceScoreCard({ score }: ComplianceScoreCardProps) {
  const scoreColor = getScoreColor(score.overallScore);
  const scoreBgColor = getScoreBgColor(score.overallScore);

  const breakdownItems = [
    {
      label: 'Zero Discrepancy Rate',
      value: score.breakdown.zeroDiscrepancyRate,
      icon: Target,
      description: 'Requisitions with zero variance',
    },
    {
      label: 'On-Time Reconciliation',
      value: score.breakdown.onTimeReconciliationRate,
      icon: Clock,
      description: 'Reconciled within 14 days',
    },
    {
      label: 'Proof of Spend',
      value: score.breakdown.proofOfSpendCompleteness,
      icon: FileCheck,
      description: 'Complete documentation',
    },
    {
      label: 'Investigation Resolution',
      value: score.breakdown.investigationResolutionRate,
      icon: Shield,
      description: 'Investigations resolved on time',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">ADD-FIN-001 Compliance</h3>
          <p className="text-sm text-gray-500 mt-1">Zero-discrepancy policy adherence</p>
        </div>
        <div className="flex items-center gap-2">
          {getTrendIcon(score.trend)}
          <span className="text-sm text-gray-600">{getTrendLabel(score.trend)}</span>
        </div>
      </div>

      {/* Main Score */}
      <div className="flex items-center justify-center mb-6">
        <div
          className={`w-32 h-32 rounded-full ${scoreBgColor} flex items-center justify-center`}
        >
          <div className="text-center">
            <div className={`text-4xl font-bold ${scoreColor}`}>
              {score.overallScore.toFixed(0)}
            </div>
            <div className="text-sm text-gray-500">/ 100</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        {breakdownItems.map((item) => {
          const Icon = item.icon;
          const itemColor = getScoreColor(item.value);

          return (
            <div key={item.label} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Icon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <span className={`text-sm font-medium ${itemColor}`}>
                    {item.value.toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.value >= 90
                        ? 'bg-green-500'
                        : item.value >= 70
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Last updated: {score.lastUpdated.toLocaleDateString()} at{' '}
          {score.lastUpdated.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

interface ComplianceScoreCompactProps {
  score: ComplianceScore;
  onClick?: () => void;
}

export function ComplianceScoreCompact({ score, onClick }: ComplianceScoreCompactProps) {
  const scoreColor = getScoreColor(score.overallScore);
  const scoreBgColor = getScoreBgColor(score.overallScore);

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left w-full"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full ${scoreBgColor} flex items-center justify-center flex-shrink-0`}
        >
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {score.overallScore.toFixed(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">Compliance Score</h4>
            {getTrendIcon(score.trend)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {score.overallScore >= 90
              ? 'Excellent compliance'
              : score.overallScore >= 70
              ? 'Needs improvement'
              : 'Requires attention'}
          </p>
        </div>
      </div>
    </button>
  );
}
