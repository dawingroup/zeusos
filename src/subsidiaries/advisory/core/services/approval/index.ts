/**
 * APPROVAL ENGINE - Public API
 */

// Configuration
export {
  type ApprovalConfig,
  type ApprovalTypeRule,
  type FunderApprovalRule,
  type AmountThreshold,
  type EscalationRule,
  buildDefaultApprovalConfig,
  getApprovalTypeRule,
  getFunderRules,
  getApplicableThreshold,
  getEscalationRule,
  mergeApprovalConfig,
} from './approval-config';

// Chain Builder
export {
  ApprovalChainBuilder,
  type ApprovalChainContext,
  type ApprovalChainResult,
  createApprovalChainBuilder,
  createCustomApprovalChainBuilder,
} from './approval-chain-builder';

// Engine
export {
  ApprovalEngine,
  approvalEngine,
  type CreateApprovalRequestData,
  type ApprovalAction,
  type ApprovalEvent,
  type ApprovalEventType,
  type ApprovalEventHandler,
} from './approval-engine';

// Hooks
export {
  useApprovalRequest,
  useEngagementApprovals,
  useMyPendingApprovals,
  useApprovalMutations,
  useCanApprove,
  useApprovalProgress,
  useApprovalSummary,
} from './approval-hooks';
