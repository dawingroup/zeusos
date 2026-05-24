/**
 * ModuleNav Component
 * Navigation between modules (sidebar)
 */

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Palette, Package, Factory, Wrench, Layers, Rocket, Image } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Clipper',
    href: '/clipper',
    icon: <Image className="w-5 h-5" />,
  },
  {
    label: 'Design Manager',
    href: '/design',
    icon: <Palette className="w-5 h-5" />,
  },
  {
    label: 'Asset Registry',
    href: '/assets',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Feature Library',
    href: '/design/features',
    icon: <Layers className="w-5 h-5" />,
  },
  {
    label: 'Launch Pipeline',
    href: '/launch-pipeline',
    icon: <Rocket className="w-5 h-5" />,
    badge: 'New',
  },
  {
    label: 'Procurement',
    href: '/manufacturing/purchase-orders',
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: 'Production',
    href: '/manufacturing',
    icon: <Factory className="w-5 h-5" />,
  },
];

export interface ModuleNavProps {
  collapsed?: boolean;
}

export function ModuleNav({ collapsed = false }: ModuleNavProps) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.disabled ? '#' : item.href}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive && !item.disabled
                ? 'bg-[#872E5C] text-white'
                : 'text-muted-foreground hover:bg-[var(--bg-sunken)]',
              item.disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
            )
          }
          onClick={(e) => item.disabled && e.preventDefault()}
        >
          {item.icon}
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="px-2 py-0.5 text-xs bg-[var(--bg-sunken)] text-muted-foreground rounded-full">
                  {item.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default ModuleNav;
