/**
 * APPROVAL CHAIN BUILDER
 * 
 * Dynamically builds approval chains based on request type, amount, and funding sources.
 */

import { 
  ApprovalStep, 
  ApprovalType,
  ApprovalCondition,
} from '../../types/approval';
import { Engagement } from '../../types/engagement';
import { FundingSource } from '../../types/funding';
import { TeamRole, TeamMember } from '../../types/engagement-team';
import {
  ApprovalConfig,
  ApprovalTypeRule,
  getApprovalTypeRule,
  getFunderRules,
  getApplicableThreshold,
  buildDefaultApprovalConfig,
} from './approval-config';

// ============================================================================
// Types
// ============================================================================

/**
 * Context for building approval chain
 */
export interface ApprovalChainContext {
  /** Engagement ID */
  engagementId: string;
  /** Full engagement data */
  engagement: Engagement;
  /** Type of approval */
  type: ApprovalType;
  /** Amount (if financial) */
  amount?: number;
  /** Currency code */
  currency?: string;
  /** Funding source IDs involved */
  fundingSourceIds?: string[];
  /** Full funding source data */
  fundingSources?: FundingSource[];
  /** Custom conditions to apply */
  customConditions?: ApprovalCondition[];
}

/**
 * Result of chain building
 */
export interface ApprovalChainResult {
  /** Built approval steps */
  steps: ApprovalStep[];
  /** Total number of steps */
  totalSteps: number;
  /** Estimated days to complete */
  estimatedCompletionDays: number;
  /** Whether no-objection is required */
  requiresNoObjection: boolean;
  /** Funder IDs requiring no-objection */
  noObjectionFunders: string[];
}

/**
 * Approver candidate
 */
interface ApproverCandidate {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  priority: number;
}

// ============================================================================
// Role Hierarchy
// ============================================================================

/**
 * Get role hierarchy (highest authority to lowest)
 */
function getRoleHierarchy(): TeamRole[] {
  return [
    'engagement_director',
    'engagement_lead',
    'deal_lead',
    'portfolio_manager',
    'program_manager',
    'investment_analyst',
    'research_analyst',
    'wealth_advisor',
    'relationship_manager',
    'finance_officer',
    'compliance_officer',
    'legal_counsel',
    'quantity_surveyor',
    'site_engineer',
    'site_manager',
    'project_manager',
    'admin_support',
  ];
}

/**
 * Get role priority (lower = higher authority)
 */
function getRolePriority(role: TeamRole): number {
  const hierarchy = getRoleHierarchy();
  const index = hierarchy.indexOf(role);
  return index === -1 ? 999 : index;
}

/**
 * Check if a user's role can approve for a required role
 */
function canApproveForRole(
  userRole: TeamRole,
  requiredRole: TeamRole
): boolean {
  const userPriority = getRolePriority(userRole);
  const requiredPriority = getRolePriority(requiredRole);
  
  // Higher authority (lower priority number) can approve for lower roles
  return userPriority <= requiredPriority;
}

// ============================================================================
// Chain Builder Class
// ============================================================================

export class ApprovalChainBuilder {
  private config: ApprovalConfig;

  constructor(config?: ApprovalConfig) {
    this.config = config || buildDefaultApprovalConfig();
  }

  /**
   * Build approval chain for a request
   */
  buildChain(context: ApprovalChainContext): ApprovalChainResult {
    const { type, amount, currency, engagement, fundingSources } = context;

    // Get base rules for this type
    const typeRule = getApprovalTypeRule(this.config, type);
    if (!typeRule) {
      throw new Error(`No approval rules defined for type: ${type}`);
    }

    // Collect all required roles
    const requiredRoles = new Set<TeamRole>(typeRule.baseRoles);
    const noObjectionFunders: string[] = [];
    let requiresNoObjection = false;

    // Add amount-based roles
    if (amount !== undefined && currency) {
      const threshold = getApplicableThreshold(
        typeRule.amountThresholds,
        amount,
        currency
      );
      if (threshold) {
        threshold.requiredRoles.forEach(role => requiredRoles.add(role));
      }
    }

    // Add funder-specific requirements
    if (fundingSources && fundingSources.length > 0) {
      for (const source of fundingSources) {
        const funderRules = getFunderRules(
          this.config,
          source.funderId,
          source.category
        );

        for (const rule of funderRules) {
          // Add additional roles
          rule.additionalRoles.forEach(role => requiredRoles.add(role));

          // Check for no-objection requirement
          if (
            rule.noObjectionRequired &&
            amount !== undefined &&
            amount >= rule.noObjectionThreshold
          ) {
            requiresNoObjection = true;
            if (!noObjectionFunders.includes(source.funderId)) {
              noObjectionFunders.push(source.funderId);
            }
          }

          // Add additional threshold-based roles
          if (amount !== undefined && currency) {
            const additionalThreshold = getApplicableThreshold(
              rule.additionalThresholds,
              amount,
              currency
            );
            if (additionalThreshold) {
              additionalThreshold.requiredRoles.forEach(role => requiredRoles.add(role));
            }
          }
        }
      }
    }

    // Find approvers for each required role
    const approverCandidates = this.findApprovers(
      engagement,
      Array.from(requiredRoles)
    );

    // Build approval steps
    const steps = this.buildSteps(
      approverCandidates,
      typeRule,
      context
    );

    // Add no-objection step if required
    if (requiresNoObjection && noObjectionFunders.length > 0) {
      steps.push(this.buildNoObjectionStep(
        noObjectionFunders,
        typeRule.maxDaysToComplete
      ));
    }

    // Renumber steps
    steps.forEach((step, index) => {
      step.sequence = index + 1;
    });

    // Calculate estimated completion
    const estimatedCompletionDays = steps.reduce(
      (total, step) => total + ((step.slaHours || 24) / 24),
      0
    );

    return {
      steps,
      totalSteps: steps.length,
      estimatedCompletionDays,
      requiresNoObjection,
      noObjectionFunders,
    };
  }

  /**
   * Find team members who can approve for given roles
   */
  private findApprovers(
    engagement: Engagement,
    roles: TeamRole[]
  ): ApproverCandidate[] {
    const candidates: ApproverCandidate[] = [];
    const teamMembers = engagement.team?.members || [];

    for (const role of roles) {
      // Find team members with this role or higher authority
      const eligibleMembers = teamMembers.filter((member: TeamMember) => 
        member.isActive && canApproveForRole(member.role, role)
      );

      for (const member of eligibleMembers) {
        // Avoid duplicates
        if (!candidates.find(c => c.userId === member.userId)) {
          candidates.push({
            userId: member.userId,
            name: member.name,
            email: member.email,
            role: member.role,
            priority: getRolePriority(member.role),
          });
        }
      }
    }

    return candidates.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Build approval steps from candidates
   */
  private buildSteps(
    candidates: ApproverCandidate[],
    typeRule: ApprovalTypeRule,
    context: ApprovalChainContext
  ): ApprovalStep[] {
    const steps: ApprovalStep[] = [];
    const usedApprovers = new Set<string>();

    if (candidates.length === 0) {
      // If no candidates found, create a step requiring manual assignment
      steps.push({
        sequence: 1,
        name: 'Pending Approver Assignment',
        approverType: 'role',
        approverRole: typeRule.baseRoles[0] || 'project_manager',
        isRequired: true,
        isConditional: false,
        status: 'pending',
        slaHours: typeRule.maxDaysToComplete * 24,
      });
      return steps;
    }

    // Group candidates by role priority
    const roleGroups = this.groupByRolePriority(candidates);
    const isSequential = typeRule.requiresSequential;

    let stepSequence = 1;
    for (const [_priority, group] of Array.from(roleGroups)) {
      if (group.length === 0) continue;

      // Pick approvers from this group who haven't been used
      const stepApprovers = group.filter(c => !usedApprovers.has(c.userId));
      
      if (stepApprovers.length === 0) continue;

      // Determine how many approvers needed at this level
      const approversNeeded = Math.min(
        stepApprovers.length,
        this.getApproversNeeded(typeRule, context.amount, context.currency)
      );

      const selectedApprovers = stepApprovers.slice(0, approversNeeded);
      const primaryApprover = selectedApprovers[0];
      
      // Create step
      const step: ApprovalStep = {
        sequence: stepSequence,
        name: `${this.formatRoleName(primaryApprover.role)} Approval`,
        approverType: selectedApprovers.length === 1 ? 'user' : 'role',
        approverId: selectedApprovers.length === 1 ? primaryApprover.userId : undefined,
        approverRole: primaryApprover.role,
        isRequired: true,
        isConditional: false,
        status: 'pending',
        slaHours: Math.ceil(typeRule.maxDaysToComplete * 24 / Math.max(roleGroups.size, 1)),
      };

      steps.push(step);
      selectedApprovers.forEach(a => usedApprovers.add(a.userId));
      stepSequence++;

      // If sequential and we've added enough steps, stop
      if (isSequential && steps.length >= this.getApproversNeeded(typeRule, context.amount, context.currency)) {
        break;
      }
    }

    return steps;
  }

  /**
   * Group candidates by role priority
   */
  private groupByRolePriority(
    candidates: ApproverCandidate[]
  ): Map<number, ApproverCandidate[]> {
    const groups = new Map<number, ApproverCandidate[]>();
    
    for (const candidate of candidates) {
      const existing = groups.get(candidate.priority) || [];
      existing.push(candidate);
      groups.set(candidate.priority, existing);
    }

    // Sort by priority key
    const sortedEntries = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
    return new Map(sortedEntries);
  }

  /**
   * Get number of approvers needed based on amount
   */
  private getApproversNeeded(
    typeRule: ApprovalTypeRule,
    amount?: number,
    currency?: string
  ): number {
    if (amount === undefined || !currency) {
      return 1;
    }

    const threshold = getApplicableThreshold(
      typeRule.amountThresholds,
      amount,
      currency
    );

    return threshold?.requiredCount || 1;
  }

  /**
   * Build no-objection step for funders
   */
  private buildNoObjectionStep(
    funderIds: string[],
    baseSLADays: number
  ): ApprovalStep {
    return {
      sequence: 999, // Will be renumbered
      name: 'Funder No-Objection',
      approverType: 'funder',
      funderId: funderIds[0], // Primary funder
      isRequired: true,
      isConditional: true,
      condition: {
        type: 'funding_source',
        funderIds,
      },
      status: 'pending',
      slaHours: baseSLADays * 24,
    };
  }

  /**
   * Format role name for display
   */
  private formatRoleName(role: TeamRole): string {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create approval chain builder with default config
 */
export function createApprovalChainBuilder(): ApprovalChainBuilder {
  return new ApprovalChainBuilder();
}

/**
 * Create approval chain builder with custom config
 */
export function createCustomApprovalChainBuilder(
  config: ApprovalConfig
): ApprovalChainBuilder {
  return new ApprovalChainBuilder(config);
}
