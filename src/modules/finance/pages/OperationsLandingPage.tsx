// ============================================================================
// OPERATIONS LANDING PAGE
// ZeusOS v2.0 - Finance Module
// Replaces card-grid navigation with summary data + pill sub-navigation.
// Shows: 4 summary stat cards, top items tables, pill navigation bar.
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import {
  ArrowRight,
} from 'lucide-react';
import { useFinanceDashboard } from '../hooks/useFinanceDashboard';
import { useAuth } from '@/shared/hooks/useAuth';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

const COMPANY_ID = 'dawinos';

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function OperationsLandingPage() {
  const navigate = useNavigate();
  useAuth();

  const {
    metrics,
    budgets,
    accounts,
    loading,
  } = useFinanceDashboard(COMPANY_ID);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Finance Operations</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Day-to-day financial activities & workflows
        </p>
      </div>

      {/* Row 1: Summary Stats */}
      <KPIGrid cols={4}>
        <KPICard
          label="Accounts"
          value={metrics.accountCount}
          delta="Active postable accounts"
        />
        <KPICard
          label="Cash Balance"
          value={formatCompact(metrics.totalCash)}
          unit="UGX"
        />
        <KPICard
          label="Budget Utilization"
          value={`${metrics.budgetUtilization}%`}
          delta={`${formatCompact(metrics.totalSpent)} of ${formatCompact(metrics.totalBudget)}`}
        />
        <KPICard
          label="Active Budgets"
          value={metrics.activeBudgetCount}
          delta={`${metrics.recentTransactionCount} recent txns`}
        />
      </KPIGrid>

      {/* Row 2: Budget Status + Top Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget Status */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Active Budgets</h3>
            <button
              onClick={() => navigate('/finance/operations/budgets')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rag-green)] hover:text-[var(--rag-green)]"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {budgets.length > 0 ? (
            <div className="space-y-3">
              {budgets.map((b) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground truncate max-w-[50%]">{b.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--fg-tertiary)]">{b.category}</span>
                      <span className={`text-xs font-medium ${b.utilization >= 100 ? 'text-[var(--rag-red)]' : b.utilization >= 85 ? 'text-[var(--rag-amber)]' : 'text-muted-foreground'}`}>
                        {b.utilization}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${b.utilization >= 100 ? 'bg-[var(--rag-red)]' : b.utilization >= 85 ? 'bg-[var(--rag-amber)]' : 'bg-[var(--rag-green)]'}`}
                      style={{ width: `${Math.min(b.utilization, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-tertiary)] text-center py-6">No active budgets</p>
          )}
        </Card>

        {/* Top Accounts */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Top Accounts by Balance</h3>
            <button
              onClick={() => navigate('/finance/settings/accounts')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--rag-green)] hover:text-[var(--rag-green)]"
            >
              Chart of Accounts <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      a.type === 'asset' ? 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' :
                      a.type === 'liability' ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' :
                      a.type === 'equity' ? 'bg-purple-50 text-purple-700' :
                      a.type === 'revenue' ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' :
                      'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                    }`}>
                      {a.type}
                    </span>
                    <span className="text-sm text-muted-foreground truncate">{a.name}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground shrink-0 ml-2">
                    {formatCompact(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-tertiary)] text-center py-6">No account data</p>
          )}
        </Card>
      </div>
    </div>
  );
}

export default OperationsLandingPage;
