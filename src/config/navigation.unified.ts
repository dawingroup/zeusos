/**
 * Unified Navigation Configuration
 * Single source of truth for all navigation items across ZeusOS.
 * Consolidates: config/navigation.ts + integration/constants/navigation.constants.ts
 *
 * Phase 3.H follow-up — navigation cleanup:
 *   - FINISHES_NAVIGATION (DawinOS construction modules) deleted.
 *   - ADVISORY_NAVIGATION reduced to the still-wired /advisory/investment
 *     subtree; MatFlow and Infrastructure Delivery routes were removed in
 *     Phase 1.C.
 *   - AGENCY_NAVIGATION is the base sidebar; per-subsidiary variants
 *     (ZEUS_DIGITAL_NAVIGATION, LABYRINTH_NAVIGATION, etc.) reorder the
 *     same items so each sub-brand's primary specialty comes first.
 *   - COMMERCIAL_NAVIGATION exposes Account Management, Pricing, and
 *     Billing — gated to parent-org admins/owners in the AppShell to
 *     mirror the ParentOrgGuard / Cloud Function / Firestore rules
 *     boundary (§7.4 "commercial gravity").
 *   - CORPORATE_NAVIGATION child hrefs aligned to the actual routes in
 *     src/router/index.tsx; dead sub-links removed.
 *   - GLOBAL_NAVIGATION trimmed: Customers, Suppliers, and Messaging
 *     pointed at routes that don't exist post-Phase-1.C; only Delivery
 *     Inbox (subsidiary workspace) remains.
 *
 * Phase 4 modules (Media, Production, Talent) are not registered here —
 * they land on the phase-4-media-production-talent branch and will be
 * folded into AGENCY_NAVIGATION when that PR merges.
 */

import type { CommandItem } from '@/core/components/navigation/CommandPalette';
import type { SubsidiaryId } from '@/core/settings/types';

// ============================================================================
// TYPES
// ============================================================================

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  description?: string;
  module?: string;
  roles?: string[];
  children?: NavItem[];
  badge?: number | string;
  keywords?: string[];
  /** Optional keyboard shortcut, e.g. "G S" for Strategy. */
  shortcut?: string;
}

export interface SubsidiaryConfig {
  id: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  defaultPath: string;
  navigation: NavItem[];
}

// ============================================================================
// AGENCY NAVIGATION — main sidebar for every sub-brand
// ============================================================================
// Items here are visible to every authenticated user that has the parent
// subsidiary access. Per-subsidiary reordering is applied via the named
// *_NAVIGATION constants below (e.g. LABYRINTH_NAVIGATION) — each variant
// is the same set of items, just with the brand's primary specialty
// surfaced first. No items are hidden per sub-brand; all five sub-brands
// have access to every module in this list.

export const AGENCY_NAVIGATION: NavItem[] = [
  {
    id: 'engagements',
    label: 'Engagements',
    href: '/engagements',
    icon: 'Briefcase',
    description: 'Legacy advisory engagements — migrating to Campaigns / Master Jobs',
    keywords: ['engagement', 'project', 'job'],
  },
  {
    id: 'delivery-inbox',
    label: 'Delivery Inbox',
    href: '/delivery/inbox',
    icon: 'Inbox',
    description: 'Internal work orders awaiting acceptance and in-flight work',
    keywords: ['delivery', 'iwo', 'work orders', 'tasks', 'time', 'cost'],
  },
  {
    id: 'investment',
    label: 'Investment Pipeline',
    href: '/advisory/investment',
    icon: 'Briefcase',
    description: 'Deal pipeline & portfolio (Zeus Digital advisory subsidiary)',
    keywords: ['deals', 'pipeline', 'portfolio', 'investment'],
    children: [
      { id: 'investment-pipeline', label: 'Pipeline',  href: '/advisory/investment/pipeline', icon: 'Kanban' },
      { id: 'investment-deals',    label: 'Deals',     href: '/advisory/investment/deals',    icon: 'Handshake' },
      { id: 'investment-reports',  label: 'Reports',   href: '/advisory/investment/reports',  icon: 'BarChart3' },
    ],
  },
  {
    id: 'ai-assistant',
    label: 'AI Assistant',
    href: '/ai-assistant',
    icon: 'Bot',
    description: 'Conversational AI for ZeusOS',
    keywords: ['ai', 'assistant', 'chat'],
  },
];

// ============================================================================
// COMMERCIAL NAVIGATION — parent-org Account Management surface
// ============================================================================
// Visible only to parent-org admin/owner principals. AppShell applies the
// gate; routes are also wrapped in ParentOrgGuard so the boundary is
// enforced three layers deep (UI / API / Firestore rules).

export const COMMERCIAL_NAVIGATION: NavItem[] = [
  {
    id: 'clients',
    label: 'Clients',
    href: '/clients',
    icon: 'Users',
    description: 'Client roster, MSAs, SOWs, change orders',
    keywords: ['clients', 'msa', 'sow', 'change order', 'commercial'],
  },
  {
    id: 'master-jobs',
    label: 'Master Jobs',
    href: '/master-jobs',
    icon: 'FolderKanban',
    description: 'Campaign-level engagements with IWO issuance',
    keywords: ['master job', 'campaign', 'iwo', 'engagement'],
  },
  {
    id: 'review-queue',
    label: 'Review Queue',
    href: '/account-mgmt/reviews',
    icon: 'ClipboardCheck',
    description: 'Deliverables awaiting AM sign-off',
    keywords: ['review', 'queue', 'deliverable', 'approve'],
  },
  {
    id: 'intake-queue',
    label: 'Intake',
    href: '/account-mgmt/intake',
    icon: 'Inbox',
    description: 'Direct-from-client requests to route',
    keywords: ['intake', 'request', 'route'],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    href: '/pricing/rate-cards',
    icon: 'Tag',
    description: 'Rate cards and quote builder',
    keywords: ['pricing', 'rate card', 'quote', 'price'],
    children: [
      { id: 'pricing-rate-cards', label: 'Rate Cards', href: '/pricing/rate-cards', icon: 'Tag' },
      { id: 'pricing-quote-new',  label: 'New Quote',  href: '/pricing/quotes/new', icon: 'FilePlus' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    href: '/billing/client-invoices',
    icon: 'Receipt',
    description: 'Client invoices, intercompany billing, GL adapter status',
    keywords: ['billing', 'invoice', 'gl', 'intercompany'],
    children: [
      { id: 'billing-client',       label: 'Client Invoices',   href: '/billing/client-invoices', icon: 'Receipt' },
      { id: 'billing-intercompany', label: 'Intercompany',       href: '/billing/intercompany',    icon: 'ArrowLeftRight' },
      { id: 'billing-gl',           label: 'GL Adapter Status',  href: '/billing/gl-status',       icon: 'Activity' },
    ],
  },
];

// ============================================================================
// SHARED UTILITY NAVIGATION (command-palette indexing only)
// ============================================================================
// AI Intelligence + My Tasks live in the header (AIIntelligenceMenu +
// GlobalTaskButton); they are not in the sidebar.

export const UTILITY_NAVIGATION: NavItem[] = [
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    href: '/intelligence',
    icon: 'Brain',
    module: 'intelligence-layer',
    description: 'Smart guidance for daily tasks & workflows',
    keywords: ['ai', 'intelligence', 'guidance', 'tasks', 'workflows', 'smart'],
    children: [
      {
        id: 'my-tasks',
        label: 'My Tasks',
        href: '/intelligence/inbox',
        icon: 'ClipboardList',
        description: 'Your assigned tasks and to-dos',
        keywords: ['tasks', 'my tasks', 'inbox', 'todo'],
      },
      {
        id: 'team-dashboard',
        label: 'Team Dashboard',
        href: '/intelligence/manager',
        icon: 'Users',
        description: 'Team workload and task overview',
        keywords: ['team', 'dashboard', 'workload', 'manager'],
        roles: ['manager', 'admin', 'owner', 'super_admin'],
      },
      {
        id: 'intelligence-admin',
        label: 'Admin Console',
        href: '/intelligence/admin',
        icon: 'Settings',
        description: 'System configuration and monitoring',
        keywords: ['admin', 'settings', 'configuration', 'monitoring'],
        roles: ['admin', 'owner', 'super_admin'],
      },
    ],
  },
];

// ============================================================================
// GLOBAL NAVIGATION (sidebar — workspace section)
// ============================================================================
// Items shared across every subsidiary. Delivery Inbox is also surfaced
// here so subsidiary users keep it visible when they switch sub-brands;
// AppShell hides it for parent-org users (the SubsidiaryDeliveryGuard
// would 403 them).

export const GLOBAL_NAVIGATION: NavItem[] = [
  {
    id: 'delivery-inbox',
    label: 'Delivery Inbox',
    href: '/delivery/inbox',
    icon: 'Inbox',
    description: 'Internal work orders awaiting acceptance and in-flight work',
    keywords: ['delivery', 'iwo', 'work orders', 'tasks', 'time', 'cost'],
  },
];

// ============================================================================
// ADMIN NAVIGATION
// ============================================================================

export const ADMIN_NAVIGATION: NavItem[] = [
  {
    id: 'admin',
    label: 'Administration',
    href: '/admin/users',
    icon: 'Settings',
    roles: ['admin', 'super_admin'],
    children: [
      {
        id: 'admin-access',
        label: 'Access',
        href: '/admin/users',
        icon: 'Shield',
        children: [
          { id: 'admin-users', label: 'Users',     href: '/admin/users', icon: 'Users' },
          { id: 'admin-roles', label: 'Roles',     href: '/admin/roles', icon: 'KeyRound' },
        ],
      },
      { id: 'admin-audit',     label: 'Audit Log',     href: '/admin/audit-log',     icon: 'FileText' },
      { id: 'admin-design',    label: 'Design System', href: '/admin/design-system', icon: 'Palette' },
    ],
  },
];

// ============================================================================
// CORPORATE MODULES (header pills + cross-subsidiary services)
// ============================================================================
// Child hrefs aligned to the actual route surface in src/router/index.tsx
// (Phase 3.H cleanup — broken sub-links removed).

export const CORPORATE_NAVIGATION: NavItem[] = [
  {
    id: 'strategy',
    label: 'CEO Strategy',
    href: '/strategy',
    icon: 'Target',
    module: 'strategy',
    description: 'Strategic planning & OKRs',
    shortcut: 'G S',
    keywords: ['strategy', 'okrs', 'kpis', 'objectives', 'goals', 'performance'],
    children: [
      { id: 'strategy-dashboard', label: 'Executive Dashboard', href: '/strategy',          icon: 'LayoutDashboard' },
      { id: 'strategy-overview',  label: 'Overview',            href: '/strategy/overview', icon: 'FileText' },
      { id: 'strategy-okrs',      label: 'OKRs',                href: '/strategy/okrs',     icon: 'Target' },
      { id: 'strategy-kpi',       label: 'KPIs',                href: '/strategy/kpi',      icon: 'BarChart3' },
      { id: 'strategy-kpi-lib',   label: 'KPI Library',         href: '/strategy/kpi/library', icon: 'Library' },
    ],
  },
  {
    id: 'hr',
    label: 'HR Central',
    href: '/hr/employees',
    icon: 'Users',
    module: 'hr',
    description: 'Human resources & performance',
    shortcut: 'G H',
    keywords: ['employees', 'staff', 'payroll', 'leave', 'performance', 'reviews', 'goals'],
    children: [
      { id: 'hr-employees',    label: 'Employees',    href: '/hr/employees',     icon: 'Users' },
      { id: 'hr-leave',        label: 'Leave',        href: '/hr/leave',         icon: 'Calendar' },
      { id: 'hr-payroll',      label: 'Payroll',      href: '/hr/payroll',       icon: 'DollarSign' },
      { id: 'hr-organization', label: 'Organization', href: '/hr/org-structure', icon: 'Sitemap' },
      { id: 'hr-performance',  label: 'Performance',  href: '/performance/goals', icon: 'TrendingUp' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    href: '/finance',
    icon: 'DollarSign',
    module: 'finance',
    description: 'Financial management',
    shortcut: 'G F',
    keywords: ['finance', 'cash', 'reports', 'expenditure', 'spend plan'],
    children: [
      { id: 'finance-overview',      label: 'Overview',          href: '/finance/overview',         icon: 'LayoutDashboard' },
      { id: 'finance-cash',          label: 'Cash Flow',         href: '/finance/cash',             icon: 'TrendingUp' },
      { id: 'finance-forecast',      label: 'Cash Forecast',     href: '/finance/cash-forecast',    icon: 'LineChart' },
      { id: 'finance-spend-plan',    label: 'Spend Plan',        href: '/finance/spend-plan',       icon: 'PiggyBank' },
      { id: 'finance-expenditure',   label: 'Expenditure Queue', href: '/finance/expenditure-queue', icon: 'ClipboardList' },
      { id: 'finance-cfo',           label: 'CFO Briefing',      href: '/finance/cfo-briefing',     icon: 'FileText' },
      { id: 'finance-operations',    label: 'Operations',        href: '/finance/operations',       icon: 'Activity' },
      { id: 'finance-reports',       label: 'Reports',           href: '/finance/reports',          icon: 'BarChart3' },
      { id: 'finance-settings',      label: 'Settings',          href: '/finance/settings',         icon: 'Settings' },
    ],
  },
  {
    id: 'capital',
    label: 'Capital Hub',
    href: '/capital',
    icon: 'Building2',
    module: 'capital',
    description: 'Capital planning, readiness & application tracking',
    shortcut: 'G C',
    keywords: ['capital', 'loans', 'facilities', 'readiness', 'applications'],
    children: [
      { id: 'capital-dashboard',    label: 'Dashboard',    href: '/capital',              icon: 'LayoutDashboard' },
      { id: 'capital-needs',        label: 'Needs',        href: '/capital/needs',        icon: 'Target' },
      { id: 'capital-products',     label: 'Products',     href: '/capital/products',     icon: 'Package' },
      { id: 'capital-readiness',    label: 'Readiness',    href: '/capital/readiness',    icon: 'ClipboardCheck' },
      { id: 'capital-applications', label: 'Applications', href: '/capital/applications', icon: 'FileText' },
      { id: 'capital-facilities',   label: 'Facilities',   href: '/capital/facilities',   icon: 'Building2' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    href: '/compliance',
    icon: 'Shield',
    module: 'compliance',
    description: 'Document management & regulatory compliance',
    shortcut: 'G O',
    keywords: ['compliance', 'documents', 'obligations', 'regulations', 'tax', 'license'],
    children: [
      { id: 'compliance-dashboard',   label: 'Dashboard',   href: '/compliance',             icon: 'LayoutDashboard' },
      { id: 'compliance-documents',   label: 'Documents',   href: '/compliance/documents',   icon: 'FileText' },
      { id: 'compliance-obligations', label: 'Obligations', href: '/compliance/obligations', icon: 'ClipboardCheck' },
    ],
  },
  {
    id: 'market-intel',
    label: 'Market Intelligence',
    href: '/market-intel/competitors',
    icon: 'Globe',
    module: 'market_intelligence',
    description: 'Market research',
    shortcut: 'G M',
    keywords: ['competitors', 'market', 'research', 'insights'],
    children: [
      { id: 'market-competitors', label: 'Competitors',  href: '/market-intel/competitors', icon: 'Users' },
      { id: 'market-news',        label: 'News Feed',    href: '/market-intel/news',        icon: 'Newspaper' },
      { id: 'market-analysis',    label: 'Analysis',     href: '/market-intel/market',      icon: 'BarChart3' },
      { id: 'market-insights',    label: 'Insights',     href: '/market-intel/insights',    icon: 'Lightbulb' },
      { id: 'market-topics',      label: 'Topics',       href: '/market-intel/topics',      icon: 'Hash' },
      { id: 'market-social',      label: 'Social',       href: '/market-intel/social',      icon: 'MessageSquare' },
    ],
  },
];

// ============================================================================
// PER-SUBSIDIARY NAVIGATION VARIANTS
// ============================================================================
// Each Zeus sub-brand surfaces its primary specialty first. Variants are
// reorderings of AGENCY_NAVIGATION — never subsets. Items absent from a
// priority list (e.g. Phase 4 entries like `production` / `talent` that
// aren't yet registered in AGENCY_NAVIGATION) are skipped silently by the
// helper, so these constants stay forward-compatible.
//
// Mapping per the sub-brand mandate:
//   • Zeus The Agency   — full-service. Default order (Engagements first).
//   • Zeus Digital      — digital + advisory. Investment first.
//   • Labyrinth A&V     — production house. Production first.
//   • Odd Gorilla       — creative shop. Engagements, then Talent, then Production.
//   • House of Zeus     — strategy + house ops. Default order for now.

/**
 * Return `items` with the entries whose ids appear in `priorityIds` pushed
 * to the front (in the order given). Missing ids are skipped. Items not in
 * the priority list keep their relative order and follow at the tail.
 */
function reorderByIds(items: NavItem[], priorityIds: string[]): NavItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const head = priorityIds
    .map((id) => byId.get(id))
    .filter((x): x is NavItem => !!x);
  const headIds = new Set(priorityIds);
  const tail = items.filter((i) => !headIds.has(i.id));
  return [...head, ...tail];
}

export const ZEUS_AGENCY_NAVIGATION: NavItem[]   = AGENCY_NAVIGATION;
export const ZEUS_DIGITAL_NAVIGATION: NavItem[]  = reorderByIds(AGENCY_NAVIGATION, ['investment', 'engagements', 'campaigns']);
export const LABYRINTH_NAVIGATION: NavItem[]     = reorderByIds(AGENCY_NAVIGATION, ['production', 'campaigns', 'engagements']);
export const ODD_GORILLA_NAVIGATION: NavItem[]   = reorderByIds(AGENCY_NAVIGATION, ['engagements', 'talent', 'production']);
export const HOUSE_OF_ZEUS_NAVIGATION: NavItem[] = AGENCY_NAVIGATION;

// ============================================================================
// SUBSIDIARY CONFIGURATIONS
// ============================================================================

export const SUBSIDIARIES: SubsidiaryConfig[] = [
  {
    id: 'zeus-the-agency',
    name: 'Zeus The Agency',
    shortName: 'Zeus',
    color: '#F5D900',
    icon: 'Sparkles',
    defaultPath: '/',
    navigation: ZEUS_AGENCY_NAVIGATION,
  },
  {
    id: 'zeus-digital',
    name: 'Zeus Digital',
    shortName: 'ZD',
    color: '#00C5E5',
    icon: 'Zap',
    defaultPath: '/',
    navigation: ZEUS_DIGITAL_NAVIGATION,
  },
  {
    id: 'labyrinth',
    name: 'Labyrinth Audio & Visual',
    shortName: 'Labyrinth',
    color: '#C8F0D6',
    icon: 'Music',
    defaultPath: '/',
    navigation: LABYRINTH_NAVIGATION,
  },
  {
    id: 'odd-gorilla',
    name: 'Odd Gorilla',
    shortName: 'Odd Gorilla',
    color: '#FFB0B8',
    icon: 'PawPrint',
    defaultPath: '/',
    navigation: ODD_GORILLA_NAVIGATION,
  },
  {
    id: 'house-of-zeus',
    name: 'House of Zeus',
    shortName: 'HoZ',
    color: '#C8FF3C',
    icon: 'Home',
    defaultPath: '/',
    navigation: HOUSE_OF_ZEUS_NAVIGATION,
  },
];

/**
 * Type-safe getter — `SubsidiaryConfig.id` is currently typed as `string`
 * for back-compat, but every entry is one of the canonical Zeus IDs.
 */
export function getSubsidiaryConfig(id: SubsidiaryId): SubsidiaryConfig | undefined {
  return SUBSIDIARIES.find((s) => s.id === id);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Flatten navigation tree into a list of command items for the command palette.
 */
export function flattenNavigation(
  items: NavItem[],
  _parentPath?: string
): CommandItem[] {
  const result: CommandItem[] = [];

  for (const item of items) {
    result.push({
      id: item.id,
      label: item.label,
      description: item.description,
      path: item.href,
      icon: item.icon,
      category: 'navigation',
      keywords: item.keywords,
      shortcut: item.shortcut,
    });

    if (item.children) {
      result.push(...flattenNavigation(item.children, item.href));
    }
  }

  return result;
}

/**
 * Get all command items for the command palette
 */
export function getAllCommandItems(): CommandItem[] {
  return [
    ...flattenNavigation(AGENCY_NAVIGATION),
    ...flattenNavigation(COMMERCIAL_NAVIGATION),
    ...flattenNavigation(CORPORATE_NAVIGATION),
    ...flattenNavigation(UTILITY_NAVIGATION),
    ...flattenNavigation(ADMIN_NAVIGATION),
  ];
}

/**
 * Get navigation for a specific subsidiary
 */
export function getSubsidiaryNavigation(subsidiaryId: string): NavItem[] {
  const subsidiary = SUBSIDIARIES.find(s => s.id === subsidiaryId);
  return subsidiary?.navigation || ZEUS_AGENCY_NAVIGATION;
}

/**
 * Filter navigation items by user's accessible modules.
 * Items without a `module` field are always shown.
 * Items with a `module` field are only shown if the module is accessible.
 */
export function filterNavigationByAccess(
  items: NavItem[],
  accessibleModuleIds: string[],
  isPrivileged: boolean,
): NavItem[] {
  if (isPrivileged) return items;

  return items.filter((item) => {
    if (!item.module) return true;
    return accessibleModuleIds.includes(item.module);
  });
}

/**
 * Get the active navigation section based on current path
 */
export function getActiveSection(pathname: string): string | null {
  const allItems = [
    ...AGENCY_NAVIGATION,
    ...COMMERCIAL_NAVIGATION,
    ...CORPORATE_NAVIGATION,
  ];

  for (const item of allItems) {
    if (pathname === item.href || pathname.startsWith(item.href + '/')) {
      return item.id;
    }
    if (item.children) {
      for (const child of item.children) {
        if (pathname === child.href || pathname.startsWith(child.href + '/')) {
          return item.id;
        }
      }
    }
  }

  return null;
}

// ============================================================================
// BACK-COMPAT ALIASES — deprecated; will be deleted once consumers move over.
// ============================================================================

/**
 * @deprecated Use AGENCY_NAVIGATION. The FINISHES_NAVIGATION alias is
 * retained for one cycle so external consumers (storybook stories,
 * snapshot tests) don't break on rename. Slated for removal in Phase 4.B.
 */
export const FINISHES_NAVIGATION = AGENCY_NAVIGATION;

/**
 * @deprecated Use AGENCY_NAVIGATION. The advisory-only sidebar layout
 * has been folded into the shared agency nav.
 */
export const ADVISORY_NAVIGATION = AGENCY_NAVIGATION;
