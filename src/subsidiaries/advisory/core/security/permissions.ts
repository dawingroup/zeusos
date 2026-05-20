/**
 * PERMISSIONS.TS
 * Permission definitions and matrices for the Dawin Advisory Platform
 */

import { EngagementRole, ClientRole, FunderRole } from './roles';

/**
 * PERMISSION
 * Granular permissions
 */
export type Permission =
  // Engagement
  | 'engagement:read'
  | 'engagement:create'
  | 'engagement:update'
  | 'engagement:delete'
  | 'engagement:manage_team'
  
  // Funding
  | 'funding:read'
  | 'funding:create'
  | 'funding:update'
  | 'funding:approve_disbursement'
  
  // Programs/Projects (Delivery)
  | 'program:read'
  | 'program:create'
  | 'program:update'
  | 'project:read'
  | 'project:create'
  | 'project:update'
  | 'project:approve_payment'
  
  // Deals (Investment)
  | 'deal:read'
  | 'deal:create'
  | 'deal:update'
  | 'deal:approve'
  
  // Portfolios (Advisory)
  | 'portfolio:read'
  | 'portfolio:create'
  | 'portfolio:update'
  | 'portfolio:execute_trade'
  
  // Compliance
  | 'report:read'
  | 'report:submit'
  | 'report:approve'
  | 'covenant:read'
  | 'covenant:measure'
  
  // Approvals
  | 'approval:view_pending'
  | 'approval:approve'
  | 'approval:reject'
  
  // Documents
  | 'document:read'
  | 'document:upload'
  | 'document:delete'
  
  // Client/Funder (for external access)
  | 'client:read_own'
  | 'client:update_own'
  | 'funder:read_portfolio'
  | 'funder:approve_disbursement';

/**
 * PERMISSION CATEGORY
 */
export type PermissionCategory =
  | 'engagement'
  | 'funding'
  | 'delivery'
  | 'investment'
  | 'advisory'
  | 'compliance'
  | 'approvals'
  | 'documents'
  | 'external';

/**
 * Get permission category
 */
export function getPermissionCategory(permission: Permission): PermissionCategory {
  if (permission.startsWith('engagement:')) return 'engagement';
  if (permission.startsWith('funding:')) return 'funding';
  if (permission.startsWith('program:') || permission.startsWith('project:')) return 'delivery';
  if (permission.startsWith('deal:')) return 'investment';
  if (permission.startsWith('portfolio:')) return 'advisory';
  if (permission.startsWith('report:') || permission.startsWith('covenant:')) return 'compliance';
  if (permission.startsWith('approval:')) return 'approvals';
  if (permission.startsWith('document:')) return 'documents';
  return 'external';
}

/**
 * ENGAGEMENT ROLE PERMISSIONS
 */
export const ENGAGEMENT_ROLE_PERMISSIONS: Record<EngagementRole, Permission[]> = {
  engagement_owner: [
    'engagement:read', 'engagement:create', 'engagement:update', 'engagement:delete', 'engagement:manage_team',
    'funding:read', 'funding:create', 'funding:update', 'funding:approve_disbursement',
    'program:read', 'program:create', 'program:update',
    'project:read', 'project:create', 'project:update', 'project:approve_payment',
    'deal:read', 'deal:create', 'deal:update', 'deal:approve',
    'portfolio:read', 'portfolio:create', 'portfolio:update', 'portfolio:execute_trade',
    'report:read', 'report:submit', 'report:approve',
    'covenant:read', 'covenant:measure',
    'approval:view_pending', 'approval:approve', 'approval:reject',
    'document:read', 'document:upload', 'document:delete',
  ],
  
  engagement_lead: [
    'engagement:read', 'engagement:update', 'engagement:manage_team',
    'funding:read', 'funding:create', 'funding:update',
    'program:read', 'program:create', 'program:update',
    'project:read', 'project:create', 'project:update', 'project:approve_payment',
    'deal:read', 'deal:create', 'deal:update',
    'portfolio:read', 'portfolio:create', 'portfolio:update',
    'report:read', 'report:submit', 'report:approve',
    'covenant:read', 'covenant:measure',
    'approval:view_pending', 'approval:approve', 'approval:reject',
    'document:read', 'document:upload', 'document:delete',
  ],
  
  program_manager: [
    'engagement:read',
    'funding:read',
    'program:read', 'program:create', 'program:update',
    'project:read', 'project:create', 'project:update', 'project:approve_payment',
    'report:read', 'report:submit',
    'covenant:read', 'covenant:measure',
    'approval:view_pending', 'approval:approve',
    'document:read', 'document:upload',
  ],
  
  project_manager: [
    'engagement:read',
    'funding:read',
    'program:read',
    'project:read', 'project:create', 'project:update',
    'report:read', 'report:submit',
    'covenant:read',
    'approval:view_pending',
    'document:read', 'document:upload',
  ],
  
  site_manager: [
    'engagement:read',
    'project:read', 'project:update',
    'document:read', 'document:upload',
  ],
  
  quantity_surveyor: [
    'engagement:read',
    'project:read', 'project:update',
    'approval:view_pending',
    'document:read', 'document:upload',
  ],
  
  deal_lead: [
    'engagement:read',
    'funding:read',
    'deal:read', 'deal:create', 'deal:update', 'deal:approve',
    'report:read', 'report:submit',
    'covenant:read', 'covenant:measure',
    'approval:view_pending', 'approval:approve',
    'document:read', 'document:upload',
  ],
  
  portfolio_manager: [
    'engagement:read',
    'portfolio:read', 'portfolio:create', 'portfolio:update', 'portfolio:execute_trade',
    'report:read', 'report:submit',
    'approval:view_pending', 'approval:approve',
    'document:read', 'document:upload',
  ],
  
  finance_officer: [
    'engagement:read',
    'funding:read', 'funding:update',
    'project:read',
    'deal:read',
    'report:read', 'report:submit',
    'covenant:read', 'covenant:measure',
    'approval:view_pending',
    'document:read', 'document:upload',
  ],
  
  compliance_officer: [
    'engagement:read',
    'funding:read',
    'report:read', 'report:submit', 'report:approve',
    'covenant:read', 'covenant:measure',
    'approval:view_pending',
    'document:read', 'document:upload',
  ],
  
  team_member: [
    'engagement:read',
    'funding:read',
    'program:read',
    'project:read',
    'deal:read',
    'portfolio:read',
    'report:read',
    'covenant:read',
    'document:read', 'document:upload',
  ],
  
  viewer: [
    'engagement:read',
    'funding:read',
    'program:read',
    'project:read',
    'deal:read',
    'portfolio:read',
    'report:read',
    'covenant:read',
    'document:read',
  ],
};

/**
 * CLIENT ROLE PERMISSIONS
 */
export const CLIENT_ROLE_PERMISSIONS: Record<ClientRole, Permission[]> = {
  client_admin: [
    'client:read_own',
    'client:update_own',
    'engagement:read',
    'document:read',
    'document:upload',
    'report:read',
  ],
  
  client_authorized: [
    'client:read_own',
    'engagement:read',
    'document:read',
    'document:upload',
    'report:read',
    'approval:view_pending',
  ],
  
  client_user: [
    'client:read_own',
    'engagement:read',
    'document:read',
    'report:read',
  ],
  
  client_viewer: [
    'client:read_own',
    'engagement:read',
    'document:read',
  ],
};

/**
 * FUNDER ROLE PERMISSIONS
 */
export const FUNDER_ROLE_PERMISSIONS: Record<FunderRole, Permission[]> = {
  funder_admin: [
    'funder:read_portfolio',
    'funder:approve_disbursement',
    'engagement:read',
    'funding:read',
    'report:read',
    'covenant:read',
    'document:read',
  ],
  
  funder_officer: [
    'funder:read_portfolio',
    'funder:approve_disbursement',
    'engagement:read',
    'funding:read',
    'report:read',
    'covenant:read',
    'document:read',
  ],
  
  funder_viewer: [
    'funder:read_portfolio',
    'engagement:read',
    'funding:read',
    'report:read',
    'document:read',
  ],
};

/**
 * Check if engagement role has permission
 */
export function hasPermission(role: EngagementRole, permission: Permission): boolean {
  return ENGAGEMENT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if client role has permission
 */
export function clientHasPermission(role: ClientRole, permission: Permission): boolean {
  return CLIENT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if funder role has permission
 */
export function funderHasPermission(role: FunderRole, permission: Permission): boolean {
  return FUNDER_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for an engagement role
 */
export function getAllPermissions(role: EngagementRole): Permission[] {
  return ENGAGEMENT_ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for a client role
 */
export function getClientPermissions(role: ClientRole): Permission[] {
  return CLIENT_ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for a funder role
 */
export function getFunderPermissions(role: FunderRole): Permission[] {
  return FUNDER_ROLE_PERMISSIONS[role] || [];
}

/**
 * Get permission display name
 */
export function getPermissionDisplayName(permission: Permission): string {
  const parts = permission.split(':');
  const resource = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const action = parts[1].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${resource}: ${action}`;
}

/**
 * Group permissions by category
 */
export function groupPermissionsByCategory(permissions: Permission[]): Record<PermissionCategory, Permission[]> {
  const grouped: Record<PermissionCategory, Permission[]> = {
    engagement: [],
    funding: [],
    delivery: [],
    investment: [],
    advisory: [],
    compliance: [],
    approvals: [],
    documents: [],
    external: [],
  };
  
  for (const permission of permissions) {
    const category = getPermissionCategory(permission);
    grouped[category].push(permission);
  }
  
  return grouped;
}
