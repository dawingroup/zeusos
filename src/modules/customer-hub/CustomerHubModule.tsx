/**
 * CustomerHubModule
 * Routing for Customer Hub module
 */

import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

const CustomerListPage = lazyWithRetry(() => import('./pages/CustomerListPage'));
const CustomerDetailPage = lazyWithRetry(() => import('./pages/CustomerDetailPage'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

export function CustomerHubModule() {
  return (
    <ModuleContentWrapper>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route index element={<CustomerListPage />} />
          <Route path=":customerId" element={<CustomerDetailPage />} />
        </Routes>
      </Suspense>
    </ModuleContentWrapper>
  );
}

export default CustomerHubModule;
