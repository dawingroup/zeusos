/**
 * ModuleTabNav
 * Sticky module header: title + subtitle on top, child-route tab strip below.
 * Per portal redesign — Phase 3.
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { getIconByName } from '@/shared/utils/iconMap';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/core/components/ui/button';

export interface TabNavItem {
  id: string;
  label: string;
  path: string;
  icon?: string | LucideIcon;
  badge?: number | string;
  exact?: boolean;
}

export interface ModuleTabNavProps {
  title: string;
  subtitle?: string;
  tabs: TabNavItem[];
  backPath?: string;
  backLabel?: string;
  /** Deprecated — accent now derives from --accent CSS var. Retained for API back-compat. */
  accentColor?: string;
  className?: string;
  rightContent?: React.ReactNode;
}

export function ModuleTabNav({
  title,
  subtitle,
  tabs,
  backPath,
  backLabel = 'Back',
  className,
  rightContent,
}: ModuleTabNavProps) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Drop a sentinel above the sticky bar; when it scrolls out of view, the
  // bar is "stuck" and gets a soft shadow.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const getIcon = (icon?: string | LucideIcon) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      const Icon = getIconByName(icon);
      return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
    }
    const IconComponent = icon;
    return <IconComponent className="h-3.5 w-3.5" />;
  };

  const isActive = (tab: TabNavItem) => {
    if (tab.exact) return location.pathname === tab.path;
    return location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <div
        className={cn(
          'sticky top-0 z-30 transition-shadow duration-200',
          scrolled && 'shadow-[0_2px_8px_rgba(20,20,22,0.04)]',
          className
        )}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {/* ──────────── Title row ──────────── */}
        <div className="max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8 pt-3.5 pb-2.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {backPath && (
                <NavLink to={backPath}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-7 px-2 text-[12px] text-[var(--fg-secondary)]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {backLabel}
                  </Button>
                </NavLink>
              )}
              <div className="min-w-0">
                <h1
                  className="text-[19px] font-semibold leading-tight truncate"
                  style={{ letterSpacing: '-0.015em', color: 'var(--fg-primary)' }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p
                    className="mt-1 text-[12.5px] truncate"
                    style={{ color: 'var(--fg-secondary)' }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {rightContent && (
              <div className="flex items-center gap-2 shrink-0">{rightContent}</div>
            )}
          </div>
        </div>

        {/* ──────────── Tab strip ──────────── */}
        {tabs.length > 0 && (
          <div className="max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-8">
            <nav
              className="flex gap-0.5 overflow-x-auto"
              style={{ marginBottom: '-1px' }}
              aria-label="Module sections"
            >
              {tabs.map((tab) => {
                const active = isActive(tab);
                return (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={cn(
                      'inline-flex items-center gap-1.5 whitespace-nowrap',
                      'pt-2.5 pb-3 px-3 text-[12.5px] font-medium transition-colors',
                      'border-b-2 -mb-px'
                    )}
                    style={{
                      color: active ? 'var(--accent)' : 'var(--fg-tertiary)',
                      borderBottomColor: active ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {getIcon(tab.icon)}
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className="ml-0.5 px-1.5 py-0.5 text-[10.5px] rounded-full font-medium"
                        style={{
                          backgroundColor: active
                            ? 'var(--accent-soft)'
                            : 'var(--bg-sunken)',
                          color: active ? 'var(--accent)' : 'var(--fg-tertiary)',
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}

export default ModuleTabNav;
