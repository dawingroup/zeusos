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
  ChevronRight,
  ChevronDown,
  Palette,
  Plus,
  Briefcase,
  Tag,
  FileText,
  Star as StarIcon,
  ShoppingCart,
  Megaphone,
  Target,
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
import { ActionCenter } from '@/modules/intelligence-layer/components/ActionCenter';
import {
  getAllCommandItems,
  AGENCY_NAVIGATION,
  COMMERCIAL_NAVIGATION,
  CORPORATE_NAVIGATION,
  UTILITY_NAVIGATION,
  ADMIN_NAVIGATION,
  filterNavigationByAccess,
  type NavItem,
} from '@/config/navigation.unified';
import { adaptManifestToLegacyNavItem, resolveNav, type NavStatus } from '@/core/navigation/manifest';
import { isConflictIsolated } from '@/core/settings/brand-capabilities';
import { isParentOrgPrincipal as resolveIsParentOrgPrincipal } from '@/core/settings/org-kind';
import type { SubsidiaryId } from '@/core/settings/types';
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
import { PreferencesMenu } from '@/core/components/layout/PreferencesMenu';
import { useGlobalShortcuts } from '@/shared/hooks/useGlobalShortcuts';

// Flat legacy-NavItem lookup used by the manifest adapter so we keep
// child dropdowns (Talent → Roster/Invoices, Billing → Client/Inter-
// Co/GL, …) intact when the manifest item maps to an existing legacy
// entry. Built once at module load — `AGENCY_NAVIGATION`,
// `COMMERCIAL_NAVIGATION`, and `ADMIN_NAVIGATION` are static.
const LEGACY_LOOKUP: Map<string, NavItem> = (() => {
  const map = new Map<string, NavItem>();
  const collect = (item: NavItem) => {
    map.set(item.id, item);
    item.children?.forEach(collect);
  };
  [...AGENCY_NAVIGATION, ...COMMERCIAL_NAVIGATION, ...ADMIN_NAVIGATION].forEach(collect);
  return map;
})();

// UI refresh — sidebar section grouping. The manifest is a flat ordered
// list (no `section` field), so we derive a section per moduleId here and
// render eyebrow-labelled groups. Unmapped ids fall into 'work' (subsidiary)
// so new manifest entries still appear. Order matches SECTION_ORDER.
const SECTION_FOR_MODULE: Record<string, string> = {
  // parent + shared
  dashboard: 'main',
  'account-management': 'commercial',
  clients: 'commercial', // adapter maps account-management → legacy id "clients"
  traffic: 'commercial',
  pricing: 'commercial',
  billing: 'commercial',
  commercial: 'commercial',
  'conflict-firewall': 'commercial',
  procurement: 'ops',
  suppliers: 'ops',
  crm: 'ops',
  talent: 'ops',
  'asset-library': 'ops',
  finance: 'ops',
  'hr-central': 'ops',
  strategy: 'ops',
  'market-intel': 'ops',
  'ai-assistant': 'ops',
  intelligence: 'ops',
  comms: 'ops',
  reports: 'admin',
  compliance: 'admin',
  'my-time': 'admin',
  'team-time': 'admin',
  admin: 'admin',
  'api-keys': 'admin',
  // subsidiary head/middle/tail
  'delivery-inbox': 'main',
  'ecd-review': 'main',
  campaigns: 'work',
  production: 'work',
  media: 'work',
  'burn-sla': 'admin',
  hr: 'admin',
};
const SECTION_LABELS: Record<string, string> = {
  main: 'Today',
  commercial: 'Commercial',
  work: 'Delivery',
  ops: 'Operations',
  admin: 'System',
};
const SECTION_ORDER = ['main', 'commercial', 'work', 'ops', 'admin'];

// Global quick-add menu (header "+" button). Each entry deep-links to a real
// create route. `parentOnly` items (commercial creates) are filtered out for
// subsidiary principals, matching the route guards.
interface QuickAddItem {
  label: string;
  href: string;
  icon: LucideIcon;
  parentOnly?: boolean;
}
const QUICK_ADD_ITEMS: QuickAddItem[] = [
  { label: 'New client',        href: '/clients/new',                         icon: Briefcase,    parentOnly: true },
  { label: 'New quote',         href: '/pricing/quotes/new',                  icon: Tag,          parentOnly: true },
  { label: 'New lead',          href: '/crm/new',                             icon: Target },
  { label: 'New talent',        href: '/talent/new',                          icon: StarIcon },
  { label: 'New media plan',    href: '/media/new',                           icon: Megaphone },
  { label: 'New supplier',      href: '/suppliers/new',                       icon: ShoppingCart },
  { label: 'New purchase order', href: '/procurement/purchase-orders/new',    icon: FileText,     parentOnly: true },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const { allAccessibleModuleIds, isAdmin: isModuleAdmin, isSuperUser } = useUserModules();
  const { sidebarOpen, toggleSidebar, sidebarAutoClose, sidebarCollapsed, toggleSidebarCollapsed, direction, navScope, setNavScope } = useUIStore();
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

  // UI refresh — mirror the active sub-brand onto <html data-brand> so the
  // [data-brand] CSS blocks light up --brand-accent across the shell (sidebar
  // accent bar, active-item marker) and ported surfaces. Canonical SubsidiaryId
  // values match the [data-brand] keys 1:1.
  useEffect(() => {
    const brandId = currentSubsidiary?.id || 'zeus-group';
    document.documentElement.setAttribute('data-brand', brandId);
  }, [currentSubsidiary?.id]);

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

  // Phase 6.UI.0 — sidebar is now sourced from the navigation manifest
  // (`src/core/navigation/manifest.ts`). The manifest resolves
  // (orgKind, subsidiaryId) → ordered NavItem list per the brief, so
  // each subsidiary sees a sidebar tuned to its workflow without the
  // AppShell having to know the per-brand ordering.
  const isPrivileged = isModuleAdmin || isSuperUser;

  // Parent-org admin/owner principal — mirrors ParentOrgGuard. The
  // manifest splits "PARENT" vs "SUBSIDIARY" off this signal: when the
  // user is a parent-org principal AND has the `zeus-group` org
  // selected, we render the PARENT manifest (Account Mgmt, Traffic,
  // Pricing, Billing, Conflict Firewall, …). Otherwise we render the
  // SUBSIDIARY manifest for the selected sub-brand.
  // Shared resolver (super-user email OR homeOrgId==='zeus-group' OR
  // admin/owner with zeus-group access) so the sidebar matches the route
  // guards. Previously this only checked the last branch, so a Zeus Group
  // owner whose subsidiaryAccess listed only a sub-brand — or a super-user
  // email — got an empty sidebar + subsidiary dashboard.
  const isParentOrgPrincipal = useMemo(
    () => resolveIsParentOrgPrincipal(user?.email, dawinUser),
    [user?.email, dawinUser],
  );

  const mainNavItems = useMemo(() => {
    const subId = (currentSubsidiary?.id ?? 'zeus-group') as SubsidiaryId;

    // ADR-2026-05-25 §3.2 step 5 — three org-kind branches:
    //  • PARENT          parent-org admin on `zeus-group`
    //  • SUBSIDIARY_SELLING  parent-org admin viewing a sub-brand, OR
    //                       a brand-direct AD on their own brand
    //                       (their homeOrgId == subId AND they have a
    //                       sales-bearing globalRole). Sidebar adds
    //                       brand-scoped commercial entries.
    //  • SUBSIDIARY     plain delivery user on a sub-brand (delivery-only sidebar)
    let orgKind: 'PARENT' | 'SUBSIDIARY' | 'SUBSIDIARY_SELLING';
    if (isParentOrgPrincipal && subId === 'zeus-group') {
      orgKind = 'PARENT';
    } else if (subId !== 'zeus-group') {
      const userHome = (dawinUser as { homeOrgId?: string } | null)?.homeOrgId;
      const isBrandSeller =
        !!dawinUser &&
        ['admin', 'owner', 'manager'].includes(dawinUser.globalRole) &&
        (userHome === subId || isParentOrgPrincipal);
      orgKind = isBrandSeller ? 'SUBSIDIARY_SELLING' : 'SUBSIDIARY';
    } else {
      orgKind = 'SUBSIDIARY';
    }

    const resolved = resolveNav(orgKind, subId);
    const adapted = resolved.map((item) => adaptManifestToLegacyNavItem(item, LEGACY_LOOKUP));

    // Filter manifest items the user can't access via the module-level
    // gate. Privileged accounts (super-user, module admin) bypass.
    const filtered = filterNavigationByAccess(adapted, allAccessibleModuleIds, isPrivileged);

    // Admin gating — only show the Admin item if the user has an
    // admin-tier global role or is on the seed admin email list.
    const adminEmails = ['onzimai@zeusgroup.co.ug'];
    const isAdminEmail = !!user?.email && adminEmails.includes(user.email);
    const hasAdminRole = !!dawinUser && ['admin', 'owner', 'super_admin'].includes(dawinUser.globalRole);
    if (hasAdminRole || isAdminEmail || isPrivileged) return filtered;
    return filtered.filter((item) => item.id !== 'admin' && item.id !== 'api-keys');
  }, [
    allAccessibleModuleIds,
    isPrivileged,
    isParentOrgPrincipal,
    currentSubsidiary?.id,
    user?.email,
    dawinUser,
  ]);

  // UI Refresh v3 — roadmap nav scope. 'deployed' hides `planned` items;
  // 'roadmap' (default) keeps them (rendered dimmed in renderNavItem). The
  // status field rides through the manifest adapter onto each NavItem.
  const scopedNavItems = useMemo(() => {
    if (navScope === 'roadmap') return mainNavItems;
    return mainNavItems.filter(
      (it) => ((it as { status?: NavStatus }).status ?? 'live') === 'live',
    );
  }, [mainNavItems, navScope]);
  const hasPlanned = useMemo(
    () => mainNavItems.some((it) => (it as { status?: NavStatus }).status === 'planned'),
    [mainNavItems],
  );

  // Corporate modules filtered by access (header pills)
  const corporateNavItems = useMemo(() => {
    return filterNavigationByAccess(CORPORATE_NAVIGATION, allAccessibleModuleIds, isPrivileged);
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
    const allItems = [
      ...mainNavItems,
      ...corporateNavItems,
      ...adminNavItems,
    ];
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

  // UI refresh — shell-level breadcrumb + org-chip framing.
  const isParentRoot =
    isParentOrgPrincipal && (currentSubsidiary?.id ?? 'zeus-group') === 'zeus-group';
  const breadcrumbRoot = isParentRoot ? 'Zeus Group' : subsidiaryName;
  const activeNavLabel = [...mainNavItems, ...corporateNavItems]
    .filter((it) => isActive(it.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label;
  const userInitials =
    user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';
  const userRoleLabel = isParentRoot
    ? 'Parent-org admin'
    : dawinUser?.globalRole
      ? dawinUser.globalRole.charAt(0).toUpperCase() + dawinUser.globalRole.slice(1)
      : 'Team member';

  const getIcon = (iconName: string): LucideIcon | null => {
    return getIconByName(iconName);
  };

  const handleSubsidiarySwitch = (sub: typeof subsidiaries[0]) => {
    setCurrentSubsidiary(sub);
    // Use React Router navigation instead of full page reload
    navigate('/');
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
    // UI Refresh v3 — roadmap status. `planned` items render dimmed with a
    // hollow-dot marker (only reachable when navScope === 'roadmap').
    const planned = (item as { status?: NavStatus }).status === 'planned';

    // Collapsed rail mode (desktop only): show icon-only with popover flyout
    if (!sidebarExpanded) {
      return (
        <div key={item.id} style={planned ? { opacity: 0.8 } : undefined}>
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
      <div key={item.id} style={planned ? { opacity: 0.8 } : undefined}>
        <div
          className={cn(
            'group relative flex items-center gap-3 px-2.5 h-8 rounded-md text-[13px] transition-colors cursor-pointer select-none',
            isHighlighted
              ? 'bg-[var(--bg-sidebar-active)] text-[var(--fg-on-dark)] font-medium'
              : 'text-[var(--fg-on-dark)] hover:bg-[var(--bg-sidebar-hover)]'
          )}
        >
          {isHighlighted && direction === 'ambitious' && (
            <span
              className="absolute left-0 rounded-full"
              style={{ top: 6, bottom: 6, width: 3, background: 'var(--brand-accent)' }}
            />
          )}
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
            {planned && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full border border-[var(--fg-on-dark-muted)] flex-none"
                title="Planned — not yet deployed"
                aria-label="Planned"
              />
            )}
            {item.badge && (
              <span className={cn('text-[10px] bg-[var(--bg-sidebar-hover)] text-[var(--fg-on-dark)] px-1.5 py-0.5 rounded', !planned && 'ml-auto')}>
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

      {/* Desktop Header — UI Refresh v3 two-row layout (handoff README
          §"Top bar, two rows"). Row 1: breadcrumb + search + icon cluster.
          Row 2: corporate service pills. On lg+, left-padded to start at the
          sidebar's right edge (sidebar: w-16 collapsed, w-60 expanded). */}
      <header
        className={cn(
          'hidden lg:flex sticky top-0 z-40 flex-col transition-shadow duration-200',
          'border-b border-[var(--border-default)] bg-[var(--bg-surface)]',
          sidebarExpanded ? 'lg:pl-[16.5rem]' : 'lg:pl-[5.5rem]',
          isScrolled && 'shadow-[var(--shadow-sm)]'
        )}
      >
        {/* Row 1 — breadcrumb · search · actions */}
        <div className="flex h-14 items-center gap-3 pr-6">
          {/* UI refresh — shell breadcrumb (root › active surface) */}
          <div className="flex items-center gap-1.5 text-[13px] shrink-0 min-w-0 max-w-[280px]">
            <span className="text-[var(--fg-tertiary)] truncate">{breadcrumbRoot}</span>
            {activeNavLabel && (
              <>
                <ChevronRight className="h-3 w-3 text-[var(--fg-quaternary)] flex-none" />
                <span className="font-semibold text-[var(--fg-primary)] truncate">{activeNavLabel}</span>
              </>
            )}
          </div>

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

          {/* (Tasks quick-access removed from the desktop header — the
              floating Action Center now surfaces "needs a person now" work.
              Mobile keeps its GlobalTaskButton since the Action Center is
              desktop-only.) */}

          {/* Messaging — internal team chat (/comms). Always available; WhatsApp
              folds into the same surface once enabled. (/whatsapp is not routed.) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/comms')}
            className="relative h-8 w-8"
            aria-label="Messages"
          >
            <MessageSquare className="h-4 w-4" />
            {totalMessagingUnread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--rag-green)] text-[10px] font-medium text-white flex items-center justify-center">
                {totalMessagingUnread > 9 ? '9+' : totalMessagingUnread}
              </span>
            )}
          </Button>

          {/* Global quick-add (+) — dropdown of "create" deep-links. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Quick add"
                data-testid="global-quick-add"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                Quick add
              </div>
              <DropdownMenuSeparator />
              {QUICK_ADD_ITEMS.filter((it) => !it.parentOnly || isParentRoot).map((it) => {
                const ItemIcon = it.icon;
                return (
                  <DropdownMenuItem key={it.href} asChild>
                    <Link to={it.href}>
                      <ItemIcon className="mr-2 h-3.5 w-3.5" /> {it.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User avatar — rightmost. Account menu (Profile / Appearance /
              Admin / Preferences / Sign out); mirrors the sidebar footer card. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 ml-0.5"
                aria-label="Account menu"
                data-testid="header-account-menu"
              >
                <span
                  className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #e63946, #b8222e)' }}
                >
                  {userInitials}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                  {user?.displayName || 'User'}
                </div>
                <div className="text-[11px] text-[var(--fg-tertiary)] truncate">{user?.email}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <User className="mr-2 h-3.5 w-3.5" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings/appearance">
                  <Palette className="mr-2 h-3.5 w-3.5" /> Appearance
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
                data-testid="header-logout-button"
                className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2 — corporate service pills: "CORPORATE" label · module pills ·
            divider · AI Intelligence · (parent only) right-aligned Admin.
            Org switcher + account menu live in the sidebar (chip + footer). */}
        <div className="flex items-center gap-1 pr-6 pb-2 overflow-x-auto">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg-quaternary)] mr-1.5 flex-none">
            Corporate
          </span>
          <GroupNavPills items={corporateNavItems} />
          <span className="self-stretch w-px bg-[var(--border-subtle)] mx-1.5 my-1" />
          <GroupNavPills items={UTILITY_NAVIGATION} />
          {isParentRoot && adminNavItems.length > 0 && (
            <div className="ml-auto flex-none">
              <GroupNavPills items={ADMIN_NAVIGATION} />
            </div>
          )}
        </div>
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

        {/* Messaging - Mobile — internal team chat (/comms), always available. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/comms')}
          className="relative"
          aria-label="Messages"
        >
          <MessageSquare className="h-5 w-5" />
          {totalMessagingUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--rag-green)] text-[10px] font-medium text-white flex items-center justify-center">
              {totalMessagingUnread > 9 ? '9+' : totalMessagingUnread}
            </span>
          )}
        </Button>
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
            <DropdownMenuItem onClick={() => signOut()} data-testid="logout-button">
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
                <span className="text-xs font-bold" style={{ color: currentSubsidiary?.ink ?? '#fff' }}>{subsidiaryName.charAt(0)}</span>
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
                  <span className="text-xs font-bold" style={{ color: sub.ink }}>{sub.shortName.charAt(0)}</span>
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
        {/* Sidebar — dark-themed per portal redesign. Full-height on
            desktop (lg:top-0 + lg:h-screen), slides in below mobile
            header on small screens. z-[60] sits above the desktop
            header (z-40) so the sidebar visually covers the header's
            left gutter; the header has lg:pl-[16.5rem]/[5.5rem] so its
            content starts to the right of the sidebar regardless. */}
        <aside
          className={cn(
            'fixed left-0 z-[60] border-r',
            'top-14 bottom-0', // Mobile: below header
            'lg:fixed lg:top-0 lg:h-screen lg:bottom-auto lg:translate-x-0',
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
          {/* UI refresh — wordmark + sub-brand accent bar */}
          <div className={cn(
            'flex items-center gap-2 pt-4 pb-1',
            sidebarExpanded ? 'px-5' : 'lg:px-0 lg:justify-center px-5'
          )}>
            <span
              className="inline-flex items-center justify-center rounded-[5px] font-extrabold flex-none"
              style={{
                width: 22, height: 22, fontSize: 12, letterSpacing: '-0.01em',
                background: direction === 'ambitious' ? 'var(--brand-accent)' : 'var(--zeus-red)',
                color: direction === 'ambitious' ? 'var(--brand-accent-fg)' : '#fff',
              }}
            >Z</span>
            {sidebarExpanded && (
              <span className="font-bold text-[14.5px] tracking-[-0.01em] text-[var(--fg-on-dark)]">ZeusOS</span>
            )}
          </div>
          {direction === 'ambitious' && sidebarExpanded && (
            <div
              className="rounded-full"
              style={{ height: 3, margin: '8px 20px 0', background: 'var(--brand-accent)', opacity: 0.85 }}
            />
          )}

          {/* UI refresh — org switcher chip (relocated from the header) */}
          <div className={cn('pt-2.5 pb-1', sidebarExpanded ? 'px-3.5' : 'lg:px-2 px-3.5')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center rounded-[10px] text-left border border-white/[0.06] transition-colors',
                    'bg-[var(--bg-sidebar-hover)] hover:bg-[var(--bg-sidebar-active)]',
                    sidebarExpanded ? 'w-full gap-2.5 px-2.5 py-2' : 'justify-center p-1.5'
                  )}
                  aria-label="Switch organisation"
                >
                  <span
                    className="inline-flex items-center justify-center rounded-lg font-bold flex-none"
                    style={{
                      width: 30, height: 30, fontSize: 11, letterSpacing: '0.04em',
                      background: 'var(--brand-accent)', color: 'var(--brand-accent-fg)',
                      boxShadow: direction === 'ambitious' ? '0 0 0 2px color-mix(in srgb, var(--brand-accent) 30%, transparent)' : 'none',
                    }}
                  >
                    {currentSubsidiary?.shortName ?? 'ZG'}
                  </span>
                  {sidebarExpanded && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-tight text-[var(--fg-on-dark)] truncate">
                          {subsidiaryName}
                        </span>
                        <span className="block text-[10.5px] uppercase tracking-[0.08em] text-[var(--fg-on-dark-muted)] mt-0.5">
                          {isParentRoot ? 'Parent · Zeus Group' : 'Subsidiary'}
                        </span>
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-[var(--fg-on-dark-muted)] flex-none" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" style={{ zIndex: 70 }}>
                <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                  Switch organisation
                </div>
                {subsidiaries.filter((s) => s.status === 'active').map((sub) => (
                  <DropdownMenuItem
                    key={sub.id}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSubsidiarySwitch(sub); }}
                    className="gap-2.5 cursor-pointer"
                  >
                    <span
                      className="rounded flex-none"
                      style={{
                        width: 18, height: 18, background: sub.color,
                        border: currentSubsidiary?.id === sub.id ? '2px solid var(--fg-primary)' : 'none',
                      }}
                    />
                    <span className="flex-1 truncate">{sub.name}</span>
                    {isConflictIsolated(sub.id as SubsidiaryId) && (
                      <span
                        className="text-[9.5px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(230,91,102,0.18)', color: '#cf4b54' }}
                      >
                        Isolated
                      </span>
                    )}
                    {currentSubsidiary?.id === sub.id && <Check className="h-3.5 w-3.5 flex-none" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
            <div className={cn('p-3', !sidebarExpanded && 'lg:px-2')}>
              {/* Phase 6.UI.0 — single resolved manifest. UI refresh groups
                  the resolved items into eyebrow-labelled sections (Today /
                  Commercial / Delivery / Operations / System) via
                  SECTION_FOR_MODULE when expanded; the collapsed rail keeps
                  a flat icon list. */}
              {sidebarExpanded
                ? SECTION_ORDER.map((section) => {
                    const items = scopedNavItems.filter(
                      (it: NavItem) => (SECTION_FOR_MODULE[it.id] || 'work') === section
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={section} className="mb-3">
                        <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-on-dark-muted)]">
                          {SECTION_LABELS[section] || section}
                        </div>
                        <div className="space-y-px">
                          {items.map((item: NavItem) => renderNavItem(item))}
                        </div>
                      </div>
                    );
                  })
                : <div className="space-y-1">{scopedNavItems.map((item: NavItem) => renderNavItem(item))}</div>}

              {/* UI Refresh v3 — roadmap legend + scope toggle. Only shown
                  (expanded) when the resolved nav actually carries a planned
                  item, so deployed-only orgs see no clutter. */}
              {sidebarExpanded && hasPlanned && (
                <div className="mt-3 px-3 pt-3 border-t border-[var(--border-on-dark)]">
                  <div className="flex items-center gap-3 text-[10px] text-[var(--fg-on-dark-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-on-dark)]" /> Live
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full border border-[var(--fg-on-dark-muted)]" /> Planned
                    </span>
                    <button
                      type="button"
                      onClick={() => setNavScope(navScope === 'roadmap' ? 'deployed' : 'roadmap')}
                      className="ml-auto text-[10px] text-[var(--fg-on-dark-muted)] hover:text-[var(--fg-on-dark)] transition-colors"
                      title={navScope === 'roadmap' ? 'Hide planned modules' : 'Show full roadmap'}
                    >
                      {navScope === 'roadmap' ? 'Deployed only' : 'Full roadmap'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* UI refresh — user footer card (relocated from the header) */}
          <div className={cn('mt-auto', sidebarExpanded ? 'm-2.5' : 'lg:mx-1.5 lg:my-2 m-2.5')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center rounded-[10px] text-left bg-white/[0.04] hover:bg-white/[0.07] transition-colors',
                    sidebarExpanded ? 'w-full gap-2.5 p-2.5' : 'justify-center p-1.5'
                  )}
                  aria-label="Account menu"
                >
                  <span
                    className="inline-flex items-center justify-center rounded-full text-[11px] font-semibold text-white flex-none"
                    style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #e63946, #b8222e)' }}
                  >
                    {userInitials}
                  </span>
                  {sidebarExpanded && (
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold leading-tight text-[var(--fg-on-dark)] truncate">
                        {user?.displayName || 'User'}
                      </span>
                      <span className="block text-[10.5px] text-[var(--fg-on-dark-muted)] mt-0.5 truncate">
                        {userRoleLabel}
                      </span>
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <div className="px-2 py-1.5">
                  <div className="text-[13px] font-medium text-[var(--fg-primary)] truncate">
                    {user?.displayName || 'User'}
                  </div>
                  <div className="text-[11px] text-[var(--fg-tertiary)] truncate">{user?.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-3.5 w-3.5" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings/appearance">
                    <Palette className="mr-2 h-3.5 w-3.5" /> Appearance
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
                  data-testid="logout-button"
                  className="text-[var(--rag-red)] focus:text-[var(--rag-red)]"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 top-14 z-[55] bg-black/50 lg:hidden transition-opacity duration-300"
            onClick={toggleSidebar}
          />
        )}

        {/* Main Content. lg:ml-* offsets for the fixed sidebar so content
            doesn't render under it. */}
        <main
          className={cn(
            'flex-1 min-w-0',
            sidebarExpanded ? 'lg:ml-60' : 'lg:ml-16'
          )}
        >
          {children}
        </main>
      </div>

      {/* UI Refresh v3 — Action Center: floating "needs a person now" panel,
          wired to the real AI task inbox. Renders nothing when the inbox is
          empty, so it never adds chrome. Desktop only (lg+). */}
      <div className="hidden lg:block">
        <ActionCenter />
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
