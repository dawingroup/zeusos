/**
 * APPROVAL CONFIGURATION TYPES
 *
 * Types for custom approval workflow configuration.
 * Allows super admins to override default ADD-FIN-001 approval workflows
 * at organization, program, or project level.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// TEAM ROLES (for approval stages)
// ─────────────────────────────────────────────────────────────────

export type TeamRole =
  | 'PROJECT_MANAGER'
  | 'SITE_ENGINEER'
  | 'ICE_MANAGER'
  | 'FINANCE'
  | 'QUALITY_MANAGER'
  | 'DONOR_REP'
  | 'PROGRAM_MANAGER'
  | 'BOARD_MEMBER'
  | 'SUPER_ADMIN';

// ─────────────────────────────────────────────────────────────────
// SKIP CONDITIONS
// ─────────────────────────────────────────────────────────────────

export interface ApprovalSkipCondition {
  id: string;
  type: 'amount' | 'category' | 'user_role' | 'custom';
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'ne';
  value: any;
  description: string;
}

// ─────────────────────────────────────────────────────────────────
// ESCALATION RULES
// ─────────────────────────────────────────────────────────────────

export interface EscalationRule {
  id: string;
  daysOverdue: number;
  escalateToRole: TeamRole;
  notificationMessage: string;
  requiresAction: boolean;
}

// ─────────────────────────────────────────────────────────────────
// APPROVAL STAGE
// ─────────────────────────────────────────────────────────────────

export interface ApprovalStage {
  id: string;
  sequence: number;
  name: string;
  description?: string;

  // Role requirement
  requiredRole: TeamRole;
  alternativeRoles?: TeamRole[];

  // SLA
  slaHours: number;

  // Behavior
  isRequired: boolean;
  canSkip: boolean;
  skipConditions?: ApprovalSkipCondition[];

  // Parallel vs Sequential
  canRunInParallel: boolean;
  parallelGroupId?: string;

  // External approvals (e.g., donor)
  isExternalApproval: boolean;
  externalApproverEmail?: string;
  externalApproverName?: string;

  // Notifications
  notifyOnAssignment: boolean;
  notifyOnOverdue: boolean;
  escalationRules?: EscalationRule[];
}

// ─────────────────────────────────────────────────────────────────
// APPROVAL CONFIGURATION
// ─────────────────────────────────────────────────────────────────

export type ApprovalConfigurationType = 'requisition' | 'accountability' | 'ipc';
export type ApprovalConfigurationLevel = 'organization' | 'program' | 'project';

export interface ApprovalConfiguration {
  id: string;

  // Metadata
  name: string;
  description?: string;
  type: ApprovalConfigurationType;

  // Hierarchy
  level: ApprovalConfigurationLevel;
  entityId: string; // orgId, programId, or projectId

  // Status
  isDefault: boolean;
  isActive: boolean;
  overridesDefault: boolean;

  // Configuration
  stages: ApprovalStage[];

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  reason?: string; // Why this override was created

  // Version control
  version: number;
  previousVersionId?: string;
}

// ─────────────────────────────────────────────────────────────────
// CONFIGURATION CHANGE TRACKING
// ─────────────────────────────────────────────────────────────────

export interface ConfigurationChange {
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface ApprovalConfigVersion {
  id: string;
  configId: string;
  version: number;
  configuration: ApprovalConfiguration;
  changedBy: string;
  changedAt: Timestamp;
  changeReason: string;
  changes: ConfigurationChange[];
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Validate approval configuration stages
 */
export function validateConfigurationStages(stages: ApprovalStage[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check at least one stage
  if (stages.length === 0) {
    errors.push('Configuration must have at least one approval stage');
  }

  // Check unique sequences
  const sequences = stages.map(s => s.sequence);
  const uniqueSequences = new Set(sequences);
  if (sequences.length !== uniqueSequences.size) {
    errors.push('Stage sequences must be unique');
  }

  // Check parallel stages have group IDs
  const parallelStages = stages.filter(s => s.canRunInParallel);
  for (const stage of parallelStages) {
    if (!stage.parallelGroupId) {
      errors.push(`Parallel stage "${stage.name}" must have parallelGroupId`);
    }
  }

  // Check SLA hours are positive
  for (const stage of stages) {
    if (stage.slaHours <= 0) {
      errors.push(`Stage "${stage.name}" must have positive SLA hours`);
    }
  }

  // Check external approvals have contact info
  const externalStages = stages.filter(s => s.isExternalApproval);
  for (const stage of externalStages) {
    if (!stage.externalApproverEmail && !stage.externalApproverName) {
      errors.push(`External approval stage "${stage.name}" must have approver contact info`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a stage should be skipped based on conditions
 */
export function shouldSkipStage(
  stage: ApprovalStage,
  context: {
    amount?: number;
    currency?: string;
    category?: string;
    userRole?: string;
  }
): boolean {
  if (!stage.canSkip || !stage.skipConditions || stage.skipConditions.length === 0) {
    return false;
  }

  // All conditions must be met to skip
  for (const condition of stage.skipConditions) {
    if (condition.type === 'amount' && context.amount !== undefined) {
      const conditionAmount = Number(condition.value);
      const amount = context.amount;

      let conditionMet = false;
      switch (condition.operator) {
        case 'lt':
          conditionMet = amount < conditionAmount;
          break;
        case 'lte':
          conditionMet = amount <= conditionAmount;
          break;
        case 'gt':
          conditionMet = amount > conditionAmount;
          break;
        case 'gte':
          conditionMet = amount >= conditionAmount;
          break;
        case 'eq':
          conditionMet = amount === conditionAmount;
          break;
        case 'ne':
          conditionMet = amount !== conditionAmount;
          break;
      }

      if (!conditionMet) return false;
    } else if (condition.type === 'category' && context.category) {
      const conditionMet = condition.operator === 'eq'
        ? context.category === condition.value
        : context.category !== condition.value;
      if (!conditionMet) return false;
    } else if (condition.type === 'user_role' && context.userRole) {
      const conditionMet = condition.operator === 'eq'
        ? context.userRole === condition.value
        : context.userRole !== condition.value;
      if (!conditionMet) return false;
    }
  }

  return true; // All conditions met
}

/**
 * Calculate total SLA hours for a configuration
 */
export function calculateTotalSLA(
  config: ApprovalConfiguration,
  skipContext?: {
    amount?: number;
    currency?: string;
    category?: string;
    userRole?: string;
  }
): number {
  let totalHours = 0;
  const parallelGroups = new Map<string, number>();

  for (const stage of config.stages) {
    // Skip if conditions met
    if (skipContext && shouldSkipStage(stage, skipContext)) {
      continue;
    }

    if (stage.canRunInParallel && stage.parallelGroupId) {
      // For parallel stages, take the max SLA in the group
      const currentMax = parallelGroups.get(stage.parallelGroupId) || 0;
      parallelGroups.set(stage.parallelGroupId, Math.max(currentMax, stage.slaHours));
    } else {
      // Sequential stage
      totalHours += stage.slaHours;
    }
  }

  // Add parallel group max SLAs
  for (const groupMax of parallelGroups.values()) {
    totalHours += groupMax;
  }

  return totalHours;
}

/**
 * Get default ADD-FIN-001 requisition configuration
 */
export function getDefaultRequisitionConfig(
  organizationId: string,
  createdBy: string
): Omit<ApprovalConfiguration, 'id'> {
  return {
    name: 'ADD-FIN-001 Default Requisition Workflow',
    description: 'Standard dual-approval workflow: Technical Review → Financial Approval',
    type: 'requisition',
    level: 'organization',
    entityId: organizationId,
    isDefault: true,
    isActive: true,
    overridesDefault: false,
    stages: [
      {
        id: 'stage-technical',
        sequence: 1,
        name: 'Technical Review',
        description: 'ICE Manager reviews technical feasibility and BOQ compliance',
        requiredRole: 'ICE_MANAGER',
        alternativeRoles: ['PROJECT_MANAGER'],
        slaHours: 48,
        isRequired: true,
        canSkip: false,
        canRunInParallel: false,
        isExternalApproval: false,
        notifyOnAssignment: true,
        notifyOnOverdue: true,
        escalationRules: [
          {
            id: 'escalation-technical-1',
            daysOverdue: 1,
            escalateToRole: 'PROGRAM_MANAGER',
            notificationMessage: 'Technical review overdue by 1 day',
            requiresAction: false,
          },
          {
            id: 'escalation-technical-2',
            daysOverdue: 2,
            escalateToRole: 'SUPER_ADMIN',
            notificationMessage: 'Technical review overdue by 2 days - urgent action required',
            requiresAction: true,
          },
        ],
      },
      {
        id: 'stage-financial',
        sequence: 2,
        name: 'Financial Approval',
        description: 'Finance team reviews budget compliance and fund availability',
        requiredRole: 'FINANCE',
        slaHours: 72,
        isRequired: true,
        canSkip: false,
        canRunInParallel: false,
        isExternalApproval: false,
        notifyOnAssignment: true,
        notifyOnOverdue: true,
        escalationRules: [
          {
            id: 'escalation-financial-1',
            daysOverdue: 1,
            escalateToRole: 'PROGRAM_MANAGER',
            notificationMessage: 'Financial approval overdue by 1 day',
            requiresAction: false,
          },
          {
            id: 'escalation-financial-2',
            daysOverdue: 3,
            escalateToRole: 'SUPER_ADMIN',
            notificationMessage: 'Financial approval overdue by 3 days - urgent action required',
            requiresAction: true,
          },
        ],
      },
    ],
    createdBy,
    createdAt: Timestamp.now(),
    updatedBy: createdBy,
    updatedAt: Timestamp.now(),
    version: 1,
  };
}

/**
 * Get default ADD-FIN-001 accountability configuration
 */
export function getDefaultAccountabilityConfig(
  organizationId: string,
  createdBy: string
): Omit<ApprovalConfiguration, 'id'> {
  return {
    name: 'ADD-FIN-001 Default Accountability Workflow',
    description: 'Standard accountability approval: Financial Review → Reconciliation',
    type: 'accountability',
    level: 'organization',
    entityId: organizationId,
    isDefault: true,
    isActive: true,
    overridesDefault: false,
    stages: [
      {
        id: 'stage-accountability-review',
        sequence: 1,
        name: 'Financial Review',
        description: 'Finance team reviews proof of spend and zero-discrepancy compliance',
        requiredRole: 'FINANCE',
        slaHours: 48,
        isRequired: true,
        canSkip: false,
        canRunInParallel: false,
        isExternalApproval: false,
        notifyOnAssignment: true,
        notifyOnOverdue: true,
      },
    ],
    createdBy,
    createdAt: Timestamp.now(),
    updatedBy: createdBy,
    updatedAt: Timestamp.now(),
    version: 1,
  };
}
