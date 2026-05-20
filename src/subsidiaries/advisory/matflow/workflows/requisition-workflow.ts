/**
 * Requisition Workflow State Machine
 * 
 * Defines the state transitions and rules for requisition approval workflow.
 */

// Extended status type for workflow (superset of RequisitionStatus)
export type WorkflowRequisitionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'archived'
  | 'cancelled';

// ============================================================================
// TYPES
// ============================================================================

export type ApprovalStage = 
  | 'technical_review'
  | 'budget_review'
  | 'final_approval';

export interface WorkflowState {
  status: WorkflowRequisitionStatus;
  currentStage?: ApprovalStage;
  allowedTransitions: WorkflowRequisitionStatus[];
  requiredRole?: string;
}

export interface WorkflowTransition {
  from: WorkflowRequisitionStatus;
  to: WorkflowRequisitionStatus;
  action: string;
  requiredRole?: string;
  conditions?: string[];
}

export interface ApprovalStageConfig {
  stage: ApprovalStage;
  name: string;
  requiredRole: string;
  order: number;
  canModifyItems: boolean;
  canReject: boolean;
  canReturn: boolean;
}

// ============================================================================
// WORKFLOW CONFIGURATION
// ============================================================================

export const APPROVAL_STAGES: ApprovalStageConfig[] = [
  {
    stage: 'technical_review',
    name: 'Technical Review',
    requiredRole: 'quantity_surveyor',
    order: 1,
    canModifyItems: true,
    canReject: true,
    canReturn: true,
  },
  {
    stage: 'budget_review',
    name: 'Budget Review',
    requiredRole: 'project_accountant',
    order: 2,
    canModifyItems: false,
    canReject: true,
    canReturn: true,
  },
  {
    stage: 'final_approval',
    name: 'Final Approval',
    requiredRole: 'project_manager',
    order: 3,
    canModifyItems: false,
    canReject: true,
    canReturn: false,
  },
];

export const WORKFLOW_STATES: Record<WorkflowRequisitionStatus, WorkflowState> = {
  draft: {
    status: 'draft',
    allowedTransitions: ['submitted', 'archived'],
  },
  submitted: {
    status: 'submitted',
    currentStage: 'technical_review',
    allowedTransitions: ['under_review', 'returned', 'rejected'],
    requiredRole: 'quantity_surveyor',
  },
  under_review: {
    status: 'under_review',
    allowedTransitions: ['approved', 'returned', 'rejected'],
  },
  approved: {
    status: 'approved',
    allowedTransitions: ['fulfilled'],
  },
  rejected: {
    status: 'rejected',
    allowedTransitions: ['draft'],
  },
  returned: {
    status: 'returned',
    allowedTransitions: ['submitted', 'archived'],
  },
  partially_fulfilled: {
    status: 'partially_fulfilled',
    allowedTransitions: ['fulfilled'],
  },
  fulfilled: {
    status: 'fulfilled',
    allowedTransitions: [],
  },
  archived: {
    status: 'archived',
    allowedTransitions: [],
  },
  cancelled: {
    status: 'cancelled',
    allowedTransitions: [],
  },
};

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  // From draft
  {
    from: 'draft',
    to: 'submitted',
    action: 'submit',
    conditions: ['has_items', 'items_valid'],
  },
  {
    from: 'draft',
    to: 'archived',
    action: 'archive',
  },
  
  // From submitted - Technical Review
  {
    from: 'submitted',
    to: 'under_review',
    action: 'approve_technical',
    requiredRole: 'quantity_surveyor',
  },
  {
    from: 'submitted',
    to: 'returned',
    action: 'return',
    requiredRole: 'quantity_surveyor',
  },
  {
    from: 'submitted',
    to: 'rejected',
    action: 'reject',
    requiredRole: 'quantity_surveyor',
  },
  
  // From under_review - Budget Review
  {
    from: 'under_review',
    to: 'under_review',
    action: 'approve_budget',
    requiredRole: 'project_accountant',
  },
  {
    from: 'under_review',
    to: 'approved',
    action: 'approve_final',
    requiredRole: 'project_manager',
  },
  {
    from: 'under_review',
    to: 'returned',
    action: 'return',
  },
  {
    from: 'under_review',
    to: 'rejected',
    action: 'reject',
  },
  
  // From approved
  {
    from: 'approved',
    to: 'fulfilled',
    action: 'fulfill',
    conditions: ['has_linked_po'],
  },
  
  // From rejected
  {
    from: 'rejected',
    to: 'draft',
    action: 'revise',
  },
  
  // From returned
  {
    from: 'returned',
    to: 'submitted',
    action: 'resubmit',
    conditions: ['has_items', 'items_valid'],
  },
  {
    from: 'returned',
    to: 'archived',
    action: 'archive',
  },
];

// ============================================================================
// WORKFLOW HELPERS
// ============================================================================

/**
 * Check if a transition is valid
 */
export const canTransition = (
  currentStatus: WorkflowRequisitionStatus,
  targetStatus: WorkflowRequisitionStatus
): boolean => {
  const state = WORKFLOW_STATES[currentStatus];
  return state.allowedTransitions.includes(targetStatus);
};

/**
 * Get the next approval stage
 */
export const getNextStage = (
  currentStage: ApprovalStage | undefined
): ApprovalStageConfig | null => {
  if (!currentStage) {
    return APPROVAL_STAGES[0];
  }
  
  const currentIndex = APPROVAL_STAGES.findIndex(s => s.stage === currentStage);
  if (currentIndex === -1 || currentIndex >= APPROVAL_STAGES.length - 1) {
    return null;
  }
  
  return APPROVAL_STAGES[currentIndex + 1];
};

/**
 * Get approval stage by name
 */
export const getStage = (stage: ApprovalStage): ApprovalStageConfig | undefined => {
  return APPROVAL_STAGES.find(s => s.stage === stage);
};

/**
 * Check if user can approve at current stage
 */
export const canApprove = (
  currentStage: ApprovalStage | undefined,
  userRole: string
): boolean => {
  if (!currentStage) return false;
  
  const stage = getStage(currentStage);
  return stage?.requiredRole === userRole;
};

/**
 * Get available actions for a status
 */
export const getAvailableActions = (
  currentStatus: WorkflowRequisitionStatus,
  userRole?: string
): string[] => {
  const transitions = WORKFLOW_TRANSITIONS.filter(t => t.from === currentStatus);
  
  if (userRole) {
    return transitions
      .filter(t => !t.requiredRole || t.requiredRole === userRole)
      .map(t => t.action);
  }
  
  return transitions.map(t => t.action);
};

/**
 * Validate transition conditions
 */
export const validateTransitionConditions = (
  transition: WorkflowTransition,
  context: {
    hasItems?: boolean;
    itemsValid?: boolean;
    hasLinkedPO?: boolean;
  }
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!transition.conditions) {
    return { valid: true, errors: [] };
  }
  
  for (const condition of transition.conditions) {
    switch (condition) {
      case 'has_items':
        if (!context.hasItems) {
          errors.push('Requisition must have at least one item');
        }
        break;
      case 'items_valid':
        if (!context.itemsValid) {
          errors.push('All items must have valid data');
        }
        break;
      case 'has_linked_po':
        if (!context.hasLinkedPO) {
          errors.push('Requisition must have a linked purchase order');
        }
        break;
    }
  }
  
  return { valid: errors.length === 0, errors };
};

/**
 * Get status display info
 */
export const getStatusDisplayInfo = (status: WorkflowRequisitionStatus): {
  label: string;
  color: string;
  icon: string;
} => {
  const statusMap: Record<WorkflowRequisitionStatus, { label: string; color: string; icon: string }> = {
    draft: { label: 'Draft', color: 'gray', icon: 'edit' },
    submitted: { label: 'Submitted', color: 'blue', icon: 'send' },
    under_review: { label: 'Under Review', color: 'yellow', icon: 'clock' },
    approved: { label: 'Approved', color: 'green', icon: 'check' },
    rejected: { label: 'Rejected', color: 'red', icon: 'x' },
    returned: { label: 'Returned', color: 'orange', icon: 'arrow-left' },
    partially_fulfilled: { label: 'Partially Fulfilled', color: 'blue', icon: 'package' },
    fulfilled: { label: 'Fulfilled', color: 'purple', icon: 'package' },
    archived: { label: 'Archived', color: 'gray', icon: 'archive' },
    cancelled: { label: 'Cancelled', color: 'gray', icon: 'slash' },
  };
  
  return statusMap[status];
};

export default {
  APPROVAL_STAGES,
  WORKFLOW_STATES,
  WORKFLOW_TRANSITIONS,
  canTransition,
  getNextStage,
  getStage,
  canApprove,
  getAvailableActions,
  validateTransitionConditions,
  getStatusDisplayInfo,
};
