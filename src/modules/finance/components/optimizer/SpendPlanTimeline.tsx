// ============================================================================
// SPEND PLAN TIMELINE
// Vertical timeline showing today's scheduled payments with running cash balance
// ============================================================================

import { useMemo } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Pause,
  PiggyBank,
} from 'lucide-react';
import { Card } from '@/core/components/ui/card';
import type { SpendPlan, PlannedExpenditure } from '../../types/optimizer.types';
import { PRIORITY_TIER_COLORS } from '../../constants/optimizer.constants';

interface SpendPlanTimelineProps {
  plan: SpendPlan;
  onApprove?: (expenditureId: string) => void;
  onDefer?: (expenditureId: string) => void;
  className?: string;
}

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

interface TimelineEntry {
  type: 'receipt' | 'expenditure' | 'savings';
  id: string;
  description: string;
  amount: number;
  runningBalance: number;
  tier?: PlannedExpenditure['priorityTier'];
  status?: string;
  isPartial?: boolean;
}

export function SpendPlanTimeline({
  plan,
  onApprove,
  onDefer,
  className = '',
}: SpendPlanTimelineProps) {
  const entries = useMemo<TimelineEntry[]>(() => {
    const result: TimelineEntry[] = [];
    let balance = plan.openingBankBalance;

    // Add confirmed receipts first
    for (const receipt of plan.expectedReceipts || []) {
      if (receipt.confidenceLevel === 'confirmed') {
        balance += receipt.amount;
        result.push({
          type: 'receipt',
          id: receipt.id,
          description: receipt.description,
          amount: receipt.amount,
          runningBalance: balance,
        });
      }
    }

    // Add scheduled expenditures in order
    for (const exp of plan.scheduledExpenditures || []) {
      balance -= exp.amount;
      result.push({
        type: 'expenditure',
        id: exp.expenditureId,
        description: exp.description,
        amount: exp.amount,
        runningBalance: balance,
        tier: exp.priorityTier,
        isPartial: exp.isPartialPayment,
      });
    }

    // Add savings allocation
    if (plan.savingsAllocation > 0) {
      balance -= plan.savingsAllocation;
      result.push({
        type: 'savings',
        id: 'savings',
        description: 'Savings Allocation',
        amount: plan.savingsAllocation,
        runningBalance: balance,
      });
    }

    return result;
  }, [plan]);

  if (!entries.length) {
    return (
      <Card className={`p-6 text-center text-[var(--fg-tertiary)] ${className}`}>
        No items in today&apos;s spend plan
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      {/* Opening Balance */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--rag-blue-soft)] rounded-lg mb-4">
        <span className="text-sm font-medium text-[var(--rag-blue)]">Opening Balance</span>
        <span className="text-sm font-bold text-[var(--rag-blue)]">{formatUGX(plan.openingBankBalance)}</span>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--bg-sunken)]" />

        {entries.map((entry) => (
          <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Icon */}
            <div className={`
              relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2
              ${entry.type === 'receipt'
                ? 'bg-[var(--rag-green-soft)] border-[var(--rag-green)]'
                : entry.type === 'savings'
                  ? 'bg-purple-50 border-purple-300'
                  : 'bg-card border-[var(--border-subtle)]'}
            `}>
              {entry.type === 'receipt' ? (
                <ArrowDown className="w-4 h-4 text-[var(--rag-green)]" />
              ) : entry.type === 'savings' ? (
                <PiggyBank className="w-4 h-4 text-purple-600" />
              ) : entry.status === 'approved' ? (
                <CheckCircle className="w-4 h-4 text-[var(--rag-green)]" />
              ) : entry.status === 'deferred' ? (
                <Pause className="w-4 h-4 text-[var(--fg-tertiary)]" />
              ) : entry.tier === 'CRITICAL' ? (
                <AlertTriangle className="w-4 h-4 text-[var(--rag-red)]" />
              ) : (
                <ArrowUp className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {entry.description}
                    {entry.isPartial && (
                      <span className="ml-1 text-xs text-[var(--rag-amber)]">(partial)</span>
                    )}
                  </p>
                  {entry.tier && (
                    <span
                      className="inline-block mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        color: PRIORITY_TIER_COLORS[entry.tier],
                        backgroundColor: `${PRIORITY_TIER_COLORS[entry.tier]}15`,
                      }}
                    >
                      {entry.tier}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${
                    entry.type === 'receipt' ? 'text-[var(--rag-green)]' : 'text-foreground'
                  }`}>
                    {entry.type === 'receipt' ? '+' : '-'}{formatUGX(entry.amount)}
                  </p>
                  <p className="text-xs text-[var(--fg-tertiary)]">
                    Bal: {formatUGX(entry.runningBalance)}
                  </p>
                </div>
              </div>

              {/* Actions for pending expenditures */}
              {entry.type === 'expenditure' && !entry.status && (onApprove || onDefer) && (
                <div className="flex gap-2 mt-1.5">
                  {onApprove && (
                    <button
                      onClick={() => onApprove(entry.id)}
                      className="text-xs text-[var(--rag-green)] hover:text-[var(--rag-green)] font-medium"
                    >
                      Approve
                    </button>
                  )}
                  {onDefer && (
                    <button
                      onClick={() => onDefer(entry.id)}
                      className="text-xs text-muted-foreground hover:text-muted-foreground font-medium"
                    >
                      Defer
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Closing Balance */}
      <div className={`
        flex items-center justify-between px-3 py-2 rounded-lg mt-4
        ${plan.closingBalance < 0 ? 'bg-[var(--rag-red-soft)]' : 'bg-[var(--bg-sunken)]'}
      `}>
        <span className={`text-sm font-medium ${
          plan.closingBalance < 0 ? 'text-[var(--rag-red)]' : 'text-muted-foreground'
        }`}>
          Closing Balance
        </span>
        <span className={`text-sm font-bold ${
          plan.closingBalance < 0 ? 'text-[var(--rag-red)]' : 'text-foreground'
        }`}>
          {formatUGX(plan.closingBalance)}
        </span>
      </div>

      {/* Risk Flags */}
      {plan.riskFlags?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {plan.riskFlags.map((flag, idx) => (
            <div key={idx} className={`flex items-start gap-2 text-xs p-2 rounded ${
              flag.severity === 'critical' ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
                : flag.severity === 'warning' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                  : 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]'
            }`}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{flag.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default SpendPlanTimeline;
