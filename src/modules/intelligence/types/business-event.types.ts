/**
 * Business Event Types - DawinOS v2.0
 * Types for the event-driven intelligence system
 */

import { Timestamp } from 'firebase/firestore';
import {
  SubsidiaryId,
  DepartmentId,
  EventCategory,
  EventPriority,
} from '../config/constants';

// ============================================
// Event Core Types
// ============================================

/**
 * Source of a business event
 */
export interface EventSource {
  type: 'subsidiary' | 'module' | 'integration' | 'system' | 'user' | 'schedule';
  id: string;
  name: string;
}

/**
 * Who/what triggered the event
 */
export interface EventTrigger {
  type: 'user' | 'system' | 'schedule' | 'integration' | 'workflow';
  id: string;
  name?: string;
}

/**
 * Event processing status
 */
export interface EventProcessing {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  tasksGenerated: string[];
  notificationsSent: string[];
  processedAt?: Timestamp;
  processingDuration?: number; // milliseconds
  errorMessage?: string;
  retryCount: number;
  lastRetryAt?: Timestamp;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  subsidiaryId: SubsidiaryId;
  departmentId?: DepartmentId;
  correlationId?: string;       // Links related events
  causationId?: string;         // ID of event that caused this one
  priority: EventPriority;
  tags?: string[];
  isInternal: boolean;          // Internal system event vs user-facing
}

/**
 * Core Business Event interface
 */
export interface BusinessEvent {
  id: string;
  eventType: string;              // From event catalog
  eventCategory: EventCategory;
  source: EventSource;
  trigger: EventTrigger;
  payload: Record<string, any>;   // Event-specific data
  metadata: EventMetadata;
  processing: EventProcessing;
  createdAt: Timestamp;
  expiresAt?: Timestamp;          // Auto-cleanup for temporary events
}

// ============================================
// Event Definition (Catalog Entry)
// ============================================

/**
 * Task generation rule for an event type
 */
export interface EventTaskRule {
  taskType: string;
  title: string;                  // Can include {{payload.field}} placeholders
  description?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueInDays?: number;
  assignTo: AssignmentRule;
  conditions?: EventCondition[];  // Only generate if conditions met
}

/**
 * Assignment rule for task generation
 */
export interface AssignmentRule {
  type: 'role' | 'department' | 'user' | 'manager' | 'creator' | 'dynamic';
  value?: string;                 // Role ID, department ID, or user ID
  fallback?: AssignmentRule;      // Fallback if primary assignment fails
}

/**
 * Condition for conditional task generation
 */
export interface EventCondition {
  field: string;                  // Path in payload, e.g., 'amount', 'status'
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'contains';
  value: any;
}

/**
 * Notification rule for an event type
 */
export interface EventNotificationRule {
  channels: ('email' | 'sms' | 'push' | 'in-app')[];
  recipients: NotificationRecipient[];
  template: string;               // Template ID
  conditions?: EventCondition[];
  delay?: number;                 // Delay in minutes before sending
}

/**
 * Notification recipient definition
 */
export interface NotificationRecipient {
  type: 'role' | 'department' | 'user' | 'creator' | 'assignee' | 'manager';
  value?: string;
}

/**
 * Event type definition (catalog entry)
 */
export interface EventDefinition {
  eventType: string;              // Unique identifier
  name: string;                   // Human-readable name
  description: string;
  category: EventCategory;
  source: {
    allowedSources: EventSource['type'][];
    allowedModules?: string[];
  };
  schema: {
    required: string[];           // Required payload fields
    properties: Record<string, {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      description?: string;
    }>;
  };
  tasks: EventTaskRule[];
  notifications: EventNotificationRule[];
  retention: {
    keepDays: number;
    archive: boolean;
  };
  enabled: boolean;
}

// ============================================
// Specific Event Payload Types
// ============================================

// Customer Events
export interface CustomerInquiryPayload {
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  inquiryType: 'quote' | 'information' | 'support' | 'complaint';
  subject: string;
  message: string;
  source: 'website' | 'email' | 'phone' | 'referral' | 'walk-in';
  projectType?: string;
}

export interface QuoteRequestedPayload {
  quoteId: string;
  customerId: string;
  customerName: string;
  projectDescription: string;
  estimatedValue?: number;
  deadline?: Timestamp;
  items: {
    description: string;
    quantity: number;
    unit: string;
  }[];
}

export interface OrderPlacedPayload {
  orderId: string;
  customerId: string;
  customerName: string;
  orderValue: number;
  currency: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  deliveryAddress?: string;
  deliveryDate?: Timestamp;
}

// Financial Events
export interface PaymentReceivedPayload {
  paymentId: string;
  invoiceId?: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  paymentMethod: 'bank_transfer' | 'mobile_money' | 'cash' | 'card' | 'cheque';
  reference: string;
  bankAccount?: string;
}

export interface InvoiceOverduePayload {
  invoiceId: string;
  customerId: string;
  customerName: string;
  invoiceAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  currency: string;
  dueDate: Timestamp;
  daysOverdue: number;
  previousReminders: number;
}

export interface BudgetExceededPayload {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  spentAmount: number;
  exceededBy: number;
  exceededByPercent: number;
  currency: string;
  period: string;
  departmentId: DepartmentId;
}

// HR Events
export interface LeaveRequestedPayload {
  requestId: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: Timestamp;
  endDate: Timestamp;
  days: number;
  reason?: string;
  managerId: string;
}

export interface ContractExpiringPayload {
  contractId: string;
  employeeId: string;
  employeeName: string;
  contractType: string;
  expiryDate: Timestamp;
  daysUntilExpiry: number;
  managerId: string;
}

export interface PerformanceReviewDuePayload {
  employeeId: string;
  employeeName: string;
  reviewType: 'quarterly' | 'annual' | 'probation';
  dueDate: Timestamp;
  lastReviewDate?: Timestamp;
  reviewerId: string;
}

// Production Events (Finishes)
export interface JobStartedPayload {
  jobId: string;
  projectId: string;
  projectName: string;
  customerId: string;
  startDate: Timestamp;
  estimatedEndDate: Timestamp;
  assignedTeam: string[];
  materials: {
    materialId: string;
    name: string;
    quantity: number;
  }[];
}

export interface MilestoneReachedPayload {
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneName: string;
  completedAt: Timestamp;
  completedBy: string;
  nextMilestone?: {
    id: string;
    name: string;
    dueDate: Timestamp;
  };
}

export interface QualityIssuePayload {
  issueId: string;
  projectId: string;
  projectName: string;
  issueType: 'material_defect' | 'workmanship' | 'design_error' | 'damage';
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  description: string;
  detectedBy: string;
  location?: string;
  photos?: string[];
}

// Strategic Events
export interface MarketChangePayload {
  changeId: string;
  changeType: 'competitor_action' | 'regulation' | 'market_trend' | 'economic';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  affectedSubsidiaries: SubsidiaryId[];
  sourceUrl?: string;
  detectedAt: Timestamp;
}

export interface OpportunityIdentifiedPayload {
  opportunityId: string;
  opportunityType: string;
  title: string;
  description: string;
  estimatedValue?: number;
  currency?: string;
  probability?: number;
  source: string;
  expiryDate?: Timestamp;
}

// ============================================
// Dawin Finishes Event Payloads
// ============================================

// Design Manager Events
export interface DesignItemCreatedPayload {
  projectId: string;
  projectCode?: string;
  projectName?: string;
  designItemId: string;
  itemName: string;
  itemCode?: string;
  category: 'casework' | 'furniture' | 'millwork' | 'doors' | 'fixtures' | 'specialty';
  initialStage?: string;
  createdBy: string;
}

export interface DesignStageChangedPayload {
  projectId: string;
  projectCode?: string;
  designItemId: string;
  itemName: string;
  itemCode?: string;
  previousStage: string;
  newStage: string;
  changedBy: string;
  notes?: string;
}

export interface DesignApprovalRequestedPayload {
  projectId: string;
  projectCode?: string;
  designItemId: string;
  itemName: string;
  approvalType: 'internal_review' | 'client_approval' | 'manufacturing_review';
  requestedBy: string;
  requestedByName?: string;
  deadline?: Timestamp;
  notes?: string;
}

export interface RAGStatusCriticalPayload {
  projectId: string;
  projectCode?: string;
  designItemId: string;
  itemName: string;
  category: 'designCompleteness' | 'manufacturingReadiness' | 'qualityGates';
  aspect: string;
  previousStatus: string;
  newStatus: string;
  notes?: string;
  changedBy: string;
}

export interface DesignProductionReadyPayload {
  projectId: string;
  projectCode?: string;
  designItemId: string;
  itemName: string;
  itemCode: string;
  category?: string;
  overallReadiness?: number;
  approvedBy: string;
  approvedByName?: string;
}

// Launch Pipeline Events
export interface ProductAddedToPipelinePayload {
  productId: string;
  productName: string;
  category: string;
  priority?: string;
  targetLaunchDate?: Timestamp;
  createdBy: string;
}

export interface ProductReadyForShopifyPayload {
  productId: string;
  productName: string;
  handle?: string;
  category?: string;
  readinessScore?: number;
  approvedBy?: string;
}

// Cutlist Events
export interface CutlistOptimizationCompletePayload {
  workInstanceId: string;
  projectId: string;
  projectCode?: string;
  totalSheets: number;
  totalPanels: number;
  averageUtilization: number;
  totalCost?: number;
  createdBy: string;
}

// Asset Events
export interface AssetMaintenanceRequiredPayload {
  assetId: string;
  assetName: string;
  assetCategory?: string;
  maintenanceType: 'scheduled' | 'corrective' | 'preventive';
  hoursAtMaintenance?: number;
  previousStatus?: string;
  reportedBy?: string;
  issueDescription?: string;
}

// ============================================
// Event Builder Types
// ============================================

export type EventPayloadMap = {
  // Customer
  'customer.inquiry_received': CustomerInquiryPayload;
  'customer.quote_requested': QuoteRequestedPayload;
  'customer.order_placed': OrderPlacedPayload;

  // Financial
  'financial.payment_received': PaymentReceivedPayload;
  'financial.invoice_overdue': InvoiceOverduePayload;
  'financial.budget_exceeded': BudgetExceededPayload;

  // HR
  'hr.leave_requested': LeaveRequestedPayload;
  'hr.contract_expiring': ContractExpiringPayload;
  'hr.performance_review_due': PerformanceReviewDuePayload;

  // Production
  'production.job_started': JobStartedPayload;
  'production.milestone_reached': MilestoneReachedPayload;
  'production.quality_issue': QualityIssuePayload;

  // Dawin Finishes - Design Manager
  'finishes.design_item_created': DesignItemCreatedPayload;
  'finishes.design_stage_changed': DesignStageChangedPayload;
  'finishes.design_approval_requested': DesignApprovalRequestedPayload;
  'finishes.rag_status_critical': RAGStatusCriticalPayload;
  'finishes.design_production_ready': DesignProductionReadyPayload;

  // Dawin Finishes - Launch Pipeline
  'finishes.product_added_to_pipeline': ProductAddedToPipelinePayload;
  'finishes.product_ready_for_shopify': ProductReadyForShopifyPayload;

  // Dawin Finishes - Cutlist
  'finishes.cutlist_optimization_complete': CutlistOptimizationCompletePayload;

  // Dawin Finishes - Assets
  'finishes.asset_maintenance_required': AssetMaintenanceRequiredPayload;

  // Strategic
  'strategic.market_change': MarketChangePayload;
  'strategic.opportunity_identified': OpportunityIdentifiedPayload;
};

export type EventType = keyof EventPayloadMap;

/**
 * Typed event creator
 */
export interface CreateEventInput<T extends EventType> {
  eventType: T;
  payload: EventPayloadMap[T];
  metadata: Omit<EventMetadata, 'correlationId'> & {
    correlationId?: string;
  };
}
