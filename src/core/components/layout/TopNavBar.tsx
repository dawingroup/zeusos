import React from 'react';
import { Bell, Search, Menu, MessageSquare, Sparkles, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/core/components/ui/tooltip';
import { GroupNavPills } from './GroupNavPills';
import { SubsidiaryPicker } from './SubsidiaryPicker';
import { PreferencesMenu } from './PreferencesMenu';
import { useNotifications, useAuth } from '@/integration/store';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/shared/services/firebase';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { subscribeToUnreadCount } from '@/modules/whatsapp/services/whatsappService';
import { cn } from '@/shared/lib/utils';

export interface TopNavBarProps {
  onOpenNotifications?: () => void;
  onOpenSearch?: () => void;
  onMenuClick?: () => void;
}

/**
 * 56px top bar.
 *   Left:  mobile menu, Group nav pills (Strategy/HR/Finance/...)
 *   Right: ⌘K search, AI, Messaging, Notifications,
 *          Subsidiary picker, User avatar (with Preferences submenu).
 */
export function TopNavBar({
  onOpenNotifications,
  onOpenSearch,
  onMenuClick,
}: TopNavBarProps) {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { displayName, email } = useAuth();
  const whatsappEnabled = useFeatureFlag('WHATSAPP_ENABLED');
  const [waUnread, setWaUnread] = React.useState(0);

  React.useEffect(() => {
    if (!whatsappEnabled) return;
    return subscribeToUnreadCount(setWaUnread);
  }, [whatsappEnabled]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <header
      className={cn(
        'h-14 shrink-0 flex items-center justify-between gap-3',
        'border-b border-[var(--border-default)]',
        'bg-[var(--bg-surface)] px-3 sm:px-4'
      )}
    >
      {/* ──────────── Left: mobile menu + group nav ──────────── */}
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <GroupNavPills className="hidden md:flex" />
      </div>

      {/* ──────────── Right: cluster ──────────── */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Search ⌘K */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenSearch}
              className={cn(
                'hidden sm:inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-md',
                'border border-[var(--border-default)] bg-[var(--bg-surface)]',
                'text-[12.5px] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]',
                'hover:bg-[var(--bg-sunken)] transition-colors focus:outline-none',
                'focus:ring-2 focus:ring-[var(--accent-soft)]'
              )}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline-flex h-4 items-center px-1 rounded text-[10px] font-mono bg-[var(--bg-sunken)] text-[var(--fg-tertiary)]">
                ⌘K
              </kbd>
            </button>
          </TooltipTrigger>
          <TooltipContent>Search (⌘K)</TooltipContent>
        </Tooltip>

        {/* Mobile search */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden h-8 w-8"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* AI Intelligence */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate('/ai')}
              aria-label="AI Intelligence"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI Intelligence</TooltipContent>
        </Tooltip>

        {/* Messaging */}
        {whatsappEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={() => navigate('/whatsapp')}
                aria-label="Messages"
              >
                <MessageSquare className="h-4 w-4" />
                {waUnread > 0 && (
                  <span
                    className="absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-[var(--bg-surface)]"
                    style={{ backgroundColor: 'var(--rag-green)' }}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Messages{waUnread > 0 ? ` (${waUnread})` : ''}</TooltipContent>
          </Tooltip>
        )}

        {/* Notifications */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative"
              onClick={onOpenNotifications}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-[var(--bg-surface)]"
                  style={{ backgroundColor: 'var(--rag-red)' }}
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </TooltipContent>
        </Tooltip>

        {/* Subsidiary picker */}
        <SubsidiaryPicker className="ml-1" />

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 ml-1"
              aria-label="Account menu"
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-[11.5px] font-semibold"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                {displayName?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
                <p className="text-[13px] font-medium text-[var(--fg-primary)]">
                  {displayName || 'User'}
                </p>
                <p className="text-[11px] text-[var(--fg-tertiary)] truncate">{email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserIcon className="mr-2 h-3.5 w-3.5" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
              <Settings className="mr-2 h-3.5 w-3.5" /> Settings
            </DropdownMenuItem>
            <PreferencesMenu />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
