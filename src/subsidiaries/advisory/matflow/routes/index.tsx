/**
 * MatFlow Routes Configuration
 * Defines all routes for the MatFlow module
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MatFlowLayout } from '../components/layout/MatFlowLayout';
import { MatFlowContextProvider } from '../context/MatFlowContext';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load components for code splitting
const MatFlowDashboard = lazyWithRetry(() => import('../components/dashboard/MatFlowDashboard'));
const BOQList = lazyWithRetry(() => import('../components/boq/BOQList'));

// Placeholder components for routes not yet implemented
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
    <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
    <p className="text-gray-500">This page is under development</p>
  </div>
);

// Loading fallback
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

export const MatFlowRoutes: React.FC = () => {
  return (
    <MatFlowContextProvider>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route element={<MatFlowLayout />}>
            {/* Dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<MatFlowDashboard />} />

            {/* BOQ Routes */}
            <Route path="boq">
              <Route index element={<BOQList />} />
              <Route path="new" element={<PlaceholderPage title="Create New BOQ" />} />
              <Route path="upload" element={<PlaceholderPage title="Upload BOQ" />} />
              <Route path=":boqId" element={<PlaceholderPage title="BOQ Detail" />} />
              <Route path=":boqId/edit" element={<PlaceholderPage title="Edit BOQ" />} />
            </Route>

            {/* Material Library Routes */}
            <Route path="materials">
              <Route index element={<PlaceholderPage title="Material Library" />} />
              <Route path=":materialId" element={<PlaceholderPage title="Material Detail" />} />
            </Route>

            {/* Requisition Routes */}
            <Route path="requisitions">
              <Route index element={<PlaceholderPage title="Requisitions" />} />
              <Route path="new" element={<PlaceholderPage title="New Requisition" />} />
              <Route path="approvals" element={<PlaceholderPage title="Approval Queue" />} />
              <Route path=":requisitionId" element={<PlaceholderPage title="Requisition Detail" />} />
              <Route path=":requisitionId/edit" element={<PlaceholderPage title="Edit Requisition" />} />
            </Route>

            {/* Purchase Order Routes */}
            <Route path="purchase-orders">
              <Route index element={<PlaceholderPage title="Purchase Orders" />} />
              <Route path="new" element={<PlaceholderPage title="New Purchase Order" />} />
              <Route path=":poId" element={<PlaceholderPage title="PO Detail" />} />
              <Route path=":poId/edit" element={<PlaceholderPage title="Edit PO" />} />
            </Route>

            {/* Delivery Routes */}
            <Route path="deliveries">
              <Route index element={<PlaceholderPage title="Deliveries" />} />
              <Route path="record" element={<PlaceholderPage title="Record Delivery" />} />
              <Route path=":deliveryId" element={<PlaceholderPage title="Delivery Verification" />} />
            </Route>

            {/* Budget Routes */}
            <Route path="budget">
              <Route index element={<PlaceholderPage title="Budget Dashboard" />} />
              <Route path="report" element={<PlaceholderPage title="Budget Report" />} />
            </Route>

            {/* AI Tools Routes */}
            <Route path="ai-tools">
              <Route index element={<PlaceholderPage title="AI Tools" />} />
              <Route path="parse" element={<PlaceholderPage title="AI BOQ Parser" />} />
              <Route path="parse/:jobId/review" element={<PlaceholderPage title="Parsing Review" />} />
            </Route>

            {/* Supplier Routes */}
            <Route path="suppliers">
              <Route index element={<PlaceholderPage title="Suppliers" />} />
              <Route path=":supplierId" element={<PlaceholderPage title="Supplier Detail" />} />
            </Route>

            {/* Settings */}
            <Route path="settings" element={<PlaceholderPage title="MatFlow Settings" />} />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </MatFlowContextProvider>
  );
};

export default MatFlowRoutes;
