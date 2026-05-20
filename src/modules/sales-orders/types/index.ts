/**
 * Sales Order & Commercial Protection Module — Types
 * Closes the gap between quote approval and production/invoicing.
 */

import { Timestamp } from 'firebase/firestore';
import type { PartyRef } from '@/shared/types/party';

// ============================================================================
// STATUS & ENUMS
// ============================================================================

export type SalesOrderStatus =
  | 'draft'
  | 'sent_to_client'
  | 'negotiation'
  | 'client_accepted'
  | 'design_review'
  | 'awaiting_design_signoff'
  | 'design_approved'
  | 'scope_frozen'
  | 'awaiting_deposit'
  | 'deposit_received'
  | 'released_to_production'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type ChangeOrderType =
  | 'scope_addition'
  | 'scope_removal'
  | 'scope_modification'
  | 'price_adjustment'
  | 'timeline_change'
  | 'specification_change';

export type ChangeOrderStatus =
  | 'draft'
  | 'pending_internal'
  | 'pending_client'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type DesignSignOffStatus =
  | 'draft'
  | 'sent_to_client'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'superseded';

export type RiskType =
  | 'discount_exceeds_margin'
  | 'scope_change_after_freeze'
  | 'unsigned_design'
  | 'no_deposit'
  | 'expired_quote'
  | 'multiple_revisions'
  | 'verbal_agreement_only'
  | 'cost_exceeds_price'
  | 'missing_specifications'
  | 'client_history_risk';

export type DiscountType = 'percentage' | 'fixed_amount' | 'line_item';

export type DiscountApprovalStatus = 'pending' | 'approved' | 'rejected';

export type GateStatusValue = 'not_started' | 'in_progress' | 'approved' | 'rejected' | 'waived';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ItemCategory =
  | 'furniture'
  | 'fitout'
  | 'installation'
  | 'design_fee'
  | 'consultation'
  | 'other';

export type AttachmentType =
  | 'signed_quote'
  | 'signed_design'
  | 'scope_document'
  | 'change_order'
  | 'client_correspondence'
  | 'photo'
  | 'contract'
  | 'other';

export type SignOffDocumentType =
  | 'floor_plan'
  | 'elevation'
  | '3d_render'
  | 'material_board'
  | 'specification_sheet'
  | 'quote_breakdown'
  | 'scope_document';

export type ClientApprovalMethod =
  | 'digital_signature'
  | 'email_confirmation'
  | 'signed_document'
  | 'portal_acceptance';

export type SendVia = 'email' | 'client_portal' | 'whatsapp' | 'in_person';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface SalesOrder {
  id: string;
  subsidiaryId: string;

  // Identity
  orderNumber: string;
  title: string;
  description?: string;

  // Source Links
  designProjectId: string;
  /**
   * P16/F13 — canonical FK to the originating CRM deal. Backfill ran
   * 2026-04-18; the legacy `crmDealId` field was dropped post-migration.
   * Every SO created from the CRM → quote → SO path carries this;
   * design-manager-direct creates may omit it.
   */
  dealId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  /**
   * P8/F1 — shared cross-subsidiary party ref. Writers populate this
   * alongside `customerId` so readers can migrate without a data
   * backfill. Today every SO originates from a finishes CRMDeal or
   * quote, so writers default `partyKind` to `'finishes_customer'`.
   * When a SO is created from a CRMDeal, `dealToSalesOrderService`
   * forwards `deal.party` verbatim so any future advisory-origin
   * deal would propagate its kind here without extra wiring.
   */
  party?: PartyRef;
  /**
   * Quote cardinality: a SalesOrder has at most ONE accepted quote — the one
   * that was approved by the client and triggered SO creation. The deal that
   * produced this SO may have carried many historical quotes (revisions,
   * alternates); see `CRMDeal.linkedQuoteIds` (array) for the full history.
   * This field holds only the accepted quote.
   */
  quoteId?: string;

  // Quote Versioning
  originalQuoteAmount: number;
  currentAmount: number;
  currency: 'UGX' | 'USD';

  // Discount Tracking
  discounts: Discount[];
  totalDiscountAmount: number;
  totalDiscountPercent: number;

  // Scope Definition
  scopeVersion: number;
  scopeDescription: string;
  scopeItems: SalesOrderItem[];
  scopeFrozen: boolean;
  scopeFrozenAt?: Timestamp;
  scopeFrozenBy?: string;

  // Change Orders
  changeOrders: string[];
  totalChangeOrderValue: number;
  pendingChangeOrders: number;

  // Approval Gates
  gates: ApprovalGates;

  // Payment Terms
  paymentTerms: PaymentTerms;

  // Delivery
  expectedDeliveryDate?: Timestamp;
  deliveryAddress?: string;
  deliveryNotes?: string;
  installationRequired: boolean;

  // Status
  status: SalesOrderStatus;
  statusHistory: StatusChange[];

  // Contract Link
  contractId?: string;

  // Documents
  attachments: OrderAttachment[];

  // Risk Flags
  riskFlags: RiskFlag[];

  // Payment Tracking
  payments: PaymentRecord[];
  totalPaid: number;
  balanceRemaining: number;

  // QuickBooks Online sync
  qboSalesOrderId?: string;
  qboSalesOrderDocNumber?: string;
  qboInvoiceId?: string;
  qboInvoiceDocNumber?: string;
  qboSyncStatus?: 'pending' | 'synced' | 'error';
  qboSyncedAt?: Timestamp;
  qboSyncError?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
  expiresAt?: Timestamp;
}

export interface PaymentTerms {
  depositRequired: boolean;
  depositPercent?: number;
  depositAmount?: number;
  billingMilestones?: string[];
  paymentDueDays: number;
  retentionPercent?: number;
  milestonePayments?: {
    label: string;
    percentage: number;
  }[];
}

export type PaymentType = 'deposit' | 'milestone' | 'full';
export type PaymentMethod = 'Bank Transfer' | 'Mobile Money' | 'Cash' | 'Cheque' | string;

export interface PaymentRecord {
  id: string;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  currency: string;
  paymentDate: Timestamp;        // The actual date the payment was received
  receiptRef?: string;
  /** Auto-generated RCP-… id printed on PDF; separate from manual receipt reference. */
  receiptDocumentNumber?: string;
  receiptPdfUrl?: string;
  sharedViaWhatsApp: boolean;
  whatsAppPhone?: string;
  recordedAt: Timestamp;         // When this record was created in the system
  recordedBy: string;

  // QuickBooks Payment sync
  qboPaymentId?: string;
  qboPaymentSyncStatus?: 'pending' | 'synced' | 'error';
  qboPaymentSyncedAt?: Timestamp;
  qboPaymentSyncError?: string;
}

export interface SalesOrderItem {
  id: string;
  lineNumber: number;
  /** Stable link to `clientQuotes.lineItems[].id` when the line came from a quote. */
  quoteLineItemId?: string;
  designItemId?: string;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category: ItemCategory;

  // Source version tracking
  fromQuoteVersion: number;
  addedByChangeOrder?: string;
  removedByChangeOrder?: string;
  isActive: boolean;
}

export interface Discount {
  id: string;
  type: DiscountType;
  value: number;
  amount: number;
  reason: string;
  lineItemId?: string;

  // Approval
  requestedBy: string;
  requestedAt: Timestamp;
  approvalStatus: DiscountApprovalStatus;
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;

  // Policy check
  exceedsPolicy: boolean;
  policyThreshold: number;
}

export interface ApprovalGates {
  clientAcceptance: GateStatus;
  discountApproval: GateStatus;
  designSignOff: GateStatus;
  scopeFreeze: GateStatus;
  internalReview: GateStatus;
  depositReceived: GateStatus;
}

export type ApprovalGateId = keyof ApprovalGates;

export interface GateStatus {
  required: boolean;
  status: GateStatusValue;
  approvedBy?: string;
  approvedAt?: Timestamp;
  evidence?: string;
  notes?: string;
  rejectionReason?: string;

  // Client-facing gates
  sentToClientAt?: Timestamp;
  clientRespondedAt?: Timestamp;
  clientSignatureRef?: string;
}

export interface RiskFlag {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  message: string;
  createdAt: Timestamp;
  createdBy?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolutionNotes?: string;
  autoDetected: boolean;
}

export interface StatusChange {
  fromStatus: SalesOrderStatus | null;
  toStatus: SalesOrderStatus;
  changedAt: Timestamp;
  changedBy: string;
  notes?: string;
}

export interface OrderAttachment {
  id: string;
  fileName: string;
  storagePath: string;
  type: AttachmentType;
  description?: string;
  uploadedBy: string;
  uploadedAt: Timestamp;
  isClientFacing: boolean;
}

// ============================================================================
// CHANGE ORDER
// ============================================================================

export interface ChangeOrder {
  id: string;
  subsidiaryId: string;
  salesOrderId: string;
  changeOrderNumber: string;

  // What Changed
  type: ChangeOrderType;
  title: string;
  description: string;
  reason: string;
  requestedBy: 'client' | 'internal';

  // Financial Impact
  /** Extra negotiated delta not tied to line-item add/remove/modify rows. */
  negotiatedPriceAdjustment?: number;
  /** Optional context for negotiated discount/credit approvals. */
  negotiatedAdjustmentNote?: string;
  priceImpact: number;
  previousOrderTotal: number;
  newOrderTotal: number;

  // Item Changes
  itemsAdded: SalesOrderItem[];
  itemsRemoved: ChangeOrderRemoval[];
  itemsModified: ChangeOrderModification[];

  // Timeline Impact
  deliveryDateImpact?: number;
  previousDeliveryDate?: Timestamp;
  newDeliveryDate?: Timestamp;

  // Approval
  status: ChangeOrderStatus;
  internalApprovalRequired: boolean;
  internalApprovedBy?: string;
  internalApprovedAt?: Timestamp;
  clientApprovalRequired: boolean;
  clientApprovedAt?: Timestamp;
  clientApprovalEvidence?: string;

  // Timeline of the approval flow
  submittedForInternalAt?: Timestamp;
  submittedForInternalBy?: string;
  submittedToClientAt?: Timestamp;
  submittedToClientBy?: string;
  sentToClientVia?: SendVia[];

  // Rejection / withdrawal
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  withdrawnAt?: Timestamp;
  withdrawnBy?: string;
  withdrawnReason?: string;

  // Applied snapshot (set when CO transitions to 'approved' and is applied to SO)
  appliedAt?: Timestamp;
  appliedBy?: string;

  // Manufacturing cascade linkage (populated in Phase 4)
  linkedMOIds?: string[];

  /**
   * Portal token id used for client-facing deep links. Reused across
   * channels (WhatsApp, email, direct share) so revocation flips every
   * channel at once. Created lazily the first time the CO is sent to
   * a client; absent until then.
   */
  portalTokenId?: string;

  /**
   * Per-channel delivery tracking — populated by the Phase 6
   * notification service. Each channel stores its own send / delivered
   * / read / clicked timestamps (whatever the channel reports) so the
   * CO detail UI can show "Sent via WhatsApp at 14:22, read 14:25".
   */
  deliveryTracking?: ChangeOrderDeliveryTracking;

  // Risk
  isPostScopeFreeze: boolean;
  scopeVersionBefore: number;
  scopeVersionAfter: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface ChangeOrderDeliveryTracking {
  whatsapp?: WhatsAppDeliveryStatus;
  email?: EmailDeliveryStatus;
  portal?: PortalDeliveryStatus;
}

export interface WhatsAppDeliveryStatus {
  conversationId?: string;
  messageId?: string;          // Firestore doc id of the message
  waMessageId?: string;        // Meta wamid.xxx id for webhook matching
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  clickedAt?: Timestamp;       // client tapped the CTA button / deep-link
  phoneNumber?: string;
  templateName?: string;       // if a Meta template was used
  lastError?: string;
  sentBy?: string;
}

export interface EmailDeliveryStatus {
  provider?: 'resend' | 'sendgrid' | 'manual';
  messageId?: string;
  toAddress?: string;
  sentAt?: Timestamp;
  openedAt?: Timestamp;
  clickedAt?: Timestamp;
  lastError?: string;
  sentBy?: string;
}

export interface PortalDeliveryStatus {
  lastSharedAt?: Timestamp;
  sharedBy?: string;
  lastShareUrl?: string;
}

/**
 * Approval event log — lives under `changeOrders/{coId}/approvalEvents`.
 * One row per state transition or client interaction. Evidence captures
 * the channel and, where applicable, the raw delivery metadata so an
 * auditor can reconstruct exactly which party approved via which route.
 */
export type ChangeOrderApprovalChannel =
  | 'internal'
  | 'portal'
  | 'whatsapp'
  | 'email'
  | 'in_person';

export type ChangeOrderApprovalAction =
  | 'created'
  | 'submitted_for_internal'
  | 'internal_approved'
  | 'internal_rejected'
  | 'submitted_to_client'
  | 'client_approved'
  | 'client_rejected'
  | 'withdrawn'
  | 'applied_to_so';

export interface ChangeOrderApprovalEvent {
  id: string;
  changeOrderId: string;
  action: ChangeOrderApprovalAction;
  fromStatus: ChangeOrderStatus | null;
  toStatus: ChangeOrderStatus;
  channel: ChangeOrderApprovalChannel;
  actorId: string;          // user id (for internal actions) or client identifier
  actorName?: string;
  notes?: string;
  evidence?: string;        // signature ref, token id, message id, attachment ref
  evidenceType?: 'signature' | 'token' | 'message_id' | 'attachment' | 'free_text';
  rawMetadata?: Record<string, string | number | boolean>; // channel-specific
  createdAt: Timestamp;
}

/**
 * Pricing impact computed by `pricingService.recalculateChangeOrderImpact`.
 * Revenue is derived from CO line items; cost uses linked DesignItem
 * manufacturing rollups where available (falls back to null when the
 * delta cost cannot be estimated from current data).
 */
export interface ChangeOrderPriceImpact {
  changeOrderId: string;
  salesOrderId: string;

  // Revenue side (what client will be billed)
  addedRevenue: number;
  removedRevenue: number;
  modifiedRevenue: number;
  negotiatedAdjustmentRevenue?: number;
  deltaRevenue: number;

  previousOrderTotal: number;
  newOrderTotal: number;

  // Cost side (best-effort estimate from design items)
  deltaEstimatedCost: number | null;
  costEstimateIsComplete: boolean;   // false if any added/modified item has no linked design item
  missingCostItemIds: string[];

  // Margin impact
  previousMargin: number | null;
  newMargin: number | null;
  marginDelta: number | null;
  marginBelowMinimum: boolean;
  minimumMarginPercent: number | null;

  // Warnings for caller UI
  warnings: string[];
  computedAt: Timestamp;
}

export interface ChangeOrderRemoval {
  itemId: string;
  description: string;
  amount: number;
}

export interface ChangeOrderModification {
  itemId: string;
  field: string;
  oldValue: string;
  newValue: string;
  priceImpact: number;
}

// ============================================================================
// DESIGN SIGN-OFF
// ============================================================================

export interface DesignSignOff {
  id: string;
  subsidiaryId: string;
  salesOrderId: string;
  designProjectId: string;

  // Version
  designVersion: number;
  scopeVersion: number;
  signOffNumber: string;

  // Content
  title: string;
  description: string;
  designDocuments: SignOffDocument[];
  itemsCovered: string[];
  specificationsSnapshot: string;

  // Client Approval
  status: DesignSignOffStatus;
  sentToClientAt?: Timestamp;
  sentToClientVia: SendVia;
  clientPortalToken?: string;

  // Approval evidence
  clientApprovedAt?: Timestamp;
  clientApprovalMethod: ClientApprovalMethod;
  clientSignatureRef?: string;
  clientApprovalNotes?: string;
  approvedByName?: string;
  approvedByEmail?: string;

  // Rejection
  clientRejectedAt?: Timestamp;
  rejectionReasons?: string[];
  rejectionNotes?: string;

  // Expiry
  expiresAt?: Timestamp;
  isValid: boolean;

  // Legal
  disclaimerText: string;
  termsAccepted: boolean;

  createdAt: Timestamp;
  createdBy: string;
}

export interface SignOffDocument {
  id: string;
  fileName: string;
  storagePath: string;
  type: SignOffDocumentType;
  description?: string;
  pageCount?: number;
}

// ============================================================================
// DISCOUNT POLICY
// ============================================================================

export interface DiscountPolicy {
  id: string;
  subsidiaryId?: string;

  // Auto-approve thresholds
  autoApproveMaxPercent: number;
  autoApproveMaxAmount: number;

  // Approval levels
  managerApproveMaxPercent: number;
  ceoApproveMaxPercent: number;

  // Margin protection
  minimumMarginPercent: number;
  minimumMarginWarning: number;

  // Category rules
  categoryRules: CategoryDiscountRule[];

  // Repeat client rules
  repeatClientBonusPercent?: number;

  isActive: boolean;
  updatedAt: Timestamp;
}

export interface CategoryDiscountRule {
  category: string;
  maxDiscountPercent: number;
  notes: string;
}

// ============================================================================
// SERVICE RESULT TYPES
// ============================================================================

export interface GateReadiness {
  ready: boolean;
  blockedBy: { gate: string; reason: string }[];
  warnings: string[];
}

export interface ReleaseResult {
  success: boolean;
  contractId?: string;
  manufacturingOrderIds?: string[];
  errors: string[];
  warnings: string[];
  gatesBlocking: string[];
}

export interface DiscountEvaluation {
  autoApproved: boolean;
  requiredApprover?: 'manager' | 'ceo' | 'special';
  marginAfterDiscount: number;
  marginBelowMinimum: boolean;
  exceedsPolicy: boolean;
  warnings: string[];
}

export interface MarginAnalysis {
  originalMargin: number;
  newMargin: number;
  marginReduction: number;
  belowMinimum: boolean;
  estimatedCost: number;
  projectedProfit: number;
}

export interface ActionableSalesOrder {
  salesOrder: SalesOrder;
  requiredAction:
    | 'send_to_client'
    | 'collect_design_signoff'
    | 'approve_discount'
    | 'approve_change_order'
    | 'collect_deposit'
    | 'internal_review'
    | 'resolve_risk'
    | 'release_to_production';
  urgency: RiskSeverity;
  daysPending: number;
}

// ============================================================================
// FILTERS
// ============================================================================

export interface SalesOrderFilters {
  status?: SalesOrderStatus[];
  subsidiaryId?: string;
  customerId?: string;
  dateRange?: { from: Timestamp; to: Timestamp };
  hasRiskFlags?: boolean;
  awaitingAction?: boolean;
  createdBy?: string;
  search?: string;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export interface SalesOrderDashboardStats {
  totalOrders: number;
  byStatus: Partial<Record<SalesOrderStatus, number>>;
  totalPipelineValue: number;
  awaitingClientResponse: number;
  readyToRelease: number;
  pendingDiscounts: number;
  activeRiskFlags: number;
  averageDaysToRelease: number;
}

// ============================================================================
// CLIENT APPROVAL RECORD (for design sign-offs and change orders)
// ============================================================================

export interface ClientApprovalRecord {
  approvalMethod: ClientApprovalMethod;
  signatureRef?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  notes?: string;
  timestamp: Timestamp;
}
