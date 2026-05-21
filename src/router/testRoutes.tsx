/**
 * Test Routes Configuration
 * ZeusOS v2.0 - Testing Framework
 * Route configuration for testing pages
 */

import React, { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load test pages
const TestLayout = lazyWithRetry(() => import('@/pages/test/TestLayout'));
const TestDashboard = lazyWithRetry(() => import('@/pages/test/TestDashboard'));
const TestIntelligenceLayer = lazyWithRetry(() => import('@/pages/test/TestIntelligenceLayer'));
const TestHRCentral = lazyWithRetry(() => import('@/pages/test/TestHRCentral'));
const TestCEOStrategy = lazyWithRetry(() => import('@/pages/test/TestCEOStrategy'));
const TestFinancialManagement = lazyWithRetry(() => import('@/pages/test/TestFinancialManagement'));
const PlaceholderPage = lazyWithRetry(() => import('@/pages/test/PlaceholderPage'));

// Page wrapper with Suspense
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullPageLoader />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
);

// Helper to create placeholder routes
const createPlaceholder = (title: string, parentPath: string, parentTitle: string) => (
  <PageWrapper>
    <PlaceholderPage title={title} parentPath={parentPath} parentTitle={parentTitle} />
  </PageWrapper>
);

export const testRoutes: RouteObject[] = [
  {
    path: '/test',
    element: (
      <PageWrapper>
        <TestLayout />
      </PageWrapper>
    ),
    children: [
      // Main Dashboard
      {
        index: true,
        element: <PageWrapper><TestDashboard /></PageWrapper>,
      },

      // Phase 1: Intelligence Layer
      {
        path: 'intelligence',
        element: <PageWrapper><TestIntelligenceLayer /></PageWrapper>,
      },
      {
        path: 'intelligence/events',
        element: createPlaceholder('Business Events', '/test/intelligence', 'Intelligence Layer'),
      },
      {
        path: 'intelligence/roles',
        element: createPlaceholder('Role Profiles', '/test/intelligence', 'Intelligence Layer'),
      },
      {
        path: 'intelligence/task-generation',
        element: createPlaceholder('Task Generation', '/test/intelligence', 'Intelligence Layer'),
      },
      {
        path: 'intelligence/grey-areas',
        element: createPlaceholder('Grey Area Detection', '/test/intelligence', 'Intelligence Layer'),
      },
      {
        path: 'intelligence/smart-tasks',
        element: createPlaceholder('Smart Tasks', '/test/intelligence', 'Intelligence Layer'),
      },

      // Phase 2: HR Central
      {
        path: 'hr',
        element: <PageWrapper><TestHRCentral /></PageWrapper>,
      },
      {
        path: 'hr/employees',
        element: createPlaceholder('Employee Directory', '/test/hr', 'HR Central'),
      },
      {
        path: 'hr/contracts',
        element: createPlaceholder('Contract Management', '/test/hr', 'HR Central'),
      },
      {
        path: 'hr/payroll',
        element: createPlaceholder('Payroll Dashboard', '/test/hr', 'HR Central'),
      },
      {
        path: 'hr/leave',
        element: createPlaceholder('Leave Management', '/test/hr', 'HR Central'),
      },
      {
        path: 'hr/organization',
        element: createPlaceholder('Organization Structure', '/test/hr', 'HR Central'),
      },

      // Phase 3: CEO Strategy Command
      {
        path: 'strategy',
        element: <PageWrapper><TestCEOStrategy /></PageWrapper>,
      },
      {
        path: 'strategy/documents',
        element: createPlaceholder('Strategy Documents', '/test/strategy', 'CEO Strategy'),
      },
      {
        path: 'strategy/okrs',
        element: createPlaceholder('OKR Hierarchy', '/test/strategy', 'CEO Strategy'),
      },
      {
        path: 'strategy/kpis',
        element: createPlaceholder('KPI Dashboard', '/test/strategy', 'CEO Strategy'),
      },
      {
        path: 'strategy/performance',
        element: createPlaceholder('Performance Aggregation', '/test/strategy', 'CEO Strategy'),
      },
      {
        path: 'strategy/executive',
        element: createPlaceholder('Executive Dashboard', '/test/strategy', 'CEO Strategy'),
      },

      // Phase 4: Financial Management (4.1-4.2 only)
      {
        path: 'finance',
        element: <PageWrapper><TestFinancialManagement /></PageWrapper>,
      },
      {
        path: 'finance/chart-of-accounts',
        element: createPlaceholder('Chart of Accounts', '/test/finance', 'Financial Management'),
      },
      {
        path: 'finance/budget',
        element: createPlaceholder('Budget Management', '/test/finance', 'Financial Management'),
      },
    ],
  },
];

export default testRoutes;
