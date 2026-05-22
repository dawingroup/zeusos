/**
 * Unified Navigation Configuration
 * Single source of truth for all navigation items across ZeusOS.
 * Consolidates: config/navigation.ts + integration/constants/navigation.constants.ts
 *
 * NOTE(ZeusOS Phase 1.B): the per-subsidiary navigation arrays
 * (AGENCY_LEGACY_NAVIGATION, ADVISORY_LEGACY_NAVIGATION) still
 * reference construction-domain modules (Design Manager, Inventory,
 * Manufacturing, MatFlow, etc.). These will be replaced in Phase
 * 1.C with the Campaign & Job Manager + Media + Production +
 * Talent + Asset Library nav. For now they're retained so the
 * router doesn't break — Phase 1.C deletes the modules and
 * rewrites these arrays in one sweep.
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
// DAWIN FINISHES NAVIGATION
// ============================================================================

export const FINISHES_NAVIGATION: NavItem[] = [
  {
    id: 'clipper',
    label: 'Clip Library',
    href: '/clipper',
    icon: 'Sparkles',
    module: 'clipper',
    description: 'Design inspiration clips',
    keywords: ['inspiration', 'clips', 'images'],
  },
  {
    id: 'design',
    label: 'Design Manager',
    href: '/design',
    icon: 'FolderOpen',
    module: 'design-manager',
    description: 'Manage design projects',
    keywords: ['projects', 'design', 'items'],
    children: [
      { id: 'design-projects', label: 'Projects', href: '/design', icon: 'FolderOpen' },
      { id: 'design-materials', label: 'Materials', href: '/design/materials', icon: 'Boxes' },
      { id: 'design-features', label: 'Features', href: '/design/features', icon: 'Layers' },
    ],
  },
  // Customers moved to GLOBAL_NAVIGATION (cross-subsidiary)
  {
    id: 'assets',
    label: 'Assets',
    href: '/assets',
    icon: 'Wrench',
    module: 'asset-registry',
    description: 'Asset registry',
    keywords: ['equipment', 'tools', 'machines'],
  },
  {
    id: 'design-studio',
    label: 'Design Studio',
    href: '/workshop',
    icon: 'Box',
    module: 'design-studio',
    description: '3D model viewer, configurator & print package generator',
    keywords: ['3d', 'viewer', 'polyboard', 'workshop', 'drawings', 'print package', 'pdf', 'design', 'studio', 'configurator'],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: 'Package',
    module: 'inventory',
    description: 'Stock management',
    keywords: ['stock', 'materials', 'finishes'],
    children: [
      { id: 'inventory-items', label: 'Items', href: '/inventory', icon: 'Package' },
      { id: 'stock-adjustments', label: 'Stock Adjustments', href: '/inventory/adjustments', icon: 'SwapVert' },
      { id: 'finish-library', label: 'Finish Library', href: '/inventory/finishes', icon: 'Palette' },
    ],
  },
  {
    id: 'procurement',
    label: 'Procurement',
    href: '/procurement',
    icon: 'ShoppingCart',
    module: 'procurement',
    description: 'Purchase orders & procurement management',
    keywords: ['purchase orders', 'procurement', 'buying', 'PO', 'vendors', 'RFQ'],
    children: [
      { id: 'procurement-dashboard', label: 'Dashboard', href: '/procurement', icon: 'LayoutDashboard' },
      { id: 'procurement-orders', label: 'Purchase Orders', href: '/procurement/orders', icon: 'ShoppingCart' },
      { id: 'procurement-queue', label: 'Queue', href: '/procurement/queue', icon: 'ListTodo' },
      { id: 'procurement-advisor', label: 'Advisor', href: '/procurement/advisor', icon: 'Sparkles' },
    ],
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    href: '/manufacturing',
    icon: 'Factory',
    module: 'production',
    description: 'Production orders & shop floor',
    keywords: ['manufacturing', 'production', 'MRP', 'BOM'],
    children: [
      { id: 'mfg-dashboard', label: 'Dashboard', href: '/manufacturing', icon: 'LayoutDashboard' },
      { id: 'mfg-orders', label: 'Production Orders', href: '/manufacturing/orders', icon: 'ClipboardList' },
      { id: 'mfg-shop-floor', label: 'Shop Floor', href: '/manufacturing/shop-floor', icon: 'Factory' },
      { id: 'mfg-workstations', label: 'Workstations', href: '/manufacturing/workstations', icon: 'Wrench' },
      { id: 'mfg-routing', label: 'Routing Templates', href: '/manufacturing/routing-templates', icon: 'Route' },
    ],
  },
  {
    id: 'fulfillment',
    label: 'Fulfillment',
    href: '/fulfillment',
    icon: 'Truck',
    module: 'production',
    description: 'Post-production delivery & installation',
    keywords: ['fulfillment', 'delivery', 'dispatch', 'installation', 'packing'],
  },
  {
    id: 'launch-pipeline',
    label: 'Launch Pipeline',
    href: '/launch-pipeline',
    icon: 'Rocket',
    module: 'launch-pipeline',
    description: 'Product launches',
    keywords: ['launch', 'products', 'pipeline'],
  },
  {
    id: 'crm',
    label: 'CRM',
    href: '/crm',
    icon: 'Users',
    module: 'crm',
    description: 'Sales pipeline & deal tracking',
    keywords: ['crm', 'sales', 'deals', 'pipeline', 'leads', 'opportunities'],
    children: [
      { id: 'crm-pipeline', label: 'Pipeline', href: '/crm/pipeline', icon: 'Kanban' },
      { id: 'crm-deals', label: 'Deals', href: '/crm/deals', icon: 'Handshake' },
      { id: 'crm-projects', label: 'Project Tracker', href: '/crm/projects', icon: 'FolderKanban' },
      { id: 'crm-activities', label: 'Activities', href: '/crm/activities', icon: 'Activity' },
      { id: 'crm-tasks', label: 'Sales Tasks', href: '/crm/tasks', icon: 'CheckSquare' },
      { id: 'crm-reports', label: 'Reports', href: '/crm/reports', icon: 'BarChart3' },
    ],
  },
  {
    id: 'sales-orders',
    label: 'Sales Orders',
    href: '/sales-orders',
    icon: 'FileCheck',
    module: 'sales-orders',
    description: 'Commercial protection & approval gates',
    keywords: ['sales orders', 'contracts', 'approvals', 'gates', 'discounts', 'change orders'],
    children: [
      { id: 'so-dashboard', label: 'Dashboard', href: '/sales-orders', icon: 'LayoutDashboard' },
      { id: 'so-orders', label: 'All Orders', href: '/sales-orders/list', icon: 'FileCheck' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing Hub',
    href: '/marketing',
    icon: 'Megaphone',
    module: 'marketing',
    description: 'Campaigns, social media & analytics',
    keywords: ['campaigns', 'marketing', 'whatsapp', 'social', 'analytics'],
    children: [
      { id: 'marketing-dashboard', label: 'Dashboard', href: '/marketing', icon: 'LayoutDashboard' },
      { id: 'marketing-campaigns', label: 'Campaigns', href: '/marketing/campaigns', icon: 'Megaphone' },
      { id: 'marketing-calendar', label: 'Content Calendar', href: '/marketing/calendar', icon: 'Calendar' },
      { id: 'marketing-templates', label: 'Templates', href: '/marketing/templates', icon: 'MessageSquare' },
      { id: 'marketing-analytics', label: 'Analytics', href: '/marketing/analytics', icon: 'BarChart3' },
      { id: 'marketing-media', label: 'Media Library', href: '/marketing/media', icon: 'Image' },
      { id: 'marketing-agent', label: 'AI Agent', href: '/marketing/agent', icon: 'Bot' },
    ],
  },
];

// ============================================================================
// DAWIN ADVISORY NAVIGATION
// ============================================================================

export const ADVISORY_NAVIGATION: NavItem[] = [
  {
    id: 'investment',
    label: 'Investment',
    href: '/advisory/investment',
    icon: 'Briefcase',
    module: 'investment_advisory',
    description: 'Deal pipeline & portfolio',
    keywords: ['deals', 'pipeline', 'portfolio'],
  },
  {
    id: 'matflow',
    label: 'MatFlow',
    href: '/advisory/matflow',
    icon: 'HardHat',
    module: 'matflow',
    description: 'Material flow management',
    keywords: ['boq', 'procurement', 'materials'],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    href: '/advisory/delivery',
    icon: 'Building2',
    module: 'infrastructure_delivery',
    description: 'Infrastructure delivery',
    keywords: ['projects', 'programs', 'infrastructure'],
  },
];

// ============================================================================
// SHARED/UTILITY NAVIGATION
// ============================================================================

// AI Intelligence & Assistant are now in the header (AIIntelligenceMenu + GlobalTaskButton).
// UTILITY_NAVIGATION is kept for command palette indexing only.
export const UTILITY_NAVIGATION: NavItem[] = [
  {
    id: 'intelligence',
    label: 'AI Intelligence',
    href: '/ai',
    icon: 'Brain',
    module: 'intelligence-layer',
    description: 'Smart guidance for daily tasks & workflows',
    keywords: ['ai', 'intelligence', 'guidance', 'tasks', 'workflows', 'smart'],
    children: [
      {
        id: 'my-tasks',
        label: 'My Tasks',
        href: '/my-tasks',
        icon: 'ClipboardList',
        description: 'Your assigned tasks and to-dos',
        keywords: ['tasks', 'my tasks', 'inbox', 'todo'],
      },
      {
        id: 'team-dashboard',
        label: 'Team Dashboard',
        href: '/ai/team',
        icon: 'Users',
        description: 'Team workload and task overview',
        keywords: ['team', 'dashboard', 'workload', 'manager'],
        roles: ['manager', 'admin', 'owner', 'super_admin'],
      },
      {
        id: 'intelligence-admin',
        label: 'Admin Console',
        href: '/ai/admin',
        icon: 'Settings',
        description: 'System configuration and monitoring',
        keywords: ['admin', 'settings', 'configuration', 'monitoring'],
        roles: ['admin', 'owner', 'super_admin'],
      },
    ],
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    href: '/assistant',
    icon: 'Bot',
    description: 'AI-powered help',
    keywords: ['ai', 'help', 'assistant', 'chat'],
  },
];

// ============================================================================
// GLOBAL NAVIGATION (Available across ALL subsidiaries in the sidebar)
// ============================================================================

export const GLOBAL_NAVIGATION: NavItem[] = [
  {
    // Phase 3.E — subsidiary delivery inbox. The route is guarded so
    // parent-org users get redirected; everyone else sees their IWO
    // queue here. No `module` field, so the access filter always shows
    // it — the guard handles gating, not the menu.
    id: 'delivery-inbox',
    label: 'Delivery Inbox',
    href: '/delivery/inbox',
    icon: 'Inbox',
    description: 'Internal work orders awaiting acceptance and in-flight work',
    keywords: ['delivery', 'iwo', 'work orders', 'tasks', 'time', 'cost'],
  },
  {
    id: 'customers',
    label: 'Customers',
    href: '/customers',
    icon: 'Users',
    module: 'customer-hub',
    description: 'Customer management',
    keywords: ['clients', 'contacts'],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    href: '/suppliers',
    icon: 'Building2',
    module: 'suppliers',
    description: 'Vendor & supplier management',
    keywords: ['vendors', 'suppliers', 'procurement'],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    href: '/whatsapp',
    icon: 'MessagesSquare',
    module: 'whatsapp',
    description: 'WhatsApp & Team Chat',
    keywords: ['messaging', 'whatsapp', 'chat', 'inbox', 'gchat', 'team'],
    children: [
      { id: 'messaging-whatsapp', label: 'WhatsApp', href: '/whatsapp', icon: 'MessageSquare' },
      { id: 'messaging-gchat', label: 'Team Chat', href: '/messaging/gchat', icon: 'Hash' },
    ],
  },
];

// ============================================================================
// ADMIN NAVIGATION
// ============================================================================

export const ADMIN_NAVIGATION: NavItem[] = [
  {
    id: 'admin',
    label: 'Administration',
    href: '/admin',
    icon: 'Settings',
    roles: ['admin', 'super_admin'],
    children: [
      { id: 'admin-settings', label: 'Settings', href: '/admin/settings', icon: 'Settings' },
      {
        id: 'admin-access',
        label: 'Access',
        href: '/admin/users',
        icon: 'Shield',
        children: [
          { id: 'admin-users', label: 'Users', href: '/admin/users', icon: 'Users' },
          { id: 'admin-roles', label: 'Roles', href: '/admin/roles', icon: 'KeyRound' },
        ],
      },
      {
        id: 'admin-integrations',
        label: 'Integrations',
        href: '/admin/drive-folders',
        icon: 'Plug',
        children: [
          { id: 'admin-drive-folders', label: 'Drive Folders', href: '/admin/drive-folders', icon: 'FolderOpen' },
          { id: 'admin-shopify', label: 'Shopify Sync', href: '/admin/shopify-sync', icon: 'ShoppingBag' },
          { id: 'admin-api-keys', label: 'API Keys', href: '/admin/api-keys', icon: 'KeyRound' },
        ],
      },
      {
        id: 'admin-reference',
        label: 'Reference',
        href: '/admin/design-system',
        icon: 'BookOpen',
        children: [
          { id: 'admin-ds', label: 'Design System', href: '/admin/design-system', icon: 'Palette' },
        ],
      },
    ],
  },
];

// ============================================================================
// CORPORATE MODULES (Available across subsidiaries)
// ============================================================================

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
      { id: 'strategy-dashboard', label: 'Executive Dashboard', href: '/strategy/dashboard', icon: 'LayoutDashboard' },
      { id: 'strategy-plans', label: 'Strategy Plans', href: '/strategy/plans', icon: 'FileText' },
      { id: 'strategy-okrs', label: 'OKRs', href: '/strategy/okrs', icon: 'Target' },
      { id: 'strategy-kpis', label: 'KPIs', href: '/strategy/kpis', icon: 'BarChart3' },
      { id: 'strategy-analytics', label: 'Analytics', href: '/strategy/analytics', icon: 'Activity' },
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
      { id: 'hr-employees', label: 'Employees', href: '/hr/employees', icon: 'Users' },
      { id: 'hr-performance', label: 'Performance', href: '/hr/performance', icon: 'TrendingUp' },
      { id: 'hr-leave', label: 'Leave', href: '/hr/leave', icon: 'Calendar' },
      { id: 'hr-payroll', label: 'Payroll', href: '/hr/payroll', icon: 'DollarSign' },
      { id: 'hr-organization', label: 'Organization', href: '/hr/organization', icon: 'Sitemap' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    href: '/finance/budgets',
    icon: 'DollarSign',
    module: 'finance',
    description: 'Financial management',
    shortcut: 'G F',
    keywords: ['budgets', 'expenses', 'reports'],
  },
  {
    id: 'capital',
    label: 'Capital Hub',
    href: '/capital/dashboard',
    icon: 'Building2',
    module: 'capital',
    description: 'Capital planning, readiness & application tracking',
    shortcut: 'G C',
    keywords: ['capital', 'loans', 'facilities', 'readiness', 'applications'],
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
      { id: 'compliance-dashboard', label: 'Dashboard', href: '/compliance', icon: 'LayoutDashboard' },
      { id: 'compliance-documents', label: 'Documents', href: '/compliance/documents', icon: 'FileText' },
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
  },
];

// ============================================================================
// SUBSIDIARY CONFIGURATIONS
// ============================================================================

/**
 * Zeus Group's five operating agencies.
 *
 * Phase 1.B keeps every agency pointed at the legacy FINISHES_NAVIGATION
 * (renamed AGENCY_LEGACY_NAVIGATION via alias below) so the router still
 * resolves while we strip construction modules. Phase 1.C will introduce
 * a single shared AGENCY_NAVIGATION populated with the Campaigns / Media
 * / Production / Talent / Asset-Library entries, plus per-agency overrides
 * where each sub-brand's services differ (e.g. Labyrinth surfaces Production
 * first; Zeus Digital surfaces Influencer / Paid Media first).
 */
export const SUBSIDIARIES: SubsidiaryConfig[] = [
  {
    id: 'zeus-the-agency',
    name: 'Zeus The Agency',
    shortName: 'Zeus',
    color: '#F5D900',
    icon: 'Sparkles',
    defaultPath: '/',
    navigation: FINISHES_NAVIGATION,
  },
  {
    id: 'zeus-digital',
    name: 'Zeus Digital',
    shortName: 'ZD',
    color: '#00C5E5',
    icon: 'Zap',
    defaultPath: '/',
    navigation: FINISHES_NAVIGATION,
  },
  {
    id: 'labyrinth',
    name: 'Labyrinth Audio & Visual',
    shortName: 'Labyrinth',
    color: '#C8F0D6',
    icon: 'Music',
    defaultPath: '/',
    navigation: FINISHES_NAVIGATION,
  },
  {
    id: 'odd-gorilla',
    name: 'Odd Gorilla',
    shortName: 'Odd Gorilla',
    color: '#FFB0B8',
    icon: 'PawPrint',
    defaultPath: '/',
    navigation: FINISHES_NAVIGATION,
  },
  {
    id: 'house-of-zeus',
    name: 'House of Zeus',
    shortName: 'HoZ',
    color: '#C8FF3C',
    icon: 'Home',
    defaultPath: '/',
    navigation: FINISHES_NAVIGATION,
  },
];

/**
 * Type-safe getter — `SubsidiaryConfig.id` is currently typed as `string`
 * for back-compat, but every entry is one of the canonical Zeus IDs.
 * This helper narrows the type for downstream consumers.
 */
export function getSubsidiaryConfig(id: SubsidiaryId): SubsidiaryConfig | undefined {
  return SUBSIDIARIES.find((s) => s.id === id);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Flatten navigation tree into a list of command items for the command palette
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
    ...flattenNavigation(FINISHES_NAVIGATION),
    ...flattenNavigation(ADVISORY_NAVIGATION),
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
  return subsidiary?.navigation || FINISHES_NAVIGATION;
}

/**
 * Filter navigation items by user's accessible modules.
 * Items without a `module` field are always shown (e.g., Suppliers).
 * Items with a `module` field are only shown if the module is in the accessible list.
 */
export function filterNavigationByAccess(
  items: NavItem[],
  accessibleModuleIds: string[],
  isPrivileged: boolean,
): NavItem[] {
  if (isPrivileged) return items;

  return items.filter((item) => {
    // No module restriction — always visible
    if (!item.module) return true;
    // Check if user has access to this module
    return accessibleModuleIds.includes(item.module);
  });
}

/**
 * Get the active navigation section based on current path
 */
export function getActiveSection(pathname: string): string | null {
  const allItems = [
    ...FINISHES_NAVIGATION,
    ...ADVISORY_NAVIGATION,
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
