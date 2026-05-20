import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CORPORATE_NAVIGATION, type NavItem } from '@/config/navigation.unified';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';

interface GroupNavPillsProps {
  items?: NavItem[];
  className?: string;
}

/**
 * Horizontal pill row of corporate / group-level destinations.
 * Replaces the sidebar "Group" section per the portal redesign.
 *
 * Active state when current pathname starts with the pill's href.
 * Shows the keyboard shortcut letter as a kbd hint when the "G" prefix
 * is active (dispatched as a `keyprefix` window event by useGlobalShortcuts).
 */
export function GroupNavPills({ items = CORPORATE_NAVIGATION, className }: GroupNavPillsProps) {
  const { pathname } = useLocation();
  const [gPrefix, setGPrefix] = useState(false);

  useEffect(() => {
    const onKey = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'G') {
        setGPrefix(true);
        setTimeout(() => setGPrefix(false), 1200);
      } else {
        setGPrefix(false);
      }
    };
    window.addEventListener('keyprefix', onKey);
    return () => window.removeEventListener('keyprefix', onKey);
  }, []);

  return (
    <nav
      className={cn('flex items-center gap-1', className)}
      aria-label="Group navigation"
    >
      {items.map((item) => {
        const Icon = getIconByName(item.icon);
        const active =
          pathname === item.href || pathname.startsWith(item.href + '/');
        const shortcutLetter = item.shortcut?.split(' ').pop() ?? '';

        return (
          <NavLink
            key={item.id}
            to={item.href}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 h-8 px-3 rounded-md text-[12.5px] font-medium transition-colors',
                'border border-transparent',
                (isActive || active)
                  ? 'bg-[var(--bg-sunken)] text-[var(--fg-primary)] shadow-[inset_0_-2px_0_var(--accent)]'
                  : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-primary)]'
              )
            }
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            <span className="hidden lg:inline">{item.label}</span>
            {gPrefix && shortcutLetter ? (
              <kbd className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--accent-soft)] text-[var(--accent)]">
                {shortcutLetter}
              </kbd>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
