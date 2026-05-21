/**
 * Advisory Module — Zeus Group consulting & strategy backbone
 *
 * Phase 1.C trimmed this module down: removed the MatFlow construction-formula
 * library, the Infrastructure Delivery / BOQ sub-feature, the CD Portal (token-
 * based access for site-visit Country Directors), and the MatFlow migration
 * tool. What remains is the financial project skeleton (used as the basis for
 * Zeus Campaigns) plus the Investment pipeline (deal flow management — still
 * relevant for advisory-style client engagements).
 *
 * TODO Phase 3: rename `advisory` → `agency-core`, repoint Investment as
 * `pitch-pipeline` (new-business / RFP / proposal tracking).
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

import { AdvisoryLayout } from './components/AdvisoryLayout';

const AdvisoryDashboardPage = lazyWithRetry(() => import('./pages/AdvisoryDashboardPage'));

// Investment Pages (lazy loaded — retained as new-business / deal flow primitive)
const InvestmentDashboard = lazyWithRetry(() => import('./investment/pages/InvestmentDashboard'));
const PipelineKanban = lazyWithRetry(() => import('./investment/pages/PipelineKanban'));
const DealDetail = lazyWithRetry(() => import('./investment/pages/DealDetail'));
const DealList = lazyWithRetry(() => import('./investment/pages/DealList'));
const NewDeal = lazyWithRetry(() => import('./investment/pages/NewDeal'));
const Reports = lazyWithRetry(() => import('./investment/pages/Reports'));
const InvestmentLayout = lazyWithRetry(() => import('./investment/components/InvestmentLayout'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-8 h-8 animate-spin text-[var(--zeus-accent,#E63946)]" />
  </div>
);

export const AdvisoryRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<AdvisoryLayout />}>
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <AdvisoryDashboardPage />
          </Suspense>
        } />

        {/* Investment Module — deal/pipeline management */}
        <Route path="investment" element={
          <Suspense fallback={<PageLoader />}>
            <InvestmentLayout />
          </Suspense>
        }>
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <InvestmentDashboard />
            </Suspense>
          } />
          <Route path="pipeline" element={
            <Suspense fallback={<PageLoader />}>
              <PipelineKanban />
            </Suspense>
          } />
          <Route path="deals" element={
            <Suspense fallback={<PageLoader />}>
              <DealList />
            </Suspense>
          } />
          <Route path="deals/new" element={
            <Suspense fallback={<PageLoader />}>
              <NewDeal />
            </Suspense>
          } />
          <Route path="deals/:dealId" element={
            <Suspense fallback={<PageLoader />}>
              <DealDetail />
            </Suspense>
          } />
          <Route path="reports" element={
            <Suspense fallback={<PageLoader />}>
              <Reports />
            </Suspense>
          } />
        </Route>

        {/* Legacy MatFlow URLs — single catchall redirect to dashboard. */}
        <Route path="delivery/*" element={<Navigate to="/advisory" replace />} />
        <Route path="matflow/*" element={<Navigate to="/advisory" replace />} />

        <Route path="*" element={<Navigate to="/advisory" replace />} />
      </Route>
    </Routes>
  );
};

export default AdvisoryRoutes;
