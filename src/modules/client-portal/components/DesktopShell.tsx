import * as React from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { DensityToggle } from './DensityToggle';
import { UserMenu } from './UserMenu';
import { NotificationBell } from './NotificationBell';

export type PortalLine = 'finishes' | 'advisory';

export interface PortalProject {
  tag: string;
  name: string;
  sub: string;
  slug: string;
  line: PortalLine;
}

interface NavItem {
  k: string;        // route segment after /portal/p/:slug/
  l: string;        // label
  i: IconName;
  g: 'project' | 'documents' | 'team';
  /**
   * `false` = this nav entry has no real data source yet and is only
   * displayed on the mock-data showcase routes (Vela Boutique /
   * Naqaa Rollout fixtures). On real projects it is hidden so the
   * portal doesn't promise pages we can't render.
   */
  data?: boolean;
}

const NAV_FIN: NavItem[] = [
  { k: 'dashboard',    l: 'Dashboard',         i: 'home',     g: 'project',   data: true },
  { k: 'approvals',    l: 'Approvals',         i: 'inbox',    g: 'project',   data: true },
  { k: 'quotes',       l: 'Quotations',        i: 'doc',      g: 'project',   data: true },
  { k: 'financials',   l: 'Financials',        i: 'money',    g: 'project',   data: true },
  { k: 'materials',    l: 'Materials & FF&E',  i: 'box',      g: 'documents', data: true },
  { k: 'drawings',     l: 'Plans & drawings',  i: 'plans',    g: 'documents', data: true },
  { k: 'schedule',     l: 'Schedule',          i: 'calendar', g: 'documents', data: true },
  { k: 'snags',        l: 'Snags',             i: 'pin',      g: 'documents', data: true },
  { k: 'interactions', l: 'Interactions',      i: 'star',     g: 'documents', data: true },
  { k: 'reports',      l: 'Reports',           i: 'chart',    g: 'documents', data: true },
  { k: 'messages',     l: 'Messages',          i: 'chat',     g: 'team',      data: true },
  { k: 'matflow',      l: 'Matflow',           i: 'matflow',  g: 'team',      data: true },
];

const NAV_ADV: NavItem[] = [
  { k: 'dashboard',      l: 'Dashboard',          i: 'home',     g: 'project',   data: false },
  { k: 'approvals',      l: 'Approvals',          i: 'inbox',    g: 'project',   data: false },
  { k: 'financials',     l: 'Financials',         i: 'money',    g: 'project',   data: false },
  { k: 'implementation', l: 'Implementation',     i: 'flag',     g: 'documents', data: false },
  { k: 'boqs',           l: 'BOQs',               i: 'doc',      g: 'documents', data: false },
  { k: 'schedules',      l: 'Material schedules', i: 'box',      g: 'documents', data: false },
  { k: 'drawings',       l: 'Plans & drawings',   i: 'plans',    g: 'documents', data: false },
  { k: 'snags',          l: 'Snags',              i: 'pin',      g: 'documents', data: false },
  { k: 'interactions',   l: 'Interactions',       i: 'star',     g: 'documents', data: false },
  { k: 'reports',        l: 'Reports',            i: 'chart',    g: 'documents', data: false },
  { k: 'messages',       l: 'Messages',           i: 'chat',     g: 'team',      data: false },
  { k: 'matflow',        l: 'Matflow',            i: 'matflow',  g: 'team',      data: false },
];

const NAV_GROUPS: Array<{ k: NavItem['g']; l: string }> = [
  { k: 'project',   l: 'Project' },
  { k: 'documents', l: 'Documents' },
  { k: 'team',      l: 'Team' },
];

const BADGES_FIN: Partial<Record<string, number>> = { approvals: 3, snags: 2 };
const BADGES_ADV: Partial<Record<string, number>> = { approvals: 1, snags: 3 };

interface PortalShellProps {
  project: PortalProject;
  title: React.ReactNode;
  crumbs?: React.ReactNode[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  /**
   * 'mock' = the project is a wireframe fixture, so we show every nav
   *   item (even ones whose data isn't sourced yet) for design review.
   * 'live' = the project is real Firestore data; nav entries without a
   *   data source are hidden.
   */
  dataMode?: 'mock' | 'live';
  /** Optional override of badge counts to reflect real data on live mode. */
  badges?: Partial<Record<string, number>>;
}

export function PortalShell({
  project, title, crumbs, actions, children, dataMode = 'mock', badges,
}: PortalShellProps) {
  // Mobile sidebar open/closed state. Toggled via the hamburger button
  // in the topbar; closed when the scrim is clicked or a nav link is
  // followed. Persisted to a data-attribute on the shell root so the
  // CSS @media query slides the drawer in/out without a re-render path.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Auto-close on route change (user picked a nav item).
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Lock body scroll while drawer is open so the underlying page
  // doesn't scroll behind the scrim.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [sidebarOpen]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      data-sidebar-open={sidebarOpen ? 'true' : 'false'}
    >
      <div className="h-app" style={{ minHeight: '100vh' }}>
        <Sidebar project={project} dataMode={dataMode} badgesOverride={badges} />
        <div
          className="h-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <TopBar
            title={title}
            crumbs={crumbs}
            actions={actions}
            onMenuClick={() => setSidebarOpen((v) => !v)}
          />
          <div className="h-main">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  project, dataMode, badgesOverride,
}: {
  project: PortalProject;
  dataMode: 'mock' | 'live';
  badgesOverride?: Partial<Record<string, number>>;
}) {
  const location = useLocation();
  const allNav = project.line === 'advisory' ? NAV_ADV : NAV_FIN;
  const nav = dataMode === 'live' ? allNav.filter((n) => n.data) : allNav;
  const defaultBadges = project.line === 'advisory' ? BADGES_ADV : BADGES_FIN;
  const badges = dataMode === 'live' ? (badgesOverride ?? {}) : defaultBadges;
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: nav.filter((n) => n.g === g.k) }))
    .filter((g) => g.items.length);

  const isOn = (k: string) => {
    const target = `/portal/p/${project.slug}/${k}`;
    return location.pathname === target || location.pathname.startsWith(target + '/');
  };

  return (
    <div className="h-side">
      <div className="h-side-brand">
        <div className="h-side-brand-mark">D</div>
        <div>
          <div className="h-side-brand-t">Dawin<span style={{ color: 'var(--ink-3)' }}>OS</span></div>
          <div className="h-side-brand-s">Client Portal</div>
        </div>
      </div>

      <NavLink to="/portal/projects" className="h-side-proj" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="h-side-proj-l">
          {project.line === 'advisory' ? 'Advisory project' : 'Finishes project'}
        </div>
        <div className="h-side-proj-t">
          <span>{project.name}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="h-side-proj-s">{project.tag}</div>
      </NavLink>

      <div className="h-side-nav">
        {groups.map((g) => (
          <React.Fragment key={g.k}>
            <div className="h-side-grp">{g.l}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.k}
                to={`/portal/p/${project.slug}/${it.k}`}
                className={'h-side-i' + (isOn(it.k) ? ' is-on' : '')}
                style={{ textDecoration: 'none' }}
              >
                <span className="h-side-i-ic"><Icon name={it.i} size={16} stroke={1.6} /></span>
                <span>{it.l}</span>
                {badges[it.k] ? <span className="h-side-i-r">{badges[it.k]}</span> : null}
              </NavLink>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="h-side-foot">
        <div className="h-side-foot-i">Help &amp; docs</div>
        <div className="h-side-foot-i">What's new</div>
        <div className="h-side-foot-i" style={{ color: 'var(--ink-2)' }}>v 2.4 · 12 May</div>
      </div>
    </div>
  );
}

function TopBar({
  title, crumbs, actions, onMenuClick,
}: {
  title: React.ReactNode;
  crumbs?: React.ReactNode[];
  actions?: React.ReactNode;
  onMenuClick: () => void;
}) {
  return (
    <div className="h-top">
      <div className="h-top-l">
        <button
          type="button"
          className="h-hamburger"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Icon name="menu" size={18} />
        </button>
        <div>
          {crumbs ? (
            <div className="h-top-crumbs">
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>{i > 0 ? <span>/</span> : null}{c}</React.Fragment>
              ))}
            </div>
          ) : null}
          <div className="h-top-t" style={{ marginTop: crumbs ? 4 : 0 }}>{title}</div>
        </div>
      </div>
      <div className="h-top-r">
        <div className="h-top-search">
          <Icon name="search" size={14} />
          <span>Search this project</span>
          <kbd>⌘K</kbd>
        </div>
        <DensityToggle />
        <NotificationBell />
        <UserMenu />
        {actions ? <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>{actions}</div> : null}
      </div>
    </div>
  );
}

// ── PAGE HEAD ───────────────────────────────────────────
interface PageHeadProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHead({ eyebrow, title, sub, children }: PageHeadProps) {
  return (
    <div className="h-main-head">
      <div className="h-main-head-l">
        {eyebrow ? <div className="h-main-head-eb">{eyebrow}</div> : null}
        <div className="h-main-head-t">{title}</div>
        {sub ? <div className="h-main-head-s">{sub}</div> : null}
      </div>
      {children ? <div className="h-main-head-r">{children}</div> : null}
    </div>
  );
}
