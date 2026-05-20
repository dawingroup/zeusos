/**
 * FinanceDashboardPage.tsx
 * Financial Management dashboard with comprehensive overview
 * DawinOS v2.0 - Phase 8.8
 */

import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Receipt,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Wallet,
  Smartphone,
  Banknote,
  AlertTriangle,
  FileText,
  BookOpen,
  BarChart3,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { QuickActionsGrid } from '@/shared/components/data-display';
import { useFinanceDashboard } from '@/modules/finance/hooks/useFinanceDashboard';

const FINANCE_COLOR = '#4CAF50';
const COMPANY_ID = 'dawinos';

// Format currency in UGX
function formatCurrencyUGX(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

const accountTypeIcons: Record<string, React.ReactNode> = {
  asset: <Landmark className="h-4 w-4" />,
  liability: <Receipt className="h-4 w-4" />,
  equity: <Wallet className="h-4 w-4" />,
  revenue: <TrendingUp className="h-4 w-4" />,
  expense: <TrendingDown className="h-4 w-4" />,
  bank: <Landmark className="h-4 w-4" />,
  mobile_money: <Smartphone className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
};

export function FinanceDashboardPage() {
  const navigate = useNavigate();
  const { metrics, budgets, accounts, loading, error, refresh } = useFinanceDashboard(COMPANY_ID);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6" style={{ color: FINANCE_COLOR }} />
            Financial Management
          </h1>
          <p className="text-muted-foreground">Overview of company finances, budgets, and expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/finance/expenses/new')} style={{ backgroundColor: FINANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-900">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cash */}
        <Card className="border-l-4" style={{ borderLeftColor: FINANCE_COLOR }}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cash</p>
                <p className="text-2xl font-bold mt-1">{formatCurrencyUGX(metrics.totalCash)}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {metrics.accountCount} active accounts
                </p>
              </div>
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${FINANCE_COLOR}15` }}>
                <Landmark className="h-5 w-5" style={{ color: FINANCE_COLOR }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Spent */}
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Budget Spent</p>
                <p className="text-2xl font-bold mt-1">{formatCurrencyUGX(metrics.totalSpent)}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  of {formatCurrencyUGX(metrics.totalBudget)} total
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-100">
                <Receipt className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Utilization */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Budget Utilization</p>
              <p className="text-2xl font-bold mt-1">{metrics.budgetUtilization}%</p>
              <Progress 
                value={metrics.budgetUtilization} 
                className="h-2 mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.activeBudgetCount} active budget{metrics.activeBudgetCount !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold mt-1">{metrics.recentTransactionCount}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Recent cash flow entries
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid
        columns={4}
        actions={[
          { label: 'New Expense', description: 'Record an expense', icon: Plus, onClick: () => navigate('/finance/expenses/new') },
          { label: 'Chart of Accounts', description: 'View account tree', icon: BookOpen, onClick: () => navigate('/finance/accounts') },
          { label: 'Budgets', description: 'Manage budgets', icon: FileText, onClick: () => navigate('/finance/budgets') },
          { label: 'Reports', description: 'Financial reports', icon: BarChart3, onClick: () => navigate('/finance/reports') },
        ]}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Budget Overview</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/finance/budgets')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {budgets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active budgets found</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/finance/budgets/new')}>
                  Create Budget
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map(budget => (
                  <div key={budget.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{budget.name}</span>
                        <Badge variant="outline" className="text-xs">{budget.category}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrencyUGX(budget.spent)} / {formatCurrencyUGX(budget.allocated)}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(budget.utilization, 100)} 
                      className={cn(
                        "h-2",
                        budget.utilization >= 100 ? "[&>div]:bg-red-500" :
                        budget.utilization >= 90 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                      )}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{budget.utilization.toFixed(1)}% utilized</span>
                      <span className={cn(
                        "text-xs font-medium",
                        budget.remaining >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {budget.remaining >= 0 ? 'Remaining: ' : 'Over by: '}
                        {formatCurrencyUGX(Math.abs(budget.remaining))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Balances */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Account Balances</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/finance/accounts')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Landmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No accounts found</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/finance/accounts')}>
                  Set Up Accounts
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map(account => (
                  <div 
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${FINANCE_COLOR}15`, color: FINANCE_COLOR }}
                      >
                        {accountTypeIcons[account.type] || <Wallet className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{account.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {account.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-sm">{formatCurrencyUGX(account.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default FinanceDashboardPage;
