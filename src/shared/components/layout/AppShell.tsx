/**
 * AppShell Component
 * Main application layout with sidebar and header
 * Enhanced with command palette and improved navigation UX
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  User,
  Check,
  Star,
  LucideIcon,
  Building2,
  Settings,
  MessageSquare,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { getIconByName } from '@/shared/utils/iconMap';
import { Button } from '@/core/components/ui/button';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/core/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useUIStore } from '@/shared/stores/uiStore';
import { OfflineBanner } from '@/shared/components/offline/OfflineBanner';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useNavigationStore } from '@/shared/stores/navigationStore';
import { CommandPalette } from '@/core/components/navigation/CommandPalette';
import { SearchIndexMount } from '@/core/components/search/SearchIndexMount';
import { GlobalTaskButton } from '@/modules/intelligence-layer/components/GlobalTaskButton';
import { AIAssistantFAB } from '@/modules/intelligence-layer/components/assistant/AIAssistantFAB';
import {
  getAllCommandItems,
  FINISHES_NAVIGATION,
  ADVISORY_NAVIGATION,
  CORPORATE_NAVIGATION,
  GLOBAL_NAVIGATION,
  ADMIN_NAVIGATION,
  filterNavigationByAccess,
  type NavItem,
} from '@/config/navigation.unified';
import { useUserModules } from '@/hooks/useUserModules';
import { AIIntelligenceMenu } from '@/modules/intelligence-layer/components/AIIntelligenceMenu';
import { cn } from '@/shared/lib/utils';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useBranding } from '@/shared/hooks/useBranding';
// WhatsApp + GChat modules removed in Phase 1.C — stub subscriptions.
// TODO Phase 4: rebuild client comms (WhatsApp/Slack) for marketing-agency context.
const subscribeToUnreadCount = (_setter: (n: number) => void): (() => void) => () => {};
const subscribeToGChatUnreadCount = (_setter: (n: number) => void): (() => void) => () => {};
import { GroupNavPills } from '@/core/components/layout/GroupNavPills';
import { SubsidiaryPicker } from '@/core/components/layout/SubsidiaryPicker';
import { PreferencesMenu } from '@/core/components/layout/PreferencesMenu';
import { useGlobalShortcuts } from '@/shared/hooks/useGlobalShortcuts';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const { allAccessibleModuleIds, isAdmin: isModuleAdmin, isSuperUser } = useUserModules();
  const { sidebarOpen, toggleSidebar, sidebarAutoClose, sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { currentSubsidiary, subsidiaries, setCurrentSubsidiary } = useSubsidiary();
  const { 
    favoriteItems, 
    recentItems, 
    addFavorite, 
    removeFavorite,
    addRecentItem,
    expandedSections,
    toggleSection: _toggleSection,
    setExpandedSections,
  } = useNavigationStore();

  // Branding (logo + favicon)
  const { branding } = useBranding(currentSubsidiary?.id || 'zeus-group');

  // Update browser favicon whenever branding changes
  useEffect(() => {
    const faviconSrc = branding.faviconUrl || branding.logoUrl;
    if (!faviconSrc) return;

    // Use the id-based link from index.html for maximum reliability
    const el = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (el) {
      el.removeAttribute('type');
      el.href = faviconSrc;
    } else {
      // Fallback: create a new link if the id-based one isn't found
      const link = document.createElement('link');
      link.id = 'app-favicon';
      link.rel = 'icon';
      link.href = faviconSrc;
      document.head.appendChild(link);
    }

    // Update apple-touch-icon links too
    document.querySelectorAll<HTMLLinkElement>("link[rel='apple-touch-icon']").forEach((icon) => {
      icon.href = faviconSrc;
    });
  }, [branding.faviconUrl, branding.logoUrl]);

  // Messaging (WhatsApp + Google Chat combined)
  const whatsappEnabled = useFeatureFlag('WHATSAPP_ENABLED');
  const [waUnread, setWaUnread] = useState(0);
  const [gchatUnread, setGchatUnread] = useState(0);
  const totalMessagingUnread = waUnread + gchatUnread;

  React.useEffect(() => {
    if (!whatsappEnabled) return;
    const unsubs = [
      subscribeToUnreadCount(setWaUnread),
      subscribeToGChatUnreadCount(setGchatUnread),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [whatsappEnabled]);

  // Track desktop breakpoint for sidebar rail behavior
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Scroll detection for header shadow
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 5);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Get navigation items based on current subsidiary, filtered by module access
  const isAdvisory = currentSubsidiary?.id === 'zeus-digital';
  const isPrivileged = isModuleAdmin || isSuperUser;

  const mainNavItems = useMemo(() => {
    const items = isAdvisory ? ADVISORY_NAVIGATION : FINISHES_NAVIGATION;
    return filterNavigationByAccess(items, allAccessibleModuleIds, isPrivileged);
  }, [isAdvisory, allAccessibleModuleIds, isPrivileged]);

  // Corporate modules filtered by access
  const corporateNavItems = useMemo(() => {
    return filterNavigationByAccess(CORPORATE_NAVIGATION, allAccessibleModuleIds, isPrivileged);
  }, [allAccessibleModuleIds, isPrivileged]);

  const globalNavItems = useMemo(() => {
    return filterNavigationByAccess(GLOBAL_NAVIGATION, allAccessibleModuleIds, isPrivileged);
  }, [allAccessibleModuleIds, isPrivileged]);

  // Desktop: collapsed rail by default, toggle to expand. Mobile: always expanded (full drawer).
  const sidebarExpanded = isDesktop ? !sidebarCollapsed : true;
  
  // Filter admin navigation based on user roles
  const adminNavItems = useMemo(() => {
    // Fallback admin emails for immediate access
    const adminEmails = ['onzimai@zeusgroup.co.ug'];
    const isAdminEmail = user?.email && adminEmails.includes(user.email);
    
    // Check if user has admin or super_admin global role from DawinUser profile
    let hasAdminRole = false;
    if (dawinUser) {
      hasAdminRole = ['admin', 'owner', 'super_admin'].includes(dawinUser.globalRole);
    }
    
    // Allow access if user has admin role OR is admin email
    if (!hasAdminRole && !isAdminEmail) return [];
    
    return ADMIN_NAVIGATION.filter(item => 
      !item.roles || item.roles.some(role => 
        role === 'admin' || role === 'super_admin' || role === dawinUser?.globalRole
      )
    );
  }, [dawinUser, user?.email]);

  // Command palette items
  const commandItems = useMemo(() => getAllCommandItems(), []);

  // Global G+letter shortcuts (Strategy/HR/Finance/Capital/Compliance/Market Intel)
  useGlobalShortcuts();

  // Get subsidiary display name and color
  const subsidiaryName = currentSubsidiary?.name || 'Zeus Group';
  const subsidiaryColor = currentSubsidiary?.color || '#872E5C';

  // Auto-expand navigation groups based on active route
  useEffect(() => {
    const allItems = [...mainNavItems, ...corporateNavItems, ...globalNavItems, ...adminNavItems];
    const activeParents = allItems.filter(item => 
      item.children?.some((child: NavItem) => 
        location.pathname === child.href || 
        (child.href !== '/' && location.pathname.startsWith(child.href))
      )
    );
    
    if (activeParents.length > 0) {
      const newIds = activeParents.map(p => p.id).filter(id => !expandedSections.includes(id));
      if (newIds.length > 0) {
        setExpandedSections([...expandedSections, ...newIds]);
      }
    }
  }, [location.pathname]);

  // Track recent navigation
  useEffect(() => {
    const currentItem = commandItems.find(item => 
      location.pathname === item.path || location.pathname.startsWith(item.path + '/')
    );
    if (currentItem) {
      addRecentItem(currentItem.id);
    }
  }, [location.pathname]);

  const isActive = (href: string) => {
    if (href === '/' || href === '/dashboard') return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href);
  };

  const getIcon = (iconName: string): LucideIcon | null => {
    return getIconByName(iconName);
  };

  const handleSubsidiarySwitch = (sub: typeof subsidiaries[0]) => {
    setCurrentSubsidiary(sub);
    // Use React Router navigation instead of full page reload
    const targetPath = sub.id === 'zeus-digital' ? '/advisory' : '/';
    navigate(targetPath);
  };

  // Popover flyout for collapsed sidebar icons
  const NavItemPopover = ({ item, children: trigger }: { item: NavItem; children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false);
    const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleEnter = () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setOpen(true);
    };
    const handleLeave = () => {
      closeTimer.current = setTimeout(() => setOpen(false), 150);
    };

    const hasChildren = item.children && item.children.length > 0;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            {trigger}
          </div>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-52 p-2 z-[70]"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Link
            to={item.href}
            onClick={() => setOpen(false)}
            className="block px-2 py-1.5 text-sm font-semibold hover:bg-muted rounded-md"
          >
            {item.label}
          </Link>
          {hasChildren && (
            <>
              <div className="h-px bg-border my-1" />
              <div className="space-y-0.5">
                {item.children!.map((child: NavItem) => {
                  const ChildIcon = getIcon(child.icon);
                  const childActive = isActive(child.href);
                  return (
                    <Link
                      key={child.id}
                      to={child.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                        childActive
                          ? 'bg-muted font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {ChildIcon && <ChildIcon className="h-3.5 w-3.5" />}
                      <span>{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);
    const isFavorite = favoriteItems.includes(item.id);
    const IconComponent = getIcon(item.icon);
    // Check if any child is active (for parent highlight in collapsed mode)
    const hasActiveChild = item.children?.some((child: NavItem) => isActive(child.href));
    const isHighlighted = active || hasActiveChild;

    // Collapsed rail mode (desktop only): show icon-only with popover flyout
    if (!sidebarExpanded) {
      return (
        <div key={item.id}>
          <NavItemPopover item={item}>
            <Link
              to={item.href}
              className={cn(
                'flex items-center justify-center w-full h-9 rounded-md transition-colors',
                isHighlighted
                  ? 'bg-[var(--bg-sidebar-active)] text-[var(--fg-on-dark)]'
                  : 'text-[var(--fg-on-dark-muted)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--fg-on-dark)]'
              )}
              onClick={() => {
                if (sidebarAutoClose && window.innerWidth < 1024) {
                  setTimeout(() => toggleSidebar(), 100);
                }
              }}
            >
              {IconComponent && <IconComponent className="h-4 w-4" />}
            </Link>
          </NavItemPopover>
        </div>
      );
    }

    return (
      <div key={item.id}>
        <div
          className={cn(
            'group flex items-center gap-3 px-2.5 h-8 rounded-md text-[13px] transition-colors cursor-pointer select-none',
            isHighlighted
              ? 'bg-[var(--bg-sidebar-active)] text-[var(--fg-on-dark)] font-medium'
              : 'text-[var(--fg-on-dark)] hover:bg-[var(--bg-sidebar-hover)]'
          )}
        >
          <Link
            to={item.href}
            className="flex items-center gap-3 flex-1 min-w-0"
            onClick={() => {
              if (sidebarAutoClose && window.innerWidth < 1024) {
                setTimeout(() => toggleSidebar(), 100);
              }
            }}
          >
            {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <span className="ml-auto text-[10px] bg-[var(--bg-sidebar-hover)] text-[var(--fg-on-dark)] px-1.5 py-0.5 rounded">
                {item.badge}
              </span>
            )}
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              isFavorite ? removeFavorite(item.id) : addFavorite(item.id);
            }}
            className={cn(
              'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0',
              isFavorite
                ? 'text-[var(--rag-amber)] opacity-100'
                : 'text-[var(--fg-on-dark-muted)] hover:text-[var(--rag-amber)]'
            )}
          >
            <Star className={cn('h-3 w-3', isFavorite && 'fill-current')} />
          </button>
        </div>
      </div>
    );
  };

  // Render corporate nav item for header dropdown
  const renderCorporateMenuItem = (item: NavItem) => {
    const IconComponent = getIcon(item.icon);
    return (
      <DropdownMenuItem
        key={item.id}
        onClick={() => navigate(item.href)}
        className="gap-2 cursor-pointer"
      >
        {IconComponent && <IconComponent className="h-4 w-4" />}
        <div className="flex-1">
          <div className="font-medium">{item.label}</div>
          {item.description && (
            <div className="text-xs text-muted-foreground">{item.description}</div>
          )}
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Boot the global-search index (no-op when feature flag is off). */}
      <SearchIndexMount />
      <OfflineBanner />
      
      {/* Desktop Header - Group nav pills + cluster (Phase 2) */}
      <header
        className={cn(
          'hidden lg:flex sticky top-0 z-40 h-14 items-center gap-3 px-6 transition-shadow duration-200',
          'border-b border-[var(--border-default)] bg-[var(--bg-surface)]',
          isScrolled && 'shadow-[var(--shadow-sm)]'
        )}
      >
        <div className="flex items-center gap-2 shrink-0">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="h-7 w-auto object-contain" />
          ) : (
            <Building2 className="h-4 w-4 text-[var(--fg-tertiary)]" />
          )}
        </div>

        <GroupNavPills items={corporateNavItems} />

        <div className="flex-1" />

        {/* Command Palette in header */}
        <CommandPalette
          items={commandItems}
          recentItems={recentItems}
          favoriteItems={favoriteItems}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
          organizationId={(user as { organizationId?: string } | null)?.organizationId || 'default'}
          subsidiaryId={currentSubsidiary?.id}
        />

        {/* AI Intelligence Menu */}
        <AIIntelligenceMenu />

        {/* Global Task Button (My Tasks quick-access) */}
        <GlobalTaskButton />

        {/* Messaging (WhatsApp + Google Chat) */}
        {whatsappEnabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/whatsapp')}
            className="relative h-8 w-8"
          >
            <MessageSquare className="h-4 w-4" />
            {totalMessagingUnread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-600 text-[10px] font-medium text-white flex items-center justify-center">
                {totalMessagingUnread > 9 ? '9+' : totalMessagingUnread}
              </span>
            )}
          </Button>
        )}

        {/* Subsidiary Switcher (now a compact pill before the avatar) */}
        <SubsidiaryPicker />

        {/* User Menu — now circular avatar w/ Preferences submenu */}
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
                {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-1.5">
              <div className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                {user?.displayName || 'User'}
              </div>
              <div className="text-[11px] text-[var(--fg-tertiary)] truncate">
                {user?.email}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="mr-2 h-3.5 w-3.5" /> Profile
              </Link>
            </DropdownMenuItem>
            {adminNavItems.length > 0 && (
              <DropdownMenuItem asChild>
                <Link to="/admin">
                  <Settings className="mr-2 h-3.5 w-3.5" /> Admin
                </Link>
              </DropdownMenuItem>
            )}
            <PreferencesMenu />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile Header */}
      <header className={cn(
        "lg:hidden sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 transition-shadow duration-200",
        isScrolled && "shadow-sm"
      )}>
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <CommandPalette
            items={commandItems}
            recentItems={recentItems}
            favoriteItems={favoriteItems}
            onAddFavorite={addFavorite}
            onRemoveFavorite={removeFavorite}
            organizationId={(user as { organizationId?: string } | null)?.organizationId || 'default'}
            subsidiaryId={currentSubsidiary?.id}
            onSelect={() => {
              // Auto-close sidebar when selecting from command palette on mobile
              if (sidebarAutoClose && window.innerWidth < 1024) {
                setTimeout(() => toggleSidebar(), 100);
              }
            }}
          />
        </div>
        {/* AI Intelligence + Tasks - Mobile */}
        <AIIntelligenceMenu />
        <GlobalTaskButton />

        {/* Messaging - Mobile */}
        {whatsappEnabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/whatsapp')}
            className="relative"
          >
            <MessageSquare className="h-5 w-5" />
            {totalMessagingUnread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-600 text-[10px] font-medium text-white flex items-center justify-center">
                {totalMessagingUnread > 9 ? '9+' : totalMessagingUnread}
              </span>
            )}
          </Button>
        )}
        {/* Zeus Group dropdown for mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Zeus Group Services
            </div>
            {corporateNavItems.map(renderCorporateMenuItem)}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/profile">Profile</Link>
            </DropdownMenuItem>
            {/* Admin Dashboard - Only show if user has admin role */}
            {adminNavItems.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Subsidiary Switcher - Mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <div
                className="h-6 w-6 rounded flex items-center justify-center"
                style={{ backgroundColor: subsidiaryColor }}
              >
                <span className="text-white text-xs font-bold">{subsidiaryName.charAt(0)}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" style={{ zIndex: 70 }}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Switch Subsidiary
            </div>
            {subsidiaries.filter(s => s.status === 'active').map((sub) => (
              <DropdownMenuItem
                key={sub.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubsidiarySwitch(sub);
                }}
                className="gap-2 cursor-pointer"
              >
                <div
                  className="h-6 w-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: sub.color }}
                >
                  <span className="text-white text-xs font-bold">{sub.shortName.charAt(0)}</span>
                </div>
                <span className="flex-1">{sub.name}</span>
                {currentSubsidiary?.id === sub.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {subsidiaries.filter(s => s.status === 'coming-soon').map((sub) => (
              <DropdownMenuItem
                key={sub.id}
                disabled
                className="gap-2 opacity-50"
              >
                <div className="h-6 w-6 rounded flex items-center justify-center bg-muted">
                  <span className="text-muted-foreground text-xs font-bold">{sub.shortName.charAt(0)}</span>
                </div>
                <span className="flex-1">{sub.name}</span>
                <span className="text-xs text-muted-foreground">Soon</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — dark-themed per portal redesign */}
        <aside
          className={cn(
            'fixed left-0 z-[60] border-r',
            'top-14 bottom-0', // Mobile: below header
            'lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0',
            // Mobile: slide in/out
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'transition-all duration-300 ease-in-out',
            // Desktop: collapsed rail (w-16) or expanded (w-60)
            sidebarExpanded ? 'w-60' : 'lg:w-16 w-60',
            'flex flex-col'
          )}
          style={{
            backgroundColor: 'var(--bg-sidebar)',
            color: 'var(--fg-on-dark)',
            borderRightColor: 'var(--border-on-dark)',
          }}
        >
          {/* Toggle button - desktop only */}
          <div className={cn(
            'hidden lg:flex items-center border-b border-[var(--border-on-dark)] px-2 py-2',
            sidebarExpanded ? 'justify-end' : 'justify-center'
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebarCollapsed}
              className="h-7 w-7 text-[var(--fg-on-dark-muted)] hover:text-[var(--fg-on-dark)] hover:bg-[var(--bg-sidebar-hover)]"
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarExpanded ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className={cn('p-3 space-y-5', !sidebarExpanded && 'lg:px-2')}>
              {/* Dashboard Link */}
              <div className="space-y-1">
                {renderNavItem({
                  id: 'dashboard',
                  label: 'Dashboard',
                  href: '/',
                  icon: 'LayoutDashboard',
                  description: 'Main dashboard overview',
                  keywords: ['home', 'dashboard', 'overview'],
                })}
              </div>

              {/* Main Navigation - Subsidiary specific */}
              <div className="space-y-1">
                {mainNavItems.map(item => renderNavItem(item))}
              </div>

              {/* Workspace (Customers, Suppliers, Messaging) */}
              {globalNavItems.length > 0 && (
                <div className="space-y-1">
                  {sidebarExpanded && (
                    <p className="px-2 text-[10px] font-medium text-[var(--fg-on-dark-muted)] uppercase tracking-[0.1em] mb-1.5">
                      Workspace
                    </p>
                  )}
                  {globalNavItems.map((item: NavItem) => renderNavItem(item))}
                </div>
              )}

              {/* Admin */}
              {adminNavItems.length > 0 && (
                <div>
                  {sidebarExpanded && (
                    <p className="px-2 text-[10px] font-medium text-[var(--fg-on-dark-muted)] uppercase tracking-[0.1em] mb-1.5">
                      Admin
                    </p>
                  )}
                  <div className="space-y-1">
                    {adminNavItems.map((item: NavItem) => renderNavItem(item))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 top-14 z-[55] bg-black/50 lg:hidden transition-opacity duration-300"
            onClick={toggleSidebar}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-0 min-w-0">
          {children}
        </main>
      </div>

      {/* Global AI Assistant FAB */}
      <AIAssistantFAB
        context={{
          currentModule: location.pathname.split('/')[1] || 'general',
        }}
      />
    </div>
  );
}
