import { useMemo, useState } from 'react';
import { Pin, PinOff, ChevronDown } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Button } from '@/core/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/core/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { getIconByName } from '@/shared/utils/iconMap';
import {
  ADMIN_NAVIGATION,
  ADVISORY_NAVIGATION,
  FINISHES_NAVIGATION,
  GLOBAL_NAVIGATION,
  UTILITY_NAVIGATION,
  type NavItem,
} from '@/config/navigation.unified';
import { useSidebar } from '@/integration/store';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';

export interface UnifiedSidebarProps {
  className?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export function UnifiedSidebar({
  className,
  collapsed = false,
  onNavigate,
}: UnifiedSidebarProps) {
  const { isPinned, togglePin } = useSidebar();
  const { currentSubsidiary } = useSubsidiary();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isCollapsed = collapsed;

  const sections = useMemo<NavSection[]>(() => {
    const subsidiaryNav =
      currentSubsidiary?.id === 'zeus-digital'
        ? ADVISORY_NAVIGATION
        : FINISHES_NAVIGATION;

    const subsidiaryLabel = currentSubsidiary?.shortName ?? 'Finishes';

    return [
      { id: 'subsidiary', label: subsidiaryLabel, items: subsidiaryNav },
      { id: 'workspace', label: 'Workspace', items: GLOBAL_NAVIGATION },
      { id: 'intelligence', label: 'Intelligence', items: UTILITY_NAVIGATION },
      { id: 'admin', label: 'Admin', items: ADMIN_NAVIGATION },
    ];
  }, [currentSubsidiary]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'h-screen flex flex-col shrink-0 transition-[width] duration-200',
        isCollapsed ? 'w-16' : 'w-60',
        'border-r border-[var(--border-on-dark)]',
        className
      )}
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        color: 'var(--fg-on-dark)',
      }}
    >
      {/* ──────────── Brand ──────────── */}
      <div
        className={cn(
          'h-14 flex items-center shrink-0 border-b border-[var(--border-on-dark)]',
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-md grid place-items-center text-white font-bold text-[11px] tracking-wider shrink-0"
            style={{
              background:
                'linear-gradient(135deg, #872e5c 0%, #e18425 100%)',
            }}
          >
            DG
          </div>
          {!isCollapsed && (
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-[var(--fg-on-dark)]">
                Dawin Group
              </div>
              <div className="text-[10.5px] text-[var(--fg-on-dark-muted)]">
                Portal
              </div>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[var(--fg-on-dark-muted)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--bg-sidebar-hover)]"
                onClick={() => togglePin?.()}
                aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ──────────── Sections ──────────── */}
      <ScrollArea className="flex-1">
        <div className={cn('py-3', isCollapsed ? 'px-2' : 'px-3')}>
          {sections.map((section, idx) => (
            <SidebarSection
              key={section.id}
              section={section}
              collapsed={isCollapsed}
              expanded={expanded}
              onToggle={toggle}
              onNavigate={onNavigate}
              showDivider={idx > 0}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

interface SectionProps {
  section: NavSection;
  collapsed: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate?: () => void;
  showDivider?: boolean;
}

function SidebarSection({
  section,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
  showDivider,
}: SectionProps) {
  if (!section.items.length) return null;
  return (
    <div className={cn(showDivider && 'mt-4 pt-4 border-t border-[var(--border-on-dark)]')}>
      {!collapsed && (
        <div className="px-2 mb-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--fg-on-dark-muted)]">
          {section.label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {section.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            collapsed={collapsed}
            expanded={expanded}
            onToggle={onToggle}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

interface ItemProps {
  item: NavItem;
  collapsed: boolean;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate?: () => void;
  depth?: number;
}

function SidebarItem({
  item,
  collapsed,
  expanded,
  onToggle,
  onNavigate,
  depth = 0,
}: ItemProps) {
  const { pathname } = useLocation();
  const Icon = getIconByName(item.icon);
  const hasChildren = !!item.children?.length;
  const isExpanded = expanded.has(item.id);
  const active =
    pathname === item.href || pathname.startsWith(item.href + '/');

  const rowClass = cn(
    'group flex items-center gap-3 rounded-md text-[13px] font-normal select-none transition-colors',
    collapsed ? 'justify-center h-9 w-full' : 'h-8 px-2.5',
    depth > 0 && !collapsed && 'pl-7 text-[12.5px]',
    active
      ? 'bg-[var(--bg-sidebar-active)] text-[var(--fg-on-dark)] font-medium'
      : 'text-[var(--fg-on-dark)] hover:bg-[var(--bg-sidebar-hover)]'
  );

  const iconNode = Icon ? (
    <Icon
      className={cn(
        'shrink-0',
        collapsed ? 'h-4 w-4' : depth > 0 ? 'h-3.5 w-3.5' : 'h-4 w-4'
      )}
    />
  ) : null;

  const labelNode = !collapsed && <span className="flex-1 truncate">{item.label}</span>;
  const badgeNode =
    !collapsed && item.badge != null ? (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-sidebar-hover)] text-[var(--fg-on-dark)]">
        {item.badge}
      </span>
    ) : null;

  if (hasChildren && !collapsed) {
    return (
      <div>
        <button
          type="button"
          className={cn(rowClass, 'w-full text-left')}
          onClick={() => onToggle(item.id)}
        >
          {iconNode}
          {labelNode}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-[var(--fg-on-dark-muted)] transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
        {isExpanded && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            {item.children!.map((child) => (
              <SidebarItem
                key={child.id}
                item={child}
                collapsed={collapsed}
                expanded={expanded}
                onToggle={onToggle}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const link = (
    <NavLink to={item.href} onClick={onNavigate} className={rowClass}>
      {iconNode}
      {labelNode}
      {badgeNode}
    </NavLink>
  );

  if (collapsed && depth === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
