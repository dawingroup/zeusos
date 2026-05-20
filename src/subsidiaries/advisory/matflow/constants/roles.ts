/**
 * MatFlow Role Definitions
 * Defines the capabilities for each predefined role
 */

import type { MatFlowCapability } from '../types';

export type MatFlowRole = 'quantity_surveyor' | 'site_engineer' | 'project_manager' | 'procurement_officer' | 'viewer';

export interface RoleDefinition {
  role: MatFlowRole;
  name: string;
  description: string;
  capabilities: MatFlowCapability[];
}

export const MATFLOW_ROLES: RoleDefinition[] = [
  {
    role: 'quantity_surveyor',
    name: 'Quantity Surveyor',
    description: 'Full access to BOQ management, formulas, and approvals',
    capabilities: [
      'boq:view', 'boq:create', 'boq:edit', 'boq:delete', 'boq:approve', 'boq:import',
      'procurement:view', 'procurement:create', 'procurement:edit',
      'project:view', 'project:edit',
      'formula:view', 'formula:manage',
      'reports:view', 'reports:export',
    ],
  },
  {
    role: 'site_engineer',
    name: 'Site Engineer',
    description: 'Procurement logging and BOQ viewing',
    capabilities: [
      'boq:view',
      'procurement:view', 'procurement:create', 'procurement:edit',
      'project:view',
      'formula:view',
      'reports:view',
    ],
  },
  {
    role: 'project_manager',
    name: 'Project Manager',
    description: 'Oversight, approvals, and reporting access',
    capabilities: [
      'boq:view', 'boq:approve',
      'procurement:view',
      'project:view', 'project:edit',
      'formula:view',
      'reports:view', 'reports:export',
    ],
  },
  {
    role: 'procurement_officer',
    name: 'Procurement Officer',
    description: 'Procurement management and material ordering',
    capabilities: [
      'boq:view',
      'procurement:view', 'procurement:create', 'procurement:edit',
      'project:view',
      'formula:view',
      'reports:view',
    ],
  },
  {
    role: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to project data',
    capabilities: [
      'boq:view',
      'procurement:view',
      'project:view',
      'formula:view',
      'reports:view',
    ],
  },
];

/**
 * Get role definition by role key
 */
export function getRoleDefinition(role: MatFlowRole): RoleDefinition | undefined {
  return MATFLOW_ROLES.find(r => r.role === role);
}

/**
 * Get capabilities for a role
 */
export function getRoleCapabilities(role: MatFlowRole): MatFlowCapability[] {
  const definition = getRoleDefinition(role);
  return definition?.capabilities || [];
}

/**
 * Format role for display
 */
export function formatRoleName(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Role color mapping for badges
 */
export const ROLE_COLORS: Record<MatFlowRole, string> = {
  quantity_surveyor: 'bg-blue-100 text-blue-800',
  site_engineer: 'bg-green-100 text-green-800',
  project_manager: 'bg-purple-100 text-purple-800',
  procurement_officer: 'bg-orange-100 text-orange-800',
  viewer: 'bg-gray-100 text-gray-800',
};
