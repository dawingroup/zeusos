/**
 * Memos layout — routed shell for the memo module.
 */
import { Outlet } from 'react-router-dom';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const MEMO_TABS: TabNavItem[] = [
  { id: 'register', label: 'Register', path: '/memos', icon: 'FileText', exact: true },
  { id: 'mine', label: 'My memos', path: '/memos/mine', icon: 'User' },
  { id: 'awaiting', label: 'Awaiting me', path: '/memos/awaiting', icon: 'Inbox' },
  { id: 'new', label: 'New memo', path: '/memos/new', icon: 'FilePlus' },
];

export default function MemosLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <ModuleTabNav title="Memos" subtitle="Written context for finance, administrative and operational decisions" tabs={MEMO_TABS} accentColor="slate" />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
