/**
 * Navigation Configuration
 * Defines navigation structure for the application
 */

import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  TrendingUp,
  PieChart,
  Package,
  Bot,
  Settings,
  UserCircle,
  Bell,
  Shield,
  Activity,
  FileText,
  HardHat,
  Receipt,
  Kanban,
  Scale,
  Wallet,
  FolderOpen,
  Boxes,
  ShoppingCart,
  Truck,
  LucideIcon,
  Wrench,
  Layers,
  Rocket,
  Scissors,
  Sparkles,
  Bug,
  DollarSign,
  Target,
  GraduationCap,
  Calendar,
  Brain,
  Globe,
  Newspaper,
  BarChart3,
  Lightbulb,
  Megaphone,
  MessageSquare,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  module?: string;
  roles?: string[];
  children?: NavItem[];
  badge?: number | string;
}

// ============================================================================
// DAWIN FINISHES NAVIGATION
// ============================================================================

export const finishesNavItems: NavItem[] = [
  {
    id: 'finishes-dashboard',
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    id: 'clipper',
    label: 'Clip Library',
    href: '/clipper',
    icon: Sparkles,
  },
  {
    id: 'design',
    label: 'Design Manager',
    href: '/design',
    icon: FolderOpen,
    children: [
      { id: 'design-dashboard', label: 'Projects', href: '/design', icon: FolderOpen },
      { id: 'design-materials', label: 'Materials', href: '/design/materials', icon: Boxes },
      { id: 'design-features', label: 'Features', href: '/design/features', icon: Layers },
    ],
  },
  {
    id: 'cutlist',
    label: 'Cutlist',
    href: '/cutlist',
    icon: Scissors,
  },
  {
    id: 'fulfillment',
    label: 'Fulfillment',
    href: '/fulfillment',
    icon: Truck,
  },
  {
    id: 'customers',
    label: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    id: 'marketing',
    label: 'Marketing Hub',
    href: '/marketing',
    icon: Megaphone,
    children: [
      { id: 'marketing-dashboard', label: 'Dashboard', href: '/marketing', icon: LayoutDashboard },
      { id: 'marketing-campaigns', label: 'Campaigns', href: '/marketing/campaigns', icon: Megaphone },
      { id: 'marketing-calendar', label: 'Calendar', href: '/marketing/calendar', icon: Calendar },
      { id: 'marketing-templates', label: 'Templates', href: '/marketing/templates', icon: MessageSquare },
      { id: 'marketing-analytics', label: 'Analytics', href: '/marketing/analytics', icon: BarChart3 },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    href: '/assets',
    icon: Wrench,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    icon: Package,
  },
  {
    id: 'launch-pipeline',
    label: 'Launch Pipeline',
    href: '/launch-pipeline',
    icon: Rocket,
    children: [
      { id: 'launch-dashboard', label: 'Pipeline', href: '/launch-pipeline', icon: Kanban },
      { id: 'launch-audit', label: 'Audit', href: '/launch-pipeline/audit', icon: Activity },
    ],
  },
  {
    id: 'hr',
    label: 'HR Central',
    href: '/hr',
    icon: Users,
    children: [
      { id: 'hr-dashboard', label: 'Dashboard', href: '/hr', icon: LayoutDashboard },
      { id: 'hr-employees', label: 'Employees', href: '/hr/employees', icon: Users },
      { id: 'hr-leave', label: 'Leave Management', href: '/hr/leave', icon: Calendar },
      { id: 'hr-payroll', label: 'Payroll', href: '/hr/payroll', icon: DollarSign },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    href: '/finance',
    icon: DollarSign,
    children: [
      { id: 'finance-dashboard', label: 'Dashboard', href: '/finance', icon: LayoutDashboard },
      { id: 'finance-budgets', label: 'Budgets', href: '/finance/budgets', icon: Wallet },
      { id: 'finance-expenses', label: 'Expenses', href: '/finance/expenses', icon: Receipt },
      { id: 'finance-reports', label: 'Reports', href: '/finance/reports', icon: PieChart },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    href: '/performance',
    icon: Target,
    children: [
      { id: 'performance-dashboard', label: 'Dashboard', href: '/performance', icon: LayoutDashboard },
      { id: 'performance-goals', label: 'Goals', href: '/performance/goals', icon: Target },
      { id: 'performance-reviews', label: 'Reviews', href: '/performance/reviews', icon: FileText },
      { id: 'performance-competencies', label: 'Competencies', href: '/performance/competencies', icon: Brain },
      { id: 'performance-development', label: 'Development', href: '/performance/development', icon: GraduationCap },
    ],
  },
  {
    id: 'capital',
    label: 'Capital Hub',
    href: '/capital',
    icon: TrendingUp,
    children: [
      { id: 'capital-dashboard', label: 'Dashboard', href: '/capital/dashboard', icon: LayoutDashboard },
      { id: 'capital-needs', label: 'Capital Needs', href: '/capital/needs', icon: TrendingUp },
      { id: 'capital-products', label: 'Products', href: '/capital/products', icon: Briefcase },
      { id: 'capital-readiness', label: 'Readiness', href: '/capital/readiness', icon: Scale },
      { id: 'capital-applications', label: 'Applications', href: '/capital/applications', icon: FileText },
      { id: 'capital-facilities', label: 'Facilities', href: '/capital/facilities', icon: PieChart },
    ],
  },
  {
    id: 'market-intel',
    label: 'Market Intelligence',
    href: '/market-intel',
    icon: Globe,
    children: [
      { id: 'market-intel-dashboard', label: 'Dashboard', href: '/market-intel', icon: LayoutDashboard },
      { id: 'market-intel-competitors', label: 'Competitors', href: '/market-intel/competitors', icon: Building2 },
      { id: 'market-intel-news', label: 'News Feed', href: '/market-intel/news', icon: Newspaper },
      { id: 'market-intel-market', label: 'Market Analysis', href: '/market-intel/market', icon: BarChart3 },
      { id: 'market-intel-insights', label: 'AI Insights', href: '/market-intel/insights', icon: Lightbulb },
    ],
  },
  {
    id: 'ai-intelligence',
    label: 'AI Intelligence',
    href: '/ai',
    icon: Brain,
  },
];

// ============================================================================
// DAWIN ADVISORY NAVIGATION
// ============================================================================

export const advisoryNavItems: NavItem[] = [
  {
    id: 'advisory-home',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'engagements',
    label: 'Engagements',
    href: '/engagements',
    icon: Briefcase,
  },
  {
    id: 'clients',
    label: 'Clients',
    href: '/clients',
    icon: Building2,
  },
];

// Legacy: Keep for backward compatibility
export const mainNavItems: NavItem[] = finishesNavItems;

export const moduleNavItems: NavItem[] = [
  {
    id: 'advisory',
    label: 'Zeus Group',
    href: '/advisory',
    icon: PieChart,
    module: 'investment_advisory',
    children: [
      { id: 'advisory-dashboard', label: 'Dashboard', href: '/advisory', icon: LayoutDashboard },
      { id: 'advisory-investment', label: 'Investment', href: '/advisory/investment', icon: TrendingUp },
      { id: 'advisory-matflow', label: 'MatFlow', href: '/advisory/matflow', icon: Package },
      { id: 'advisory-delivery', label: 'Delivery', href: '/advisory/delivery', icon: HardHat },
    ],
  },
  {
    id: 'delivery',
    label: 'Infrastructure Delivery',
    href: '/advisory/delivery',
    icon: HardHat,
    module: 'infrastructure_delivery',
    children: [
      { id: 'delivery-dashboard', label: 'Dashboard', href: '/advisory/delivery', icon: LayoutDashboard },
      { id: 'programs', label: 'Programs', href: '/advisory/delivery/programs', icon: FolderOpen },
      { id: 'projects', label: 'Projects', href: '/advisory/delivery/projects', icon: FileText },
    ],
  },
  {
    id: 'investment',
    label: 'Investment',
    href: '/advisory/investment',
    icon: TrendingUp,
    module: 'infrastructure_investment',
    children: [
      { id: 'investment-dashboard', label: 'Dashboard', href: '/advisory/investment', icon: LayoutDashboard },
      { id: 'pipeline', label: 'Pipeline', href: '/advisory/investment/pipeline', icon: Kanban },
      { id: 'deals', label: 'Deal List', href: '/advisory/investment/deals', icon: FileText },
      { id: 'reports', label: 'Reports', href: '/advisory/investment/reports', icon: PieChart },
    ],
  },
  {
    id: 'matflow',
    label: 'MatFlow',
    href: '/advisory/matflow',
    icon: Package,
    module: 'matflow',
    children: [
      { id: 'matflow-dashboard', label: 'Dashboard', href: '/advisory/matflow', icon: LayoutDashboard },
      { id: 'matflow-projects', label: 'Projects', href: '/advisory/matflow/projects', icon: FolderOpen },
      { id: 'boq', label: 'Bills of Quantities', href: '/advisory/matflow/boq', icon: FileText },
      { id: 'procurement', label: 'Procurement', href: '/advisory/matflow/procurement', icon: ShoppingCart },
      { id: 'suppliers', label: 'Suppliers', href: '/advisory/matflow/suppliers', icon: Truck },
      { id: 'reports', label: 'Reports', href: '/advisory/matflow/reports', icon: PieChart },
      { id: 'settings', label: 'Settings', href: '/advisory/matflow/settings', icon: Settings },
    ],
  },
  {
    id: 'market-intelligence',
    label: 'Market Intelligence',
    href: '/market-intelligence',
    icon: TrendingUp,
    module: 'market_intelligence',
    children: [
      { id: 'mi-dashboard', label: 'Dashboard', href: '/market-intelligence', icon: LayoutDashboard },
      { id: 'mi-insights', label: 'Insights', href: '/market-intelligence/insights', icon: FileText },
      { id: 'mi-reports', label: 'Reports', href: '/market-intelligence/reports', icon: PieChart },
      { id: 'mi-analytics', label: 'Analytics', href: '/market-intelligence/analytics', icon: Activity },
    ],
  },
];

export const utilityNavItems: NavItem[] = [
  {
    id: 'assistant',
    label: 'AI Assistant',
    href: '/assistant',
    icon: Bot,
  },
];

export const adminNavItems: NavItem[] = [
  {
    id: 'admin',
    label: 'Administration',
    href: '/admin',
    icon: Settings,
    roles: ['admin', 'super_admin'],
    children: [
      { id: 'admin-dashboard', label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { id: 'users', label: 'User Management', href: '/admin/users', icon: Users },
      { id: 'roles', label: 'Role Management', href: '/admin/roles', icon: Shield },
      { id: 'migration', label: 'Data Migration', href: '/admin/migration', icon: Activity },
      { id: 'audit-log', label: 'Audit Log', href: '/admin/audit-log', icon: FileText },
      { id: 'settings', label: 'System Settings', href: '/admin/settings', icon: Settings },
    ],
  },
  {
    id: 'testing',
    label: 'Testing Suite',
    href: '/test',
    icon: Bug,
    roles: ['admin', 'super_admin', 'developer'],
    children: [
      { id: 'test-dashboard', label: 'Test Dashboard', href: '/test', icon: LayoutDashboard },
      { id: 'test-intelligence', label: 'Intelligence Layer', href: '/test/intelligence', icon: Activity },
      { id: 'test-hr', label: 'HR Central', href: '/test/hr', icon: Users },
      { id: 'test-strategy', label: 'CEO Strategy', href: '/test/strategy', icon: TrendingUp },
      { id: 'test-finance', label: 'Financial Mgmt', href: '/test/finance', icon: Wallet },
    ],
  },
];

export const userNavItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: UserCircle,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/profile/notifications',
    icon: Bell,
  },
];
