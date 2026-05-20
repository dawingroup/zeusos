/**
 * WhatsApp Layout
 * Tab-based navigation for WhatsApp module sub-pages
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const WHATSAPP_TABS: TabNavItem[] = [
  { id: 'inbox', label: 'Inbox', path: '/whatsapp', icon: 'MessageCircle', exact: true },
  { id: 'templates', label: 'Templates', path: '/whatsapp/templates', icon: 'FileText' },
  { id: 'broadcasts', label: 'Broadcasts', path: '/whatsapp/broadcasts', icon: 'Megaphone' },
  { id: 'automation', label: 'Automation', path: '/whatsapp/automation', icon: 'Bot' },
  { id: 'commerce', label: 'Commerce', path: '/whatsapp/commerce', icon: 'ShoppingBag' },
  { id: 'settings', label: 'Settings', path: '/whatsapp/settings', icon: 'Settings' },
];

export default function WhatsAppLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="WhatsApp"
        subtitle="Messaging, Templates & Automation"
        tabs={WHATSAPP_TABS}
        accentColor="green"
        className="lg:top-12"
      />
      <ModuleContentWrapper noPadding>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
