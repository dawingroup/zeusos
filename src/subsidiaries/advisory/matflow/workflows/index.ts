/**
 * MatFlow Workflows Index
 * 
 * Central export for workflow state machines and approval engine.
 */

// Requisition Workflow
export {
  type WorkflowRequisitionStatus,
  type ApprovalStage,
  type WorkflowState,
  type WorkflowTransition,
  type ApprovalStageConfig,
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
} from './requisition-workflow';

// PO Workflow
export {
  type PurchaseOrderStatus,
  type POWorkflowState,
  type POWorkflowTransition,
  PO_WORKFLOW_STATES,
  PO_WORKFLOW_TRANSITIONS,
  canTransitionPO,
  getAvailablePOActions,
  validatePOTransitionConditions,
  getPOStatusDisplayInfo,
  calculatePOTimeline,
} from './po-workflow';

// Approval Engine
export {
  ApprovalEngine,
  createApprovalEngine,
  REQUISITION_APPROVAL_CONFIG,
  PO_APPROVAL_CONFIG,
  type ApprovalConfig,
  type ApprovalStageDefinition,
  type ApproverRequirement,
  type AutoApproveCondition,
  type EscalationRule,
  type NotificationSettings,
  type ApprovalInstance,
  type ApprovalInstanceStatus,
  type ApprovalStageInstance,
  type ApprovalAction,
  type ApprovalContext,
} from './approval-engine';
