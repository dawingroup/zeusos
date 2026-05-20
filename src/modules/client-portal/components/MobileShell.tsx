import * as React from 'react';
import { Icon, type IconName } from './Icon';

interface PhoneFrameProps {
  children: React.ReactNode;
  label?: string;
  tabbar?: boolean;
  tabActive?: TabKey;
}

type TabKey = 'home' | 'approvals' | 'documents' | 'messages' | 'more';

export function PhoneFrame({ children, label, tabbar = true, tabActive = 'home' }: PhoneFrameProps) {
  return (
    <div className="h-phone">
      <div className="h-status" style={{ color: 'var(--ink)' }}>
        <span>9:41</span>
        <span className="h-status-isle" />
        <span className="h-status-r">
          <svg width="16" height="12" viewBox="0 0 16 12">
            <path d="M0 8h2v3H0zM4 5h2v6H4zM8 2h2v9H8zM12 0h2v11h-2z" fill="currentColor" />
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12">
            <path d="M8 11a1 1 0 110-2 1 1 0 010 2zM3.5 6.5a6 6 0 019 0M5.5 8.5a3 3 0 016 0M1 4a9 9 0 0114 0"
              stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          </svg>
          <svg width="24" height="12" viewBox="0 0 24 12">
            <rect x="0.5" y="1.5" width="20" height="9" rx="2" stroke="currentColor" strokeOpacity="0.5" fill="none" />
            <rect x="2" y="3" width="14" height="6" rx="1" fill="currentColor" />
            <path d="M22 4v4" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      {children}
      {tabbar ? <TabBar active={tabActive} /> : null}
      <div className="h-tab-home-bar" />
      {label ? <div className="h-screen-label">{label}</div> : null}
    </div>
  );
}

const TAB_ITEMS: { k: TabKey; l: string; i: IconName }[] = [
  { k: 'home',      l: 'Home',      i: 'home' },
  { k: 'approvals', l: 'Approvals', i: 'inbox' },
  { k: 'documents', l: 'Documents', i: 'doc' },
  { k: 'messages',  l: 'Messages',  i: 'chat' },
  { k: 'more',      l: 'More',      i: 'more' },
];

export function TabBar({ active = 'home', onSelect }: { active?: TabKey; onSelect?: (k: TabKey) => void }) {
  return (
    <div className="h-tabbar">
      {TAB_ITEMS.map((it) => (
        <button
          key={it.k}
          type="button"
          className={'h-tab' + (active === it.k ? ' is-on' : '')}
          onClick={() => onSelect?.(it.k)}
        >
          <div className="h-tab-i"><Icon name={it.i} size={20} /></div>
          <div className="h-tab-l">{it.l}</div>
        </button>
      ))}
    </div>
  );
}

interface MobileNavProps {
  title: React.ReactNode;
  sub?: React.ReactNode;
  back?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
}

export function MobileNav({ title, sub, back, right, onBack }: MobileNavProps) {
  return (
    <div className="h-mtopnav">
      <div className="h-mtopnav-l">
        {back ? (
          <div className="h-mtopnav-back" onClick={onBack} style={{ cursor: onBack ? 'pointer' : undefined }}>
            <Icon name="arrow-l" size={16} />
          </div>
        ) : null}
        <div>
          <div className="h-mtopnav-t">{title}</div>
          {sub ? <div className="h-mtopnav-s">{sub}</div> : null}
        </div>
      </div>
      <div className="h-mtopnav-r">{right}</div>
    </div>
  );
}
