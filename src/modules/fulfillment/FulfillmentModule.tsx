/**
 * FulfillmentModule
 * Entry point for the standalone fulfillment module
 */

import { Routes, Route } from 'react-router-dom';
import FulfillmentDashboardPage from './pages/FulfillmentDashboardPage';
import FulfillmentItemDetailPage from './pages/FulfillmentItemDetailPage';
import FulfillmentProjectDetailPage from './pages/FulfillmentProjectDetailPage';

export default function FulfillmentModule() {
  return (
    <Routes>
      <Route index element={<FulfillmentDashboardPage />} />
      <Route path="project/:projectId" element={<FulfillmentProjectDetailPage />} />
      <Route path="item/:itemId" element={<FulfillmentItemDetailPage />} />
    </Routes>
  );
}
