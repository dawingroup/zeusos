/**
 * Purchase Order Workflow State Machine
 * 
 * Defines the state transitions and rules for PO workflow.
 */

// PO Status type for workflow
export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent_to_supplier'
  | 'acknowledged'
  | 'partial'
  | 'delivered'
  | 'completed'
  | 'cancelled';

// ============================================================================
// TYPES
// ============================================================================

export interface POWorkflowState {
  status: PurchaseOrderStatus;
  allowedTransitions: PurchaseOrderStatus[];
  requiredRole?: string;
  description: string;
}

export interface POWorkflowTransition {
  from: PurchaseOrderStatus;
  to: PurchaseOrderStatus;
  action: string;
  requiredRole?: string;
  conditions?: string[];
  description: string;
}

// ============================================================================
// WORKFLOW CONFIGURATION
// ============================================================================

export const PO_WORKFLOW_STATES: Record<PurchaseOrderStatus, POWorkflowState> = {
  draft: {
    status: 'draft',
    allowedTransitions: ['pending_approval', 'cancelled'],
    description: 'PO is being prepared',
  },
  pending_approval: {
    status: 'pending_approval',
    allowedTransitions: ['approved', 'rejected'],
    requiredRole: 'project_manager',
    description: 'Awaiting approval',
  },
  approved: {
    status: 'approved',
    allowedTransitions: ['sent_to_supplier', 'cancelled'],
    description: 'Approved, ready to send to supplier',
  },
  rejected: {
    status: 'rejected',
    allowedTransitions: ['draft'],
    description: 'Rejected, needs revision',
  },
  sent_to_supplier: {
    status: 'sent_to_supplier',
    allowedTransitions: ['acknowledged', 'cancelled'],
    description: 'Sent to supplier, awaiting acknowledgment',
  },
  acknowledged: {
    status: 'acknowledged',
    allowedTransitions: ['partial', 'delivered', 'cancelled'],
    description: 'Supplier acknowledged the order',
  },
  partial: {
    status: 'partial',
    allowedTransitions: ['delivered', 'completed', 'cancelled'],
    description: 'Partially delivered',
  },
  delivered: {
    status: 'delivered',
    allowedTransitions: ['completed'],
    description: 'All items delivered, pending verification',
  },
  completed: {
    status: 'completed',
    allowedTransitions: [],
    description: 'PO completed and closed',
  },
  cancelled: {
    status: 'cancelled',
    allowedTransitions: [],
    description: 'PO cancelled',
  },
};

export const PO_WORKFLOW_TRANSITIONS: POWorkflowTransition[] = [
  // From draft
  {
    from: 'draft',
    to: 'pending_approval',
    action: 'submit',
    conditions: ['has_items', 'has_supplier', 'valid_amounts'],
    description: 'Submit PO for approval',
  },
  {
    from: 'draft',
    to: 'cancelled',
    action: 'cancel',
    description: 'Cancel draft PO',
  },
  
  // From pending_approval
  {
    from: 'pending_approval',
    to: 'approved',
    action: 'approve',
    requiredRole: 'project_manager',
    description: 'Approve the purchase order',
  },
  {
    from: 'pending_approval',
    to: 'rejected',
    action: 'reject',
    requiredRole: 'project_manager',
    description: 'Reject the purchase order',
  },
  
  // From approved
  {
    from: 'approved',
    to: 'sent_to_supplier',
    action: 'send_to_supplier',
    description: 'Send PO to supplier',
  },
  {
    from: 'approved',
    to: 'cancelled',
    action: 'cancel',
    description: 'Cancel approved PO',
  },
  
  // From rejected
  {
    from: 'rejected',
    to: 'draft',
    action: 'revise',
    description: 'Revise rejected PO',
  },
  
  // From sent_to_supplier
  {
    from: 'sent_to_supplier',
    to: 'acknowledged',
    action: 'acknowledge',
    description: 'Supplier acknowledges the order',
  },
  {
    from: 'sent_to_supplier',
    to: 'cancelled',
    action: 'cancel',
    description: 'Cancel PO sent to supplier',
  },
  
  // From acknowledged
  {
    from: 'acknowledged',
    to: 'partial',
    action: 'receive_partial',
    description: 'Record partial delivery',
  },
  {
    from: 'acknowledged',
    to: 'delivered',
    action: 'receive_full',
    description: 'Record full delivery',
  },
  {
    from: 'acknowledged',
    to: 'cancelled',
    action: 'cancel',
    description: 'Cancel acknowledged PO',
  },
  
  // From partial
  {
    from: 'partial',
    to: 'delivered',
    action: 'receive_remaining',
    conditions: ['all_items_received'],
    description: 'Record remaining delivery',
  },
  {
    from: 'partial',
    to: 'completed',
    action: 'complete_partial',
    description: 'Complete PO with partial delivery',
  },
  {
    from: 'partial',
    to: 'cancelled',
    action: 'cancel',
    description: 'Cancel partially delivered PO',
  },
  
  // From delivered
  {
    from: 'delivered',
    to: 'completed',
    action: 'complete',
    description: 'Complete and close PO',
  },
];

// ============================================================================
// WORKFLOW HELPERS
// ============================================================================

/**
 * Check if a transition is valid
 */
export const canTransitionPO = (
  currentStatus: PurchaseOrderStatus,
  targetStatus: PurchaseOrderStatus
): boolean => {
  const state = PO_WORKFLOW_STATES[currentStatus];
  return state.allowedTransitions.includes(targetStatus);
};

/**
 * Get available actions for a PO status
 */
export const getAvailablePOActions = (
  currentStatus: PurchaseOrderStatus,
  userRole?: string
): POWorkflowTransition[] => {
  const transitions = PO_WORKFLOW_TRANSITIONS.filter(t => t.from === currentStatus);
  
  if (userRole) {
    return transitions.filter(t => !t.requiredRole || t.requiredRole === userRole);
  }
  
  return transitions;
};

/**
 * Validate PO transition conditions
 */
export const validatePOTransitionConditions = (
  transition: POWorkflowTransition,
  context: {
    hasItems?: boolean;
    hasSupplier?: boolean;
    validAmounts?: boolean;
    allItemsReceived?: boolean;
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
          errors.push('PO must have at least one item');
        }
        break;
      case 'has_supplier':
        if (!context.hasSupplier) {
          errors.push('PO must have a supplier assigned');
        }
        break;
      case 'valid_amounts':
        if (!context.validAmounts) {
          errors.push('All item amounts must be valid');
        }
        break;
      case 'all_items_received':
        if (!context.allItemsReceived) {
          errors.push('Not all items have been received');
        }
        break;
    }
  }
  
  return { valid: errors.length === 0, errors };
};

/**
 * Get PO status display info
 */
export const getPOStatusDisplayInfo = (status: PurchaseOrderStatus): {
  label: string;
  color: string;
  icon: string;
  progress: number;
} => {
  const statusMap: Record<PurchaseOrderStatus, { label: string; color: string; icon: string; progress: number }> = {
    draft: { label: 'Draft', color: 'gray', icon: 'edit', progress: 10 },
    pending_approval: { label: 'Pending Approval', color: 'yellow', icon: 'clock', progress: 20 },
    approved: { label: 'Approved', color: 'blue', icon: 'check', progress: 30 },
    rejected: { label: 'Rejected', color: 'red', icon: 'x', progress: 0 },
    sent_to_supplier: { label: 'Sent to Supplier', color: 'purple', icon: 'send', progress: 40 },
    acknowledged: { label: 'Acknowledged', color: 'indigo', icon: 'check-circle', progress: 50 },
    partial: { label: 'Partial Delivery', color: 'orange', icon: 'package', progress: 70 },
    delivered: { label: 'Delivered', color: 'teal', icon: 'truck', progress: 90 },
    completed: { label: 'Completed', color: 'green', icon: 'check-circle', progress: 100 },
    cancelled: { label: 'Cancelled', color: 'gray', icon: 'slash', progress: 0 },
  };
  
  return statusMap[status];
};

/**
 * Calculate expected timeline for PO
 */
export const calculatePOTimeline = (
  createdAt: Date,
  expectedDeliveryDate: Date,
  status: PurchaseOrderStatus
): {
  daysElapsed: number;
  daysRemaining: number;
  isOverdue: boolean;
  estimatedCompletion: Date;
} => {
  const now = new Date();
  const daysElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.floor((expectedDeliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0 && !['completed', 'cancelled'].includes(status);
  
  // Estimate completion based on status progress
  const statusInfo = getPOStatusDisplayInfo(status);
  const remainingProgress = 100 - statusInfo.progress;
  const avgDaysPerProgress = daysElapsed / (statusInfo.progress || 1);
  const estimatedDaysRemaining = avgDaysPerProgress * remainingProgress;
  const estimatedCompletion = new Date(now.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000);
  
  return {
    daysElapsed,
    daysRemaining,
    isOverdue,
    estimatedCompletion,
  };
};

export default {
  PO_WORKFLOW_STATES,
  PO_WORKFLOW_TRANSITIONS,
  canTransitionPO,
  getAvailablePOActions,
  validatePOTransitionConditions,
  getPOStatusDisplayInfo,
  calculatePOTimeline,
};
