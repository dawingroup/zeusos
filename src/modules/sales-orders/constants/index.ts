/**
 * Sales Order Module — Constants
 */

import type {
  SalesOrderStatus,
  ApprovalGateId,
  RiskType,
  RiskSeverity,
  ChangeOrderStatus,
  DesignSignOffStatus,
  ItemCategory,
  PaymentTerms,
} from '../types';

// ============================================================================
// COLLECTION NAMES
// ============================================================================

export const SO_COLLECTION = 'salesOrders';
export const CHANGE_ORDERS_COLLECTION = 'changeOrders';
export const CHANGE_ORDER_APPROVAL_EVENTS_SUBCOLLECTION = 'approvalEvents';
export const DESIGN_SIGNOFFS_COLLECTION = 'designSignOffs';
export const DISCOUNT_POLICIES_COLLECTION = 'discountPolicies';
export const BUSINESS_EVENTS_COLLECTION = 'businessEvents';
export const CLIENT_PORTAL_TOKENS_COLLECTION = 'clientPortalTokens';

// ============================================================================
// STATUS LABELS & COLORS
// ============================================================================

export const SO_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  draft: 'Draft',
  sent_to_client: 'Sent to Client',
  negotiation: 'Negotiation',
  client_accepted: 'Client Accepted',
  design_review: 'Design Review',
  awaiting_design_signoff: 'Awaiting Design Sign-Off',
  design_approved: 'Design Approved',
  scope_frozen: 'Scope Frozen',
  awaiting_deposit: 'Awaiting Deposit',
  deposit_received: 'Deposit Received',
  released_to_production: 'Released to Production',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

export const SO_STATUS_COLORS: Record<SalesOrderStatus, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#374151' },
  sent_to_client: { bg: '#DBEAFE', text: '#1E40AF' },
  negotiation: { bg: '#FEF3C7', text: '#92400E' },
  client_accepted: { bg: '#D1FAE5', text: '#065F46' },
  design_review: { bg: '#E0E7FF', text: '#3730A3' },
  awaiting_design_signoff: { bg: '#FCE7F3', text: '#9D174D' },
  design_approved: { bg: '#CFFAFE', text: '#155E75' },
  scope_frozen: { bg: '#E0E7FF', text: '#3730A3' },
  awaiting_deposit: { bg: '#FEF3C7', text: '#92400E' },
  deposit_received: { bg: '#D1FAE5', text: '#065F46' },
  released_to_production: { bg: '#EDE9FE', text: '#5B21B6' },
  in_progress: { bg: '#FED7AA', text: '#9A3412' },
  completed: { bg: '#BBF7D0', text: '#166534' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
  disputed: { bg: '#FEE2E2', text: '#991B1B' },
};

export const SO_STATUS_ORDER: SalesOrderStatus[] = [
  'draft',
  'sent_to_client',
  'negotiation',
  'client_accepted',
  'design_review',
  'awaiting_design_signoff',
  'design_approved',
  'scope_frozen',
  'awaiting_deposit',
  'deposit_received',
  'released_to_production',
  'in_progress',
  'completed',
  'cancelled',
  'disputed',
];

// ============================================================================
// STATUS TRANSITION RULES
// ============================================================================

/** Valid status transitions. Key = current status, value = allowed targets. */
export const STATUS_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ['sent_to_client', 'cancelled'],
  sent_to_client: ['negotiation', 'client_accepted', 'cancelled'],
  negotiation: ['client_accepted', 'cancelled'],
  client_accepted: ['design_review', 'cancelled'],
  design_review: ['awaiting_design_signoff', 'cancelled'],
  awaiting_design_signoff: ['design_approved', 'design_review', 'cancelled'],
  design_approved: ['scope_frozen', 'cancelled'],
  scope_frozen: ['awaiting_deposit', 'released_to_production', 'cancelled'],
  awaiting_deposit: ['deposit_received', 'cancelled'],
  deposit_received: ['released_to_production', 'cancelled'],
  released_to_production: ['in_progress', 'disputed'],
  in_progress: ['completed', 'disputed'],
  completed: ['disputed'],
  cancelled: [],
  disputed: ['in_progress', 'cancelled'],
};

/**
 * Gates required to be passed before a status transition.
 * Key = target status, value = gates that must be 'approved' or 'waived'.
 */
export const GATE_REQUIREMENTS: Partial<Record<SalesOrderStatus, ApprovalGateId[]>> = {
  client_accepted: ['clientAcceptance'],
  design_approved: ['designSignOff'],
  scope_frozen: ['scopeFreeze'],
  released_to_production: [
    'clientAcceptance',
    'discountApproval',
    'designSignOff',
    'scopeFreeze',
    'internalReview',
    'depositReceived',
  ],
};

// ============================================================================
// GATE CONFIGURATION
// ============================================================================

export const GATE_LABELS: Record<ApprovalGateId, string> = {
  clientAcceptance: 'Client Acceptance',
  discountApproval: 'Discount Approval',
  designSignOff: 'Design Sign-Off',
  scopeFreeze: 'Scope Freeze',
  internalReview: 'Internal Review',
  depositReceived: 'Deposit Received',
};

export const GATE_DESCRIPTIONS: Record<ApprovalGateId, string> = {
  clientAcceptance: 'Client has formally accepted the quote',
  discountApproval: 'All discounts are within policy or approved',
  designSignOff: 'Client has approved the final design documents',
  scopeFreeze: 'Scope is locked — changes require a formal change order',
  internalReview: 'Manager/CEO approval for high-value orders',
  depositReceived: 'Required deposit payment has been received',
};

export const GATE_ORDER: ApprovalGateId[] = [
  'clientAcceptance',
  'discountApproval',
  'designSignOff',
  'scopeFreeze',
  'internalReview',
  'depositReceived',
];

/** Order value threshold above which internal review is required (UGX) */
export const INTERNAL_REVIEW_THRESHOLD = 20_000_000;

// ============================================================================
// RISK TYPE LABELS
// ============================================================================

export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  discount_exceeds_margin: 'Discount exceeds profit margin',
  scope_change_after_freeze: 'Scope change after freeze',
  unsigned_design: 'Production without design sign-off',
  no_deposit: 'Work starting without deposit',
  expired_quote: 'Quote validity expired',
  multiple_revisions: 'Excessive scope changes (scope creep)',
  verbal_agreement_only: 'No written acceptance on file',
  cost_exceeds_price: 'Projected cost exceeds selling price',
  missing_specifications: 'Items without detailed specifications',
  client_history_risk: 'Client has dispute/late payment history',
};

export const RISK_SEVERITY_ORDER: RiskSeverity[] = ['critical', 'high', 'medium', 'low'];

export const RISK_SEVERITY_COLORS: Record<RiskSeverity, { bg: string; text: string; icon: string }> = {
  critical: { bg: '#FEE2E2', text: '#991B1B', icon: '#DC2626' },
  high: { bg: '#FED7AA', text: '#9A3412', icon: '#EA580C' },
  medium: { bg: '#FEF3C7', text: '#92400E', icon: '#D97706' },
  low: { bg: '#FEF9C3', text: '#854D0E', icon: '#CA8A04' },
};

// ============================================================================
// CHANGE ORDER LABELS
// ============================================================================

export const CO_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  draft: 'Draft',
  pending_internal: 'Pending Internal Approval',
  pending_client: 'Pending Client Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/**
 * Valid CO status transitions. Keys are the current status; values are
 * allowed target states. `terminal` statuses have an empty array and
 * cannot be left via a state-changing mutation.
 * Hop rules:
 *   draft            → pending_internal (submit for internal approval)
 *                    → pending_client   (when internal approval not required)
 *                    → withdrawn
 *   pending_internal → pending_client   (internal approved + client required)
 *                    → approved         (internal approved + client not required)
 *                    → rejected         (internal rejected)
 *                    → withdrawn
 *   pending_client   → approved         (client approved)
 *                    → rejected         (client rejected)
 *                    → withdrawn
 *   approved         → (terminal — changes to SO are applied)
 *   rejected         → (terminal)
 *   withdrawn        → (terminal)
 */
export const CO_STATUS_TRANSITIONS: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  draft: ['pending_internal', 'pending_client', 'withdrawn'],
  pending_internal: ['pending_client', 'approved', 'rejected', 'withdrawn'],
  pending_client: ['approved', 'rejected', 'withdrawn'],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export const CO_OPEN_STATUSES: ChangeOrderStatus[] = [
  'draft',
  'pending_internal',
  'pending_client',
];

export const CO_TERMINAL_STATUSES: ChangeOrderStatus[] = [
  'approved',
  'rejected',
  'withdrawn',
];

export const CO_TYPE_LABELS: Record<string, string> = {
  scope_addition: 'Scope Addition',
  scope_removal: 'Scope Removal',
  scope_modification: 'Scope Modification',
  price_adjustment: 'Price Adjustment',
  timeline_change: 'Timeline Change',
  specification_change: 'Specification Change',
};

// ============================================================================
// DESIGN SIGN-OFF LABELS
// ============================================================================

export const DSO_STATUS_LABELS: Record<DesignSignOffStatus, string> = {
  draft: 'Draft',
  sent_to_client: 'Sent to Client',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  superseded: 'Superseded',
};

// ============================================================================
// ITEM CATEGORY LABELS
// ============================================================================

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  furniture: 'Furniture',
  fitout: 'Fit-Out',
  installation: 'Installation',
  design_fee: 'Design Fee',
  consultation: 'Consultation',
  other: 'Other',
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_PAYMENT_TERMS: PaymentTerms = {
  depositRequired: true,
  depositPercent: 50,
  paymentDueDays: 30,
  retentionPercent: 0,
};

/** Maximum scope change orders before 'multiple_revisions' risk flag */
export const MAX_CHANGE_ORDERS_BEFORE_RISK = 3;

/** Default quote validity in days */
export const DEFAULT_QUOTE_VALIDITY_DAYS = 30;

/** Design sign-off request expiry in days */
export const DEFAULT_SIGNOFF_EXPIRY_DAYS = 14;

export const DEFAULT_DISCLAIMER_TEXT =
  'By approving, you confirm these designs match your requirements. Changes after approval will require a formal change order with potential cost and timeline impact.';
