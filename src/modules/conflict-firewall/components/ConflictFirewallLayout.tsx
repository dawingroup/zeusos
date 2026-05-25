/**
 * Conflict Firewall — tabbed layout per the Phase 6.UI manifest:
 *   Categories · Client Tags · Walls · Breach Risks
 */

import { NavLink, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const TABS: { to: string; label: string; testId: string }[] = [
  { to: '/conflict-firewall/categories',    label: 'Categories',     testId: 'cf-tab-categories' },
  { to: '/conflict-firewall/client-tags',   label: 'Client Tags',    testId: 'cf-tab-client-tags' },
  { to: '/conflict-firewall/walls',         label: 'Walls',          testId: 'cf-tab-walls' },
  { to: '/conflict-firewall/breach-risks',  label: 'Breach Risks',   testId: 'cf-tab-breach-risks' },
];

export function ConflictFirewallLayout() {
  return (
    <div className="p-6" data-testid="conflict-firewall-layout">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-[20px] font-semibold text-[var(--fg-primary)] mb-1">
          <ShieldAlert className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Conflict Firewall
        </h1>
        <p className="text-[13px] text-[var(--fg-tertiary)]">
          Categories drive client tags, tags pin walls, walls block routing decisions.
          See <code className="font-mono">docs/ADDENDUM_V1_1.md §6</code>.
        </p>
      </header>

      <nav className="border-b border-[var(--border-default)] mb-5" aria-label="Conflict Firewall tabs">
        <ul className="flex gap-1 -mb-px">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
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

export default ConflictFirewallLayout;
