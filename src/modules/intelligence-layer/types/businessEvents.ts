// ============================================================================
// BUSINESS EVENT TYPES
// DawinOS v2.0 - Intelligence Layer
// Types for cross-module business event detection and task generation
// ============================================================================

import type { SourceModuleId } from '../constants';

// ============================================================================
// SUBSIDIARIES & MODULES
// ============================================================================

export type SubsidiaryId = 'finishes' | 'advisory' | 'technology' | 'capital' | 'corporate';

export interface ModuleConfig {
  id: SourceModuleId;
  subsidiary: SubsidiaryId;
  name: string;
  description: string;
  eventTypes: string[];
  enabled: boolean;
}

// ============================================================================
// BUSINESS EVENTS
// ============================================================================

export type BusinessEventCategory = 
  | 'workflow_transition'
  | 'approval_required'
  | 'deadline_approaching'
  | 'anomaly_detected'
  | 'milestone_reached'
  | 'resource_constraint'
  | 'quality_gate'
  | 'cost_threshold'
  | 'client_interaction'
  | 'document_update'
  | 'team_assignment';

export type BusinessEventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface BusinessEvent {
  id: string;
  
  // Event identification
  eventType: string;
  category: BusinessEventCategory;
  severity: BusinessEventSeverity;
  
  // Source
  sourceModule: SourceModuleId;
  subsidiary: SubsidiaryId;
  
  // Context
  entityType: string;
  entityId: string;
  entityName: string;
  projectId?: string;
  projectName?: string;
  
  // Event details
  title: string;
  description: string;
  previousState?: Record<string, any>;
  currentState?: Record<string, any>;
  changedFields?: string[];
  
  // Trigger info
  triggeredBy?: string;
  triggeredByName?: string;
  triggeredAt: Date;
  
  // Processing
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'ignored';
  processedAt?: Date;
  generatedTaskIds?: string[];
  error?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// DAWIN FINISHES EVENT TYPES
// ============================================================================

export type FinishesDesignManagerEvent =
  | 'design_item_created'
  | 'design_item_stage_changed'
  | 'design_item_approval_requested'
  | 'design_item_approved'
  | 'design_item_rejected'
  | 'design_item_rag_updated'
  | 'design_item_file_uploaded'
  | 'design_item_costing_completed'
  | 'design_item_procurement_started'
  | 'design_item_production_ready'
  | 'design_project_created'
  | 'design_project_status_changed'
  | 'design_project_deadline_approaching';

export type FinishesLaunchPipelineEvent =
  | 'product_created'
  | 'product_stage_changed'
  | 'product_launched'
  | 'product_synced_shopify'
  | 'product_pricing_updated';

export type FinishesInventoryEvent =
  | 'stock_low'
  | 'stock_reorder_required'
  | 'material_received'
  | 'material_allocated';

export type FinishesCustomerEvent =
  | 'customer_created'
  | 'customer_project_assigned'
  | 'customer_communication_logged';

export type WhatsAppCommunicationEvent =
  | 'whatsapp_message_received'
  | 'whatsapp_message_sent'
  | 'whatsapp_window_expiring'
  | 'whatsapp_delivery_failed'
  | 'whatsapp_unknown_contact';

// ============================================================================
// DAWIN FINISHES MANUFACTURING & PROCUREMENT EVENT TYPES
// ============================================================================

export type FinishesManufacturingEvent =
  | 'manufacturing_order_created'
  | 'manufacturing_order_approved'
  | 'manufacturing_order_stage_changed'
  | 'manufacturing_order_completed'
  | 'manufacturing_order_on_hold'
  | 'material_shortage_detected'
  | 'material_reservation_created'
  | 'qc_inspection_failed';

export type FinishesPurchaseOrderEvent =
  | 'purchase_order_created'
  | 'purchase_order_submitted_for_approval'
  | 'purchase_order_approved'
  | 'purchase_order_rejected'
  | 'purchase_order_sent'
  | 'goods_received'
  | 'purchase_order_closed';

export type FinishesInventoryEnhancedEvent =
  | 'stock_level_critical'
  | 'stock_transfer_requested'
  | 'cost_variance_detected';

// ============================================================================
// DAWIN ADVISORY EVENT TYPES
// ============================================================================

export type AdvisoryEngagementEvent =
  | 'engagement_created'
  | 'engagement_status_changed'
  | 'engagement_team_assigned'
  | 'engagement_milestone_reached'
  | 'engagement_deadline_approaching'
  | 'engagement_budget_threshold';

export type AdvisoryFundingEvent =
  | 'funding_source_added'
  | 'disbursement_requested'
  | 'disbursement_approved'
  | 'covenant_measurement_due'
  | 'covenant_breach_risk';

export type AdvisoryReportingEvent =
  | 'report_due'
  | 'report_submitted'
  | 'report_approved'
  | 'report_overdue';

// ============================================================================
// TASK TEMPLATES
// ============================================================================

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

export interface TaskChecklistItem {
  id: string;
  title: string;
  description?: string;
  isRequired: boolean;
  order: number;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  verificationCriteria?: string;
  referenceUrl?: string;
}

export interface TaskTemplate {
  id: string;
  
  // Identification
  name: string;
  description: string;
  category: string;
  
  // Trigger conditions
  triggerEvents: string[];
  triggerConditions?: TaskTriggerCondition[];
  
  // Task details
  defaultTitle: string;
  defaultDescription: string;
  defaultPriority: TaskPriority;
  defaultDueDays: number;
  
  // Checklist
  checklistItems: TaskChecklistItem[];
  
  // Assignment
  assignmentStrategy: 'creator' | 'project_lead' | 'specific_role' | 'specific_user' | 'manager' | 'department';
  assignToRole?: string;
  assignToUserId?: string;
  assignToDepartment?: string;
  
  // Module context
  sourceModule: SourceModuleId;
  subsidiary: SubsidiaryId;
  
  // Metadata
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TaskTriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

// ============================================================================
// GENERATED TASKS
// ============================================================================

export interface GeneratedTask {
  id: string;
  
  // Source
  businessEventId: string;
  templateId: string;
  
  // Task details
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  
  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: Date;
  
  // Dates
  dueDate: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Checklist
  checklistItems: TaskChecklistItem[];
  checklistProgress: number; // 0-100
  
  // Context
  sourceModule: SourceModuleId;
  subsidiary: SubsidiaryId;
  entityType: string;
  entityId: string;
  entityName: string;
  projectId?: string;
  projectName?: string;
  
  // Links
  relatedTaskIds?: string[];
  parentTaskId?: string;
  
  // Metadata
  metadata?: Record<string, any>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;

  // AI enrichment
  aiDescription?: string;
  aiChecklist?: AIChecklistItem[];
  aiRelevantDocuments?: AIRelevantDocument[];
  aiEnrichedAt?: Date;
  aiUrgencyScore?: number;
  aiUrgencyReason?: string;
}

export interface AIChecklistItem {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  order: number;
  completed: boolean;
}

export interface AIRelevantDocument {
  name: string;
  type: 'client_document' | 'deliverable' | 'design_brief' | 'feature_library' | 'design_item' | 'project' | 'moodboard' | 'material_spec' | 'external_reference';
  reason: string;
}

// ============================================================================
// TASK DEPENDENCIES
// ============================================================================

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: 'blocks' | 'required_before' | 'related';
  createdAt: Date;
}

// ============================================================================
// MODULE INTEGRATION CONFIG
// ============================================================================

export interface ModuleIntegrationConfig {
  id: string;
  sourceModule: SourceModuleId;
  subsidiary: SubsidiaryId;
  
  // Event listeners
  listenToCollections: string[];
  eventMappings: EventMapping[];
  
  // Settings
  isEnabled: boolean;
  processingDelay: number; // ms
  batchSize: number;
  
  // Metadata
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventMapping {
  collectionPath: string;
  triggerOnCreate: boolean;
  triggerOnUpdate: boolean;
  triggerOnDelete: boolean;
  eventType: string;
  fieldMappings: FieldMapping[];
  conditions?: TaskTriggerCondition[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: 'direct' | 'timestamp' | 'string' | 'number' | 'boolean';
}
