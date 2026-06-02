import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { CORPORATE_NAVIGATION, type NavItem } from '@/config/navigation.unified';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';

interface GroupNavPillsProps {
  items?: NavItem[];
  className?: string;
}

/**
 * Corporate service pills (UI Refresh v3 — handoff README §"Top bar, row 2").
 *
 * Each pill is a **dropdown**: the trigger shows the module icon + label +
 * a chevron that rotates 180° when open; clicking opens a menu of the
 * module's children (from `navigation.unified.ts`). Active state (current
 * route under that module) gets `--brand-accent-soft` bg + `--brand-accent`
 * border + 600 weight. Only one menu open at a time; outside-click closes.
 *
 * Replaces the prior flat NavLink pills. Navigation uses the child `href`
 * directly (react-router), so this stays in lock-step with the route table.
 */
export function GroupNavPills({ items = CORPORATE_NAVIGATION, className }: GroupNavPillsProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on outside-click.
  useEffect(() => {
    if (!openId) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openId]);

  // Close the menu on route change.
  useEffect(() => {
    setOpenId(null);
  }, [pathname]);

  const isUnder = (href: string) =>
    href === pathname || pathname.startsWith(href + '/') || pathname === href;

  return (
    <nav
      ref={rootRef}
      className={cn('flex items-center gap-1', className)}
      aria-label="Corporate navigation"
    >
      {items.map((item) => {
        const Icon = getIconByName(item.icon);
        const children = item.children ?? [];
        const active =
          isUnder(item.href) || children.some((c) => isUnder(c.href));
        const open = openId === item.id;

        return (
          <div key={item.id} className="relative flex-none">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() =>
                children.length > 0
                  ? setOpenId(open ? null : item.id)
                  : navigate(item.href)
              }
              className={cn(
                'inline-flex items-center gap-1.5 h-[30px] px-2.5 rounded-lg text-[12.5px] transition-colors',
                'border',
                active
                  ? 'border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--fg-primary)] font-semibold'
                  : 'border-transparent text-[var(--fg-secondary)] font-medium hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-primary)]',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              <span className="hidden lg:inline">{item.label}</span>
              {children.length > 0 && (
                <ChevronDown
                  className={cn(
                    'h-3 w-3 text-[var(--fg-tertiary)] transition-transform',
                    open && 'rotate-180',
                  )}
                />
              )}
            </button>

            {open && children.length > 0 && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1.5 min-w-[210px] rounded-[10px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-lg)]"
              >
                <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-tertiary)]">
                  {item.label}
                </div>
                {children.map((child) => {
                  const ChildIcon = getIconByName(child.icon);
                  const childActive = isUnder(child.href);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        navigate(child.href);
                        setOpenId(null);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[12.5px] transition-colors',
                        childActive
                          ? 'bg-[var(--bg-sunken)] font-semibold text-[var(--fg-primary)]'
                          : 'text-[var(--fg-primary)] hover:bg-[var(--bg-sunken)]',
                      )}
                    >
                      {ChildIcon ? (
                        <ChildIcon className="h-3.5 w-3.5 text-[var(--fg-tertiary)]" />
                      ) : null}
                      <span>{child.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
