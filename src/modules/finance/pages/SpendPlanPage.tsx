// ============================================================================
// SPEND PLAN PAGE
// Daily spend plan with date picker, approve/defer actions, cash waterfall
// ============================================================================

import { useState, useCallback } from 'react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  Calendar,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Pause,
  Zap,
} from 'lucide-react';
import { useOptimizer } from '../hooks/useOptimizer';
import { SpendPlanTimeline } from '../components/optimizer/SpendPlanTimeline';
import { TierBadge } from '../components/optimizer/ExpenditureScoreCard';

import { useAuth } from '@/shared/hooks/useAuth';

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function SpendPlanPage() {
  useAuth();
  const companyId = 'zeus-group'; // From company context

  const {
    todaysSpendPlan,
    isLoading,
    error,
    generatePlan,
    approveItem,
    deferItem,
    refresh,
  } = useOptimizer({ companyId });

  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [bankBalance, setBankBalance] = useState('');
  const [savingsBalance, setSavingsBalance] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deferReason, setDeferReason] = useState('');
  const [deferringId, setDeferringId] = useState<string | null>(null);

  const plan = todaysSpendPlan;

  const handleGenerate = useCallback(async () => {
    const bank = parseFloat(bankBalance) || plan?.openingBankBalance || 0;
    const savings = parseFloat(savingsBalance) || plan?.openingSavingsBalance || 0;
    setIsGenerating(true);
    try {
      await generatePlan(bank, savings);
    } finally {
      setIsGenerating(false);
    }
  }, [bankBalance, savingsBalance, plan, generatePlan]);

  const handleApprove = useCallback(async (expenditureId: string) => {
    if (plan?.id) {
      await approveItem(plan.id, expenditureId);
    }
  }, [plan, approveItem]);

  const handleDefer = useCallback(async (expenditureId: string) => {
    setDeferringId(expenditureId);
  }, []);

  const confirmDefer = useCallback(async () => {
    if (deferringId && deferReason.trim()) {
      await deferItem(deferringId, deferReason.trim());
      setDeferringId(null);
      setDeferReason('');
    }
  }, [deferringId, deferReason, deferItem]);

  if (isLoading && !plan) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-[var(--rag-green)]" />
          <h2 className="text-xl font-bold text-foreground">Daily Spend Plan</h2>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40 text-sm"
          />
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
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Generate Plan Controls */}
      {!plan && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Generate Spend Plan</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Enter the current bank and savings balances to generate today&apos;s optimized spend plan.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bank Balance (UGX)</label>
              <Input
                type="number"
                placeholder="e.g. 50,000,000"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Savings Balance (UGX)</label>
              <Input
                type="number"
                placeholder="e.g. 10,000,000"
                value={savingsBalance}
                onChange={(e) => setSavingsBalance(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-[var(--rag-green)] hover:bg-[var(--rag-green)] text-white w-full"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-1.5" />
                )}
                Generate Plan
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content */}
      {plan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <SpendPlanTimeline
              plan={plan}
              onApprove={handleApprove}
              onDefer={handleDefer}
            />

            {/* Deferred Items */}
            {plan.deferredExpenditures && plan.deferredExpenditures.length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Pause className="w-4 h-4 text-[var(--fg-tertiary)]" />
                  Deferred ({plan.deferredExpenditures.length})
                </h4>
                <div className="space-y-2">
                  {plan.deferredExpenditures.map((exp: any) => (
                    <div
                      key={exp.expenditureId}
                      className="flex items-center gap-3 py-1.5 border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <TierBadge tier={exp.priorityTier} />
                      <span className="text-sm text-muted-foreground truncate flex-1">{exp.description}</span>
                      <span className="text-sm font-medium text-muted-foreground">{formatUGX(exp.amount)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar Summary */}
          <div className="space-y-4">
            {/* Plan Stats */}
            <Card className="p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Plan Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-medium ${
                    plan.status === 'active' ? 'text-[var(--rag-green)]' : 'text-[var(--rag-amber)]'
                  }`}>
                    {plan.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Opening Balance</span>
                  <span className="font-medium">{formatUGX(plan.openingBankBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Inflow</span>
                  <span className="font-medium text-[var(--rag-green)]">+{formatUGX(plan.totalInflow)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Outflow</span>
                  <span className="font-medium text-[var(--rag-red)]">-{formatUGX(plan.totalOutflow)}</span>
                </div>
                {plan.savingsAllocation > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Savings</span>
                    <span className="font-medium text-[var(--rag-blue)]">-{formatUGX(plan.savingsAllocation)}</span>
                  </div>
                )}
                <hr className="border-[var(--border-subtle)]" />
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Closing Balance</span>
                  <span className={`font-bold ${plan.closingBalance < 0 ? 'text-[var(--rag-red)]' : 'text-foreground'}`}>
                    {formatUGX(plan.closingBalance)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Action Items */}
            {plan.actionItems && plan.actionItems.length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Action Items</h4>
                <div className="space-y-2">
                  {plan.actionItems.map((action: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 text-[var(--rag-blue)] shrink-0" />
                      <span className="text-muted-foreground">{action.action}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Regenerate */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Regenerate Plan
            </Button>
          </div>
        </div>
      )}

      {/* Defer Reason Dialog */}
      {deferringId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-5 w-full max-w-md">
            <h4 className="text-sm font-semibold text-foreground mb-3">Defer Expenditure</h4>
            <Input
              placeholder="Reason for deferring..."
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setDeferringId(null); setDeferReason(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={confirmDefer} disabled={!deferReason.trim()}>
                Confirm Defer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default SpendPlanPage;
