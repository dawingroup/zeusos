/**
 * PROGRAM TEAM TYPES
 * 
 * Team roles, permissions, and member management for programs.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// TEAM ROLES
// ─────────────────────────────────────────────────────────────────

/**
 * Program team roles
 */
export type ProgramTeamRole =
  // Leadership
  | 'program_manager'
  | 'deputy_program_manager'
  // Technical
  | 'engineer'
  | 'quantity_surveyor'
  | 'architect'
  // Field
  | 'site_engineer'
  | 'clerk_of_works'
  | 'site_supervisor'
  // Finance
  | 'finance_officer'
  | 'accountant'
  // Procurement
  | 'procurement_officer'
  // M&E
  | 'monitoring_officer'
  | 'safeguards_officer'
  // Support
  | 'administrative_officer'
  | 'data_entry_clerk'
  // External
  | 'consultant'
  | 'observer';

/**
 * Team permissions
 */
export type TeamPermission =
  | 'view_projects'
  | 'create_projects'
  | 'edit_projects'
  | 'delete_projects'
  | 'view_payments'
  | 'create_payments'
  | 'approve_payments'
  | 'view_budget'
  | 'edit_budget'
  | 'view_documents'
  | 'upload_documents'
  | 'delete_documents'
  | 'view_team'
  | 'manage_team'
  | 'view_reports'
  | 'generate_reports'
  | 'view_matflow'
  | 'manage_matflow';

/**
 * Team role configuration
 */
export interface TeamRoleConfig {
  role: ProgramTeamRole;
  label: string;
  description: string;
  category: 'leadership' | 'technical' | 'field' | 'finance' | 'procurement' | 'mne' | 'support' | 'external';
  permissions: TeamPermission[];
  canApprovePayments: boolean;
  maxApprovalAmount?: number;
}

/**
 * Role configurations
 */
export const PROGRAM_TEAM_ROLES: Record<ProgramTeamRole, TeamRoleConfig> = {
  program_manager: {
    role: 'program_manager',
    label: 'Program Manager',
    description: 'Overall program leadership and oversight',
    category: 'leadership',
    permissions: [
      'view_projects', 'create_projects', 'edit_projects', 'delete_projects',
      'view_payments', 'create_payments', 'approve_payments',
      'view_budget', 'edit_budget',
      'view_documents', 'upload_documents', 'delete_documents',
      'view_team', 'manage_team',
      'view_reports', 'generate_reports',
      'view_matflow', 'manage_matflow',
    ],
    canApprovePayments: true,
  },
  deputy_program_manager: {
    role: 'deputy_program_manager',
    label: 'Deputy Program Manager',
    description: 'Supports program manager in oversight',
    category: 'leadership',
    permissions: [
      'view_projects', 'create_projects', 'edit_projects',
      'view_payments', 'create_payments', 'approve_payments',
      'view_budget', 'edit_budget',
      'view_documents', 'upload_documents',
      'view_team', 'manage_team',
      'view_reports', 'generate_reports',
      'view_matflow', 'manage_matflow',
    ],
    canApprovePayments: true,
  },
  engineer: {
    role: 'engineer',
    label: 'Engineer',
    description: 'Technical oversight and review',
    category: 'technical',
    permissions: [
      'view_projects', 'edit_projects',
      'view_payments',
      'view_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
      'view_matflow',
    ],
    canApprovePayments: false,
  },
  quantity_surveyor: {
    role: 'quantity_surveyor',
    label: 'Quantity Surveyor',
    description: 'Measurements, valuations, and cost control',
    category: 'technical',
    permissions: [
      'view_projects', 'edit_projects',
      'view_payments', 'create_payments',
      'view_budget', 'edit_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
      'view_matflow', 'manage_matflow',
    ],
    canApprovePayments: false,
  },
  architect: {
    role: 'architect',
    label: 'Architect',
    description: 'Design oversight and approvals',
    category: 'technical',
    permissions: [
      'view_projects',
      'view_payments',
      'view_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports',
    ],
    canApprovePayments: false,
  },
  site_engineer: {
    role: 'site_engineer',
    label: 'Site Engineer',
    description: 'On-site technical supervision',
    category: 'field',
    permissions: [
      'view_projects', 'edit_projects',
      'view_payments', 'create_payments',
      'view_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
      'view_matflow',
    ],
    canApprovePayments: false,
  },
  clerk_of_works: {
    role: 'clerk_of_works',
    label: 'Clerk of Works',
    description: 'Day-to-day site supervision',
    category: 'field',
    permissions: [
      'view_projects',
      'view_payments',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports',
      'view_matflow',
    ],
    canApprovePayments: false,
  },
  site_supervisor: {
    role: 'site_supervisor',
    label: 'Site Supervisor',
    description: 'General site supervision',
    category: 'field',
    permissions: [
      'view_projects',
      'view_documents', 'upload_documents',
      'view_team',
      'view_matflow',
    ],
    canApprovePayments: false,
  },
  finance_officer: {
    role: 'finance_officer',
    label: 'Finance Officer',
    description: 'Financial management and reporting',
    category: 'finance',
    permissions: [
      'view_projects',
      'view_payments', 'create_payments', 'approve_payments',
      'view_budget', 'edit_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
    ],
    canApprovePayments: true,
  },
  accountant: {
    role: 'accountant',
    label: 'Accountant',
    description: 'Day-to-day financial operations',
    category: 'finance',
    permissions: [
      'view_projects',
      'view_payments', 'create_payments',
      'view_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports',
    ],
    canApprovePayments: false,
  },
  procurement_officer: {
    role: 'procurement_officer',
    label: 'Procurement Officer',
    description: 'Procurement and contract management',
    category: 'procurement',
    permissions: [
      'view_projects',
      'view_payments', 'create_payments',
      'view_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
      'view_matflow', 'manage_matflow',
    ],
    canApprovePayments: false,
  },
  monitoring_officer: {
    role: 'monitoring_officer',
    label: 'M&E Officer',
    description: 'Monitoring and evaluation',
    category: 'mne',
    permissions: [
      'view_projects', 'edit_projects',
      'view_payments',
      'view_budget',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
      'view_matflow',
    ],
    canApprovePayments: false,
  },
  safeguards_officer: {
    role: 'safeguards_officer',
    label: 'Safeguards Officer',
    description: 'Environmental and social safeguards',
    category: 'mne',
    permissions: [
      'view_projects', 'edit_projects',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports', 'generate_reports',
    ],
    canApprovePayments: false,
  },
  administrative_officer: {
    role: 'administrative_officer',
    label: 'Administrative Officer',
    description: 'Administrative support',
    category: 'support',
    permissions: [
      'view_projects',
      'view_payments',
      'view_documents', 'upload_documents',
      'view_team',
      'view_reports',
    ],
    canApprovePayments: false,
  },
  data_entry_clerk: {
    role: 'data_entry_clerk',
    label: 'Data Entry Clerk',
    description: 'Data entry and record keeping',
    category: 'support',
    permissions: [
      'view_projects', 'edit_projects',
      'view_payments', 'create_payments',
      'view_documents', 'upload_documents',
      'view_reports',
    ],
    canApprovePayments: false,
  },
  consultant: {
    role: 'consultant',
    label: 'Consultant',
    description: 'External consultant with limited access',
    category: 'external',
    permissions: [
      'view_projects',
      'view_documents', 'upload_documents',
      'view_reports',
    ],
    canApprovePayments: false,
  },
  observer: {
    role: 'observer',
    label: 'Observer',
    description: 'Read-only access for monitoring',
    category: 'external',
    permissions: [
      'view_projects',
      'view_payments',
      'view_budget',
      'view_documents',
      'view_reports',
    ],
    canApprovePayments: false,
  },
};

// ─────────────────────────────────────────────────────────────────
// TEAM MEMBER
// ─────────────────────────────────────────────────────────────────

/**
 * Program team member
 */
export interface ProgramTeamMember {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  role: ProgramTeamRole;
  title?: string;
  assignedProjectIds: string[];
  isPrimary: boolean;
  isActive: boolean;
  additionalPermissions?: TeamPermission[];
  restrictedPermissions?: TeamPermission[];
  startDate: Timestamp;
  endDate?: Timestamp;
  notes?: string;
  addedBy: string;
  addedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get effective permissions for a team member
 */
export function getEffectivePermissions(member: ProgramTeamMember): TeamPermission[] {
  const roleConfig = PROGRAM_TEAM_ROLES[member.role];
  let permissions = [...roleConfig.permissions];
  
  if (member.additionalPermissions) {
    permissions = [...new Set([...permissions, ...member.additionalPermissions])];
  }
  
  if (member.restrictedPermissions) {
    permissions = permissions.filter(p => !member.restrictedPermissions!.includes(p));
  }
  
  return permissions;
}

/**
 * Check if team member has permission
 */
export function hasPermission(member: ProgramTeamMember, permission: TeamPermission): boolean {
  return getEffectivePermissions(member).includes(permission);
}

/**
 * Check if team member can approve payments
 */
export function canApprovePayments(member: ProgramTeamMember): boolean {
  const roleConfig = PROGRAM_TEAM_ROLES[member.role];
  return roleConfig.canApprovePayments && hasPermission(member, 'approve_payments');
}

/**
 * Get team members by role
 */
export function getTeamMembersByRole(
  team: ProgramTeamMember[],
  role: ProgramTeamRole
): ProgramTeamMember[] {
  return team.filter(m => m.role === role && m.isActive);
}

/**
 * Get team members by category
 */
export function getTeamMembersByCategory(
  team: ProgramTeamMember[],
  category: TeamRoleConfig['category']
): ProgramTeamMember[] {
  const rolesInCategory = Object.values(PROGRAM_TEAM_ROLES)
    .filter(config => config.category === category)
    .map(config => config.role);
  
  return team.filter(m => rolesInCategory.includes(m.role) && m.isActive);
}

/**
 * Get primary contact for role
 */
export function getPrimaryContact(
  team: ProgramTeamMember[],
  role: ProgramTeamRole
): ProgramTeamMember | undefined {
  return team.find(m => m.role === role && m.isPrimary && m.isActive);
}

/**
 * Get roles by category
 */
export function getRolesByCategory(
  category: TeamRoleConfig['category']
): ProgramTeamRole[] {
  return Object.values(PROGRAM_TEAM_ROLES)
    .filter(config => config.category === category)
    .map(config => config.role);
}

/**
 * Get role display info
 */
export function getRoleDisplayInfo(role: ProgramTeamRole): { label: string; category: string } {
  const config = PROGRAM_TEAM_ROLES[role];
  return {
    label: config.label,
    category: config.category,
  };
}

/**
 * Get all role categories
 */
export function getAllRoleCategories(): TeamRoleConfig['category'][] {
  return ['leadership', 'technical', 'field', 'finance', 'procurement', 'mne', 'support', 'external'];
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: TeamRoleConfig['category']): string {
  const names: Record<TeamRoleConfig['category'], string> = {
    leadership: 'Leadership',
    technical: 'Technical',
    field: 'Field Staff',
    finance: 'Finance',
    procurement: 'Procurement',
    mne: 'M&E',
    support: 'Support',
    external: 'External',
  };
  return names[category];
}
