/**
 * Marketing Layout
 * Tab-based navigation for Marketing Hub module sub-pages
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const MARKETING_TABS: TabNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/marketing', icon: 'LayoutDashboard', exact: true },
  { id: 'campaigns', label: 'Campaigns', path: '/marketing/campaigns', icon: 'Megaphone' },
  { id: 'calendar', label: 'Content Calendar', path: '/marketing/calendar', icon: 'Calendar' },
  { id: 'accounts', label: 'Social Accounts', path: '/marketing/accounts', icon: 'Share2' },
  { id: 'templates', label: 'Templates', path: '/marketing/templates', icon: 'MessageSquare' },
  { id: 'analytics', label: 'Analytics', path: '/marketing/analytics', icon: 'BarChart3' },
  { id: 'media', label: 'Media Library', path: '/marketing/media', icon: 'Image' },
  { id: 'case-studies', label: 'Case Studies', path: '/marketing/case-studies', icon: 'BookOpen' },
  { id: 'today', label: 'Today', path: '/marketing/today', icon: 'Sparkles' },
  { id: 'voices', label: 'Voices', path: '/marketing/voices', icon: 'Quote' },
  { id: 'press', label: 'Press', path: '/marketing/press', icon: 'Newspaper' },
  { id: 'agent', label: 'AI Agent', path: '/marketing/agent', icon: 'Bot' },
];

export default function MarketingLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Marketing Hub"
        subtitle="Campaigns, Content & Analytics"
        tabs={MARKETING_TABS}
        accentColor="pink"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
