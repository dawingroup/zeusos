import { Timestamp } from 'firebase/firestore';
import { Money } from './money';
import { FundingCategory } from './funding-category';

/**
 * APPROVAL TYPE
 * Types of items requiring approval
 */
export type ApprovalType =
  // Payments
  | 'payment_request'
  | 'interim_payment_certificate'
  | 'requisition'
  | 'accountability'
  
  // Procurement
  | 'procurement_request'
  | 'vendor_selection'
  | 'contract_award'
  
  // Changes
  | 'budget_reallocation'
  | 'scope_change'
  | 'timeline_extension'
  | 'cost_overrun'
  
  // Documents
  | 'report_submission'
  | 'certificate_issuance'
  
  // Investment
  | 'investment_decision'
  | 'deal_approval'
  | 'valuation_approval'
  
  // Advisory
  | 'trade_execution'
  | 'rebalancing'
  | 'recommendation';

/**
 * APPROVAL STATUS
 */
export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled';

/**
 * APPROVER TYPE
 */
export type ApproverType =
  | 'user'               // Specific user
  | 'role'               // Anyone with role
  | 'team_lead'          // Engagement lead
  | 'funder'             // External funder
  | 'auto';              // Automatic (system)

/**
 * APPROVAL PRIORITY
 */
export type ApprovalPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * APPROVAL STEP STATUS
 */
export type ApprovalStepStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'skipped';

/**
 * APPROVAL DECISION
 */
export type ApprovalDecisionType = 'approved' | 'rejected' | 'returned';

/**
 * APPROVAL CONDITION
 */
export interface ApprovalCondition {
  /** Condition type */
  type: 'amount_threshold' | 'funding_source' | 'approval_type' | 'custom';
  
  /** For amount_threshold */
  amountThreshold?: Money;
  
  /** For funding_source */
  fundingCategories?: FundingCategory[];
  funderIds?: string[];
  
  /** For approval_type */
  approvalTypes?: ApprovalType[];
  
  /** Custom condition expression */
  customExpression?: string;
}

/**
 * APPROVAL STEP
 * A single step in an approval chain
 */
export interface ApprovalStep {
  /** Step sequence */
  sequence: number;
  
  /** Step name */
  name: string;
  
  /** Approver type */
  approverType: ApproverType;
  
  /** Specific approver (user ID or role) */
  approverId?: string;
  
  /** Approver role (if type is 'role') */
  approverRole?: string;
  
  /** Funder ID (if type is 'funder') */
  funderId?: string;
  
  /** Is this step required or optional */
  isRequired: boolean;
  
  /** Is this step conditional */
  isConditional: boolean;
  
  /** Condition for step (if conditional) */
  condition?: ApprovalCondition;
  
  /** Step status */
  status: ApprovalStepStatus;
  
  /** Decision made */
  decision?: ApprovalDecisionType;
  
  /** Decision by (user ID) */
  decisionBy?: string;
  
  /** Decision date */
  decisionAt?: Timestamp;
  
  /** Comments */
  comments?: string;
  
  /** SLA hours */
  slaHours?: number;
  
  /** Is past SLA */
  isPastSLA?: boolean;
}

/**
 * APPROVAL REQUEST
 * An item pending approval
 */
export interface ApprovalRequest {
  id: string;
  
  /** Engagement context */
  engagementId: string;
  
  /** Entity type being approved */
  entityType: string;
  
  /** Entity ID being approved */
  entityId: string;
  
  // ─────────────────────────────────────────────────────────────────
  // REQUEST DETAILS
  // ─────────────────────────────────────────────────────────────────
  
  /** Approval type */
  type: ApprovalType;
  
  /** Request title */
  title: string;
  
  /** Description */
  description: string;
  
  /** Amount (if financial) */
  amount?: Money;
  
  /** Priority */
  priority: ApprovalPriority;
  
  // ─────────────────────────────────────────────────────────────────
  // APPROVAL CHAIN
  // ─────────────────────────────────────────────────────────────────
  
  /** Approval chain for this request */
  approvalChain: ApprovalStep[];
  
  /** Current step index */
  currentStepIndex: number;
  
  /** Is chain complete */
  isComplete: boolean;
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────
  
  /** Overall status */
  status: ApprovalStatus;
  
  /** Final decision */
  finalDecision?: 'approved' | 'rejected';
  
  /** Final decision date */
  finalDecisionDate?: Timestamp;
  
  // ─────────────────────────────────────────────────────────────────
  // DOCUMENTS
  // ─────────────────────────────────────────────────────────────────
  
  /** Supporting documents */
  documentIds: string[];
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  requestedBy: string;
  requestedAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * APPROVAL DECISION (Action record)
 */
export interface ApprovalDecision {
  requestId: string;
  stepSequence: number;
  decision: ApprovalDecisionType;
  comments?: string;
  conditions?: string[];
  decisionBy: string;
  decisionAt: Timestamp;
}

/**
 * CREATE APPROVAL REQUEST DATA
 */
export interface CreateApprovalRequestData {
  engagementId: string;
  entityType: string;
  entityId: string;
  type: ApprovalType;
  title: string;
  description: string;
  amount?: Money;
  priority?: ApprovalPriority;
  documentIds?: string[];
}

/**
 * APPROVAL REQUEST SUMMARY
 */
export interface ApprovalRequestSummary {
  id: string;
  type: ApprovalType;
  title: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  amount?: Money;
  requestedBy: string;
  requestedAt: Timestamp;
  currentStepName?: string;
  isPastSLA: boolean;
}

/**
 * Get approval status display name
 */
export function getApprovalStatusDisplayName(status: ApprovalStatus): string {
  const names: Record<ApprovalStatus, string> = {
    draft: 'Draft',
    pending: 'Pending',
    in_review: 'In Review',
    approved: 'Approved',
    rejected: 'Rejected',
    returned: 'Returned',
    cancelled: 'Cancelled',
  };
  return names[status];
}

/**
 * Get approval status color
 */
export function getApprovalStatusColor(status: ApprovalStatus): string {
  const colors: Record<ApprovalStatus, string> = {
    draft: 'gray',
    pending: 'yellow',
    in_review: 'blue',
    approved: 'green',
    rejected: 'red',
    returned: 'orange',
    cancelled: 'gray',
  };
  return colors[status];
}

/**
 * Get approval type display name
 */
export function getApprovalTypeDisplayName(type: ApprovalType): string {
  const names: Record<ApprovalType, string> = {
    payment_request: 'Payment Request',
    interim_payment_certificate: 'Interim Payment Certificate',
    requisition: 'Requisition',
    accountability: 'Accountability',
    procurement_request: 'Procurement Request',
    vendor_selection: 'Vendor Selection',
    contract_award: 'Contract Award',
    budget_reallocation: 'Budget Reallocation',
    scope_change: 'Scope Change',
    timeline_extension: 'Timeline Extension',
    cost_overrun: 'Cost Overrun',
    report_submission: 'Report Submission',
    certificate_issuance: 'Certificate Issuance',
    investment_decision: 'Investment Decision',
    deal_approval: 'Deal Approval',
    valuation_approval: 'Valuation Approval',
    trade_execution: 'Trade Execution',
    rebalancing: 'Portfolio Rebalancing',
    recommendation: 'Investment Recommendation',
  };
  return names[type];
}

/**
 * Get approval type category
 */
export function getApprovalTypeCategory(type: ApprovalType): string {
  const payments: ApprovalType[] = ['payment_request', 'interim_payment_certificate', 'requisition', 'accountability'];
  const procurement: ApprovalType[] = ['procurement_request', 'vendor_selection', 'contract_award'];
  const changes: ApprovalType[] = ['budget_reallocation', 'scope_change', 'timeline_extension', 'cost_overrun'];
  const documents: ApprovalType[] = ['report_submission', 'certificate_issuance'];
  const investment: ApprovalType[] = ['investment_decision', 'deal_approval', 'valuation_approval'];
  const advisory: ApprovalType[] = ['trade_execution', 'rebalancing', 'recommendation'];
  
  if (payments.includes(type)) return 'Payments';
  if (procurement.includes(type)) return 'Procurement';
  if (changes.includes(type)) return 'Changes';
  if (documents.includes(type)) return 'Documents';
  if (investment.includes(type)) return 'Investment';
  if (advisory.includes(type)) return 'Advisory';
  return 'Other';
}

/**
 * Get priority display name
 */
export function getPriorityDisplayName(priority: ApprovalPriority): string {
  const names: Record<ApprovalPriority, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  };
  return names[priority];
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: ApprovalPriority): string {
  const colors: Record<ApprovalPriority, string> = {
    low: 'gray',
    normal: 'blue',
    high: 'orange',
    urgent: 'red',
  };
  return colors[priority];
}

/**
 * Check if request is pending action
 */
export function isRequestPending(status: ApprovalStatus): boolean {
  return ['pending', 'in_review'].includes(status);
}

/**
 * Check if request is terminal
 */
export function isRequestTerminal(status: ApprovalStatus): boolean {
  return ['approved', 'rejected', 'cancelled'].includes(status);
}

/**
 * Get current step from approval chain
 */
export function getCurrentStep(chain: ApprovalStep[]): ApprovalStep | undefined {
  return chain.find(s => s.status === 'pending' || s.status === 'in_progress');
}

/**
 * Check if any step is past SLA
 */
export function hasStepPastSLA(chain: ApprovalStep[]): boolean {
  return chain.some(s => s.isPastSLA);
}
