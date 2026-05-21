/**
 * Finance Module
 * Main router component for the Finance module (legacy pattern)
 * ZeusOS v2.0 - Financial Management
 *
 * Note: The active router is src/router/index.tsx.
 * This file is used by the legacy src/app/routes/index.tsx.
 */

import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FinanceLayout } from './components/FinanceLayout';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

const AnalysisLandingPage = lazyWithRetry(() => import('./pages/AnalysisLandingPage'));
const OperationsLandingPage = lazyWithRetry(() => import('./pages/OperationsLandingPage'));
const SettingsLandingPage = lazyWithRetry(() => import('./pages/SettingsLandingPage'));
const ReportsLandingPage = lazyWithRetry(() => import('./pages/ReportsLandingPage'));
const KPIsPage = lazyWithRetry(() => import('./pages/KPIsPage'));
const KPIExplorerPage = lazyWithRetry(() => import('./pages/KPIExplorerPage'));
const GrowthPage = lazyWithRetry(() => import('./pages/GrowthPage'));
const TrendPage = lazyWithRetry(() => import('./pages/TrendPage'));
const FinancialHealthPage = lazyWithRetry(() => import('./pages/FinancialHealthPage'));
const ProfitabilityPage = lazyWithRetry(() => import('./pages/ProfitabilityPage'));
const CashFlowPage = lazyWithRetry(() => import('./pages/CashFlowPage'));
const GoalSeekPage = lazyWithRetry(() => import('./pages/GoalSeekPage'));
const ForecastPage = lazyWithRetry(() => import('./pages/ForecastPage'));
const InvoicesPage = lazyWithRetry(() => import('./pages/InvoicesPage'));
const BillsPage = lazyWithRetry(() => import('./pages/BillsPage'));
const AccountabilityPage = lazyWithRetry(() => import('./pages/AccountabilityPage'));
const RefundsPage = lazyWithRetry(() => import('./pages/RefundsPage'));
const TaxCompliancePage = lazyWithRetry(() => import('./pages/TaxCompliancePage'));
const ReconciliationsPage = lazyWithRetry(() => import('./pages/ReconciliationsPage'));
const ChartOfAccounts = lazyWithRetry(() => import('./pages/ChartOfAccounts'));
const IntegrationsPage = lazyWithRetry(() => import('./pages/IntegrationsPage'));
const QBOSyncDashboardPage = lazyWithRetry(() => import('./pages/QBOSyncDashboardPage'));
const AccountMappingsPage = lazyWithRetry(() => import('./pages/AccountMappingsPage'));

function Fallback() {
  return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" /></div>;
}

export function FinanceModule() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<FinanceLayout />}>
          <Route index element={<Navigate to="analysis" replace />} />

          {/* Analysis */}
          <Route path="analysis" element={<AnalysisLandingPage />} />
          <Route path="analysis/kpis" element={<KPIsPage />} />
          <Route path="analysis/kpi-explorer" element={<KPIExplorerPage />} />
          <Route path="analysis/profitability" element={<ProfitabilityPage />} />
          <Route path="analysis/cash-flow" element={<CashFlowPage />} />
          <Route path="analysis/growth" element={<GrowthPage />} />
          <Route path="analysis/trend" element={<TrendPage />} />
          <Route path="analysis/goal-seek" element={<GoalSeekPage />} />
          <Route path="analysis/financial" element={<FinancialHealthPage />} />

          {/* Forecasting */}
          <Route path="forecast" element={<ForecastPage />} />

          {/* Reports */}
          <Route path="reports" element={<ReportsLandingPage />} />

          {/* Operations */}
          <Route path="operations" element={<OperationsLandingPage />} />
          <Route path="operations/invoices" element={<InvoicesPage />} />
          <Route path="operations/bills" element={<BillsPage />} />
          <Route path="operations/accountability" element={<AccountabilityPage />} />
          <Route path="operations/refunds" element={<RefundsPage />} />
          <Route path="operations/tax-compliance" element={<TaxCompliancePage />} />
          <Route path="operations/reconciliations" element={<ReconciliationsPage />} />

          {/* Settings */}
          <Route path="settings" element={<SettingsLandingPage />} />
          <Route path="settings/accounts" element={<ChartOfAccounts />} />
          <Route path="settings/integrations" element={<IntegrationsPage />} />
          <Route path="settings/sync" element={<QBOSyncDashboardPage />} />
          <Route path="settings/mappings" element={<AccountMappingsPage />} />

          {/* Backward-compatible redirects */}
          <Route path="budgets" element={<Navigate to="/finance/operations/budgets" replace />} />
          <Route path="bills" element={<Navigate to="/finance/operations/bills" replace />} />
          <Route path="invoices" element={<Navigate to="/finance/operations/invoices" replace />} />
          <Route path="profitability" element={<Navigate to="/finance/overview/profitability" replace />} />
          <Route path="goal-seek" element={<Navigate to="/finance/overview/goal-seek" replace />} />
          <Route path="cash-flow" element={<Navigate to="/finance/overview/cash-flow" replace />} />
          <Route path="accounts" element={<Navigate to="/finance/settings/accounts" replace />} />
          <Route path="integrations" element={<Navigate to="/finance/settings/integrations" replace />} />

          <Route path="*" element={<Navigate to="/finance/overview" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default FinanceModule;
