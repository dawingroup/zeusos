import { Money } from './money';
import { FundingSource } from './funding';
import { ApprovalStep, ApprovalType, ApprovalCondition, ApproverType } from './approval';
import { TeamRole } from './engagement-team';

/**
 * APPROVAL RULE
 * A rule that adds approvers to the chain
 */
export interface ApprovalRule {
  id: string;
  
  /** Rule name */
  name: string;
  
  /** Approval types this rule applies to */
  appliesToTypes: ApprovalType[];
  
  /** Sequence in chain */
  sequence: number;
  
  /** Approver type */
  approverType: ApproverType;
  
  /** Specific approver or role */
  approverIdOrRole: string;
  
  /** Is required */
  isRequired: boolean;
  
  /** Condition (if conditional) */
  condition?: ApprovalCondition;
  
  /** SLA hours */
  slaHours: number;
}

/**
 * AMOUNT THRESHOLD
 * Amount-based approval escalation
 */
export interface AmountThreshold {
  /** Minimum amount for this threshold */
  minAmount: Money;
  
  /** Maximum amount (null = unlimited) */
  maxAmount?: Money;
  
  /** Additional approvers required */
  additionalApprovers: {
    role: TeamRole;
    isRequired: boolean;
    sequence: number;
  }[];
}

/**
 * FUNDER APPROVAL REQUIREMENT
 * Funder-specific approval requirements
 */
export interface FunderApprovalRequirement {
  /** Funding source ID */
  fundingSourceId: string;
  
  /** Funder ID */
  funderId: string;
  
  /** Funder name (for display) */
  funderName: string;
  
  /** Approval types requiring funder approval */
  requiredForTypes: ApprovalType[];
  
  /** Amount threshold for funder approval */
  amountThreshold?: Money;
  
  /** Contact for approvals */
  approvalContactId?: string;
  
  /** SLA hours */
  slaHours: number;
}

/**
 * APPROVAL CONFIG
 * Configuration for building approval chains
 */
export interface ApprovalConfig {
  /** Engagement ID */
  engagementId: string;
  
  /** Rules for building chains */
  rules: ApprovalRule[];
  
  /** Amount thresholds */
  amountThresholds: AmountThreshold[];
  
  /** Funder-specific requirements */
  funderRequirements: FunderApprovalRequirement[];
  
  /** Default SLA hours */
  defaultSlaHours: number;
  
  /** Auto-approve below this amount */
  autoApproveThreshold?: Money;
}

/**
 * CHAIN BUILD CONTEXT
 * Context for building an approval chain
 */
export interface ChainBuildContext {
  /** Approval type */
  type: ApprovalType;
  
  /** Amount (if applicable) */
  amount?: Money;
  
  /** Funding source (if payment) */
  fundingSourceId?: string;
  
  /** Implementation type (for delivery) */
  implementationType?: 'contractor' | 'direct';
}

/**
 * Evaluate if a condition is met
 */
export function evaluateCondition(
  condition: ApprovalCondition,
  context: ChainBuildContext
): boolean {
  switch (condition.type) {
    case 'amount_threshold':
      return !!(context.amount && 
        condition.amountThreshold &&
        context.amount.amount >= condition.amountThreshold.amount);
    
    case 'approval_type':
      return !!(condition.approvalTypes?.includes(context.type));
    
    case 'funding_source':
      if (condition.funderIds && context.fundingSourceId) {
        // Would need to lookup funder from source
        return true;
      }
      return false;
    
    default:
      return true;
  }
}

/**
 * Build approval chain based on config and context
 */
export function buildApprovalChain(
  config: ApprovalConfig,
  context: ChainBuildContext,
  fundingSources: FundingSource[]
): ApprovalStep[] {
  const steps: ApprovalStep[] = [];
  let sequence = 1;
  
  // Check for auto-approval
  if (config.autoApproveThreshold && context.amount) {
    if (context.amount.amount < config.autoApproveThreshold.amount) {
      return [{
        sequence: 1,
        name: 'Auto-Approved',
        approverType: 'auto',
        isRequired: true,
        isConditional: false,
        status: 'approved',
        decision: 'approved',
        slaHours: 0,
      }];
    }
  }
  
  // 1. Add base rules that match the approval type
  const matchingRules = config.rules
    .filter(rule => rule.appliesToTypes.includes(context.type))
    .filter(rule => !rule.condition || evaluateCondition(rule.condition, context))
    .sort((a, b) => a.sequence - b.sequence);
  
  for (const rule of matchingRules) {
    steps.push({
      sequence: sequence++,
      name: rule.name,
      approverType: rule.approverType,
      approverId: rule.approverType === 'user' ? rule.approverIdOrRole : undefined,
      approverRole: rule.approverType === 'role' ? rule.approverIdOrRole : undefined,
      isRequired: rule.isRequired,
      isConditional: !!rule.condition,
      condition: rule.condition,
      status: 'pending',
      slaHours: rule.slaHours,
    });
  }
  
  // 2. Add amount-based escalation
  if (context.amount) {
    const matchingThreshold = config.amountThresholds.find(
      t => context.amount!.amount >= t.minAmount.amount &&
           (!t.maxAmount || context.amount!.amount <= t.maxAmount.amount)
    );
    
    if (matchingThreshold) {
      for (const approver of matchingThreshold.additionalApprovers) {
        steps.push({
          sequence: sequence++,
          name: `${approver.role} Approval (Amount > ${matchingThreshold.minAmount.amount})`,
          approverType: 'role',
          approverRole: approver.role,
          isRequired: approver.isRequired,
          isConditional: true,
          condition: {
            type: 'amount_threshold',
            amountThreshold: matchingThreshold.minAmount,
          },
          status: 'pending',
          slaHours: config.defaultSlaHours,
        });
      }
    }
  }
  
  // 3. Add funder-specific requirements
  if (context.fundingSourceId) {
    const source = fundingSources.find(s => s.id === context.fundingSourceId);
    if (source) {
      const funderReq = config.funderRequirements.find(
        r => r.fundingSourceId === context.fundingSourceId &&
             r.requiredForTypes.includes(context.type)
      );
      
      if (funderReq) {
        const meetsFunderThreshold = !funderReq.amountThreshold ||
          (context.amount && context.amount.amount >= funderReq.amountThreshold.amount);
        
        if (meetsFunderThreshold) {
          steps.push({
            sequence: sequence++,
            name: `${funderReq.funderName} Approval`,
            approverType: 'funder',
            funderId: funderReq.funderId,
            isRequired: true,
            isConditional: true,
            condition: {
              type: 'funding_source',
              funderIds: [funderReq.funderId],
            },
            status: 'pending',
            slaHours: funderReq.slaHours,
          });
        }
      }
    }
  }
  
  return steps;
}

/**
 * Get next pending step in chain
 */
export function getNextPendingStep(steps: ApprovalStep[]): ApprovalStep | undefined {
  return steps.find(s => s.status === 'pending');
}

/**
 * Check if chain is complete
 */
export function isChainComplete(steps: ApprovalStep[]): boolean {
  return steps.every(s => 
    s.status === 'approved' || 
    s.status === 'skipped' ||
    (!s.isRequired && s.status === 'pending')
  );
}

/**
 * Check if chain is rejected
 */
export function isChainRejected(steps: ApprovalStep[]): boolean {
  return steps.some(s => s.status === 'rejected');
}

/**
 * Get chain completion percentage
 */
export function getChainCompletionPercentage(steps: ApprovalStep[]): number {
  if (steps.length === 0) return 100;
  const completed = steps.filter(s => 
    s.status === 'approved' || s.status === 'skipped'
  ).length;
  return Math.round((completed / steps.length) * 100);
}

/**
 * Create default approval config
 */
export function createDefaultApprovalConfig(engagementId: string): ApprovalConfig {
  return {
    engagementId,
    rules: [
      {
        id: 'default-reviewer',
        name: 'Project Manager Review',
        appliesToTypes: ['payment_request', 'requisition', 'accountability'],
        sequence: 1,
        approverType: 'role',
        approverIdOrRole: 'project_manager',
        isRequired: true,
        slaHours: 24,
      },
      {
        id: 'default-approver',
        name: 'Engagement Lead Approval',
        appliesToTypes: ['payment_request', 'requisition', 'accountability', 'budget_reallocation', 'scope_change'],
        sequence: 2,
        approverType: 'team_lead',
        approverIdOrRole: 'engagement_lead',
        isRequired: true,
        slaHours: 48,
      },
    ],
    amountThresholds: [],
    funderRequirements: [],
    defaultSlaHours: 48,
  };
}

/**
 * Merge approval configs (for combining funder requirements)
 */
export function mergeApprovalConfigs(
  base: ApprovalConfig,
  ...additions: Partial<ApprovalConfig>[]
): ApprovalConfig {
  let merged = { ...base };
  
  for (const addition of additions) {
    if (addition.rules) {
      merged.rules = [...merged.rules, ...addition.rules];
    }
    if (addition.amountThresholds) {
      merged.amountThresholds = [...merged.amountThresholds, ...addition.amountThresholds];
    }
    if (addition.funderRequirements) {
      merged.funderRequirements = [...merged.funderRequirements, ...addition.funderRequirements];
    }
  }
  
  // Sort rules by sequence
  merged.rules.sort((a, b) => a.sequence - b.sequence);
  
  return merged;
}
