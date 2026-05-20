/**
 * AIIntelligenceMenu Component
 * Brain icon dropdown in the header for quick access to AI Intelligence pages.
 * Role-gated: Team Dashboard visible to managers+, Admin Console visible to admins+.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, LayoutDashboard, ClipboardList, Users, Settings } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { cn } from '@/shared/lib/utils';

interface MenuEntry {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
}

const MENU_ITEMS: MenuEntry[] = [
  { label: 'Dashboard', path: '/ai', icon: LayoutDashboard },
  { label: 'My Tasks', path: '/my-tasks', icon: ClipboardList },
  { label: 'Team Dashboard', path: '/ai/team', icon: Users, roles: ['manager', 'admin', 'owner', 'super_admin'] },
  { label: 'Admin Console', path: '/ai/admin', icon: Settings, roles: ['admin', 'owner', 'super_admin'] },
];

export function AIIntelligenceMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const userRole = dawinUser?.globalRole || '';

  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const isOnAIPage =
    location.pathname.startsWith('/ai') || location.pathname.startsWith('/my-tasks');

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative h-8 w-8', isOnAIPage && 'bg-muted')}
          title="AI Intelligence"
        >
          <Brain className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          AI Intelligence
        </div>
        <DropdownMenuSeparator />
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <DropdownMenuItem
              key={item.path}
              onClick={() => {
                setIsOpen(false);
                navigate(item.path);
              }}
              className={cn('gap-2 cursor-pointer', active && 'bg-muted')}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
