import { StakeholderRef } from './stakeholder';
import { EngagementDomain } from './engagement-domain';

/**
 * TEAM ROLE
 * Roles within an engagement team
 */
export type TeamRole =
  // Leadership
  | 'engagement_lead'
  | 'engagement_director'
  
  // Delivery
  | 'program_manager'
  | 'project_manager'
  | 'site_manager'
  | 'quantity_surveyor'
  | 'site_engineer'
  
  // Investment
  | 'deal_lead'
  | 'investment_analyst'
  | 'portfolio_manager'
  
  // Advisory
  | 'relationship_manager'
  | 'wealth_advisor'
  | 'research_analyst'
  
  // Support
  | 'finance_officer'
  | 'compliance_officer'
  | 'legal_counsel'
  | 'admin_support';

/**
 * TEAM MEMBER
 */
export interface TeamMember {
  /** User ID */
  userId: string;
  
  /** Display name */
  name: string;
  
  /** Email */
  email: string;
  
  /** Role in engagement */
  role: TeamRole;
  
  /** Allocation percentage (0-100) */
  allocation: number;
  
  /** Start date on engagement */
  startDate: Date;
  
  /** End date (if rotated off) */
  endDate?: Date;
  
  /** Is currently active */
  isActive: boolean;
}

/**
 * TEAM ASSIGNMENT
 * Full team structure for an engagement
 */
export interface TeamAssignment {
  /** Engagement lead (accountable) */
  leadId: string;
  
  /** Lead name (denormalized) */
  leadName: string;
  
  /** Lead email (denormalized) */
  leadEmail: string;
  
  /** Primary delivery team */
  members: TeamMember[];
  
  /** External advisors/consultants */
  externals: StakeholderRef[];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: TeamRole): string {
  const names: Record<TeamRole, string> = {
    engagement_lead: 'Engagement Lead',
    engagement_director: 'Engagement Director',
    program_manager: 'Program Manager',
    project_manager: 'Project Manager',
    site_manager: 'Site Manager',
    quantity_surveyor: 'Quantity Surveyor',
    site_engineer: 'Site Engineer',
    deal_lead: 'Deal Lead',
    investment_analyst: 'Investment Analyst',
    portfolio_manager: 'Portfolio Manager',
    relationship_manager: 'Relationship Manager',
    wealth_advisor: 'Wealth Advisor',
    research_analyst: 'Research Analyst',
    finance_officer: 'Finance Officer',
    compliance_officer: 'Compliance Officer',
    legal_counsel: 'Legal Counsel',
    admin_support: 'Admin Support',
  };
  return names[role];
}

/**
 * Get role abbreviation
 */
export function getRoleAbbreviation(role: TeamRole): string {
  const abbreviations: Record<TeamRole, string> = {
    engagement_lead: 'EL',
    engagement_director: 'ED',
    program_manager: 'PM',
    project_manager: 'PjM',
    site_manager: 'SM',
    quantity_surveyor: 'QS',
    site_engineer: 'SE',
    deal_lead: 'DL',
    investment_analyst: 'IA',
    portfolio_manager: 'PoM',
    relationship_manager: 'RM',
    wealth_advisor: 'WA',
    research_analyst: 'RA',
    finance_officer: 'FO',
    compliance_officer: 'CO',
    legal_counsel: 'LC',
    admin_support: 'AS',
  };
  return abbreviations[role];
}

/**
 * Base roles applicable to all domains
 */
const BASE_ROLES: TeamRole[] = [
  'engagement_lead',
  'engagement_director',
  'finance_officer',
  'compliance_officer',
  'admin_support',
];

/**
 * Get roles applicable to a domain
 */
export function getRolesForDomain(domain: EngagementDomain): TeamRole[] {
  const domainRoles: Record<EngagementDomain, TeamRole[]> = {
    infrastructure_delivery: [
      'program_manager',
      'project_manager',
      'site_manager',
      'quantity_surveyor',
      'site_engineer',
    ],
    infrastructure_investment: [
      'deal_lead',
      'investment_analyst',
      'portfolio_manager',
      'legal_counsel',
    ],
    investment_advisory: [
      'relationship_manager',
      'wealth_advisor',
      'portfolio_manager',
      'research_analyst',
    ],
    transaction_advisory: [
      'deal_lead',
      'investment_analyst',
      'legal_counsel',
    ],
    strategy_consulting: [
      'research_analyst',
    ],
  };
  
  return [...BASE_ROLES, ...domainRoles[domain]];
}

/**
 * Check if role is a leadership role
 */
export function isLeadershipRole(role: TeamRole): boolean {
  return ['engagement_lead', 'engagement_director'].includes(role);
}

/**
 * Get active team members
 */
export function getActiveMembers(team: TeamAssignment): TeamMember[] {
  return team.members.filter(m => m.isActive);
}

/**
 * Get total team allocation
 */
export function getTotalAllocation(team: TeamAssignment): number {
  return team.members
    .filter(m => m.isActive)
    .reduce((sum, m) => sum + m.allocation, 0);
}

/**
 * Find team member by role
 */
export function findMemberByRole(team: TeamAssignment, role: TeamRole): TeamMember | undefined {
  return team.members.find(m => m.role === role && m.isActive);
}

/**
 * Create empty team assignment
 */
export function createEmptyTeam(leadId: string, leadName: string, leadEmail: string): TeamAssignment {
  return {
    leadId,
    leadName,
    leadEmail,
    members: [
      {
        userId: leadId,
        name: leadName,
        email: leadEmail,
        role: 'engagement_lead',
        allocation: 100,
        startDate: new Date(),
        isActive: true,
      },
    ],
    externals: [],
  };
}
