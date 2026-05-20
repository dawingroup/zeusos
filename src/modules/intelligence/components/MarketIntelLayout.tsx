/**
 * Market Intelligence Layout
 * Tab-based navigation for Market Intelligence module sub-pages
 * Coordinates with main header for sticky positioning
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const MARKET_INTEL_TABS: TabNavItem[] = [
  {
    id: 'competitors',
    label: 'Competitors',
    path: '/market-intel/competitors',
    icon: 'Users',
  },
  {
    id: 'news',
    label: 'News Feed',
    path: '/market-intel/news',
    icon: 'Newspaper',
  },
  {
    id: 'market',
    label: 'Market Analysis',
    path: '/market-intel/market',
    icon: 'BarChart3',
  },
  {
    id: 'insights',
    label: 'Insights',
    path: '/market-intel/insights',
    icon: 'Lightbulb',
  },
  {
    id: 'topics',
    label: 'Topic Tracking',
    path: '/market-intel/topics',
    icon: 'Radio',
  },
  {
    id: 'social',
    label: 'Social Tracker',
    path: '/market-intel/social',
    icon: 'Activity',
  },
  {
    id: 'ai-scan',
    label: 'AI Scan',
    path: '/market-intel/ai-scan',
    icon: 'Radar',
  },
];

export function MarketIntelLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Market Intelligence"
        subtitle="Competitive Analysis & Market Research"
        tabs={MARKET_INTEL_TABS}
        accentColor="cyan"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default MarketIntelLayout;
