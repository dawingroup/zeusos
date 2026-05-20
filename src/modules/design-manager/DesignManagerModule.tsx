/**
 * Design Manager Module Entry Point
 * Internal routing for the Design Manager module
 */

import { Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load pages for code splitting
const DesignManagerPageNew = lazyWithRetry(() => import('./components/dashboard/DesignManagerPageNew'));
const ProjectView = lazyWithRetry(() => import('./components/project/ProjectView'));
const ItemDetailRouter = lazyWithRetry(() => import('./components/design-item/ItemDetailRouter'));
const MaterialsPage = lazyWithRetry(() => import('./pages/MaterialsPage'));
const FeatureLibraryPage = lazyWithRetry(() => import('./components/feature-library/FeatureLibraryPage'));
const StrategyCanvasPage = lazyWithRetry(() => import('./pages/StrategyCanvasPage'));
const BottomUpPricingPage = lazyWithRetry(() => import('./components/bottom-up-pricing/BottomUpPricingPage'));

/**
 * Loading fallback
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

/**
 * Design Manager Module with internal routing
 */
export default function DesignManagerModule() {
  return (
    <ModuleContentWrapper>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route index element={<DesignManagerPageNew />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="features" element={<FeatureLibraryPage />} />
        <Route path="roadmap" element={<Navigate to="/design" replace />} />
        <Route path="shopify" element={<Navigate to="/design" replace />} />
        <Route path="project/:projectId" element={<ProjectView />} />
        <Route path="project/:projectId/strategy" element={<StrategyCanvasPage />} />
        <Route path="project/:projectId/pricing" element={<BottomUpPricingPage />} />
        <Route path="project/:projectId/item/:itemId" element={<ItemDetailRouter />} />
      </Routes>
    </Suspense>
    </ModuleContentWrapper>
  );
}
