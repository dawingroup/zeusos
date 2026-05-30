/**
 * Phase 6.UI.B — Traffic module layout. Tabbed nav per the manifest:
 *   Routing Queue · Active IWOs · Brand Capacity · Override Log
 */

import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { PageHero } from '@/shared/components/refresh';

const TABS: { to: string; label: string; testId: string }[] = [
  { to: '/traffic',            label: 'Routing Queue',  testId: 'traffic-tab-queue' },
  { to: '/traffic/active',     label: 'Active IWOs',    testId: 'traffic-tab-active' },
  { to: '/traffic/capacity',   label: 'Brand Capacity', testId: 'traffic-tab-capacity' },
  { to: '/traffic/overrides',  label: 'Override Log',   testId: 'traffic-tab-overrides' },
];

export function TrafficLayout() {
  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="traffic-layout">
      <PageHero
        eyebrow="Traffic"
        title="Routing & assignment"
        body="Brand-routing decisions for open master jobs. The engine proposes a serving brand; Traffic confirms or overrides before issuance. Conflict-walled candidates are excluded automatically."
      />

      <nav className="mb-5" style={{ borderBottom: '1px solid var(--border-subtle)' }} aria-label="Traffic tabs">
        <ul className="flex gap-1 -mb-px">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/traffic'}
                data-testid={t.testId}
                className={({ isActive }) =>
                  cn(
                    'inline-block px-3.5 py-2.5 text-[13px] border-b-2 transition-colors',
                    isActive
                      ? 'border-[var(--zeus-red)] text-[var(--fg-primary)] font-semibold'
                      : 'border-transparent text-[var(--fg-tertiary)] font-medium hover:text-[var(--fg-primary)]',
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
