/**
 * CommsLayout — the tabbed shell for the Comms / Messaging module (/comms/*).
 *
 * Ported from DawinOS `MessagingLayout`, adapted to ZeusOS routes + the
 * `ModuleTabNav` primitive. Renders a sticky tab strip; child routes render in
 * the outlet. Tabs:
 *   Team Chat · WhatsApp · Unified Inbox · Templates · Broadcasts · Settings
 *
 * Team Chat + Settings are the ZeusOS-native surfaces that already shipped.
 * The WhatsApp-channel tabs (WhatsApp / Unified / Templates / Broadcasts) are
 * ported from DawinOS but render a "not configured" state until a Meta
 * Business (Cloud API) account + token are provisioned for ZeusOS — see
 * `comms-config.service` + `MessagingSettingsPage`.
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const COMMS_TABS: TabNavItem[] = [
  // Unified Inbox is the module's default landing surface (loads first).
  { id: 'unified',    label: 'Unified Inbox', path: '/comms',            icon: 'Inbox', exact: true },
  { id: 'team-chat',  label: 'Team Chat',     path: '/comms/team',       icon: 'MessagesSquare' },
  { id: 'whatsapp',   label: 'WhatsApp',      path: '/comms/whatsapp',   icon: 'MessageSquare' },
  { id: 'templates',  label: 'Templates',     path: '/comms/templates',  icon: 'FileText' },
  { id: 'broadcasts', label: 'Broadcasts',    path: '/comms/broadcasts', icon: 'Megaphone' },
  { id: 'settings',   label: 'Settings',      path: '/comms/settings',   icon: 'Settings' },
];

export default function CommsLayout() {
  return (
    <div className="flex flex-col h-full" data-testid="comms-layout">
      <ModuleTabNav
        title="Comms"
        subtitle="Team Chat & client messaging"
        tabs={COMMS_TABS}
      />
      <ModuleContentWrapper noPadding>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
