/**
 * CRM Module Types
 * Deal/opportunity management, activity tracking, and sales pipeline types
 */

import type { Timestamp } from 'firebase/firestore';
import type { PartyRef } from '@/shared/types/party';

// ============================================================
// Deal / Opportunity Types
// ============================================================

/**
 * CRM deal stages - tailored for manufacturing/design sales cycle
 */
export type CRMDealStage =
  | 'lead'
  | 'qualification'
  | 'site_visit'
  | 'design_proposal'
  | 'quotation'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'on_hold';

export type DealSource =
  | 'referral'
  | 'website'
  | 'walk_in'
  | 'repeat_client'
  | 'social_media'
  | 'trade_show'
  | 'cold_outreach'
  | 'other';

export type DealPriority = 'low' | 'medium' | 'high' | 'critical';

export interface CRMDeal {
  id: string;

  // Core identification
  dealNumber: string;
  title: string;
  description?: string;

  // Customer link
  customerId: string;
  customerName: string;
  customerPhone?: string;

  /**
   * P8/F1 — shared cross-subsidiary party ref. Writers populate this
   * alongside the legacy `customerId` so readers can migrate to it
   * without a data backfill. When unset, treat the row as a legacy
   * finishes Customer via `customerId`. Written by crmDealService.
   *
   * Today every CRMDeal originates in the finishes subsidiary, so
   * writers default `partyKind` to `'finishes_customer'`. Advisory-
   * origin deals (if introduced later) would set `'advisory_client'`.
   */
  party?: PartyRef;

  // Pipeline
  stage: CRMDealStage;
  probability: number;
  priority: DealPriority;
  source: DealSource;

  // Financial
  estimatedValue: number;
  currency: string;
  weightedValue: number;

  // Linked entities
  linkedProjectId?: string;
  /**
   * Quote cardinality: one deal MAY accumulate MANY quotes over its lifetime
   * (initial quote, revisions, alternates). This is why it's an array.
   * In contrast, a `SalesOrder` has at most ONE `quoteId` — the accepted quote
   * that the order was generated from (see `modules/sales-orders/types/index.ts`).
   * When a quote is accepted and converted to a SO, its id ends up both:
   *   - here in `CRMDeal.linkedQuoteIds` (historical set on the deal)
   *   - and singular on `SalesOrder.quoteId` (the accepted one)
   */
  linkedQuoteIds: string[];
  linkedMOIds: string[];
  linkedSalesOrderId?: string;

  // Assignment
  ownerId: string;
  ownerName: string;
  teamMemberIds: string[];

  // Dates
  expectedCloseDate?: Timestamp;
  actualCloseDate?: Timestamp;
  lastContactDate?: Timestamp;
  nextFollowUpDate?: Timestamp;
  stageEnteredAt: Timestamp;

  // Win/loss
  closedReason?: string;
  competitorName?: string;

  // Location
  siteLocation?: {
    address?: string;
    city?: string;
    country?: string;
  };

  // Shopify order metadata (for deals created from Shopify orders)
  shopifyOrderId?: string;
  shopifyOrderNumber?: string;
  shopifyOrderUrl?: string;

  // Tags and notes
  tags: string[];
  notes?: string;

  // Subsidiary scoping
  subsidiaryId: string;

  /**
   * Denormalized roll-up of the linked SalesOrder's change orders.
   * Written by `changeOrderService` on every CO state change so deal-
   * level dashboards and list views don't have to fan out to the SO
   * module. Absent when the deal has no SO yet.
   */
  changeOrderSummary?: DealChangeOrderSummary;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface DealChangeOrderSummary {
  count: number;            // total COs of any status
  openCount: number;        // pending_internal + pending_client
  approvedCount: number;
  rejectedCount: number;
  approvedValue: number;    // sum of approved CO priceImpact
  pendingValue: number;     // sum of pending CO priceImpact (indicative)
  hasPostFreezeCO: boolean;
  lastChangeOrderAt?: Timestamp;
  lastChangeOrderNumber?: string;
  lastChangeOrderStatus?: string;
  updatedAt: Timestamp;
}

export type CRMDealFormData = Omit<CRMDeal, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'dealNumber' | 'weightedValue' | 'stageEnteredAt'>;

// ============================================================
// Activity Types
// ============================================================

export type CRMActivityType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'site_visit'
  | 'presentation'
  | 'note'
  | 'quote_sent'
  | 'quote_approved'
  | 'quote_rejected'
  | 'stage_change'
  | 'project_created'
  | 'manufacturing_update'
  | 'payment_received'
  | 'task_completed'
  | 'change_order_requested'
  | 'change_order_submitted_to_client'
  | 'change_order_approved'
  | 'change_order_rejected'
  | 'change_order_withdrawn';

export type CRMActivitySource = 'manual' | 'auto_design_manager' | 'auto_manufacturing' | 'auto_finance' | 'auto_system';

export interface CRMActivity {
  id: string;

  // Context
  dealId?: string;
  customerId: string;
  projectId?: string;

  /**
   * P8/F1 — shared cross-subsidiary party ref. Populated by activity
   * writers (logActivity callers + the auto-activity inside
   * crmDealService.createDeal). Readers can migrate to this without
   * a data backfill; legacy rows with only `customerId` still render.
   */
  party?: PartyRef;

  // Activity details
  type: CRMActivityType;
  title: string;
  description?: string;
  source: CRMActivitySource;

  // Cross-module references
  sourceModule?: string;
  sourceEntityId?: string;
  sourceEntityType?: string;

  // Participants
  participants?: string[];
  contactPersonName?: string;

  /**
   * P11-4 (F8) — FK into the normalized `customerContacts` collection
   * introduced in P11-1/2. Optional during rollout: writers may still
   * log activities without a specific contact, and legacy rows carry
   * only `contactPersonName` (free-text). New writers that DO know the
   * contact should populate both — the id for joins, the name as a
   * denormalized cache so list views don't need a per-activity lookup.
   *
   * Readers should prefer `contactPersonId` when present and fall back
   * to `contactPersonName` otherwise. The embedded-array fallback on
   * `Customer.contacts` is handled in the reader helper, not here.
   */
  contactPersonId?: string;

  // Outcome
  outcome?: string;
  nextSteps?: string;

  // Follow-up
  followUpDate?: Timestamp;
  followUpAssignedTo?: string;

  // Metadata
  performedBy: string;
  performedByName: string;
  performedAt: Timestamp;
  createdAt: Timestamp;
}

// ============================================================
// Sales Task Types
// ============================================================

export type SalesTaskType =
  | 'follow_up_call'
  | 'follow_up_email'
  | 'site_visit'
  | 'send_quote'
  | 'send_proposal'
  | 'schedule_meeting'
  | 'design_review'
  | 'payment_follow_up'
  | 'general';

export type SalesTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';

export interface SalesTask {
  id: string;

  // Context
  dealId?: string;
  customerId?: string;
  projectId?: string;

  // Task details
  type: SalesTaskType;
  title: string;
  description?: string;
  status: SalesTaskStatus;
  priority: DealPriority;

  // Assignment
  assignedTo: string;
  assignedToName: string;

  /**
   * P11-4 (F8) — FK into the normalized `customerContacts` collection.
   * Optional during rollout; parallels the same field on `CRMActivity`.
   * Writers that know which contact the task relates to (e.g. "call
   * Jane about the quote revision") should populate both the id and
   * the denormalized name cache below. Readers prefer the id, fall
   * back to the name cache, then ultimately to a customer-level
   * lookup when neither is set.
   */
  contactPersonId?: string;
  contactPersonName?: string;

  // Dates
  dueDate: Timestamp;
  completedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

// ============================================================
// Pipeline Analytics Types
// ============================================================

export interface PipelineStageMetrics {
  stage: CRMDealStage;
  count: number;
  totalValue: number;
  weightedValue: number;
  averageAge: number;
}

export interface PipelineSummary {
  totalDeals: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  byStage: Record<CRMDealStage, PipelineStageMetrics>;
  conversionRate: number;
  averageDealSize: number;
  averageSalesCycle: number;
  wonThisMonth: number;
  wonThisQuarter: number;
  lostThisMonth: number;
}

// ============================================================
// Project Financial Summary
// ============================================================

export interface ProjectFinancialSummary {
  totalQuotedValue: number;
  totalApprovedQuotes: number;
  totalManufacturingCost: number;
  totalMaterialCost: number;
  estimatedProfit: number;
  currency: string;
}

// ============================================================
// Incoming Manufacturing Item (pre-handover design items)
// ============================================================

export interface IncomingManufacturingItem {
  /**
   * P8/F1 (P8-3 reader migration) — resolved party ref. Populated by
   * `incomingItemsService.fetchIncomingManufacturingItems` from the
   * project's `customerId` via `resolveParty`. Today only finishes
   * customers show up here since advisory-flow projects don't create
   * DesignItems; the field is nevertheless a forward-compat hook.
   */
  party?: PartyRef;
  designItemId: string;
  designItemName: string;
  projectId: string;
  projectCode: string;
  customerName: string;
  sourcingType: string;
  currentStage: string;
  overallReadiness: number;
  ragStatus: string;
  estimatedCosts: {
    materialCost: number;
    laborCost: number;
    totalCost: number;
  };
  handoverStatus?: 'pending' | 'handed-over' | 'rejected';
  createdAt: Timestamp;
}

// ============================================================
// Project Detail Aggregation (computed at read-time)
// ============================================================

export interface ProjectDetailAggregation {
  // Project info
  projectId: string;
  projectCode: string;
  projectName: string;
  projectDescription?: string;
  projectStatus: string;
  startDate?: Timestamp;
  dueDate?: Timestamp;

  // Customer info
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerType?: string;
  siteLocation?: string;

  /**
   * P8/F1 (P8-3 reader migration) — resolved cross-subsidiary party
   * ref. Populated by `getProjectDetailAggregation` via `resolveParty`
   * on the linked deal when available, otherwise falls back to
   * `{ partyKind: 'finishes_customer', partyId: customerId }` for the
   * typical finishes path. Readers that need to render a subsidiary
   * badge or branch on kind should prefer this over `customerId`.
   */
  party?: PartyRef;

  // Design items from subcollection
  designItems: Array<{
    id: string;
    name: string;
    itemCode: string;
    category: string;
    sourcingType?: string;
    currentStage: string;
    ragStatus: string;
    overallReadiness: number;
    manufacturingOrderId?: string;
    handoverStatus?: string;
    manufacturing?: {
      materialCost: number;
      laborCost: number;
      totalCost: number;
    };
  }>;

  // Manufacturing orders linked to this project
  manufacturingOrders: Array<{
    id: string;
    moNumber: string;
    designItemName: string;
    status: string;
    currentStage: string;
    priority: string;
    costSummary: {
      materialCost: number;
      laborCost: number;
      totalCost: number;
    };
  }>;

  // Financial summary
  financials: ProjectFinancialSummary;

  // CRM activities for this project
  activities: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    performedByName: string;
    performedAt: Timestamp;
  }>;

  // Linked CRM deal
  linkedDeal?: {
    id: string;
    dealNumber: string;
    title: string;
    stage: string;
    estimatedValue: number;
  };
}

// ============================================================
// Unified Project Aggregation Types
// ============================================================

export interface UnifiedProjectStatus {
  projectId: string;
  projectCode: string;
  projectName: string;

  // Customer
  customerId?: string;
  customerName?: string;

  // CRM deal link
  dealId?: string;
  dealStage?: CRMDealStage;

  // Design Manager status
  designStatus: string;
  totalDesignItems: number;
  designItemsByStage: Record<string, number>;
  overallDesignProgress: number;

  // Manufacturing status
  totalMOs: number;
  mosByStatus: Record<string, number>;
  mosByStage: Record<string, number>;
  overallManufacturingProgress: number;

  // Quote/financial status
  totalQuotes: number;
  approvedQuotesValue: number;
  pendingQuotesValue: number;

  // Overall
  overallProgress: number;
  isAtRisk: boolean;
  riskFactors: string[];

  // Dates
  lastActivityDate?: Timestamp;
}
