import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/core/components/ui/tooltip';
import type { NavItem } from '@/integration/constants/navigation.constants';
import { getIconByName } from '@/shared/utils/iconMap';

export interface NavigationMenuProps {
  items: NavItem[];
  expandedItems: string[];
  onToggleExpanded: (id: string) => void;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavigationMenu({
  items,
  expandedItems,
  onToggleExpanded,
  collapsed = false,
  onNavigate,
}: NavigationMenuProps) {
  const location = useLocation();

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = getIconByName(iconName);
    return Icon ? <Icon className="h-4 w-4 shrink-0" /> : null;
  };

  const renderItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.path);
    const hasChildren = !!item.children?.length;
    const expanded = expandedItems.includes(item.id);
    const icon = getIcon(item.icon);

    const rowClassName = cn(
      'flex items-center gap-3 rounded-lg text-sm transition-colors cursor-pointer select-none',
      collapsed ? 'justify-center p-2' : 'px-3 py-2',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      depth > 0 && !collapsed && 'ml-4'
    );

    const content = (
      <div key={item.id}>
        {hasChildren && !collapsed ? (
          <div
            className={rowClassName}
            onClick={(e) => {
              e.preventDefault();
              onToggleExpanded(item.id);
            }}
          >
            {icon}
            <span className="flex-1">{item.label}</span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
            />
          </div>
        ) : (
          <Link 
            to={item.path || (item.children?.[0]?.path) || '#'} 
            className={rowClassName}
            onClick={() => onNavigate?.()}
          >
            {icon}
            {!collapsed && <span className="flex-1">{item.label}</span>}
          </Link>
        )}

        {hasChildren && expanded && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );

    if (collapsed && depth === 0) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return <div className="space-y-1">{items.map((i) => renderItem(i))}</div>;
}
