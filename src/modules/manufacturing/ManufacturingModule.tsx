/**
 * Manufacturing Module Router
 * Nested routes for manufacturing orders and dashboard
 */

import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy-load pages
const ManufacturingDashboardPage = lazyWithRetry(() => import('./pages/ManufacturingDashboardPage'));
const ManufacturingOrdersPage = lazyWithRetry(() => import('./pages/ManufacturingOrdersPage'));
const ManufacturingOrderDetailPage = lazyWithRetry(() => import('./pages/ManufacturingOrderDetailPage'));
const ShopFloorPage = lazyWithRetry(() => import('./pages/ShopFloorPage'));
const WorkstationsPage = lazyWithRetry(() => import('./pages/WorkstationsPage'));
const RoutingTemplatesPage = lazyWithRetry(() => import('./pages/RoutingTemplatesPage'));
const OrderDetailPageEnhanced = lazyWithRetry(() => import('./pages/OrderDetailPageEnhanced'));

const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
    <CircularProgress />
  </Box>
);

export default function ManufacturingModule() {
  return (
    <ModuleContentWrapper>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route index element={<ManufacturingDashboardPage />} />
          <Route path="orders" element={<ManufacturingOrdersPage />} />
          <Route path="orders/:moId" element={<ManufacturingOrderDetailPage />} />
          <Route path="orders/:orderId/enhanced" element={<OrderDetailPageEnhanced />} />
          <Route path="shop-floor" element={<ShopFloorPage />} />
          <Route path="workstations" element={<WorkstationsPage />} />
          <Route path="routing-templates" element={<RoutingTemplatesPage />} />
          {/* Legacy redirects — procurement now has its own module */}
          <Route path="purchase-orders" element={<Navigate to="/procurement/orders" replace />} />
          <Route path="purchase-orders/*" element={<Navigate to="/procurement/orders" replace />} />
          <Route path="procurement" element={<Navigate to="/procurement" replace />} />
          <Route path="procurement-queue" element={<Navigate to="/procurement/queue" replace />} />
          <Route path="*" element={<Navigate to="/manufacturing" replace />} />
        </Routes>
      </Suspense>
    </ModuleContentWrapper>
  );
}
