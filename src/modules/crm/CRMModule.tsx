/**
 * CRM Module
 * Sales pipeline, deal tracking, and customer relationship management
 * Entry point with internal routing
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

const CRMDashboardPage = lazyWithRetry(() => import('./pages/CRMDashboardPage'));
const DealsPage = lazyWithRetry(() => import('./pages/DealsPage'));
const DealDetailPage = lazyWithRetry(() => import('./pages/DealDetailPage'));
const ProjectTrackerPage = lazyWithRetry(() => import('./pages/ProjectTrackerPage'));
const SalesActivitiesPage = lazyWithRetry(() => import('./pages/SalesActivitiesPage'));
const SalesTasksPage = lazyWithRetry(() => import('./pages/SalesTasksPage'));
const CRMReportsPage = lazyWithRetry(() => import('./pages/CRMReportsPage'));

export default function CRMModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="pipeline" replace />} />
      <Route path="pipeline" element={<CRMDashboardPage />} />
      <Route path="deals" element={<DealsPage />} />
      <Route path="deals/:dealId" element={<DealDetailPage />} />
      <Route path="projects" element={<ProjectTrackerPage />} />
      <Route path="activities" element={<SalesActivitiesPage />} />
      <Route path="tasks" element={<SalesTasksPage />} />
      <Route path="reports" element={<CRMReportsPage />} />
    </Routes>
  );
}
