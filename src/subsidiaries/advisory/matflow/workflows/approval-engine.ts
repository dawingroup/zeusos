/**
 * Approval Engine
 * 
 * Generic approval workflow engine for multi-stage approval processes.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalConfig {
  id: string;
  name: string;
  description?: string;
  stages: ApprovalStageDefinition[];
  escalationRules?: EscalationRule[];
  notificationSettings?: NotificationSettings;
}

export interface ApprovalStageDefinition {
  id: string;
  name: string;
  order: number;
  requiredApprovers: ApproverRequirement[];
  timeoutHours?: number;
  autoApproveConditions?: AutoApproveCondition[];
  canModify: boolean;
  canReject: boolean;
  canDelegate: boolean;
}

export interface ApproverRequirement {
  type: 'role' | 'user' | 'any';
  value: string;
  count?: number; // For multi-approver scenarios
}

export interface AutoApproveCondition {
  field: string;
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'in';
  value: any;
}

export interface EscalationRule {
  afterHours: number;
  escalateTo: string; // Role or user ID
  notifyOriginal: boolean;
}

export interface NotificationSettings {
  onSubmit: boolean;
  onApprove: boolean;
  onReject: boolean;
  onReturn: boolean;
  onEscalate: boolean;
  reminderHours?: number[];
}

export interface ApprovalInstance {
  id: string;
  configId: string;
  entityType: string;
  entityId: string;
  status: ApprovalInstanceStatus;
  currentStageId: string | null;
  stages: ApprovalStageInstance[];
  submittedAt: Timestamp;
  submittedBy: string;
  completedAt?: Timestamp;
  completedBy?: string;
  metadata?: Record<string, any>;
}

export type ApprovalInstanceStatus = 
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled';

export interface ApprovalStageInstance {
  stageId: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approvals: ApprovalAction[];
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  notes?: string;
}

export interface ApprovalAction {
  userId: string;
  userName: string;
  userRole: string;
  action: 'approve' | 'reject' | 'return' | 'delegate';
  timestamp: Timestamp;
  comments?: string;
  modifications?: Record<string, any>;
  delegatedTo?: string;
}

export interface ApprovalContext {
  entityData: Record<string, any>;
  user: {
    id: string;
    name: string;
    role: string;
    permissions: string[];
  };
  metadata?: Record<string, any>;
}

// ============================================================================
// APPROVAL ENGINE CLASS
// ============================================================================

export class ApprovalEngine {
  private config: ApprovalConfig;

  constructor(config: ApprovalConfig) {
    this.config = config;
  }

  /**
   * Create a new approval instance
   */
  createInstance(
    entityType: string,
    entityId: string,
    submittedBy: string,
    metadata?: Record<string, any>
  ): ApprovalInstance {
    const stages: ApprovalStageInstance[] = this.config.stages.map(stage => ({
      stageId: stage.id,
      status: 'pending',
      approvals: [],
    }));

    return {
      id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      configId: this.config.id,
      entityType,
      entityId,
      status: 'pending',
      currentStageId: this.config.stages[0]?.id || null,
      stages,
      submittedAt: Timestamp.now(),
      submittedBy,
      metadata,
    };
  }

  /**
   * Check if user can approve at current stage
   */
  canUserApprove(instance: ApprovalInstance, context: ApprovalContext): boolean {
    if (!instance.currentStageId) return false;

    const stageConfig = this.config.stages.find(s => s.id === instance.currentStageId);
    if (!stageConfig) return false;

    return stageConfig.requiredApprovers.some(req => {
      switch (req.type) {
        case 'role':
          return context.user.role === req.value;
        case 'user':
          return context.user.id === req.value;
        case 'any':
          return true;
        default:
          return false;
      }
    });
  }

  /**
   * Check if auto-approve conditions are met
   */
  checkAutoApprove(instance: ApprovalInstance, context: ApprovalContext): boolean {
    if (!instance.currentStageId) return false;

    const stageConfig = this.config.stages.find(s => s.id === instance.currentStageId);
    if (!stageConfig?.autoApproveConditions?.length) return false;

    return stageConfig.autoApproveConditions.every(condition => {
      const value = context.entityData[condition.field];
      
      switch (condition.operator) {
        case 'lt': return value < condition.value;
        case 'lte': return value <= condition.value;
        case 'gt': return value > condition.value;
        case 'gte': return value >= condition.value;
        case 'eq': return value === condition.value;
        case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
        default: return false;
      }
    });
  }

  /**
   * Process an approval action
   */
  processApproval(
    instance: ApprovalInstance,
    action: Omit<ApprovalAction, 'timestamp'>,
    context: ApprovalContext
  ): ApprovalInstance {
    if (!this.canUserApprove(instance, context)) {
      throw new Error('User is not authorized to approve at this stage');
    }

    const updatedInstance = { ...instance };
    const stageIndex = updatedInstance.stages.findIndex(
      s => s.stageId === instance.currentStageId
    );

    if (stageIndex === -1) {
      throw new Error('Current stage not found');
    }

    const fullAction: ApprovalAction = {
      ...action,
      timestamp: Timestamp.now(),
    };

    // Add action to stage
    updatedInstance.stages[stageIndex].approvals.push(fullAction);

    switch (action.action) {
      case 'approve':
        return this.handleApprove(updatedInstance, stageIndex);
      case 'reject':
        return this.handleReject(updatedInstance, stageIndex);
      case 'return':
        return this.handleReturn(updatedInstance);
      case 'delegate':
        return this.handleDelegate(updatedInstance, action);
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  private handleApprove(
    instance: ApprovalInstance,
    stageIndex: number
  ): ApprovalInstance {
    const updatedInstance = { ...instance };
    
    // Mark stage as approved
    updatedInstance.stages[stageIndex].status = 'approved';
    updatedInstance.stages[stageIndex].completedAt = Timestamp.now();

    // Move to next stage or complete
    const nextStage = this.config.stages[stageIndex + 1];
    
    if (nextStage) {
      updatedInstance.currentStageId = nextStage.id;
      updatedInstance.stages[stageIndex + 1].startedAt = Timestamp.now();
      updatedInstance.status = 'in_progress';
    } else {
      // All stages complete
      updatedInstance.currentStageId = null;
      updatedInstance.status = 'approved';
      updatedInstance.completedAt = Timestamp.now();
    }

    return updatedInstance;
  }

  private handleReject(
    instance: ApprovalInstance,
    stageIndex: number
  ): ApprovalInstance {
    const updatedInstance = { ...instance };
    
    updatedInstance.stages[stageIndex].status = 'rejected';
    updatedInstance.stages[stageIndex].completedAt = Timestamp.now();
    updatedInstance.currentStageId = null;
    updatedInstance.status = 'rejected';
    updatedInstance.completedAt = Timestamp.now();

    return updatedInstance;
  }

  private handleReturn(instance: ApprovalInstance): ApprovalInstance {
    const updatedInstance = { ...instance };
    
    // Reset all stages
    updatedInstance.stages = updatedInstance.stages.map(stage => ({
      ...stage,
      status: 'pending' as const,
      approvals: [],
      startedAt: undefined,
      completedAt: undefined,
    }));
    
    updatedInstance.currentStageId = null;
    updatedInstance.status = 'returned';

    return updatedInstance;
  }

  private handleDelegate(
    instance: ApprovalInstance,
    action: Omit<ApprovalAction, 'timestamp'>
  ): ApprovalInstance {
    if (!action.delegatedTo) {
      throw new Error('Delegation target not specified');
    }

    // For delegation, we just record the action
    // The actual delegate user will need to approve separately
    return { ...instance };
  }

  /**
   * Get current stage information
   */
  getCurrentStage(instance: ApprovalInstance): ApprovalStageDefinition | null {
    if (!instance.currentStageId) return null;
    return this.config.stages.find(s => s.id === instance.currentStageId) || null;
  }

  /**
   * Get approval progress
   */
  getProgress(instance: ApprovalInstance): {
    totalStages: number;
    completedStages: number;
    percentage: number;
  } {
    const completedStages = instance.stages.filter(
      s => s.status === 'approved' || s.status === 'skipped'
    ).length;

    return {
      totalStages: this.config.stages.length,
      completedStages,
      percentage: Math.round((completedStages / this.config.stages.length) * 100),
    };
  }

  /**
   * Check if escalation is needed
   */
  checkEscalation(instance: ApprovalInstance): EscalationRule | null {
    if (!this.config.escalationRules?.length || !instance.currentStageId) {
      return null;
    }

    const stageInstance = instance.stages.find(
      s => s.stageId === instance.currentStageId
    );
    
    if (!stageInstance?.startedAt) return null;

    const hoursElapsed = (Date.now() - stageInstance.startedAt.toMillis()) / (1000 * 60 * 60);

    // Find applicable escalation rule
    const applicableRules = this.config.escalationRules
      .filter(rule => hoursElapsed >= rule.afterHours)
      .sort((a, b) => b.afterHours - a.afterHours);

    return applicableRules[0] || null;
  }
}

// ============================================================================
// PREDEFINED APPROVAL CONFIGS
// ============================================================================

export const REQUISITION_APPROVAL_CONFIG: ApprovalConfig = {
  id: 'requisition-approval',
  name: 'Requisition Approval',
  description: 'Standard requisition approval workflow',
  stages: [
    {
      id: 'technical_review',
      name: 'Technical Review',
      order: 1,
      requiredApprovers: [{ type: 'role', value: 'quantity_surveyor' }],
      timeoutHours: 24,
      canModify: true,
      canReject: true,
      canDelegate: true,
    },
    {
      id: 'budget_review',
      name: 'Budget Review',
      order: 2,
      requiredApprovers: [{ type: 'role', value: 'project_accountant' }],
      timeoutHours: 24,
      autoApproveConditions: [
        { field: 'estimatedTotal.amount', operator: 'lt', value: 1000000 },
      ],
      canModify: false,
      canReject: true,
      canDelegate: true,
    },
    {
      id: 'final_approval',
      name: 'Final Approval',
      order: 3,
      requiredApprovers: [{ type: 'role', value: 'project_manager' }],
      timeoutHours: 48,
      canModify: false,
      canReject: true,
      canDelegate: false,
    },
  ],
  escalationRules: [
    {
      afterHours: 48,
      escalateTo: 'program_manager',
      notifyOriginal: true,
    },
  ],
  notificationSettings: {
    onSubmit: true,
    onApprove: true,
    onReject: true,
    onReturn: true,
    onEscalate: true,
    reminderHours: [24, 48],
  },
};

export const PO_APPROVAL_CONFIG: ApprovalConfig = {
  id: 'po-approval',
  name: 'Purchase Order Approval',
  description: 'Standard PO approval workflow',
  stages: [
    {
      id: 'manager_approval',
      name: 'Manager Approval',
      order: 1,
      requiredApprovers: [{ type: 'role', value: 'project_manager' }],
      timeoutHours: 24,
      autoApproveConditions: [
        { field: 'grandTotal.amount', operator: 'lt', value: 5000000 },
      ],
      canModify: false,
      canReject: true,
      canDelegate: true,
    },
  ],
  notificationSettings: {
    onSubmit: true,
    onApprove: true,
    onReject: true,
    onReturn: false,
    onEscalate: true,
  },
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export const createApprovalEngine = (configId: string): ApprovalEngine => {
  const configs: Record<string, ApprovalConfig> = {
    'requisition-approval': REQUISITION_APPROVAL_CONFIG,
    'po-approval': PO_APPROVAL_CONFIG,
  };

  const config = configs[configId];
  if (!config) {
    throw new Error(`Unknown approval config: ${configId}`);
  }

  return new ApprovalEngine(config);
};

export default {
  ApprovalEngine,
  createApprovalEngine,
  REQUISITION_APPROVAL_CONFIG,
  PO_APPROVAL_CONFIG,
};
