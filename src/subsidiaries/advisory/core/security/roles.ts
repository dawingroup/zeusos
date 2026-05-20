/**
 * ROLES.TS
 * Role definitions for the Dawin Advisory Platform
 */

/**
 * PLATFORM ROLE
 * System-wide roles
 */
export type PlatformRole =
  | 'super_admin'           // Full platform access
  | 'admin'                 // Platform administration
  | 'manager'               // Oversight role
  | 'staff'                 // Regular staff
  | 'external'              // External users (clients, funders)
  | 'viewer';               // Read-only access

/**
 * ENGAGEMENT ROLE
 * Role within a specific engagement
 */
export type EngagementRole =
  | 'engagement_owner'      // Full control of engagement
  | 'engagement_lead'       // Day-to-day leadership
  | 'program_manager'       // Delivery module lead
  | 'project_manager'       // Project-level lead
  | 'site_manager'          // Site-level operations
  | 'quantity_surveyor'     // QS functions
  | 'deal_lead'             // Investment module lead
  | 'portfolio_manager'     // Advisory module lead
  | 'finance_officer'       // Financial operations
  | 'compliance_officer'    // Compliance functions
  | 'team_member'           // General team member
  | 'viewer';               // Read-only

/**
 * CLIENT ROLE
 * Role for client portal access
 */
export type ClientRole =
  | 'client_admin'          // Client organization admin
  | 'client_authorized'     // Authorized signatory
  | 'client_user'           // Regular client user
  | 'client_viewer';        // Read-only client access

/**
 * FUNDER ROLE
 * Role for funder portal access
 */
export type FunderRole =
  | 'funder_admin'          // Funder organization admin
  | 'funder_officer'        // Program officer
  | 'funder_viewer';        // Read-only funder access

/**
 * CLIENT ASSOCIATION
 */
export interface ClientAssociation {
  clientId: string;
  role: ClientRole;
}

/**
 * FUNDER ASSOCIATION
 */
export interface FunderAssociation {
  funderId: string;
  role: FunderRole;
}

/**
 * USER PROFILE
 * User's role assignments
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  
  /** Platform-wide role */
  platformRole: PlatformRole;
  
  /** Engagement-specific roles */
  engagementRoles: Record<string, EngagementRole>;
  
  /** Client associations (for external users) */
  clientAssociations?: ClientAssociation[];
  
  /** Funder associations (for external users) */
  funderAssociations?: FunderAssociation[];
  
  /** Is active */
  isActive: boolean;
  
  /** Last login */
  lastLoginAt?: Date;
  
  /** Created at */
  createdAt?: Date;
  
  /** Updated at */
  updatedAt?: Date;
}

/**
 * ROLE HIERARCHY
 * Higher roles include lower role permissions
 */
export const ENGAGEMENT_ROLE_HIERARCHY: Record<EngagementRole, number> = {
  engagement_owner: 100,
  engagement_lead: 90,
  program_manager: 80,
  deal_lead: 80,
  portfolio_manager: 80,
  project_manager: 70,
  site_manager: 60,
  quantity_surveyor: 60,
  finance_officer: 60,
  compliance_officer: 60,
  team_member: 40,
  viewer: 10,
};

/**
 * PLATFORM ROLE HIERARCHY
 */
export const PLATFORM_ROLE_HIERARCHY: Record<PlatformRole, number> = {
  super_admin: 100,
  admin: 90,
  manager: 70,
  staff: 50,
  external: 20,
  viewer: 10,
};

/**
 * Check if role A has higher or equal access than role B
 */
export function hasEqualOrHigherRole(
  roleA: EngagementRole,
  roleB: EngagementRole
): boolean {
  return ENGAGEMENT_ROLE_HIERARCHY[roleA] >= ENGAGEMENT_ROLE_HIERARCHY[roleB];
}

/**
 * Check if platform role A has higher or equal access than role B
 */
export function hasEqualOrHigherPlatformRole(
  roleA: PlatformRole,
  roleB: PlatformRole
): boolean {
  return PLATFORM_ROLE_HIERARCHY[roleA] >= PLATFORM_ROLE_HIERARCHY[roleB];
}

/**
 * Get engagement role display name
 */
export function getEngagementRoleDisplayName(role: EngagementRole): string {
  const names: Record<EngagementRole, string> = {
    engagement_owner: 'Engagement Owner',
    engagement_lead: 'Engagement Lead',
    program_manager: 'Program Manager',
    project_manager: 'Project Manager',
    site_manager: 'Site Manager',
    quantity_surveyor: 'Quantity Surveyor',
    deal_lead: 'Deal Lead',
    portfolio_manager: 'Portfolio Manager',
    finance_officer: 'Finance Officer',
    compliance_officer: 'Compliance Officer',
    team_member: 'Team Member',
    viewer: 'Viewer',
  };
  return names[role];
}

/**
 * Get platform role display name
 */
export function getPlatformRoleDisplayName(role: PlatformRole): string {
  const names: Record<PlatformRole, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Manager',
    staff: 'Staff',
    external: 'External',
    viewer: 'Viewer',
  };
  return names[role];
}

/**
 * Get client role display name
 */
export function getClientRoleDisplayName(role: ClientRole): string {
  const names: Record<ClientRole, string> = {
    client_admin: 'Client Admin',
    client_authorized: 'Authorized Signatory',
    client_user: 'Client User',
    client_viewer: 'Client Viewer',
  };
  return names[role];
}

/**
 * Get funder role display name
 */
export function getFunderRoleDisplayName(role: FunderRole): string {
  const names: Record<FunderRole, string> = {
    funder_admin: 'Funder Admin',
    funder_officer: 'Program Officer',
    funder_viewer: 'Funder Viewer',
  };
  return names[role];
}

/**
 * Check if user is platform admin
 */
export function isPlatformAdmin(profile: UserProfile): boolean {
  return ['super_admin', 'admin'].includes(profile.platformRole);
}

/**
 * Check if user is platform staff
 */
export function isPlatformStaff(profile: UserProfile): boolean {
  return ['super_admin', 'admin', 'manager', 'staff'].includes(profile.platformRole);
}

/**
 * Check if user has engagement access
 */
export function hasEngagementAccess(profile: UserProfile, engagementId: string): boolean {
  if (isPlatformAdmin(profile)) return true;
  return engagementId in profile.engagementRoles;
}

/**
 * Get user's role in engagement
 */
export function getUserEngagementRole(
  profile: UserProfile, 
  engagementId: string
): EngagementRole | null {
  return profile.engagementRoles[engagementId] || null;
}

/**
 * Create empty user profile
 */
export function createEmptyUserProfile(
  uid: string,
  email: string,
  displayName: string
): UserProfile {
  return {
    uid,
    email,
    displayName,
    platformRole: 'viewer',
    engagementRoles: {},
    isActive: true,
  };
}
