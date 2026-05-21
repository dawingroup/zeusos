/**
 * Zeus Group Module
 * Main entry point for Advisory subsidiary
 * Enhanced with Capital Hub-style UI patterns
 * MatFlow features consolidated into Infrastructure Delivery
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Layout Components
import { AdvisoryLayout } from './components/AdvisoryLayout';

// Delivery Routes (includes consolidated MatFlow features)
import { DeliveryRoutes } from './delivery/routes';

// Migration Tool (for data migration from legacy MatFlow)
const MigrationTool = lazyWithRetry(() => import('./matflow/pages/MigrationTool'));

// Advisory Pages (lazy loaded)
const AdvisoryDashboardPage = lazyWithRetry(() => import('./pages/AdvisoryDashboardPage'));

// Investment Pages (lazy loaded)
const InvestmentDashboard = lazyWithRetry(() => import('./investment/pages/InvestmentDashboard'));
const PipelineKanban = lazyWithRetry(() => import('./investment/pages/PipelineKanban'));
const DealDetail = lazyWithRetry(() => import('./investment/pages/DealDetail'));
const DealList = lazyWithRetry(() => import('./investment/pages/DealList'));
const NewDeal = lazyWithRetry(() => import('./investment/pages/NewDeal'));
const Reports = lazyWithRetry(() => import('./investment/pages/Reports'));
const InvestmentLayout = lazyWithRetry(() => import('./investment/components/InvestmentLayout'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
  </div>
);

// CD Portal Page (standalone, no layout)
const CDPortalPage = lazyWithRetry(() => import('./delivery/pages/CDPortalPage').then(m => ({ default: m.CDPortalPage })));

// Main Advisory Routes
export const AdvisoryRoutes: React.FC = () => {
  return (
    <Routes>
      {/* CD Portal - Standalone public route (no navigation, token-based access) */}
      <Route path="delivery/cd-portal" element={
        <Suspense fallback={<PageLoader />}>
          <CDPortalPage />
        </Suspense>
      } />

      <Route element={<AdvisoryLayout />}>
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <AdvisoryDashboardPage />
          </Suspense>
        } />
        {/* Investment Module with nested layout */}
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
        {/* Infrastructure Delivery (consolidated with MatFlow) */}
        <Route path="delivery/*" element={<DeliveryRoutes />} />

        {/* MatFlow Migration Tool (admin only) */}
        <Route path="matflow/migrate" element={
          <Suspense fallback={<PageLoader />}>
            <MigrationTool />
          </Suspense>
        } />

        {/* Legacy MatFlow URL redirects */}
        <Route path="matflow" element={<Navigate to="/advisory/delivery" replace />} />
        <Route path="matflow/boq" element={<Navigate to="/advisory/delivery/boq" replace />} />
        <Route path="matflow/materials" element={<Navigate to="/advisory/delivery/materials" replace />} />
        <Route path="matflow/formulas" element={<Navigate to="/advisory/delivery/materials/formulas" replace />} />
        <Route path="matflow/procurement" element={<Navigate to="/advisory/delivery/procurement" replace />} />
        <Route path="matflow/suppliers" element={<Navigate to="/advisory/delivery/procurement/suppliers" replace />} />
        <Route path="matflow/reports" element={<Navigate to="/advisory/delivery/reports" replace />} />
        <Route path="matflow/projects" element={<Navigate to="/advisory/delivery/projects" replace />} />
        <Route path="matflow/*" element={<Navigate to="/advisory/delivery" replace />} />

        <Route path="*" element={<Navigate to="/advisory" replace />} />
      </Route>
    </Routes>
  );
};

export default AdvisoryRoutes;
