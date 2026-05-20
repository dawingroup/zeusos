/**
 * APPROVAL CONFIGURATION
 * 
 * Defines rules for building approval chains based on type, amount, and context.
 */

import { ApprovalType } from '../../types/approval';
import { FundingCategory } from '../../types/funding-category';
import { TeamRole } from '../../types/engagement-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Amount threshold for approval escalation
 */
export interface AmountThreshold {
  /** Minimum amount for this threshold */
  minAmount: number;
  /** Maximum amount (null = unlimited) */
  maxAmount: number | null;
  /** Currency code */
  currency: string;
  /** Roles required at this threshold */
  requiredRoles: TeamRole[];
  /** How many approvers needed at this level */
  requiredCount: number;
  /** Can approvals be done in parallel? */
  isParallel: boolean;
}

/**
 * Base approval rule by type
 */
export interface ApprovalTypeRule {
  /** Approval type this rule applies to */
  type: ApprovalType;
  /** Minimum roles always required */
  baseRoles: TeamRole[];
  /** Amount-based escalation thresholds */
  amountThresholds: AmountThreshold[];
  /** Must approvals be sequential? */
  requiresSequential: boolean;
  /** SLA in days */
  maxDaysToComplete: number;
  /** Can this approval be delegated? */
  canBeDelegated: boolean;
  /** Is documentation required? */
  requiresDocumentation: boolean;
}

/**
 * Funder-specific approval requirements
 */
export interface FunderApprovalRule {
  /** Specific funder ID, or undefined for category-based */
  funderId?: string;
  /** Funding category this applies to */
  funderCategory?: FundingCategory;
  /** Additional roles required */
  additionalRoles: TeamRole[];
  /** Additional thresholds */
  additionalThresholds: AmountThreshold[];
  /** Funder must provide no-objection */
  noObjectionRequired: boolean;
  /** Amount above which no-objection needed */
  noObjectionThreshold: number;
  /** Days to wait for no-objection */
  noObjectionDays: number;
}

/**
 * Escalation rules for overdue approvals
 */
export interface EscalationRule {
  /** Days overdue to trigger this rule */
  daysOverdue: number;
  /** Role to escalate to */
  escalateToRole: TeamRole;
  /** Roles to notify */
  notifyRoles: TeamRole[];
  /** Auto-approve after escalation period */
  isAutoApprove: boolean;
}

/**
 * Complete approval configuration
 */
export interface ApprovalConfig {
  /** Rules by approval type */
  typeRules: Map<ApprovalType, ApprovalTypeRule>;
  /** Funder-specific rules */
  funderRules: FunderApprovalRule[];
  /** Default SLA in days */
  defaultSLADays: number;
  /** Escalation rules */
  escalationRules: EscalationRule[];
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default amount thresholds for general approvals (in USD)
 */
const DEFAULT_AMOUNT_THRESHOLDS: AmountThreshold[] = [
  {
    minAmount: 0,
    maxAmount: 10000,
    currency: 'USD',
    requiredRoles: ['project_manager'],
    requiredCount: 1,
    isParallel: false,
  },
  {
    minAmount: 10000,
    maxAmount: 50000,
    currency: 'USD',
    requiredRoles: ['project_manager', 'program_manager'],
    requiredCount: 2,
    isParallel: false,
  },
  {
    minAmount: 50000,
    maxAmount: 100000,
    currency: 'USD',
    requiredRoles: ['program_manager', 'finance_officer'],
    requiredCount: 2,
    isParallel: true,
  },
  {
    minAmount: 100000,
    maxAmount: 500000,
    currency: 'USD',
    requiredRoles: ['engagement_lead', 'finance_officer'],
    requiredCount: 2,
    isParallel: false,
  },
  {
    minAmount: 500000,
    maxAmount: null,
    currency: 'USD',
    requiredRoles: ['engagement_director', 'engagement_lead', 'finance_officer'],
    requiredCount: 3,
    isParallel: false,
  },
];

/**
 * Default approval rules by type
 */
const DEFAULT_TYPE_RULES: ApprovalTypeRule[] = [
  // ─────────────────────────────────────────────────────────────────
  // Payment approvals
  // ─────────────────────────────────────────────────────────────────
  {
    type: 'payment_request',
    baseRoles: ['project_manager'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 5,
    canBeDelegated: true,
    requiresDocumentation: true,
  },
  {
    type: 'interim_payment_certificate',
    baseRoles: ['quantity_surveyor', 'project_manager'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 7,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'requisition',
    baseRoles: ['project_manager'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS.map(t => ({
      ...t,
      maxAmount: t.maxAmount ? t.maxAmount / 2 : null,
    })),
    requiresSequential: true,
    maxDaysToComplete: 3,
    canBeDelegated: true,
    requiresDocumentation: true,
  },
  {
    type: 'accountability',
    baseRoles: ['project_manager', 'finance_officer'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 10,
    canBeDelegated: false,
    requiresDocumentation: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // Procurement approvals
  // ─────────────────────────────────────────────────────────────────
  {
    type: 'procurement_request',
    baseRoles: ['project_manager'],
    amountThresholds: [
      { minAmount: 0, maxAmount: 5000, currency: 'USD', requiredRoles: ['project_manager'], requiredCount: 1, isParallel: false },
      { minAmount: 5000, maxAmount: 25000, currency: 'USD', requiredRoles: ['project_manager', 'program_manager'], requiredCount: 2, isParallel: false },
      { minAmount: 25000, maxAmount: 100000, currency: 'USD', requiredRoles: ['program_manager', 'finance_officer'], requiredCount: 2, isParallel: true },
      { minAmount: 100000, maxAmount: null, currency: 'USD', requiredRoles: ['engagement_lead', 'finance_officer'], requiredCount: 2, isParallel: false },
    ],
    requiresSequential: false,
    maxDaysToComplete: 14,
    canBeDelegated: true,
    requiresDocumentation: true,
  },
  {
    type: 'vendor_selection',
    baseRoles: ['project_manager'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 7,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'contract_award',
    baseRoles: ['program_manager', 'legal_counsel'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 21,
    canBeDelegated: false,
    requiresDocumentation: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // Change approvals
  // ─────────────────────────────────────────────────────────────────
  {
    type: 'budget_reallocation',
    baseRoles: ['finance_officer', 'program_manager'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 7,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'scope_change',
    baseRoles: ['project_manager', 'program_manager'],
    amountThresholds: [],
    requiresSequential: true,
    maxDaysToComplete: 10,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'timeline_extension',
    baseRoles: ['project_manager', 'program_manager'],
    amountThresholds: [],
    requiresSequential: false,
    maxDaysToComplete: 5,
    canBeDelegated: true,
    requiresDocumentation: true,
  },
  {
    type: 'cost_overrun',
    baseRoles: ['quantity_surveyor', 'project_manager', 'program_manager'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 14,
    canBeDelegated: false,
    requiresDocumentation: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // Document approvals
  // ─────────────────────────────────────────────────────────────────
  {
    type: 'report_submission',
    baseRoles: ['project_manager'],
    amountThresholds: [],
    requiresSequential: false,
    maxDaysToComplete: 3,
    canBeDelegated: true,
    requiresDocumentation: false,
  },
  {
    type: 'certificate_issuance',
    baseRoles: ['project_manager', 'program_manager'],
    amountThresholds: [],
    requiresSequential: true,
    maxDaysToComplete: 5,
    canBeDelegated: true,
    requiresDocumentation: false,
  },

  // ─────────────────────────────────────────────────────────────────
  // Investment approvals
  // ─────────────────────────────────────────────────────────────────
  {
    type: 'investment_decision',
    baseRoles: ['engagement_director', 'deal_lead'],
    amountThresholds: [
      { minAmount: 0, maxAmount: 1000000, currency: 'USD', requiredRoles: ['deal_lead', 'engagement_lead'], requiredCount: 2, isParallel: false },
      { minAmount: 1000000, maxAmount: null, currency: 'USD', requiredRoles: ['deal_lead', 'engagement_director'], requiredCount: 2, isParallel: false },
    ],
    requiresSequential: true,
    maxDaysToComplete: 30,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'deal_approval',
    baseRoles: ['deal_lead', 'engagement_lead'],
    amountThresholds: DEFAULT_AMOUNT_THRESHOLDS,
    requiresSequential: true,
    maxDaysToComplete: 14,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'valuation_approval',
    baseRoles: ['investment_analyst', 'deal_lead'],
    amountThresholds: [],
    requiresSequential: true,
    maxDaysToComplete: 7,
    canBeDelegated: false,
    requiresDocumentation: true,
  },

  // ─────────────────────────────────────────────────────────────────
  // Advisory approvals
  // ─────────────────────────────────────────────────────────────────
  {
    type: 'trade_execution',
    baseRoles: ['wealth_advisor', 'portfolio_manager'],
    amountThresholds: [
      { minAmount: 0, maxAmount: 50000, currency: 'USD', requiredRoles: ['wealth_advisor'], requiredCount: 1, isParallel: false },
      { minAmount: 50000, maxAmount: 250000, currency: 'USD', requiredRoles: ['wealth_advisor', 'portfolio_manager'], requiredCount: 2, isParallel: false },
      { minAmount: 250000, maxAmount: null, currency: 'USD', requiredRoles: ['portfolio_manager', 'engagement_lead'], requiredCount: 2, isParallel: false },
    ],
    requiresSequential: true,
    maxDaysToComplete: 1,
    canBeDelegated: false,
    requiresDocumentation: true,
  },
  {
    type: 'rebalancing',
    baseRoles: ['portfolio_manager'],
    amountThresholds: [],
    requiresSequential: false,
    maxDaysToComplete: 3,
    canBeDelegated: true,
    requiresDocumentation: true,
  },
  {
    type: 'recommendation',
    baseRoles: ['wealth_advisor', 'research_analyst'],
    amountThresholds: [],
    requiresSequential: true,
    maxDaysToComplete: 5,
    canBeDelegated: true,
    requiresDocumentation: true,
  },
];

/**
 * Default funder-specific rules
 */
const DEFAULT_FUNDER_RULES: FunderApprovalRule[] = [
  // Grant funders require no-objection for large amounts
  {
    funderCategory: 'grant',
    additionalRoles: [],
    additionalThresholds: [],
    noObjectionRequired: true,
    noObjectionThreshold: 100000,
    noObjectionDays: 14,
  },
  // Concessional finance has moderate requirements
  {
    funderCategory: 'concessional',
    additionalRoles: [],
    additionalThresholds: [],
    noObjectionRequired: true,
    noObjectionThreshold: 50000,
    noObjectionDays: 10,
  },
  // Government funders have stricter requirements
  {
    funderCategory: 'government',
    additionalRoles: ['finance_officer'],
    additionalThresholds: [
      { minAmount: 25000, maxAmount: null, currency: 'USD', requiredRoles: ['engagement_lead'], requiredCount: 1, isParallel: false },
    ],
    noObjectionRequired: true,
    noObjectionThreshold: 25000,
    noObjectionDays: 21,
  },
  // Commercial lenders have different requirements
  {
    funderCategory: 'commercial_debt',
    additionalRoles: [],
    additionalThresholds: [],
    noObjectionRequired: false,
    noObjectionThreshold: 0,
    noObjectionDays: 0,
  },
  // Equity investors need transparency
  {
    funderCategory: 'equity',
    additionalRoles: [],
    additionalThresholds: [],
    noObjectionRequired: true,
    noObjectionThreshold: 250000,
    noObjectionDays: 7,
  },
];

/**
 * Default escalation rules
 */
const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    daysOverdue: 2,
    escalateToRole: 'program_manager',
    notifyRoles: ['project_manager'],
    isAutoApprove: false,
  },
  {
    daysOverdue: 5,
    escalateToRole: 'engagement_lead',
    notifyRoles: ['program_manager', 'project_manager'],
    isAutoApprove: false,
  },
  {
    daysOverdue: 10,
    escalateToRole: 'engagement_director',
    notifyRoles: ['engagement_lead', 'program_manager'],
    isAutoApprove: false,
  },
  {
    daysOverdue: 21,
    escalateToRole: 'engagement_director',
    notifyRoles: ['engagement_director'],
    isAutoApprove: true,
  },
];

// ============================================================================
// Configuration Builder
// ============================================================================

/**
 * Build default approval configuration
 */
export function buildDefaultApprovalConfig(): ApprovalConfig {
  const typeRules = new Map<ApprovalType, ApprovalTypeRule>();
  
  for (const rule of DEFAULT_TYPE_RULES) {
    typeRules.set(rule.type, rule);
  }

  return {
    typeRules,
    funderRules: DEFAULT_FUNDER_RULES,
    defaultSLADays: 7,
    escalationRules: DEFAULT_ESCALATION_RULES,
  };
}

/**
 * Get rule for approval type
 */
export function getApprovalTypeRule(
  config: ApprovalConfig,
  type: ApprovalType
): ApprovalTypeRule | undefined {
  return config.typeRules.get(type);
}

/**
 * Get funder rules for funding category or specific funder
 */
export function getFunderRules(
  config: ApprovalConfig,
  funderId?: string,
  funderCategory?: FundingCategory
): FunderApprovalRule[] {
  return config.funderRules.filter(rule => 
    (rule.funderId && rule.funderId === funderId) ||
    (rule.funderCategory && rule.funderCategory === funderCategory)
  );
}

/**
 * Get applicable amount threshold for an amount
 */
export function getApplicableThreshold(
  thresholds: AmountThreshold[],
  amount: number,
  currency: string
): AmountThreshold | undefined {
  // TODO: Currency conversion if needed
  return thresholds.find(t => 
    t.currency === currency &&
    amount >= t.minAmount &&
    (t.maxAmount === null || amount < t.maxAmount)
  );
}

/**
 * Get escalation rule by days overdue
 */
export function getEscalationRule(
  config: ApprovalConfig,
  daysOverdue: number
): EscalationRule | undefined {
  // Find the most severe applicable rule
  const applicableRules = config.escalationRules
    .filter(r => daysOverdue >= r.daysOverdue)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  
  return applicableRules[0];
}

/**
 * Merge custom config with default
 */
export function mergeApprovalConfig(
  base: ApprovalConfig,
  custom: Partial<ApprovalConfig>
): ApprovalConfig {
  const merged: ApprovalConfig = {
    typeRules: new Map(base.typeRules),
    funderRules: [...base.funderRules],
    defaultSLADays: custom.defaultSLADays ?? base.defaultSLADays,
    escalationRules: custom.escalationRules ?? base.escalationRules,
  };

  // Merge type rules
  if (custom.typeRules) {
    for (const [type, rule] of Array.from(custom.typeRules)) {
      merged.typeRules.set(type, rule);
    }
  }

  // Add custom funder rules
  if (custom.funderRules) {
    merged.funderRules = [...merged.funderRules, ...custom.funderRules];
  }

  return merged;
}
