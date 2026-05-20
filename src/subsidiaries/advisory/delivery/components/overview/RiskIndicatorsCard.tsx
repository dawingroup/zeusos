/**
 * Risk Indicators Card - Computed risk signals from project data
 */

import { ShieldAlert, DollarSign, Calendar, Wallet, FileText } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface RiskIndicatorsCardProps {
  project: Project;
}

interface RiskIndicator {
  id: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  icon: typeof DollarSign;
}

export function RiskIndicatorsCard({ project }: RiskIndicatorsCardProps) {
  const risks: RiskIndicator[] = [];

  // Budget risk
  const budgetUtilization = project.budget?.totalBudget
    ? (project.budget.spent / project.budget.totalBudget)
    : 0;
  if (project.budget?.varianceStatus === 'over' || budgetUtilization > 0.95) {
    risks.push({
      id: 'budget',
      label: 'Budget',
      severity: 'high',
      description: budgetUtilization > 0.95
        ? `${(budgetUtilization * 100).toFixed(0)}% of budget spent`
        : 'Over budget',
      icon: DollarSign,
    });
  } else if (budgetUtilization > 0.8) {
    risks.push({
      id: 'budget',
      label: 'Budget',
      severity: 'medium',
      description: `${(budgetUtilization * 100).toFixed(0)}% of budget spent`,
      icon: DollarSign,
    });
  } else {
    risks.push({
      id: 'budget',
      label: 'Budget',
      severity: 'low',
      description: 'Within budget',
      icon: DollarSign,
    });
  }

  // Schedule risk
  const timeline = project.timeline;
  const progress = project.progress;
  if (timeline?.isDelayed) {
    risks.push({
      id: 'schedule',
      label: 'Schedule',
      severity: 'high',
      description: `Delayed by ${timeline.delayDays} days`,
      icon: Calendar,
    });
  } else if (
    timeline &&
    progress &&
    timeline.percentTimeElapsed > 0 &&
    progress.physicalProgress < timeline.percentTimeElapsed * 0.7
  ) {
    risks.push({
      id: 'schedule',
      label: 'Schedule',
      severity: 'medium',
      description: `${timeline.percentTimeElapsed}% time elapsed, ${progress.physicalProgress}% done`,
      icon: Calendar,
    });
  } else {
    risks.push({
      id: 'schedule',
      label: 'Schedule',
      severity: 'low',
      description: 'On schedule',
      icon: Calendar,
    });
  }

  // Accountability risk
  const accountability = project.accountabilitySummary;
  if (accountability?.status === 'critical') {
    risks.push({
      id: 'accountability',
      label: 'Accountability',
      severity: 'high',
      description: `${accountability.overdueCount} overdue, ${accountability.accountabilityRate?.toFixed(0) || 0}% rate`,
      icon: Wallet,
    });
  } else if (accountability?.status === 'warning') {
    risks.push({
      id: 'accountability',
      label: 'Accountability',
      severity: 'medium',
      description: `${accountability.accountabilityRate?.toFixed(0) || 0}% accountability rate`,
      icon: Wallet,
    });
  } else {
    risks.push({
      id: 'accountability',
      label: 'Accountability',
      severity: 'low',
      description: accountability ? `${accountability.accountabilityRate?.toFixed(0) || 0}% rate` : 'No data',
      icon: Wallet,
    });
  }

  // BOQ risk
  const boq = project.boqSummary;
  if (boq && boq.totalItems > 0 && boq.parsedItems < boq.totalItems * 0.5) {
    risks.push({
      id: 'boq',
      label: 'BOQ',
      severity: 'medium',
      description: `${boq.parsedItems}/${boq.totalItems} items parsed`,
      icon: FileText,
    });
  } else {
    risks.push({
      id: 'boq',
      label: 'BOQ',
      severity: 'low',
      description: boq ? `${boq.totalItems} items` : 'No BOQ',
      icon: FileText,
    });
  }

  const severityColors = {
    low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  };

  const overallRisk = risks.some(r => r.severity === 'high') ? 'high' :
    risks.some(r => r.severity === 'medium') ? 'medium' : 'low';

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-gray-400" />
          Risk Indicators
        </h3>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[overallRisk].bg} ${severityColors[overallRisk].text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${severityColors[overallRisk].dot}`} />
          {overallRisk === 'low' ? 'Low Risk' : overallRisk === 'medium' ? 'Moderate' : 'High Risk'}
        </span>
      </div>

      <div className="space-y-2">
        {risks.map(risk => {
          const colors = severityColors[risk.severity];
          const Icon = risk.icon;
          return (
            <div
              key={risk.id}
              className={`flex items-center gap-3 p-2.5 rounded-lg border ${colors.bg} ${colors.border}`}
            >
              <Icon className={`w-4 h-4 ${colors.text} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${colors.text}`}>{risk.label}</div>
                <div className="text-xs opacity-80">{risk.description}</div>
              </div>
              <div className={`w-2 h-2 rounded-full ${colors.dot} shrink-0`} />
            </div>
          );
        })}
      </div>
    </BaseCard>
  );
}
