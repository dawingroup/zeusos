/**
 * Launch Pipeline Module Entry Point
 * Internal routing for the Launch Pipeline module
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load pages for code splitting
const PipelineDashboard = lazyWithRetry(() => import('./pages/LaunchPipelinePage'));
const ProductDetail = lazyWithRetry(() => import('./pages/ProductDetailPage'));

/**
 * Loading fallback
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#872E5C]"></div>
    </div>
  );
}

/**
 * Launch Pipeline Module with internal routing
 */
export function LaunchPipelineModule() {
  return (
    <ModuleContentWrapper>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route index element={<PipelineDashboard />} />
          <Route path="product/:productId" element={<ProductDetail />} />
          {/* Redirect /audit to main page with health tab for backward compatibility */}
          <Route path="audit" element={<Navigate to="/launch-pipeline?tab=health" replace />} />
        </Routes>
      </Suspense>
    </ModuleContentWrapper>
  );
}

export { LaunchPipelineModule as default };
