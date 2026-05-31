// ============================================================================
// FINANCIAL REPORTS PAGE
// ZeusOS v2.0 - Finance Module
// Displays QBO-synced P&L, Balance Sheet, and Chart of Accounts analytics
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart3, Scale, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { getQBOProfitAndLoss, getQBOBalanceSheet, getQBOAccounts, syncQBOCategory } from '../services/qboSyncService';
import type { QBOProfitAndLoss, QBOBalanceSheet, QBOAccount } from '../types/integrations.types';

const COMPANY_ID = 'zeus-group';

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

function ReportRow({ label, value, indent = false, bold = false }: { label: string; value: number; indent?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${indent ? 'pl-4' : ''} ${bold ? 'font-semibold border-t border-[var(--border-subtle)] mt-1 pt-2' : 'text-sm'}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={value < 0 ? 'text-[var(--rag-red)]' : 'text-foreground'}>{formatUSD(value)}</span>
    </div>
  );
}

export function FinancialReportsPage() {
  const [pl, setPl] = useState<QBOProfitAndLoss | null>(null);
  const [bs, setBs] = useState<QBOBalanceSheet | null>(null);
  const [accounts, setAccounts] = useState<QBOAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pl' | 'bs' | 'accounts'>('pl');

  const fyStart = (() => {
    const now = new Date();
    return now.getMonth() >= 6
      ? `${now.getFullYear()}-07-01`
      : `${now.getFullYear() - 1}-07-01`;
  })();
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plData, bsData, accts] = await Promise.all([
        getQBOProfitAndLoss(COMPANY_ID, fyStart, today).catch(() => null),
        getQBOBalanceSheet(COMPANY_ID, today).catch(() => null),
        getQBOAccounts(COMPANY_ID).catch(() => []),
      ]);
      setPl(plData);
      setBs(bsData);
      setAccounts(accts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [fyStart, today]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        syncQBOCategory(COMPANY_ID, 'profit_and_loss', fyStart, today),
        syncQBOCategory(COMPANY_ID, 'balance_sheet'),
        syncQBOCategory(COMPANY_ID, 'accounts'),
      ]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const tabs = [
    { id: 'pl' as const, label: 'Profit & Loss', icon: BarChart3 },
    { id: 'bs' as const, label: 'Balance Sheet', icon: Scale },
    { id: 'accounts' as const, label: 'Chart of Accounts', icon: Layers },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[var(--rag-green)]" />
            Financial Reports
          </h2>
          <p className="text-sm text-muted-foreground mt-1">QuickBooks Online synced financial statements</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Reports'}
        </Button>
      </div>

      {error && (
        <div className="bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg p-3 text-sm text-[var(--rag-red)]">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--rag-green)] text-[var(--rag-green)]'
                : 'border-transparent text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profit & Loss */}
      {activeTab === 'pl' && (
        <>
          {/* KPI Cards */}
          {!loading && pl && (
            <KPIGrid cols={3}>
              <KPICard
                label="Gross Profit"
                value={formatUSD(pl.grossProfit)}
                unit="USD"
                trend={pl.grossProfit >= 0 ? 'up' : 'down'}
              />
              <KPICard
                label="Net Operating Income"
                value={formatUSD(pl.netOperatingIncome)}
                unit="USD"
                trend={pl.netOperatingIncome >= 0 ? 'up' : 'down'}
              />
              <KPICard
                label="Net Income"
                value={formatUSD(pl.netIncome)}
                unit="USD"
                trend={pl.netIncome >= 0 ? 'up' : 'down'}
              />
            </KPIGrid>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                Profit & Loss Statement
                {pl && <span className="text-sm font-normal text-muted-foreground">{pl.startDate} – {pl.endDate}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : !pl ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No P&L data synced yet</p>
                  <p className="text-sm mt-1">Click "Sync Reports" to pull your P&L from QuickBooks</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {/* Income */}
                  <div className="pb-3">
                    <p className="font-semibold text-foreground mb-2">Income</p>
                    {pl.income.map((row, i) => (
                      <ReportRow key={i} label={row.label} value={row.value} indent />
                    ))}
                  </div>
                  {/* COGS */}
                  <div className="py-3">
                    <p className="font-semibold text-foreground mb-2">Cost of Goods Sold</p>
                    {pl.costOfGoodsSold.map((row, i) => (
                      <ReportRow key={i} label={row.label} value={row.value} indent />
                    ))}
                    <ReportRow label="Gross Profit" value={pl.grossProfit} bold />
                  </div>
                  {/* Expenses */}
                  <div className="py-3">
                    <p className="font-semibold text-foreground mb-2">Operating Expenses</p>
                    {pl.expenses.map((row, i) => (
                      <ReportRow key={i} label={row.label} value={row.value} indent />
                    ))}
                    <ReportRow label="Net Operating Income" value={pl.netOperatingIncome} bold />
                  </div>
                  {/* Net Income */}
                  <div className="pt-3">
                    <ReportRow label="Net Income" value={pl.netIncome} bold />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Balance Sheet */}
      {activeTab === 'bs' && (
        <>
          {!loading && bs && (
            <KPIGrid cols={3}>
              <KPICard
                label="Total Assets"
                value={formatUSD(bs.totalAssets)}
                unit="USD"
                trend="up"
              />
              <KPICard
                label="Total Liabilities"
                value={formatUSD(bs.totalLiabilities)}
                unit="USD"
                trend="down"
              />
              <KPICard
                label="Total Equity"
                value={formatUSD(bs.totalEquity)}
                unit="USD"
                trend={bs.totalEquity >= 0 ? 'up' : 'down'}
              />
            </KPIGrid>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                Balance Sheet
                {bs && <span className="text-sm font-normal text-muted-foreground">As of {bs.asOfDate}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : !bs ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scale className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No Balance Sheet data synced yet</p>
                  <p className="text-sm mt-1">Click "Sync Reports" to pull your Balance Sheet from QuickBooks</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-subtle)]">
                  <div className="pb-3">
                    <p className="font-semibold text-foreground mb-2">Assets</p>
                    {bs.assets.map((row, i) => (
                      <ReportRow key={i} label={row.label} value={row.value} indent />
                    ))}
                    <ReportRow label="Total Assets" value={bs.totalAssets} bold />
                  </div>
                  <div className="py-3">
                    <p className="font-semibold text-foreground mb-2">Liabilities</p>
                    {bs.liabilities.map((row, i) => (
                      <ReportRow key={i} label={row.label} value={row.value} indent />
                    ))}
                    <ReportRow label="Total Liabilities" value={bs.totalLiabilities} bold />
                  </div>
                  <div className="pt-3">
                    <p className="font-semibold text-foreground mb-2">Equity</p>
                    {bs.equity.map((row, i) => (
                      <ReportRow key={i} label={row.label} value={row.value} indent />
                    ))}
                    <ReportRow label="Total Equity" value={bs.totalEquity} bold />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Chart of Accounts */}
      {activeTab === 'accounts' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Chart of Accounts ({accounts.length} accounts)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No accounts synced yet</p>
                <p className="text-sm mt-1">Click "Sync Reports" to pull Chart of Accounts from QuickBooks</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-[var(--bg-sunken)]">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Classification</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Currency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {accounts.map(acct => (
                      <tr key={acct.id} className="hover:bg-[var(--bg-sunken)] transition-colors">
                        <td className="px-4 py-3 font-medium">{acct.fullyQualifiedName || acct.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{acct.accountType}</td>
                        <td className="px-4 py-3 text-muted-foreground">{acct.classification}</td>
                        <td className={`px-4 py-3 text-right font-medium ${acct.currentBalance < 0 ? 'text-[var(--rag-red)]' : ''}`}>
                          {formatUSD(acct.currentBalance)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{acct.currencyRef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FinancialReportsPage;
