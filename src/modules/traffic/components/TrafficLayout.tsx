/**
 * Phase 6.UI.B — Traffic module layout. Tabbed nav per the manifest:
 *   Routing Queue · Active IWOs · Brand Capacity · Override Log
 */

import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';

const TABS: { to: string; label: string; testId: string }[] = [
  { to: '/traffic',            label: 'Routing Queue',  testId: 'traffic-tab-queue' },
  { to: '/traffic/active',     label: 'Active IWOs',    testId: 'traffic-tab-active' },
  { to: '/traffic/capacity',   label: 'Brand Capacity', testId: 'traffic-tab-capacity' },
  { to: '/traffic/overrides',  label: 'Override Log',   testId: 'traffic-tab-overrides' },
];

export function TrafficLayout() {
  return (
    <div className="p-6" data-testid="traffic-layout">
      <header className="mb-4">
        <h1 className="text-[20px] font-semibold text-[var(--fg-primary)] mb-1">Traffic</h1>
        <p className="text-[13px] text-[var(--fg-tertiary)]">
          Brand-routing decisions for open master jobs. Confirm or override the
          engine's proposal before issuance.
        </p>
      </header>

      <nav className="border-b border-[var(--border-default)] mb-5" aria-label="Traffic tabs">
        <ul className="flex gap-1 -mb-px">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/traffic'}
                data-testid={t.testId}
                className={({ isActive }) =>
                  cn(
                    'inline-block px-3 py-2 text-[13px] font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]',
                  )
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}

export default TrafficLayout;
