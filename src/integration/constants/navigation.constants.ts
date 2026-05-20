// =============================================================================
// NAVIGATION CONSTANTS - Cross-Module Integration
// =============================================================================

import { ModuleId } from './modules.constants';

// ----------------------------------------------------------------------------
// NAVIGATION STRUCTURE
// ----------------------------------------------------------------------------
export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  module?: ModuleId;
  children?: NavItem[];
  badge?: {
    type: 'count' | 'dot' | 'new';
    value?: number;
    color?: string;
  };
  permissions?: string[];
  dividerAfter?: boolean;
}

export const MAIN_NAVIGATION: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/dashboard',
    permissions: [],
  },
  {
    id: 'intelligence',
    label: 'Smart Staff',
    icon: 'Brain',
    module: 'intelligence',
    children: [
      { id: 'tasks', label: 'My Tasks', path: '/intelligence/tasks' },
      { id: 'events', label: 'Business Events', path: '/intelligence/events' },
      { id: 'grey_areas', label: 'Grey Areas', path: '/intelligence/grey-areas', badge: { type: 'dot', color: 'warning' } },
    ],
    permissions: ['view:intelligence'],
    dividerAfter: true,
  },
  {
    id: 'hr',
    label: 'HR Central',
    icon: 'Users',
    module: 'hr_central',
    children: [
      { id: 'employees', label: 'Employees', path: '/hr/employees' },
      { id: 'performance', label: 'Performance', path: '/hr/performance/reviews' },
      { id: 'contracts', label: 'Contracts', path: '/hr/contracts' },
      { id: 'payroll', label: 'Payroll', path: '/hr/payroll' },
      { id: 'leave', label: 'Leave Management', path: '/hr/leave' },
      { id: 'organization', label: 'Organization', path: '/hr/organization' },
    ],
    permissions: ['view:hr'],
  },
  {
    id: 'strategy' as any,
    label: 'CEO Strategy',
    icon: 'Target',
    module: 'strategy' as any,
    children: [
      { id: 'overview', label: 'Executive Dashboard', path: '/strategy/dashboard' },
      { id: 'plans', label: 'Strategy Plans', path: '/strategy/plans' },
      { id: 'okrs', label: 'OKRs', path: '/strategy/okrs' },
      { id: 'kpis', label: 'KPIs', path: '/strategy/kpis' },
      { id: 'analytics', label: 'Analytics', path: '/strategy/analytics' },
    ],
    permissions: ['view:strategy'],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    module: 'financial',
    children: [
      { id: 'overview', label: 'Financial Overview', path: '/finance/overview' },
      { id: 'cash', label: 'Cash & Forecast', path: '/finance/cash' },
      { id: 'operations', label: 'Operations', path: '/finance/operations' },
      { id: 'budgets', label: 'Budgets', path: '/finance/operations/budgets' },
      { id: 'settings', label: 'Settings', path: '/finance/settings' },
    ],
    permissions: ['view:finance'],
  },
  {
    id: 'capital',
    label: 'Capital Hub',
    icon: 'Building2',
    module: 'capital_hub',
    children: [
      { id: 'dashboard', label: 'Dashboard', path: '/capital/dashboard' },
      { id: 'needs', label: 'Capital Needs', path: '/capital/needs' },
      { id: 'products', label: 'Products', path: '/capital/products' },
      { id: 'readiness', label: 'Readiness', path: '/capital/readiness' },
      { id: 'applications', label: 'Applications', path: '/capital/applications' },
      { id: 'facilities', label: 'Facilities', path: '/capital/facilities' },
    ],
    permissions: ['view:capital'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: 'Shield',
    module: 'compliance' as ModuleId,
    children: [
      { id: 'dashboard', label: 'Dashboard', path: '/compliance' },
      { id: 'documents', label: 'Documents', path: '/compliance/documents' },
      { id: 'obligations', label: 'Obligations', path: '/compliance/obligations' },
    ],
    permissions: ['view:compliance'],
  },
  {
    id: 'market',
    label: 'Market Intelligence',
    icon: 'Globe',
    module: 'market_intelligence',
    children: [
      { id: 'dashboard', label: 'Intelligence Dashboard', path: '/market-intel' },
      { id: 'competitors', label: 'Competitors', path: '/market-intel/competitors' },
      { id: 'research', label: 'Market Research', path: '/market-intel/market' },
      { id: 'scanning', label: 'Environment Scanning', path: '/market-intel/ai-scan' },
      { id: 'insights', label: 'Insights', path: '/market-intel/insights' },
    ],
    permissions: ['view:market'],
  },
  {
    id: 'marketing',
    label: 'Marketing Hub',
    icon: 'Megaphone',
    module: 'marketing',
    children: [
      { id: 'dashboard', label: 'Dashboard', path: '/marketing' },
      { id: 'campaigns', label: 'Campaigns', path: '/marketing/campaigns' },
      { id: 'calendar', label: 'Content Calendar', path: '/marketing/calendar' },
      { id: 'templates', label: 'Templates', path: '/marketing/templates' },
      { id: 'analytics', label: 'Analytics', path: '/marketing/analytics' },
    ],
    permissions: ['view:marketing'],
  },
];

// ----------------------------------------------------------------------------
// BREADCRUMB CONFIGURATIONS
// ----------------------------------------------------------------------------
export interface BreadcrumbConfig {
  pattern: RegExp;
  crumbs: Array<{
    label: string | ((params: RegExpMatchArray) => string);
    path: string | ((params: RegExpMatchArray) => string);
  }>;
}

export const BREADCRUMB_CONFIGS: BreadcrumbConfig[] = [
  // HR Central
  {
    pattern: /^\/hr\/employees$/,
    crumbs: [
      { label: 'HR Central', path: '/hr' },
      { label: 'Employees', path: '/hr/employees' },
    ],
  },
  {
    pattern: /^\/hr\/employees\/([^/]+)$/,
    crumbs: [
      { label: 'HR Central', path: '/hr' },
      { label: 'Employees', path: '/hr/employees' },
      { label: 'Employee Details', path: (p) => `/hr/employees/${p[0]}` },
    ],
  },
  // Strategy
  {
    pattern: /^\/strategy\/okrs$/,
    crumbs: [
      { label: 'CEO Strategy', path: '/strategy' },
      { label: 'OKRs', path: '/strategy/okrs' },
    ],
  },
  {
    pattern: /^\/strategy\/okrs\/([^/]+)$/,
    crumbs: [
      { label: 'CEO Strategy', path: '/strategy' },
      { label: 'OKRs', path: '/strategy/okrs' },
      { label: 'OKR Details', path: (p) => `/strategy/okrs/${p[0]}` },
    ],
  },
  // Finance
  {
    pattern: /^\/finance\/budgets$/,
    crumbs: [
      { label: 'Finance', path: '/finance' },
      { label: 'Budgets', path: '/finance/budgets' },
    ],
  },
  // Market Intelligence
  {
    pattern: /^\/market-intel\/competitors\/([^/]+)$/,
    crumbs: [
      { label: 'Market Intelligence', path: '/market-intel' },
      { label: 'Competitors', path: '/market-intel/competitors' },
      { label: 'Competitor Details', path: (p) => `/market-intel/competitors/${p[0]}` },
    ],
  },
];

// ----------------------------------------------------------------------------
// SEARCH CONFIGURATIONS
// ----------------------------------------------------------------------------
export interface SearchConfig {
  module: ModuleId | string;
  type: string;
  label: string;
  collection: string;
  searchFields: string[];
  displayField: string;
  subtitleField?: string;
  icon: string;
  urlTemplate: string;
  /** Firestore field to scope queries by. Omit for collections without an org/subsidiary field. */
  scopeField?: 'organizationId' | 'subsidiaryId';
  /** Restrict this config to specific subsidiaries. Omit to include in every subsidiary. */
  subsidiaryIds?: string[];
  /**
   * When no scopeField is set, the query otherwise falls back to limit(N) which returns an
   * arbitrary window of docs. Set fullScan=true for small, un-scoped collections (customers,
   * customerContacts) where we'd rather fetch everything and filter client-side.
   */
  fullScan?: boolean;
  /**
   * Include this config in the client-side SearchIndexManager (V2). Default true.
   * Set false for collections too large or too low-value to hold in memory.
   */
  indexable?: boolean;
  /**
   * Card component key for the V2 palette. Defaults to `type`. Override when a config
   * should render using a different card (e.g. multiple configs sharing CustomerCard).
   */
  cardKind?: string;
}

export const SEARCH_CONFIGS: SearchConfig[] = [
  // ----- HR Central (corporate, all subsidiaries) -----
  {
    module: 'hr_central',
    type: 'employee',
    label: 'Employees',
    collection: 'employees',
    searchFields: ['firstName', 'lastName', 'email', 'employeeId'],
    displayField: 'firstName',
    subtitleField: 'department',
    icon: 'User',
    urlTemplate: '/hr/employees/{id}',
    scopeField: 'subsidiaryId',
  },
  {
    module: 'hr_central',
    type: 'department',
    label: 'Departments',
    collection: 'departments',
    searchFields: ['name', 'code'],
    displayField: 'name',
    subtitleField: 'parentDepartment',
    icon: 'Building',
    urlTemplate: '/hr/org-structure',
    scopeField: 'subsidiaryId',
  },

  // ----- CEO Strategy (corporate) -----
  {
    module: 'ceo_strategy',
    type: 'okr',
    label: 'OKRs',
    collection: 'strategy_okrs',
    searchFields: ['title', 'owner'],
    displayField: 'title',
    subtitleField: 'period',
    icon: 'Target',
    urlTemplate: '/strategy/okrs/{id}',
    scopeField: 'subsidiaryId',
  },
  {
    module: 'ceo_strategy',
    type: 'strategy_document',
    label: 'Strategy Documents',
    collection: 'strategy_documents',
    searchFields: ['title', 'type'],
    displayField: 'title',
    subtitleField: 'version',
    icon: 'FileText',
    urlTemplate: '/strategy/plans',
    scopeField: 'subsidiaryId',
  },

  // ----- Finance (corporate) -----
  {
    module: 'financial',
    type: 'budget',
    label: 'Budgets',
    collection: 'budgets',
    searchFields: ['name', 'department'],
    displayField: 'name',
    subtitleField: 'fiscalYear',
    icon: 'PieChart',
    urlTemplate: '/finance/budgets/{id}',
    scopeField: 'organizationId',
  },
  {
    module: 'financial',
    type: 'account',
    label: 'Accounts',
    collection: 'chart_of_accounts',
    searchFields: ['name', 'code', 'number'],
    displayField: 'name',
    subtitleField: 'code',
    icon: 'BookOpen',
    urlTemplate: '/finance/accounts/{id}',
    scopeField: 'organizationId',
  },

  // ----- Capital (corporate) -----
  {
    module: 'capital_hub',
    type: 'capital_application',
    label: 'Capital Applications',
    collection: 'capital_applications',
    searchFields: ['provider', 'productType', 'stage'],
    displayField: 'provider',
    subtitleField: 'stage',
    icon: 'FileText',
    urlTemplate: '/capital/applications/{id}',
    scopeField: 'organizationId',
  },
  {
    module: 'capital_hub',
    type: 'capital_facility',
    label: 'Capital Facilities',
    collection: 'capital_facilities',
    searchFields: ['facilityName', 'provider', 'productType'],
    displayField: 'facilityName',
    subtitleField: 'provider',
    icon: 'Building',
    urlTemplate: '/capital/facilities/{id}',
    scopeField: 'organizationId',
  },

  // ----- Market Intelligence (corporate) -----
  {
    module: 'market_intelligence',
    type: 'competitor',
    label: 'Competitors',
    collection: 'competitors',
    searchFields: ['name', 'industry'],
    displayField: 'name',
    subtitleField: 'industry',
    icon: 'Users',
    urlTemplate: '/market-intel/competitors/{id}',
    scopeField: 'organizationId',
  },
  {
    module: 'market_intelligence',
    type: 'insight',
    label: 'Insights',
    collection: 'market_intelligence_insights',
    searchFields: ['title', 'type'],
    displayField: 'title',
    subtitleField: 'type',
    icon: 'Lightbulb',
    urlTemplate: '/market-intel/insights',
    scopeField: 'organizationId',
  },

  // ----- Compliance (corporate) -----
  {
    module: 'compliance' as ModuleId,
    type: 'document',
    label: 'Compliance Documents',
    collection: 'documents',
    searchFields: ['title', 'name', 'type', 'category', 'tags'],
    displayField: 'title',
    subtitleField: 'category',
    icon: 'FileText',
    urlTemplate: '/compliance/documents',
    scopeField: 'organizationId',
  },

  // ----- Inventory (finishes) -----
  {
    module: 'inventory' as ModuleId,
    type: 'inventory_item',
    label: 'Inventory',
    collection: 'inventoryItems',
    searchFields: ['name', 'sku', 'description', 'classification', 'category'],
    displayField: 'name',
    subtitleField: 'sku',
    icon: 'Package',
    urlTemplate: '/inventory',
    subsidiaryIds: ['dawin-finishes'],
  },
  {
    module: 'inventory' as ModuleId,
    type: 'finish_library',
    label: 'Finish Library',
    collection: 'finishLibrary',
    searchFields: ['name', 'code', 'category', 'supplier'],
    displayField: 'name',
    subtitleField: 'category',
    icon: 'Palette',
    urlTemplate: '/inventory/finishes',
    scopeField: 'organizationId',
    subsidiaryIds: ['dawin-finishes'],
  },

  // ----- Sales Orders (finishes) -----
  {
    module: 'sales_orders' as ModuleId,
    type: 'sales_order',
    label: 'Sales Orders',
    collection: 'salesOrders',
    searchFields: ['orderNumber', 'customerName', 'status', 'title'],
    displayField: 'orderNumber',
    subtitleField: 'customerName',
    icon: 'ShoppingCart',
    urlTemplate: '/sales-orders/{id}',
    scopeField: 'subsidiaryId',
    subsidiaryIds: ['dawin-finishes'],
  },

  // ----- CRM (finishes) -----
  {
    module: 'crm' as ModuleId,
    type: 'crm_deal',
    label: 'Deals',
    collection: 'crmDeals',
    searchFields: ['title', 'customerName', 'stage', 'dealNumber'],
    displayField: 'title',
    subtitleField: 'customerName',
    icon: 'Briefcase',
    urlTemplate: '/crm/deals/{id}',
    scopeField: 'subsidiaryId',
    subsidiaryIds: ['dawin-finishes'],
  },
  {
    module: 'crm' as ModuleId,
    type: 'customer',
    label: 'Customers',
    collection: 'customers',
    searchFields: ['name', 'code', 'email', 'phone'],
    displayField: 'name',
    subtitleField: 'code',
    icon: 'Users',
    urlTemplate: '/customers/{id}',
    subsidiaryIds: ['dawin-finishes'],
    fullScan: true,
  },
  {
    module: 'customer_hub' as ModuleId,
    type: 'customer_contact',
    label: 'Customer Contacts',
    collection: 'customerContacts',
    searchFields: ['name', 'email', 'phone', 'role'],
    displayField: 'name',
    subtitleField: 'email',
    icon: 'User',
    urlTemplate: '/customers',
    subsidiaryIds: ['dawin-finishes'],
    fullScan: true,
  },

  // ----- Procurement (shared) -----
  {
    module: 'procurement' as ModuleId,
    type: 'purchase_order',
    label: 'Purchase Orders',
    collection: 'purchaseOrders',
    searchFields: ['poNumber', 'supplierName', 'status', 'reference'],
    displayField: 'poNumber',
    subtitleField: 'supplierName',
    icon: 'Truck',
    urlTemplate: '/procurement/orders/{id}',
  },

  // ----- Manufacturing (finishes) -----
  {
    module: 'manufacturing' as ModuleId,
    type: 'manufacturing_order',
    label: 'Manufacturing Orders',
    collection: 'manufacturingOrders',
    searchFields: ['moNumber', 'productName', 'status', 'orderNumber'],
    displayField: 'moNumber',
    subtitleField: 'productName',
    icon: 'Factory',
    urlTemplate: '/manufacturing/orders/{id}',
    scopeField: 'subsidiaryId',
    subsidiaryIds: ['dawin-finishes'],
  },

  // ----- Design Manager (finishes) -----
  {
    module: 'design_manager' as ModuleId,
    type: 'design_project',
    label: 'Design Projects',
    collection: 'designProjects',
    searchFields: ['name', 'clientName', 'status', 'projectCode'],
    displayField: 'name',
    subtitleField: 'clientName',
    icon: 'FolderKanban',
    urlTemplate: '/design/project/{id}',
    subsidiaryIds: ['dawin-finishes'],
  },

  // ----- Construction (finishes) -----
  {
    module: 'construction' as ModuleId,
    type: 'construction_order',
    label: 'Construction Orders',
    collection: 'constructionOrders',
    searchFields: ['orderNumber', 'projectName', 'status'],
    displayField: 'orderNumber',
    subtitleField: 'projectName',
    icon: 'HardHat',
    urlTemplate: '/construction/{id}',
    subsidiaryIds: ['dawin-finishes'],
  },
];

// ----------------------------------------------------------------------------
// KEYBOARD SHORTCUTS
// ----------------------------------------------------------------------------
export interface KeyboardShortcut {
  id: string;
  keys: string;
  description: string;
  action: string;
  global: boolean;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { id: 'global_search', keys: 'Ctrl+K', description: 'Open global search', action: 'openSearch', global: true },
  { id: 'global_search_alt', keys: 'Ctrl+/', description: 'Open global search (alternate)', action: 'openSearch', global: true },
  { id: 'deep_find', keys: 'Ctrl+Shift+F', description: 'Deep find across all modules', action: 'openDeepFind', global: true },
  { id: 'page_navigator', keys: 'Ctrl+P', description: 'Jump to page', action: 'openPageNavigator', global: true },
  { id: 'quick_search', keys: '/', description: 'Quick search (when not typing)', action: 'openSearch', global: true },
  { id: 'quick_actions', keys: 'Ctrl+Shift+A', description: 'Open quick actions', action: 'openQuickActions', global: true },
  { id: 'notifications', keys: 'Ctrl+Shift+N', description: 'Open notifications', action: 'openNotifications', global: true },
  { id: 'go_dashboard', keys: 'G D', description: 'Go to dashboard', action: 'navigate:/dashboard', global: true },
  { id: 'go_tasks', keys: 'G T', description: 'Go to tasks', action: 'navigate:/intelligence/tasks', global: true },
  { id: 'go_hr', keys: 'G H', description: 'Go to HR', action: 'navigate:/hr/employees', global: true },
  { id: 'go_strategy', keys: 'G S', description: 'Go to Strategy', action: 'navigate:/strategy/dashboard', global: true },
  { id: 'go_finance', keys: 'G F', description: 'Go to Finance', action: 'navigate:/finance/dashboard', global: true },
  { id: 'toggle_sidebar', keys: 'Ctrl+B', description: 'Toggle sidebar', action: 'toggleSidebar', global: true },
];
