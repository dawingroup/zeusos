/**
 * Manufacturing Module Types
 * Manufacturing orders, BOM, material reservations, and stage tracking
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Manufacturing Order Stage & Status
// ============================================

/**
 * Manufacturing order production stages
 */
export type MOStage =
  | 'queued'
  | 'cutting'
  | 'assembly'
  | 'finishing'
  | 'qc'
  | 'ready';

/**
 * Ordered list of MO stages for pipeline display
 */
export const MO_STAGES: MOStage[] = [
  'queued',
  'cutting',
  'assembly',
  'finishing',
  'qc',
  'ready',
];

/**
 * Human-readable labels for MO stages
 */
export const MO_STAGE_LABELS: Record<MOStage, string> = {
  queued: 'Queued',
  cutting: 'Cutting',
  assembly: 'Assembly',
  finishing: 'Finishing',
  qc: 'Quality Check',
  ready: 'Ready',
};

/**
 * Manufacturing order lifecycle statuses
 */
export type ManufacturingOrderStatus =
  | 'draft'
  | 'pending-approval'
  | 'approved'
  | 'in-progress'
  | 'on-hold'
  | 'partially-complete'
  | 'completed'
  | 'closed-out'
  | 'cancelled';

/**
 * Human-readable labels for MO statuses
 */
export const MO_STATUS_LABELS: Record<ManufacturingOrderStatus, string> = {
  draft: 'Draft',
  'pending-approval': 'Pending Approval',
  approved: 'Approved',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  'partially-complete': 'Partially Complete',
  completed: 'Completed',
  'closed-out': 'Closed Out',
  cancelled: 'Cancelled',
};

// ============================================
// Completion Disposition
// ============================================

/**
 * What happens to the completed product after manufacturing
 */
export type CompletionDisposition = 'site_installation' | 'finished_goods';

export const COMPLETION_DISPOSITION_LABELS: Record<CompletionDisposition, string> = {
  site_installation: 'Site Installation',
  finished_goods: 'Finished Goods Inventory',
};

/**
 * Installation tracking status (for site_installation disposition)
 */
export type InstallationStatus =
  | 'pending_scheduling'
  | 'scheduled'
  | 'in_transit'
  | 'installing'
  | 'installed'
  | 'signed_off';

export const INSTALLATION_STATUS_LABELS: Record<InstallationStatus, string> = {
  pending_scheduling: 'Pending Scheduling',
  scheduled: 'Scheduled',
  in_transit: 'In Transit',
  installing: 'Installing',
  installed: 'Installed',
  signed_off: 'Signed Off',
};

// ============================================
// Bill of Materials (BOM)
// ============================================

/**
 * Single entry in the bill of materials
 */
export interface BOMEntry {
  id: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  category: string;
  quantityRequired: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  warehouseId?: string;
  notes?: string;

  // Supplier info (resolved from matflow)
  supplierId?: string;
  supplierName?: string;
  supplierSku?: string;

  // Parametric extensions
  mpn?: string;                      // Manufacturer Part Number (from vendor source)
  kitSourceId?: string;              // If this line was expanded from a kit, the kit item ID

  // Offcut library tracking
  offcutId?: string;                 // Offcut doc ID (when this BOM line is fulfilled by an offcut)
  offcutSourceProject?: string;      // Project ID that generated the offcut

  // Purchase priority (flows from design, can be overridden)
  purchasePriority?: number;         // 0-based rank, lower = buy first
  prioritySource?: 'design' | 'manufacturing';
  upstreamPurchasePriority?: number; // Original priority before override
}

// ============================================
// Manufacturing Order Parts
// ============================================

/**
 * Part entry copied from design item for manufacturing
 */
export interface MOPartEntry {
  id: string;
  partNumber: string;
  name: string;
  materialName: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  hasCNCOperations: boolean;
  cncProgramRef?: string;
  purchasePriority?: number;         // 0-based rank from design, lower = buy first
}

// ============================================
// Material Reservation & Consumption
// ============================================

/**
 * Material reservation against inventory for an MO
 */
export interface MaterialReservation {
  id: string;
  inventoryItemId: string;
  stockLevelId: string;
  warehouseId: string;
  quantityReserved: number;
  reservedAt: Timestamp;
  reservedBy: string;
  status: 'active' | 'consumed' | 'released';
}

/**
 * Material consumption record during manufacturing
 */
export interface MaterialConsumption {
  id: string;
  bomEntryId: string;            // Links to specific BOM line for planned vs actual tracking
  inventoryItemId: string;
  stockLevelId: string;
  warehouseId: string;
  quantityConsumed: number;

  // Costing (for COGS calculation)
  unitCost: number;              // Cost per unit at time of consumption
  totalCost: number;             // quantityConsumed × unitCost

  consumedAt: Timestamp;
  consumedBy: string;
  moStage: MOStage;
  notes?: string;                // Variance justification (e.g. wastage, defects)
}

// ============================================
// Stage Transitions
// ============================================

/**
 * Audit record for MO stage transitions
 */
export interface MOStageTransition {
  fromStage: MOStage | null;
  toStage: MOStage;
  transitionedAt: Timestamp;
  transitionedBy: string;
  notes?: string;
}

// ============================================
// Quality Check
// ============================================

/**
 * Quality inspection record
 */
export interface QualityCheck {
  inspectedBy: string;
  inspectedAt: Timestamp;
  passed: boolean;
  notes: string;
  defects?: string[];
}

// ============================================
// Completion Lots & Procured Items
// ============================================

/**
 * A completion lot records a partial or full quantity completion within an MO.
 * Supports the ISA-95 production-completion model for batch manufacturing.
 */
export interface CompletionLot {
  id: string;
  quantity: number;
  completedAt: Timestamp;
  completedBy: string;
  warehouseId?: string;
  locationId?: string;
  qualityStatus: 'pending_qc' | 'passed' | 'failed' | 'conditionally_passed';
  notes?: string;
}

/**
 * A procured item attached to an MO as a line item.
 * Tracks procurement status independently of the manufactured parts.
 */
export interface MOProcuredItem {
  id: string;
  designItemId?: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  supplier?: string;
  status: 'pending' | 'ordered' | 'received' | 'installed';
  receivedQuantity?: number;
  purchaseOrderId?: string;
  notes?: string;
}

/**
 * Demand source traceability — links MO to its originating demand
 */
export interface MODemandSource {
  type: 'sales_order' | 'stock_replenishment' | 'internal';
  referenceId: string;
  lineItemId?: string;
}

// ============================================
// Reference Documents (Workshop Viewer, shop drawings)
// ============================================

export interface MOReferenceDocument {
  id: string;
  type: 'print-package' | 'shop-drawing' | 'assembly-instructions' | 'other';
  name: string;
  storageUrl: string;
  storagePath?: string;
  source: 'workshop-viewer' | 'design-manager' | 'manual';
  sourceSessionId?: string;
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================
// Closeout
// ============================================

/**
 * Data recorded when an MO is formally closed out
 */
export interface MOCloseoutData {
  closeoutNotes: string;
  qcConfirmed: boolean;
  finishedGoodsConfirmed: boolean;
  varianceAcknowledged: boolean;
  cogsJournalVerified: boolean;
  routeTo: 'installation' | 'finished-goods';
  cogsAccountId?: string;
  cogsAccountName?: string;
  closedOutAt: Timestamp;
  closedOutBy: string;
}

/**
 * Final cost computed by Cloud Function on MO completion
 */
export interface MOFinalCost {
  totalActualCost: number;
  totalEstimatedCost: number;
  costVariance: number;
  costVariancePercent: number;
}

/**
 * COGS breakdown recorded by QBO journal entry sync
 */
export interface MOCogsRecorded {
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCOGS: number;
}

// ============================================
// Manufacturing Order
// ============================================

/**
 * Cost summary for a manufacturing order
 */
export interface MOCostSummary {
  materialCost: number;
  laborCost: number;
  totalCost: number;
  currency: string;
}

/**
 * Scheduling information for a manufacturing order
 */
export interface MOScheduling {
  scheduledStart?: Timestamp;
  scheduledEnd?: Timestamp;
  actualStart?: Timestamp;
  actualEnd?: Timestamp;
  assignedWorkstation?: string;
}

/**
 * Manufacturing Order - main entity
 */
export interface ManufacturingOrder {
  id: string;
  moNumber: string;
  status: ManufacturingOrderStatus;
  orderDate?: Timestamp;

  // Links to design manager (optional — MOs can be created independently)
  designItemId?: string;
  /** Alias for projectId when MO links to a Design Manager project */
  designProjectId?: string;
  projectId?: string;
  projectCode?: string;
  designItemName?: string;

  /** Optional production due date (separate from scheduled end) */
  dueDate?: Timestamp;

  // Sales Order & Project Phase
  salesOrderId?: string;
  projectPhase?: string;           // e.g. "Room A Cabinets", "Reception"

  // Change-order cascade linkage (Phase 4). When a CO adds scope items
  // to an SO whose MO is already released, `cascadeChangeOrderToManufacturing`
  // spawns a new child MO (this record) that carries:
  //   - `parentMOId`         — the original MO the SO was released to
  //   - `originChangeOrderId`— the CO that triggered creation
  //   - `childMOIds` on parent — reverse lookup, populated on parent MO
  // Parent MO stays untouched; aggregate reporting sums parent + children.
  parentMOId?: string;
  originChangeOrderId?: string;
  childMOIds?: string[];

  // Standalone MO fields (used when not linked to design manager)
  itemName: string;
  itemDescription?: string;
  sourceType?: MOSourceType;

  // Production details
  quantity: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Production queue position (0 = highest priority). */
  productionRank?: number;

  // BOM & Parts
  bom: BOMEntry[];
  parts: MOPartEntry[];
  instructions: string;
  handoverNotes: string;

  // Scheduling
  scheduling: MOScheduling;

  // Material tracking
  materialReservations: MaterialReservation[];
  materialConsumptions: MaterialConsumption[];

  // Stage tracking
  stageHistory: MOStageTransition[];
  currentStage: MOStage;
  stageEnteredAt: Timestamp;

  // Quality
  qualityCheck?: QualityCheck;

  // Cost
  costSummary: MOCostSummary;

  // Linked POs (procurement)
  linkedPOIds?: string[];

  // Linked Outsourced Purchase Orders
  linkedOPOIds?: string[];

  // Batch manufacturing & partial completions
  batchId?: string;
  batchNumber?: string;
  batchSequence?: number;          // 1 of N within a batch release
  totalQuantityRequired?: number;  // full demand quantity (e.g. 40)
  batchQuantity?: number;          // this MO's target quantity (e.g. 10)
  completedQuantity?: number;      // good units produced so far
  scrapQuantity?: number;          // defective/scrapped units
  completionLots?: CompletionLot[];

  // Demand traceability
  demandSource?: MODemandSource;

  // Procured items attached to this MO
  procuredItems?: MOProcuredItem[];

  // Completion disposition
  completionDisposition?: CompletionDisposition;
  installationStatus?: InstallationStatus;
  installationDate?: Timestamp;
  installationNotes?: string;
  warehouseLocation?: string;

  // Reference Documents (print packages, shop drawings from Workshop Viewer).
  // Legacy string-URL refs — kept for backward compat with existing UI
  // during Phase 3 dual-write window. New code should prefer
  // `projectFileIds` + `handoffBundleFileId` below (canonical FKs into
  // the `projectFiles` collection).
  referenceDocuments?: MOReferenceDocument[];

  // ── Phase 3 — canonical file references ───────────────────────────
  /**
   * Firestore IDs of every `projectFiles` doc consumed by this MO.
   * Populated at handoff; includes the bundle and every constituent
   * file. Resolves the F-C3 string-URL-not-FK finding in the audit.
   */
  projectFileIds?: string[];
  /**
   * ID of the immutable handoff-bundle `projectFiles` doc created by
   * `initiateHandover()`. The bundle is a ZIP snapshot of every
   * `isLatest` file for the design item at the moment of handoff.
   */
  handoffBundleFileId?: string;

  // Closeout
  closeout?: MOCloseoutData;
  finalCost?: MOFinalCost;

  // QBO sync (written by Cloud Function triggers)
  qboJournalEntryId?: string;
  qboSyncStatus?: string;
  cogsRecorded?: MOCogsRecorded;

  // Scoping
  subsidiaryId: string;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================
// Filters & Dashboard
// ============================================

/**
 * Filters for querying manufacturing orders
 */
export interface MOFilters {
  status?: ManufacturingOrderStatus | ManufacturingOrderStatus[];
  currentStage?: MOStage | MOStage[];
  projectId?: string;
  salesOrderId?: string;
  batchId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  search?: string;
  sortBy?: 'moNumber' | 'createdAt' | 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Dashboard statistics for manufacturing overview
 */
export interface ManufacturingDashboardStats {
  totalOrders: number;
  byStatus: Record<ManufacturingOrderStatus, number>;
  byStage: Record<MOStage, number>;
  ordersOnHold: number;
  completedThisMonth: number;
  averageCycleTimeDays: number;
}

// ============================================
// Enhanced MO Status (MES Extension)
// ============================================

/**
 * Extended MO status for Manufacturing Execution System
 */
export type MOStatus =
  | 'draft'
  | 'planned'
  | 'ready'
  | 'in_progress'
  | 'on_hold'
  | 'quality_review'
  | 'completed'
  | 'cancelled';

export const MO_STATUS_MAP: Record<MOStatus, string> = {
  draft: 'Draft',
  planned: 'Planned',
  ready: 'Ready',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  quality_review: 'Quality Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * MO source type indicating how the order was created
 */
export type MOSourceType = 'design_handover' | 'manual' | 'rework' | 'shopify_order' | 'change_order';

// ============================================
// Manufacturing Step (MES)
// ============================================

/**
 * Status of a manufacturing step
 */
export type StepStatus =
  | 'queued'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'qc_pending'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Workstation type for step routing
 */
export type WorkstationType =
  | 'cutting_cnc'
  | 'cutting_panel_saw'
  | 'cutting_manual'
  | 'edgebanding'
  | 'drilling'
  | 'assembly'
  | 'finishing_spray'
  | 'finishing_hand'
  | 'sanding'
  | 'hardware_installation'
  | 'upholstery'
  | 'glass_cutting'
  | 'quality_control'
  | 'packing'
  | 'custom';

export const WORKSTATION_TYPE_LABELS: Record<WorkstationType, string> = {
  cutting_cnc: 'CNC Cutting',
  cutting_panel_saw: 'Panel Saw',
  cutting_manual: 'Manual Cutting',
  edgebanding: 'Edge Banding',
  drilling: 'Drilling',
  assembly: 'Assembly',
  finishing_spray: 'Spray Finishing',
  finishing_hand: 'Hand Finishing',
  sanding: 'Sanding',
  hardware_installation: 'Hardware Installation',
  upholstery: 'Upholstery',
  glass_cutting: 'Glass Cutting',
  quality_control: 'Quality Control',
  packing: 'Packing',
  custom: 'Custom',
};

/**
 * Time entry for tracking operator work on a step
 */
export interface TimeEntry {
  id: string;
  operatorId: string;
  operatorName: string;
  action: 'start' | 'pause' | 'resume' | 'complete';
  timestamp: Timestamp;
  notes?: string;
}

/**
 * Audit record for step status changes
 */
export interface StepStatusChange {
  from: StepStatus;
  to: StepStatus;
  changedBy: string;
  changedAt: Timestamp;
  reason?: string;
}

/**
 * Material consumption at the step level
 */
export interface StepMaterialConsumption {
  inventoryItemId: string;
  materialName: string;
  quantityConsumed: number;
  unit: string;
  wasteQuantity?: number;
  wasteReason?: string;
}

/**
 * Attachment uploaded during step execution
 */
export interface StepAttachment {
  id: string;
  fileName: string;
  storagePath: string;
  type: 'photo' | 'document' | 'video';
  uploadedBy: string;
  uploadedAt: Timestamp;
}

/**
 * A single manufacturing step within an MO
 * Stored as subcollection: manufacturing_orders/{orderId}/steps/{stepId}
 */
export interface ManufacturingStep {
  id: string;
  orderId: string;
  stepIndex: number;
  name: string;
  workstationType: WorkstationType;
  workstationId?: string;
  status: StepStatus;
  statusHistory: StepStatusChange[];
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  estimatedDurationMinutes: number;
  actualDurationMinutes?: number;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  timeEntries: TimeEntry[];
  qcRequired: boolean;
  qcResult?: 'pass' | 'fail' | 'conditional';
  materialsConsumed: StepMaterialConsumption[];
  dependsOnStepIds: string[];
  isRework: boolean;
  operatorNotes?: string;
  attachments: StepAttachment[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// BOM Line (Enhanced)
// ============================================

/**
 * BOM line item categories
 */
export type BOMCategory =
  | 'sheet_material'
  | 'linear_material'
  | 'hardware'
  | 'glass'
  | 'finishing'
  | 'adhesive'
  | 'consumable'
  | 'packaging'
  | 'subcontracted'
  | 'labor';

/**
 * Procurement status for a BOM line
 */
export type BOMProcurementStatus =
  | 'not_required'
  | 'pending'
  | 'reserved'
  | 'on_order'
  | 'received'
  | 'shortage';

/**
 * Enhanced BOM line stored as subcollection: manufacturing_orders/{orderId}/bom/{lineId}
 */
export interface BOMLine {
  id: string;
  orderId: string;
  lineNumber: number;
  category: BOMCategory;
  inventoryItemId?: string;
  featureId?: string;
  materialName: string;
  materialCode?: string;
  specification?: string;
  requiredQuantity: number;
  unit: string;
  reservedQuantity: number;
  consumedQuantity: number;
  wasteQuantity: number;
  dimensions?: {
    length?: number;
    width?: number;
    thickness?: number;
  };
  unitCost: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  procurementStatus: BOMProcurementStatus;
  purchaseOrderId?: string;
  fromOptimization: boolean;
  consumedAtStepId?: string;
  notes?: string;

  // Purchase priority (flows from design, can be overridden)
  purchasePriority?: number;         // 0-based rank, lower = buy first
  prioritySource?: 'design' | 'manufacturing';
  upstreamPurchasePriority?: number; // Original priority before override

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Summary of BOM cost analysis
 */
export interface BOMCostSummary {
  totalEstimatedMaterialCost: number;
  totalActualMaterialCost: number;
  totalEstimatedLaborCost: number;
  totalActualLaborCost: number;
  totalScrapCost: number;
  currency: string;
  lineCount: number;
}

/**
 * Material availability for a single BOM line
 */
export interface BOMLineAvailability {
  bomLineId: string;
  materialName: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  status: 'in_stock' | 'partial' | 'out_of_stock' | 'on_order';
  estimatedArrivalDate?: Timestamp;
}

/**
 * Full availability report for an MO's BOM
 */
export interface BOMAvailabilityReport {
  orderId: string;
  checkedAt: Timestamp;
  overallStatus: 'all_available' | 'partial' | 'shortages';
  lines: BOMLineAvailability[];
  totalShortageValue: number;
}

// ============================================
// Workstation
// ============================================

/**
 * Workstation operational status
 */
export type WorkstationStatus = 'operational' | 'maintenance' | 'offline' | 'setup';

/**
 * A physical workstation on the shop floor
 * Stored in: workstations collection
 */
export interface Workstation {
  id: string;
  name: string;
  code: string;
  type: WorkstationType;
  location?: string;
  capacityPerHour?: number;
  maxConcurrentJobs: number;
  currentActiveJobs: number;
  operatingHoursPerDay: number;
  status: WorkstationStatus;
  currentStepIds: string[];
  queuedStepCount: number;
  assignedOperatorIds: string[];
  isActive: boolean;
  assetId?: string;
  organizationId: string;
  subsidiaryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

// ============================================
// Routing Template
// ============================================

/**
 * A single step in a routing template
 */
export interface RoutingTemplateStep {
  stepIndex: number;
  name: string;
  workstationType: WorkstationType;
  defaultWorkstationId?: string;
  estimatedDurationMinutes: number;
  qcRequired: boolean;
  dependsOnStepIndices: number[];
  isOptional: boolean;
  triggerFeatures?: string[];
}

/**
 * Routing template defining standard manufacturing sequences
 * Stored in: routing_templates collection
 */
export interface RoutingTemplate {
  id: string;
  name: string;
  description?: string;
  productType: string;
  isDefault: boolean;
  steps: RoutingTemplateStep[];
  estimatedTotalMinutes: number;
  version: number;
  isActive: boolean;
  organizationId: string;
  subsidiaryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

// ============================================
// Quality Events
// ============================================

/**
 * Defect type classification
 */
export type DefectType =
  | 'dimension_error'
  | 'surface_damage'
  | 'edge_defect'
  | 'hardware_misalignment'
  | 'finish_defect'
  | 'material_defect'
  | 'assembly_error'
  | 'missing_component'
  | 'other';

export const DEFECT_TYPE_LABELS: Record<DefectType, string> = {
  dimension_error: 'Dimension Error',
  surface_damage: 'Surface Damage',
  edge_defect: 'Edge Defect',
  hardware_misalignment: 'Hardware Misalignment',
  finish_defect: 'Finish Defect',
  material_defect: 'Material Defect',
  assembly_error: 'Assembly Error',
  missing_component: 'Missing Component',
  other: 'Other',
};

/**
 * Quality event recorded during manufacturing
 * Stored as subcollection: manufacturing_orders/{orderId}/quality_events/{eventId}
 */
export interface QualityEvent {
  id: string;
  orderId: string;
  stepId?: string;
  type: 'inspection' | 'defect' | 'rework_request' | 'rework_complete' | 'scrap';
  result?: 'pass' | 'fail' | 'conditional';
  defectType?: DefectType;
  defectSeverity?: 'minor' | 'major' | 'critical';
  defectDescription?: string;
  affectedQuantity?: number;
  resolution?: 'rework' | 'scrap' | 'use_as_is' | 'pending';
  reworkOrderId?: string;
  scrapCost?: number;
  photos: string[];
  inspectorId: string;
  inspectorName?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Enhanced ManufacturingOrder (MES Fields)
// ============================================

/**
 * Extended ManufacturingOrder with MES fields
 * Adds step-based execution, BOM subcollection, and enhanced tracking
 */
export interface ManufacturingOrderMES extends ManufacturingOrder {
  mesStatus: MOStatus;
  sourceType?: MOSourceType;
  sourceRef?: {
    designProjectId?: string;
    designItemId?: string;
    parentOrderId?: string;
    shopifyOrderId?: string;
  };
  routingTemplateId?: string;
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  currentWorkstationId?: string;
  scheduledStartDate?: Timestamp;
  scheduledEndDate?: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;
  dueDate?: Timestamp;
  estimatedLaborHours: number;
  actualLaborHours: number;
  estimatedMaterialCost: number;
  actualMaterialCost: number;
  estimatedTotalCost: number;
  actualTotalCost: number;
  qcStatus?: 'pending' | 'in_progress' | 'passed' | 'failed';
  defectCount: number;
  reworkOrderIds: string[];
  bomLineCount: number;
  bomTotalMaterialCost: number;
  customerName?: string;
  customerId?: string;
  projectName?: string;
}

// ============================================
// Release to Production
// ============================================

/**
 * Options for releasing design items to production
 */
export interface ReleaseToProductionOptions {
  designProjectId: string;
  designItemIds: string[];
  routingTemplateId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledStartDate?: Timestamp;
  dueDate?: Timestamp;
  batchMode: boolean;
  autoReserveMaterials: boolean;
  notes?: string;

  // SO gate — auto-fetched during release
  salesOrderId?: string;

  // Batch manufacturing
  batchSize?: number;              // split MOs into batches of this size

  // Project hierarchy
  projectPhase?: string;           // phase label for grouping

  // Procured items
  includeProcuredItems?: boolean;  // attach procured items as MO lines
}

/**
 * Result of a release to production operation
 */
export interface ReleaseResult {
  success: boolean;
  manufacturingOrderIds: string[];
  availabilityReport?: BOMAvailabilityReport;
  errors: Array<{ designItemId: string; error: string }>;
  warnings: string[];

  // Batch release info
  batchId?: string;
  totalMOsCreated?: number;
  procuredItemCount?: number;
}

// ============================================
// Analytics & KPIs
// ============================================

/**
 * Production summary for a date range
 */
export interface ProductionSummary {
  dateRange: { start: Timestamp; end: Timestamp };
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  completedOrders: number;
  completionRate: number;
  averageLeadTimeDays: number;
  totalDefects: number;
  defectRate: number;
  totalScrapCost: number;
  laborUtilizationPercent: number;
}

/**
 * Manufacturing KPIs for Strategy module integration
 */
export interface ManufacturingKPIs {
  ordersInProgress: number;
  avgLeadTimeDays: number;
  onTimeDeliveryRate: number;
  defectRate: number;
  materialWastePercent: number;
  laborUtilizationPercent: number;
}

/**
 * Order cost breakdown for analytics
 */
export interface OrderCostBreakdown {
  orderId: string;
  moNumber: string;
  estimatedMaterialCost: number;
  actualMaterialCost: number;
  estimatedLaborCost: number;
  actualLaborCost: number;
  scrapCost: number;
  estimatedTotalCost: number;
  actualTotalCost: number;
  variance: number;
  variancePercent: number;
}

/**
 * Operator performance metrics
 */
export interface OperatorPerformance {
  operatorId: string;
  operatorName: string;
  stepsCompleted: number;
  averageTimeVsEstimate: number;
  qualityPassRate: number;
  totalHoursWorked: number;
}

/**
 * Workstation efficiency metrics
 */
export interface WorkstationEfficiency {
  workstationId: string;
  workstationName: string;
  utilizationPercent: number;
  averageCycleTimeMinutes: number;
  queueDepth: number;
  stepsCompleted: number;
}

// ============================================
// Production Batch
// ============================================

export type ProductionBatchStatus = 'released' | 'in-progress' | 'partial' | 'completed';

export const BATCH_STATUS_LABELS: Record<ProductionBatchStatus, string> = {
  released: 'Released',
  'in-progress': 'In Progress',
  partial: 'Partial',
  completed: 'Completed',
};

/**
 * A production batch groups multiple MOs that were released together from a project.
 * Enables project-level release-to-production and grouped MO tracking.
 */
export interface ProductionBatch {
  id: string;
  batchNumber: string;
  projectId: string;
  projectCode: string;
  projectName?: string;
  moIds: string[];
  totalItems: number;
  completedItems: number;
  status: ProductionBatchStatus;
  subsidiaryId: string;
  createdAt: Timestamp;
  createdBy: string;
}
