/**
 * Investment Module Routes
 */

import { Suspense } from 'react';
import { RouteObject } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
  </div>
);

// Lazy load pages
const InvestmentDashboard = lazyWithRetry(() => import('./pages/InvestmentDashboard'));
const PipelineKanban = lazyWithRetry(() => import('./pages/PipelineKanban'));
const DealDetail = lazyWithRetry(() => import('./pages/DealDetail'));

// Wrapper with Suspense
const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const investmentRoutes: RouteObject[] = [
  {
    path: '/investment',
    children: [
      {
        index: true,
        element: withSuspense(InvestmentDashboard)
      },
      {
        path: 'pipeline',
        element: withSuspense(PipelineKanban)
      },
      {
        path: 'deals',
        children: [
          {
            path: ':dealId',
            element: withSuspense(DealDetail)
          }
        ]
      }
    ]
  }
];

export default investmentRoutes;
