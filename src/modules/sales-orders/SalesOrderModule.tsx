/**
 * SalesOrderModule — Lazy-loaded module router.
 */

import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

const SalesOrderDashboardPage = lazyWithRetry(
  () => import('./pages/SalesOrderDashboardPage'),
);
const SalesOrdersPage = lazyWithRetry(
  () => import('./pages/SalesOrdersPage'),
);
const SalesOrderDetailPage = lazyWithRetry(
  () => import('./pages/SalesOrderDetailPage'),
);
const ChangeOrderDetailPage = lazyWithRetry(
  () => import('./pages/ChangeOrderDetailPage'),
);

const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
    <CircularProgress />
  </Box>
);

export default function SalesOrderModule() {
  return (
    <ModuleContentWrapper>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route index element={<SalesOrderDashboardPage />} />
          <Route path="list" element={<SalesOrdersPage />} />
          <Route path=":orderId" element={<SalesOrderDetailPage />} />
          <Route path=":orderId/change-orders/:coId" element={<ChangeOrderDetailPage />} />
          <Route path="*" element={<Navigate to="/sales-orders" replace />} />
        </Routes>
      </Suspense>
    </ModuleContentWrapper>
  );
}
