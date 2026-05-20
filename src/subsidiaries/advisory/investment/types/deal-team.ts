/**
 * Deal team structure and roles
 */

export interface DealTeam {
  dealLead: TeamMember;
  members: TeamMember[];
  externalAdvisors?: ExternalTeamMember[];
}

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: DealTeamRole;
  responsibilities?: string[];
  allocation?: number;        // Percentage of time allocated
  joinedAt: Date;
  leftAt?: Date;
}

export type DealTeamRole =
  | 'deal_lead'
  | 'associate'
  | 'analyst'
  | 'legal_counsel'
  | 'financial_analyst'
  | 'technical_advisor'
  | 'investment_committee'
  | 'observer';

export interface ExternalTeamMember {
  name: string;
  firm: string;
  role: ExternalAdvisorRole;
  email?: string;
  phone?: string;
  scope?: string;
  feeArrangement?: string;
}

export type ExternalAdvisorRole =
  | 'legal_counsel'
  | 'financial_advisor'
  | 'technical_advisor'
  | 'tax_advisor'
  | 'environmental_consultant'
  | 'insurance_advisor'
  | 'valuation_expert'
  | 'other';

// Permissions by role
export const DEAL_ROLE_PERMISSIONS: Record<DealTeamRole, DealPermission[]> = {
  deal_lead: ['view', 'edit', 'approve', 'delete', 'manage_team', 'change_stage'],
  associate: ['view', 'edit', 'approve'],
  analyst: ['view', 'edit'],
  legal_counsel: ['view', 'edit'],
  financial_analyst: ['view', 'edit'],
  technical_advisor: ['view', 'edit'],
  investment_committee: ['view', 'approve', 'change_stage'],
  observer: ['view'],
};

export type DealPermission =
  | 'view'
  | 'edit'
  | 'approve'
  | 'delete'
  | 'manage_team'
  | 'change_stage';

// Helper to check if role has permission
export function hasPermission(role: DealTeamRole, permission: DealPermission): boolean {
  return DEAL_ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

// Get display name for role
export function getDealRoleDisplayName(role: DealTeamRole): string {
  const names: Record<DealTeamRole, string> = {
    deal_lead: 'Deal Lead',
    associate: 'Associate',
    analyst: 'Analyst',
    legal_counsel: 'Legal Counsel',
    financial_analyst: 'Financial Analyst',
    technical_advisor: 'Technical Advisor',
    investment_committee: 'Investment Committee',
    observer: 'Observer',
  };
  return names[role] || role;
}

// Get display name for external advisor role
export function getExternalRoleDisplayName(role: ExternalAdvisorRole): string {
  const names: Record<ExternalAdvisorRole, string> = {
    legal_counsel: 'Legal Counsel',
    financial_advisor: 'Financial Advisor',
    technical_advisor: 'Technical Advisor',
    tax_advisor: 'Tax Advisor',
    environmental_consultant: 'Environmental Consultant',
    insurance_advisor: 'Insurance Advisor',
    valuation_expert: 'Valuation Expert',
    other: 'Other',
  };
  return names[role] || role;
}
