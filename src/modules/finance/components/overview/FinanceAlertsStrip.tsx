// ============================================================================
// FINANCE ALERTS STRIP — Cross-module alert banner for the Overview page
// Surfaces critical items from optimizer, budgets, and operations
// ============================================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

export interface FinanceAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  href: string;
}

interface FinanceAlertsStripProps {
  criticalExpenditures: number;
  budgetOverspends: Array<{ name: string; utilization: number }>;
  pendingAmount?: number;
}

const SEVERITY_STYLES = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `UGX ${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `UGX ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `UGX ${(value / 1_000).toFixed(0)}K`;
  return `UGX ${value.toFixed(0)}`;
}

export function FinanceAlertsStrip({
  criticalExpenditures,
  budgetOverspends,
  pendingAmount,
}: FinanceAlertsStripProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = useMemo<FinanceAlert[]>(() => {
    const items: FinanceAlert[] = [];

    if (criticalExpenditures > 0) {
      items.push({
        id: 'critical-expenditures',
        severity: 'critical',
        message: `${criticalExpenditures} critical expenditure${criticalExpenditures > 1 ? 's' : ''} need immediate attention${pendingAmount ? ` (${formatCompact(pendingAmount)})` : ''}`,
        href: '/finance/cash/expenditures?tier=CRITICAL',
      });
    }

    budgetOverspends.forEach((b) => {
      if (b.utilization >= 100) {
        items.push({
          id: `budget-over-${b.name}`,
          severity: 'critical',
          message: `Budget "${b.name}" is over-spent at ${b.utilization}%`,
          href: '/finance/operations/budgets',
        });
      } else if (b.utilization >= 90) {
        items.push({
          id: `budget-warn-${b.name}`,
          severity: 'warning',
          message: `Budget "${b.name}" at ${b.utilization}% utilization`,
          href: '/finance/operations/budgets',
        });
      }
    });

    return items;
  }, [criticalExpenditures, budgetOverspends, pendingAmount]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${SEVERITY_STYLES[alert.severity]}`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{alert.message}</span>
          <button
            onClick={() => navigate(alert.href)}
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline shrink-0"
          >
            View <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
            className="p-0.5 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
