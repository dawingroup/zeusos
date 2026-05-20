/**
 * DawinOS Global Settings Types
 * Types for organization settings, user management, and access control
 */

import type { SubsidiaryModule } from '@/types/subsidiary';
import type { WorkshopProcessingRates } from '@/shared/types/processingSteps';
import type { PricingAssumptions } from '@/shared/types/pricingAssumptions';

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

/**
 * Optional overrides for PDFs and other printable branded documents.
 * Any field omitted falls back to subsidiary primary / secondary / accent colors.
 */
export interface DocumentBrandingPalette {
  /** Headings, footer links, company name fallback when no logo */
  primary?: string;
  /** Secondary chrome (gradients, Less prominent accents) */
  secondary?: string;
  /** Document title (e.g. RECEIPT), amounts, success / paid states */
  accent?: string;
  /** Borders, dividers, table outlines */
  border?: string;
  /** Muted labels (uppercase field labels, footer meta) */
  muted?: string;
  /** Background for amount / highlight callout box */
  highlightBg?: string;
  /** Alternating table row tint */
  tableAltBg?: string;
}

export interface SubsidiaryBranding {
  logoUrl?: string;
  logoLightUrl?: string;  // For dark backgrounds
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  /** Per-export overrides; merged with primaryColor / secondaryColor / accentColor when unset. */
  documentPalette?: DocumentBrandingPalette;
  tagline?: string;
  description?: string;
  website?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  };
  /** Contact + address used on letterheads, invoices, quotes for this subsidiary. */
  contact?: {
    address?: {
      street?: string;
      city?: string;
      country?: string;
      postalCode?: string;
    };
    email?: string;
    phone?: string;
  };
}

/** Platform-wide defaults that seed each user's PreferencesMenu on first login. */
export interface PlatformDefaults {
  theme?: 'light' | 'dark' | 'system';
  accent?: 'boysenberry' | 'goldenbell' | 'seafoam' | 'pesto';
  density?: 'dense' | 'balanced' | 'airy';
}

export interface OrganizationBranding {
  // Group-level branding
  groupLogo?: string;
  groupLogoLightUrl?: string;  // For dark backgrounds
  groupFaviconUrl?: string;
  groupPrimaryColor: string;
  groupSecondaryColor: string;

  /** Platform-wide UI defaults applied to new users (theme, accent, density). */
  platformDefaults?: PlatformDefaults;

  // Subsidiary-specific branding
  subsidiaries: {
    'dawin-group': SubsidiaryBranding;
    'dawin-finishes': SubsidiaryBranding;
    'dawin-advisory': SubsidiaryBranding;
    'dawin-capital': SubsidiaryBranding;
    'dawin-technology': SubsidiaryBranding;
  };
}

export interface OrganizationInfo {
  name: string;
  shortName: string;
  legalName?: string;
  taxId?: string;
  registrationNumber?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    country: string;
    postalCode?: string;
  };
}

export interface OrganizationSettings {
  id: string;
  info: OrganizationInfo;
  branding: OrganizationBranding;
  defaultCurrency: string;
  defaultLanguage: string;
  timezone: string;
  fiscalYearStart: number; // Month (1-12)

  // Workshop processing rates (planing, cutting, routing, edge banding)
  workshopProcessingRates?: WorkshopProcessingRates;

  // Pricing & optimization defaults (kerf, buffers, yields, min offcuts, default costs)
  pricingAssumptions?: PricingAssumptions;

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// USER & ACCESS CONTROL
// ============================================================================

export type GlobalRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface ModuleAccess {
  moduleId: SubsidiaryModule;
  hasAccess: boolean;
  role?: string; // Module-specific role (e.g., 'quantity_surveyor' for matflow)
  customPermissions?: string[];
}

export interface SubsidiaryAccess {
  subsidiaryId: string;
  hasAccess: boolean;
  modules: ModuleAccess[];
}

export interface DawinUser {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  photoUrl?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  
  // Global access
  globalRole: GlobalRole;
  isActive: boolean;
  
  // Subsidiary & module access
  subsidiaryAccess: SubsidiaryAccess[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  invitedBy?: string;
  invitedAt?: string;
}

export interface UserInvite {
  id: string;
  email: string;
  globalRole: GlobalRole;
  subsidiaryAccess: SubsidiaryAccess[];
  invitedBy: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  acceptedAt?: string;
}

// ============================================================================
// GLOBAL ROLE DEFINITIONS
// ============================================================================

export interface GlobalRoleDefinition {
  role: GlobalRole;
  name: string;
  description: string;
  permissions: GlobalPermission[];
}

export type GlobalPermission =
  | 'settings:view'
  | 'settings:edit'
  | 'users:view'
  | 'users:invite'
  | 'users:edit'
  | 'users:delete'
  | 'users:manage_roles'
  | 'subsidiaries:view'
  | 'subsidiaries:manage'
  | 'billing:view'
  | 'billing:manage'
  | 'audit:view';

export const GLOBAL_ROLE_DEFINITIONS: GlobalRoleDefinition[] = [
  {
    role: 'owner',
    name: 'Owner',
    description: 'Full access to all settings and features',
    permissions: [
      'settings:view', 'settings:edit',
      'users:view', 'users:invite', 'users:edit', 'users:delete', 'users:manage_roles',
      'subsidiaries:view', 'subsidiaries:manage',
      'billing:view', 'billing:manage',
      'audit:view',
    ],
  },
  {
    role: 'admin',
    name: 'Administrator',
    description: 'Manage users, settings, and subsidiaries',
    permissions: [
      'settings:view', 'settings:edit',
      'users:view', 'users:invite', 'users:edit', 'users:manage_roles',
      'subsidiaries:view', 'subsidiaries:manage',
      'billing:view',
      'audit:view',
    ],
  },
  {
    role: 'manager',
    name: 'Manager',
    description: 'Manage team members and view settings',
    permissions: [
      'settings:view',
      'users:view', 'users:invite',
      'subsidiaries:view',
      'audit:view',
    ],
  },
  {
    role: 'member',
    name: 'Member',
    description: 'Standard access to assigned modules',
    permissions: [
      'settings:view',
      'users:view',
      'subsidiaries:view',
    ],
  },
  {
    role: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'settings:view',
      'subsidiaries:view',
    ],
  },
];

export function getGlobalRoleDefinition(role: GlobalRole): GlobalRoleDefinition | undefined {
  return GLOBAL_ROLE_DEFINITIONS.find(r => r.role === role);
}

export function hasGlobalPermission(role: GlobalRole, permission: GlobalPermission): boolean {
  const definition = getGlobalRoleDefinition(role);
  return definition?.permissions.includes(permission) ?? false;
}

// ============================================================================
// MODULE FEATURE PERMISSIONS (Tab/Section-level access control)
// ============================================================================

export interface ModuleFeature {
  id: string;
  label: string;
  description: string;
  minimumRole?: GlobalRole; // Sensitivity tier default
}

/**
 * Registry of features (tabs/sections) within each module.
 * Used by:
 * - Admin UI to show feature toggles per module
 * - FeatureGuard to check feature-level access
 * - useModulePermission hook to derive hasFeature()
 *
 * Features are stored in DawinUser.subsidiaryAccess[].modules[].customPermissions[]
 */
export const MODULE_FEATURES: Record<string, ModuleFeature[]> = {
  finance: [
    { id: 'finance:analysis', label: 'Analysis', description: 'KPIs, profitability, cash flow, trends' },
    { id: 'finance:forecasting', label: 'Forecasting', description: 'Financial forecasting' },
    { id: 'finance:reports', label: 'Reports', description: 'Financial reports' },
    { id: 'finance:operations', label: 'Operations', description: 'Invoices, bills, budgets, expenses' },
    { id: 'finance:settings', label: 'Settings', description: 'Chart of accounts, integrations, QBO sync', minimumRole: 'admin' },
  ],
  hr: [
    { id: 'hr:employees', label: 'Employees', description: 'Employee list and details' },
    { id: 'hr:performance', label: 'Performance', description: 'Reviews, goals, competencies' },
    { id: 'hr:leave', label: 'Leave', description: 'Leave management' },
    { id: 'hr:payroll', label: 'Payroll', description: 'Payroll processing', minimumRole: 'admin' },
    { id: 'hr:org-structure', label: 'Organization', description: 'Org chart and structure', minimumRole: 'manager' },
  ],
  strategy: [
    { id: 'strategy:dashboard', label: 'Executive Dashboard', description: 'CEO overview' },
    { id: 'strategy:plans', label: 'Strategy Plans', description: 'Strategic plans and reviews' },
    { id: 'strategy:okrs', label: 'OKRs', description: 'Objectives and key results' },
    { id: 'strategy:kpis', label: 'KPIs', description: 'Key performance indicators' },
    { id: 'strategy:analytics', label: 'Analytics', description: 'Performance deep-dive' },
  ],
  crm: [
    { id: 'crm:pipeline', label: 'Pipeline', description: 'Sales pipeline view' },
    { id: 'crm:deals', label: 'Deals', description: 'Deal management' },
    { id: 'crm:projects', label: 'Project Tracker', description: 'Project tracking' },
    { id: 'crm:reports', label: 'Reports', description: 'CRM reports and analytics' },
  ],
  production: [
    { id: 'manufacturing:orders', label: 'Production Orders', description: 'Manufacturing orders' },
    { id: 'manufacturing:purchase-orders', label: 'Purchase Orders', description: 'Procurement' },
    { id: 'manufacturing:procurement', label: 'Procurement Queue', description: 'Procurement requests' },
  ],
  marketing: [
    { id: 'marketing:campaigns', label: 'Campaigns', description: 'Campaign management' },
    { id: 'marketing:calendar', label: 'Content Calendar', description: 'Content scheduling' },
    { id: 'marketing:analytics', label: 'Analytics', description: 'Marketing analytics' },
    { id: 'marketing:media', label: 'Media Library', description: 'Media assets' },
  ],
  capital: [
    { id: 'capital:dashboard', label: 'Dashboard', description: 'Capital overview' },
    { id: 'capital:needs', label: 'Capital Needs', description: 'Identify and track capital requirements' },
    { id: 'capital:products', label: 'Products', description: 'Available capital products catalog' },
    { id: 'capital:readiness', label: 'Readiness', description: 'Capital readiness assessment' },
    { id: 'capital:applications', label: 'Applications', description: 'Application pipeline tracking' },
    { id: 'capital:facilities', label: 'Facilities', description: 'Active facilities and repayments' },
  ],
  'intelligence-layer': [
    { id: 'ai:tasks', label: 'My Tasks', description: 'Employee task inbox' },
    { id: 'ai:team', label: 'Team Dashboard', description: 'Manager team overview', minimumRole: 'manager' },
    { id: 'ai:admin', label: 'Admin Console', description: 'System configuration', minimumRole: 'admin' },
  ],
  market_intelligence: [
    { id: 'market-intel:competitors', label: 'Competitors', description: 'Competitor tracking and analysis' },
    { id: 'market-intel:news', label: 'News Feed', description: 'Market news and updates' },
    { id: 'market-intel:analysis', label: 'Market Analysis', description: 'Market trends and data' },
    { id: 'market-intel:insights', label: 'Insights', description: 'Strategic market insights' },
    { id: 'market-intel:topics', label: 'Topic Tracking', description: 'Monitor trending topics' },
    { id: 'market-intel:social', label: 'Social Intelligence', description: 'Social media monitoring' },
  ],
};

/**
 * Get available features for a given module
 */
export function getModuleFeatures(moduleId: string): ModuleFeature[] {
  return MODULE_FEATURES[moduleId] ?? [];
}

// ============================================================================
// DOCUMENT TEMPLATES (Future)
// ============================================================================

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  moduleId: SubsidiaryModule;
  templateType: 'invoice' | 'quote' | 'report' | 'boq' | 'delivery_note' | 'custom';
  format: 'pdf' | 'xlsx' | 'docx';
  templateUrl: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}
