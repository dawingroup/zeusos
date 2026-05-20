/**
 * Design Manager Types
 * TypeScript type definitions for the design manager module
 */

import type { Timestamp } from '@/shared/types';
import type { EdgeOperationSpec } from '@/shared/types/edgeOperations';

// ============================================
// Fulfillment Tracking (Post-Production)
// ============================================

/**
 * Fulfillment status for design items after manufacturing/procurement
 */
export type FulfillmentStatus =
  | 'not_released'
  | 'in_production'
  | 'awaiting_receipt'
  | 'received'
  | 'packing'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'delivered'
  | 'installed'
  | 'complete';

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  not_released: 'Not Released',
  in_production: 'In Production',
  awaiting_receipt: 'Awaiting Receipt',
  received: 'Received',
  packing: 'Packing',
  ready_for_dispatch: 'Ready for Dispatch',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  installed: 'Installed',
  complete: 'Complete',
};

/**
 * Packing checklist item for fulfillment
 */
export interface PackingChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: Timestamp;
}

/**
 * Fulfillment tracking details for a design item
 */
export interface FulfillmentTracking {
  // Intake — received from manufacturing (or other upstream stage)
  receivedAt?: Timestamp;
  receivedBy?: string;
  routedFrom?: string;

  // Intake / packing start
  packingStartedAt?: Timestamp;

  // Packing
  packingChecklist?: PackingChecklistItem[];
  packedAt?: Timestamp;
  packedBy?: string;
  packageCount?: number;
  packageNotes?: string;

  // Dispatch
  dispatchedAt?: Timestamp;
  dispatchedBy?: string;
  deliveryMethod?: 'company_vehicle' | 'third_party' | 'client_pickup';
  trackingRef?: string;

  // Delivery
  deliveredAt?: Timestamp;
  deliveryNotes?: string;

  // Installation
  installationRequired?: boolean;
  installedAt?: Timestamp;
  installedBy?: string;
  installationNotes?: string;

  // P7 phase 3 — terminal 'complete' state gets its own timestamp so
  // fulfillment status is fully derivable from `FulfillmentTracking`
  // with no flat-field fallback. Stamped by `markAsComplete`; the
  // derivation treats it as the most-advanced signal.
  completedAt?: Timestamp;
  completedBy?: string;
}

// ============================================
// Core Enums and Status Types
// ============================================

/**
 * RAG Status values (Red, Amber, Green, Not Applicable)
 */
export type RAGStatusValue = 'red' | 'amber' | 'green' | 'not-applicable';

/**
 * Design stages in the workflow
 */
export type DesignStage =
  // Manufacturing stages (Custom Furniture/Millwork)
  | 'concept'
  | 'preliminary'
  | 'technical'
  | 'pre-production'
  | 'production-ready'
  // Procurement stages
  | 'procure-identify'
  | 'procure-quote'
  | 'procure-approve'
  | 'procure-order'
  | 'procure-received'
  // Design Document stages (formerly Architectural)
  | 'arch-brief'
  | 'arch-schematic'
  | 'arch-development'
  | 'arch-construction-docs'
  | 'arch-approved'
  // Construction stages (NEW)
  | 'const-scope'
  | 'const-spec'
  | 'const-quote'
  | 'const-approve'
  | 'const-in-progress'
  | 'const-inspection'
  | 'const-complete';

/**
 * Design item categories
 */
export type DesignCategory =
  | 'casework'
  | 'furniture'
  | 'millwork'
  | 'doors'
  | 'fixtures'
  | 'specialty'
  | 'architectural';

/**
 * Approval status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision-requested';

// ============================================
// RAG Status Types
// ============================================

/**
 * Single RAG value with metadata
 */
export interface RAGValue {
  status: RAGStatusValue;
  notes: string;
  updatedAt: Timestamp;
  updatedBy: string;
  /**
   * True once this aspect has been explicitly assessed (manual or auto update).
   * Untouched defaults stay false and are excluded from readiness scoring.
   */
  checked?: boolean;
}

/**
 * Design Completeness aspects
 */
export interface DesignCompletenessAspects {
  overallDimensions: RAGValue;
  model3D: RAGValue;
  productionDrawings: RAGValue;
  materialSpecs: RAGValue;
  hardwareSpecs: RAGValue;
  finishSpecs: RAGValue;
  joineryDetails: RAGValue;
  tolerances: RAGValue;
  assemblyInstructions: RAGValue;
}

/**
 * Manufacturing Readiness aspects
 */
export interface ManufacturingReadinessAspects {
  materialAvailability: RAGValue;
  hardwareAvailability: RAGValue;
  toolingReadiness: RAGValue;
  processDocumentation: RAGValue;
  qualityCriteria: RAGValue;
  costValidation: RAGValue;
}

/**
 * Quality Gates aspects
 */
export interface QualityGatesAspects {
  internalDesignReview: RAGValue;
  manufacturingReview: RAGValue;
  clientApproval: RAGValue;
  prototypeValidation: RAGValue;
}

/**
 * Complete RAG Status structure
 */
export interface RAGStatus {
  designCompleteness: DesignCompletenessAspects;
  manufacturingReadiness: ManufacturingReadinessAspects;
  qualityGates: QualityGatesAspects;
}

// ============================================
// Design Item Types
// ============================================

/**
 * Stage transition history entry
 */
export interface StageTransition {
  fromStage: DesignStage;
  toStage: DesignStage;
  transitionedAt: Timestamp;
  transitionedBy: string;
  notes?: string;
}

/**
 * Procurement pricing for procured items
 */
export interface ProcurementPricing {
  // Base cost
  unitCost: number;              // Cost per unit in source currency
  quantity: number;              // Number of units
  currency: string;              // Source currency (USD, EUR, CNY, etc.)
  
  // Exchange rate
  exchangeRate: number;          // Rate to convert to project currency (e.g., 1 USD = 3700 UGX)
  targetCurrency: string;        // Project currency (UGX, KES, etc.)
  
  // Logistics (based on weight/volume)
  weight?: number;               // Weight in kg
  logisticsCost?: number;        // Shipping/freight cost (in source currency)
  logisticsNotes?: string;       // Shipping method, carrier, etc.
  
  // Customs & duties
  customsCost?: number;          // Import duties, taxes (in source currency)
  hsCode?: string;               // Harmonized System code
  customsNotes?: string;         // Duty rate info, exemptions, etc.
  
  // Totals in source currency
  totalItemCost: number;         // unitCost × quantity
  totalLogistics: number;        // Total logistics
  totalCustoms: number;          // Total customs
  grandTotal: number;            // Sum of all (source currency)
  
  // Landed cost in target currency
  landedCostPerUnit: number;     // (grandTotal / quantity) × exchangeRate
  totalLandedCost: number;       // grandTotal × exchangeRate
  
  // Tracking
  quotedAt?: Timestamp;
  quotedBy?: string;
  vendor?: string;
  quoteReference?: string;
  validUntil?: Timestamp;
}

/**
 * Architectural drawing disciplines
 */
export type ArchitecturalDiscipline =
  | 'architectural'
  | 'structural'
  | 'mep'
  | 'landscaping'
  | 'furniture-millwork';

/**
 * Default hourly rates per discipline (in ZAR)
 */
export const DEFAULT_DISCIPLINE_RATES: Record<ArchitecturalDiscipline, number> = {
  'architectural': 850,
  'structural': 950,
  'mep': 900,
  'landscaping': 750,
  'furniture-millwork': 800,
};

/**
 * Human-readable labels for disciplines
 */
export const DISCIPLINE_LABELS: Record<ArchitecturalDiscipline, string> = {
  'architectural': 'Architectural',
  'structural': 'Structural',
  'mep': 'MEP (Mechanical, Electrical, Plumbing)',
  'landscaping': 'Landscaping',
  'furniture-millwork': 'Furniture & Millwork',
};

/**
 * Fixed cost line item for architectural projects
 */
export interface ArchitecturalFixedCost {
  id: string;
  category: 'site-visit' | 'geotechnical' | 'survey' | 'consultant' | 'regulatory' | 'printing' | 'other';
  description: string;
  amount: number;
  currency: string;
  vendor?: string;
  invoiceRef?: string;
  date?: Timestamp;
  notes?: string;
}

/**
 * Time entry for hourly tracking
 */
export interface ArchitecturalTimeEntry {
  id: string;
  discipline: ArchitecturalDiscipline;
  date: Timestamp;
  hours: number;
  rate: number;
  description: string;
  staffMember?: string;
  stage: DesignStage;
}

/**
 * Architectural pricing for drawing items (stored in detail page, not creation form)
 */
export interface ArchitecturalPricing {
  discipline: ArchitecturalDiscipline;
  drawingNumber?: string;
  scale?: string;
  sheetSize?: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'ARCH-D' | 'ARCH-E';

  // Hourly tracking
  hourlyRate: number;
  timeEntries: ArchitecturalTimeEntry[];
  totalHours: number;
  totalLaborCost: number;

  // Fixed costs
  fixedCosts: ArchitecturalFixedCost[];
  totalFixedCosts: number;

  // Totals
  totalCost: number;
  currency: string;

  // Revision tracking
  revisionCount: number;
  lastRevisedAt?: Timestamp;
}

// Legacy type alias for backwards compatibility
export type ArchitecturalDrawingType = ArchitecturalDiscipline;

/**
 * Standard part entry (hinges, screws, edging, etc.)
 */
export interface StandardPartEntry {
  id: string;
  sku?: string;                   // SKU reference
  name: string;                   // e.g., "Soft-close hinge 110°"
  category: 'hinge' | 'slide' | 'screw' | 'cam' | 'dowel' | 'edging' | 'handle' | 'knob' | 'other';
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
  purchasePriority?: number;      // 0-based rank. Null = unranked.
}

/**
 * Part category type for special/project parts
 */
export type PartCategory = 'handle' | 'lock' | 'hinge' | 'accessory' | 'lighting' | 'drawer-slide' | 'bracket' | 'connector' | 'other';

/**
 * Project-level part entry (shared across design items in a project)
 * Created from clips or manually added
 */
export interface ProjectPart {
  id: string;
  name: string;                   // e.g., "Custom brass handle - Italian"
  supplier: string;               // e.g., "Colonial Bronze"
  partNumber?: string;            // SKU/part number
  category: PartCategory;
  unitCost: number;
  currency: string;               // e.g., "USD", "KES"
  referenceImageUrl?: string;     // Image from clip
  purchaseUrl?: string;           // Source URL for purchasing
  clipId?: string;                // Original clip ID if created from clip
  description?: string;
  specifications?: Record<string, string>; // e.g., { "finish": "brass", "size": "4 inch" }
  lastPriceCheck?: Timestamp;
  notes?: string;
  promotedToMaterialId?: string;  // If promoted to global materials database
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Design item reference to a project part (with quantity)
 */
export interface DesignItemPartUsage {
  projectPartId: string;          // Reference to ProjectPart
  quantity: number;
  notes?: string;
}

/**
 * Special/approved part entry (custom handles, locks for luxury projects)
 * Parts Tab: captures identification + quantity only
 * Costing Tab: handles all pricing, exchange rates, transport, landed cost
 */
export interface SpecialPartEntry {
  id: string;

  // Identification (managed in Parts Tab)
  name: string;                   // e.g., "Custom brass handle - Italian"
  supplier?: string;
  supplierId?: string;            // Reference to supplier record in platform/suppliers/records
  partNumber?: string;
  category: PartCategory;
  quantity: number;
  unitCost?: number;              // Quick-access unit cost (denormalized from costing)
  referenceImageUrl?: string;     // Image for visual reference
  purchaseUrl?: string;           // URL to purchase the part
  projectPartId?: string;         // Reference to ProjectPart if from library
  approvedBy?: string;
  approvedAt?: Timestamp;
  notes?: string;

  // Costing (managed in Costing Tab - similar to procurement)
  costing?: SpecialPartCosting;

  // Purchase priority (lower number = buy first)
  purchasePriority?: number;      // 0-based rank. Null = unranked.
}

/**
 * Costing details for a special part (similar to ProcurementPricing)
 */
export interface SpecialPartCosting {
  // Source pricing
  unitCost: number;               // Cost per unit in source currency
  currency: string;               // Source currency (USD, EUR, AED, etc.)
  
  // Exchange rate
  exchangeRate: number;           // Rate to convert to project currency
  targetCurrency: string;         // Project currency (UGX, KES, etc.)
  
  // Additional costs (allocated per part)
  transportCost?: number;         // Shipping/freight allocated (source currency)
  logisticsCost?: number;         // Handling, clearing (source currency)
  customsCost?: number;           // Import duties (source currency)
  
  // Calculated totals
  totalSourceCost: number;        // (unitCost + transport + logistics + customs) * quantity
  landedUnitCost: number;         // totalSourceCost / quantity * exchangeRate
  totalLandedCost: number;        // totalSourceCost * exchangeRate
  
  // Tracking
  pricedAt?: Timestamp;
  pricedBy?: string;
  priceValidUntil?: Timestamp;
  priceNotes?: string;
}

/**
 * Sheet material breakdown from parts/nesting
 */
export interface SheetMaterialBreakdown {
  materialId?: string;            // Reference to material library
  materialName: string;
  thickness: number;
  sheetsRequired: number;
  unitCost: number;
  totalCost: number;
  partsCount: number;             // Number of parts using this material
  totalArea: number;              // m² of this material
}

/**
 * Timber material breakdown — volumetric (m³) or linear (m) costing
 */
export interface TimberMaterialBreakdown {
  materialId?: string;
  materialName: string;
  crossSection: { thickness: number; width: number };  // mm
  pricingMethod: 'volumetric' | 'linear' | 'per-piece';
  totalVolumeCubicMeters: number;     // thickness × width × length → m³
  totalLinearMeters: number;          // sum of lengths → m
  unitCost: number;                   // per m³, per m, or per piece
  totalCost: number;
  partsCount: number;
  costUnit: string;                   // 'per m³' | 'per m' | 'per piece'
}

/**
 * Linear stock (metal bar, aluminium) breakdown — linear meter costing
 */
export interface LinearMaterialBreakdown {
  materialId?: string;
  materialName: string;
  profile: string;                    // e.g., "50x25 SHS", "25mm Round Bar"
  totalLinearMeters: number;
  unitCost: number;                   // per linear meter
  totalCost: number;
  partsCount: number;
}

/**
 * Manufacturing cost for manufactured items
 */
export interface ManufacturingCost {
  // Sheet material costs (auto-calculated from parts)
  sheetMaterials: SheetMaterialBreakdown[];
  sheetMaterialsCost: number;     // Sum of all sheet materials

  // Timber material costs — volumetric (m³) or linear costing
  timberMaterials?: TimberMaterialBreakdown[];
  timberMaterialsCost?: number;

  // Linear stock material costs — linear meter costing (metal bar, aluminium)
  linearMaterials?: LinearMaterialBreakdown[];
  linearMaterialsCost?: number;

  // Edge banding material costs — linear meter costing (PVC tape, ABS strip, etc.)
  edgingMaterials?: LinearMaterialBreakdown[];
  edgingMaterialsCost?: number;

  // Standard parts (hinges, screws, edging from inventory)
  standardParts: StandardPartEntry[];
  standardPartsCost: number;

  // Special/approved parts (for luxury projects)
  specialParts: SpecialPartEntry[];
  specialPartsCost: number;

  // Material processing costs (panel saw, edge banding, planing, etc.)
  processingSteps?: Array<{
    stepId: string;
    label: string;
    quantity: number;
    unit: string;
    ratePerUnit: number;
    totalCost: number;
  }>;
  processingCost?: number;        // Sum of all processing step costs

  // Legacy field for manual override
  materialCost: number;           // Total material cost (sheet + timber + linear + standard + special)
  materialBreakdown?: string;     // e.g., "2 sheets MDF 18mm, 1 sheet Plywood"

  // Labor
  laborHours: number;             // Estimated labor hours
  laborRate: number;              // Rate per hour
  laborCost: number;              // laborHours × laborRate

  // Totals
  totalCost: number;              // materialCost + processingCost + laborCost
  costPerUnit: number;            // For items with quantity > 1
  quantity: number;               // Number of units
  
  // Auto-calculation metadata
  autoCalculated: boolean;        // Whether costs were auto-calculated from parts
  lastAutoCalcAt?: Timestamp;
  
  // Tracking
  estimatedAt?: Timestamp;
  estimatedBy?: string;
  notes?: string;
}

/**
 * P2 / P10 — Cabinet-derived manufacturing cost rollup.
 *
 * Aggregate of every `SceneCabinet.computedBOM` and `estimatedPrice` under
 * a DesignItem, produced by the design-studio
 * `designItemCostAggregator.recomputeDesignItemRollup()` service. Written
 * on scene-cabinet add / remove / duplicate / reassign.
 *
 * Kept as a sibling of `manufacturing` (instead of overwriting it) so
 * human-curated `StandardPartEntry` / `SpecialPartEntry` lists aren't
 * stomped by the automated rollup. Consumers that want "the current cost
 * picture" should prefer this field when it exists and the DesignItem
 * has cabinets linked; fall back to `manufacturing` otherwise.
 *
 * Locked cabinets ARE included in the totals — they represent committed
 * production scope that belongs to the item's cost. The rollup does not
 * fire on `lockCabinetForProduction` (lock doesn't change BOM); scenes
 * remain the source of truth for unlocked cabinets, and locked cabinets
 * effectively freeze their contribution at the moment of lock.
 */
export interface ManufacturingRollupFromCabinets {
  /** Every cabinet that contributed, for traceability + UI drill-down. */
  cabinets: Array<{
    cabinetId: string;
    sceneId: string;
    cabinetCode: string;
    displayName: string;
    isLocked: boolean;
    /** How many physical units this SceneCabinet represents. Defaults
     *  to 1 when the cabinet doc was authored before the field landed. */
    requiredQuantity?: number;
    materialsCost: number;    // estimatedPrice.materialsCost × requiredQuantity
    hardwareCost: number;     // estimatedPrice.hardwareCost × requiredQuantity
    laborCost: number;        // estimatedPrice.laborCost × requiredQuantity
    totalCost: number;        // estimatedPrice.total × requiredQuantity
    currency: 'UGX' | 'USD';
  }>;
  /** Number of SceneCabinet entries contributing to the rollup. */
  cabinetCount: number;
  /** Sum of `requiredQuantity` across every SceneCabinet — the physical
   *  units produced. Equal to `cabinetCount` unless some cabinets have
   *  `requiredQuantity > 1`. Added after the requiredQuantity feature
   *  landed; absent on rollups written before the backfill. */
  unitCount?: number;
  lockedCabinetCount: number;
  /** Scene ids that contributed at least one cabinet. */
  rolledUpFromScenes: string[];

  // Classified sums of ComputedBOMLine.totalCost across all cabinets.
  sheetMaterialsCost: number;
  timberMaterialsCost: number;
  linearMaterialsCost: number;
  edgingMaterialsCost: number;
  hardwareCost: number;
  otherMaterialsCost: number;
  /** Sum of the above material buckets. */
  materialsCost: number;

  // Pricing rollup from SceneCabinet.estimatedPrice.
  laborCost: number;
  overheadCost: number;
  subtotal: number;
  vatAmount: number;
  totalCost: number;
  /** totalCost / max(unitCount, cabinetCount, 1). Divides by physical
   *  units produced, so a SceneCabinet with requiredQuantity=4 is
   *  counted as 4 units, not 1. */
  costPerUnit: number;

  /** Reported currency. If cabinets used different currencies, this is
   * the currency of the majority and `hasMixedCurrencies` is true — the
   * UI should warn the operator rather than trust the totals. */
  currency: 'UGX' | 'USD';
  hasMixedCurrencies: boolean;

  lastRolledUpAt: Timestamp;
}

/**
 * Design Item - Main entity
 */
export interface DesignItem {
  id: string;
  
  // Identification
  itemCode: string;
  name: string;
  description?: string;
  category: DesignCategory;

  sourcingType?: 'MANUFACTURED' | 'PROCURED' | 'ARCHITECTURAL' | 'CONSTRUCTION' | 'CUSTOM_FURNITURE_MILLWORK' | 'DESIGN_DOCUMENT';

  // Procurement pricing (only for PROCURED items)
  procurement?: ProcurementPricing;

  // Manufacturing cost (only for MANUFACTURED items)
  manufacturing?: ManufacturingCost;

  // P10: cabinet-derived cost rollup (design-studio → design-manager).
  // Lives alongside `manufacturing` so the auto-aggregate doesn't stomp
  // human-curated breakdowns. See ManufacturingRollupFromCabinets doc.
  manufacturingRollup?: ManufacturingRollupFromCabinets;

  // Architectural pricing (only for ARCHITECTURAL/DESIGN_DOCUMENT items)
  architectural?: ArchitecturalPricing;

  // Construction pricing (only for CONSTRUCTION items)
  construction?: import('./deliverables').ConstructionPricing;

  /**
   * Per-stage construction gate checks. Keys come from
   * `CONSTRUCTION_STAGE_CHECKLIST` in `./deliverables`. Values: true = done.
   * The ticked proportion drives `overallReadiness` for construction items.
   */
  constructionReadiness?: Record<string, boolean>;

  // Project relationship
  projectId: string;
  projectCode: string;
  
  // Status
  currentStage: DesignStage;
  stageEnteredAt?: Timestamp; // When the current stage was entered (for delay tracking)
  ragStatus: RAGStatus;
  overallReadiness: number; // 0-100 percentage
  
  // History
  stageHistory: StageTransition[];
  approvals: Approval[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  
  // ── P6: optimistic concurrency on `parts` ────────────────────────────────
  // Every successful write to the `parts` array bumps `partsVersion`. The
  // design-studio parts-sync path reads this version before editing and
  // passes it back as `baseVersion` on the write — if the server moved in
  // the meantime, the write is rejected with `PartsConcurrencyError` and
  // the user sees a 3-way merge prompt (UI layer).
  //
  // Legacy docs (pre-P6) have no field; readers treat `undefined` as 0 and
  // writers initialise it on the next write. `partsLastSyncedAt` stamps
  // the wall-clock time of the last successful write for UX display.
  partsVersion?: number;
  partsLastSyncedAt?: Timestamp;
  /**
   * Curated parts list, procurement-facing, inventory-linked. Used to
   * be a phantom field — read/written by `partsSyncService.ts:319` and
   * `projectContextService.ts:163` but not declared on the type, forcing
   * `any`-casts at every callsite. Declared here so TypeScript can help.
   *
   * Populated by:
   *   - Workshop Viewer AI recognition (one model at a time)
   *   - Design Studio scene sync — `syncDesignItemPartsFromScene`
   *     (merges parts across every cabinet bound to this item)
   *
   * Protected by `partsVersion` optimistic concurrency — writes pass
   * the version they read, stale writes are rejected with
   * `PartsConcurrencyError`.
   */
  parts?: PartEntry[];

  // Optional fields
  requiredQuantity?: number;  // Number of units needed (e.g., 4 kitchen cabinets)
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: Timestamp;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  notes?: string;

  // Manufacturing handover — `manufacturingOrderId` is the canonical signal.
  // Readers use `deriveHandoverStatus(item)` from
  // `@/modules/design-manager/services/designItemStatusDerivation`.
  //
  // P7 phase 5: the previously @deprecated flat `handoverStatus` field is
  // removed from the type. A backfill sweep (P7 phase 5 prep) confirmed
  // zero legacy rows relied on it — every MO-linked item derives
  // 'handed-over' from `manufacturingOrderId` alone. Firestore docs with
  // residual `handoverStatus` keys are harmless; the derivation never
  // reads them and TS no longer lets callers either.
  manufacturingOrderId?: string;

  /**
   * Back-link to the Construction Order spawned from this design item at
   * the `const-approve` gate. Analog of `manufacturingOrderId` for the
   * construction workflow. See `@/modules/construction`.
   */
  constructionOrderId?: string;

  /**
   * Cross-module links to advisory BOQ line items (P9/F9).
   *
   * Populated when an operator reconciles a design-manager item against
   * one or more lines on an advisory BOQ (typical for the same project
   * being tracked in both places). The link is bidirectional — each
   * referenced BOQItem carries `linkedDesignItemId` pointing back here.
   *
   * No automatic sync: the two cost systems (DesignItem pricing unions
   * vs BOQ labor/material/equipment rates) stay independent. The link
   * only enables reconciliation views that surface divergence.
   */
  linkedBoqItemIds?: string[];

  // Fulfillment tracking (post-production pipeline) —
  // `fulfillment.{receivedAt,packedAt,dispatchedAt,deliveredAt,installedAt,completedAt}`
  // timestamps are the canonical signals; status is derived via
  // `deriveFulfillmentStatus(item)` from
  // `@/modules/design-manager/services/designItemStatusDerivation`.
  //
  // P7 phase 5: the previously @deprecated flat `fulfillmentStatus` field
  // is removed from the type. `markAsComplete` now stamps
  // `fulfillment.completedAt` (not the flat terminal), and the P7 phase 5
  // prep backfill confirmed zero legacy rows still relied on the flat
  // field. The derivation retains legacy-tolerant branches on its own
  // structural input type so cold data (e.g. Firestore raw reads) still
  // decodes cleanly — the removal here is purely at the TS boundary.
  fulfillment?: FulfillmentTracking;
  salesOrderId?: string;
  batchId?: string;

  // Parametric overrides (Phase 5 — per design item)
  parametricOverrides?: import('@/modules/inventory/types/parametricMatrix').DesignItemParametricOverrides;

  // Sort order for UI display
  sortOrder?: number;

  // Assignment
  assignedTo?: string;

  // Budget tracking
  budgetTracking?: {
    allocatedBudget?: number;
    spentAmount?: number;
    actualCost?: number;
    variance?: number;
    currency?: string;
    lastUpdated?: Timestamp;
  };

  // Strategy context from guided strategy workflow
  strategyContext?: {
    strategyId?: string;
    materialPreferences?: string[];
    budgetTier?: 'economy' | 'standard' | 'premium' | 'luxury';
    qualityLevel?: string;
    qualityExpectations?: string;
    spaceMultiplier?: number;
    scopingConfidence?: number;
    suppliers?: string[];
  };
}

// ============================================
// Project Types
// ============================================

/**
 * Design Project
 */
/**
 * Project-level deliverable requirements profile.
 * Declares which deliverable types are expected and which RAG aspects are N/A.
 */
export interface DeliverableRequirementsProfile {
  /** Deliverable types explicitly required for this project */
  requiredTypes: DeliverableType[];
  /** RAG aspects marked N/A per sourcing type. Key: sourcingType, Value: aspect paths */
  naOverrides: Record<string, string[]>;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface DesignProject {
  id: string;
  code: string;
  name: string;
  description?: string;
  
  // Client info
  /**
   * Customer who owns this project. REQUIRED as of the P5 data-model fix —
   * a project cannot exist unlinked from a customer (audit finding F4).
   * Legacy documents with a missing `customerId` must be backfilled before
   * deploying rule enforcement; see `scripts/audit-design-projects-customer.cjs`.
   */
  customerId: string;
  customerName: string;

  /**
   * Which Dawin subsidiary owns this project. Drives portal routing
   * (Finishes vs Advisory dashboards) and a handful of staff-side
   * scopes. Optional for legacy projects; new projects must set it.
   */
  subsidiaryId?: 'finishes' | 'advisory';

  // Status
  status: 'active' | 'on-hold' | 'completed' | 'cancelled';
  
  // Dates
  startDate?: Timestamp;
  dueDate?: Timestamp;
  completedDate?: Timestamp;
  
  // Locations
  siteLocation?: ProjectLocation;
  deliveryLocation?: ProjectLocation;
  
  // Parametric defaults (Phase 5 — project-level hardware selection)
  parametricDefaults?: import('@/modules/inventory/types/parametricMatrix').ProjectParametricDefaults;

  // CRM Deal link
  /**
   * P16/F13 — canonical FK to the originating CRM deal. Backfill ran
   * 2026-04-18; the legacy `linkedDealId` field was dropped post-
   * migration. May be absent on project records that predate CRM
   * linking (pure design-manager-initiated projects).
   */
  dealId?: string;

  // Manufacturing link
  linkedManufacturingOrderIds?: string[];
  linkedSalesOrderId?: string;

  // Deliverable requirements profile
  deliverableProfile?: DeliverableRequirementsProfile;

  // Drive mirror (Phase 2 — Shared Drive Architecture v3/v3.1).
  // Populated asynchronously by `createProjectDriveFolders` CF when the
  // project is created. Absent = sync disabled or still pending.
  /** Root `01_Active-Projects/{code}_{client}_{type}/` folder ID on the Shared Drive. */
  driveFolderId?: string;
  /** `webViewLink` to the project folder — surfaced as "Open in Drive" header link. */
  driveFolderUrl?: string;
  /** Server timestamp when the folder tree was created successfully. */
  driveFolderCreatedAt?: Timestamp;
  /** Last error message from the bootstrap CF, cleared on success. */
  driveFolderError?: string;

  // Archive lifecycle (Phase 4 — v3 §02_Archive).
  /**
   * True when the project folder has been moved into `02_Archive/{Year}/`
   * by `archiveProject` CF. `projectFiles` for the project get a matching
   * `archived: true` flag in the same batch. Idempotent — re-archiving a
   * project is a no-op. Does NOT block further file uploads; archived
   * projects are read-only by convention, not rule.
   */
  archived?: boolean;
  archivedAt?: Timestamp;
  archivedBy?: string;
  /** Last error from the archive CF, cleared on successful archive. */
  archiveError?: string;

  // Client Portal (v2 — editorial portal at /portal/*)
  /**
   * Firebase Auth UIDs allowed to view this project in the client portal.
   * Empty/absent = no portal access. Internal staff bypass via custom claims.
   * Updated by the Customer Hub when client users are invited to the portal.
   */
  clientPortalUserIds?: string[];

  /**
   * Overall physical progress 0–100. Maintained by delivery operations
   * (not auto-derived) so the portal reflects what the team is reporting,
   * not what design items happen to have marked.
   */
  physicalProgress?: number;

  /**
   * Cached phase rollup for the portal dashboard. Refreshed when phase
   * milestones move. All four keys optional so partial rollups still render.
   */
  phaseCompletion?: {
    design?: number;
    procurement?: number;
    construction?: number;
    snagging?: number;
  };

  /**
   * Programme baseline distinct from `startDate`. `startDate` is when work
   * began on the project; `baselineDate` is when the schedule was sealed
   * with the client and is the reference for variance calculations.
   */
  baselineDate?: Timestamp;

  /**
   * Upcoming + recent milestones surfaced in the portal "Up next" table
   * and the schedule view. Ordered by date; portal renders the next 4–6.
   */
  milestones?: ProjectMilestone[];

  /**
   * Open risks shown on the portal schedule view. Free-form per project
   * — programme directors maintain these manually in the staff-side
   * project view. Severity drives the chip colour in the portal.
   */
  risks?: ProjectRisk[];

  /**
   * Advisory-line programme details. Optional and only present when
   * `subsidiaryId === 'advisory'`. Powers the portal Advisory dashboard
   * (programme cost, phase breakdown, store rollout table).
   *
   * For Finishes projects this is undefined — the Finishes screens read
   * the SO + phaseCompletion directly instead of this rollup.
   */
  programme?: ProjectProgramme;

  /**
   * Advisory-line store list (one row per retail outlet for retail
   * rollout programmes). Surfaced as the "Stores · status snapshot"
   * table on the Advisory dashboard.
   */
  programmeStores?: ProgrammeStore[];

  /**
   * Curated site photos for the dashboard "Latest from site" gallery.
   * Distinct from `projectFiles` Drive sync which holds everything;
   * this is the client-facing selection.
   */
  sitePhotos?: ProjectSitePhoto[];

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * A scheduled milestone on a DesignProject. Surfaced in the client portal
 * dashboard and schedule views. `weekLabel` is a short tag like "Wk 15".
 */
export interface ProjectMilestone {
  id: string;
  label: string;
  detail?: string;
  owner?: string;
  date: Timestamp;
  weekLabel?: string;
  category?: 'design' | 'procurement' | 'construction' | 'snagging' | 'handover';
  status?: 'upcoming' | 'in-progress' | 'done' | 'blocked';
}

/**
 * An open risk surfaced in the portal schedule view. Severity maps to
 * the right-hand chip colour ("High" → signal red, "Med" → default,
 * "Low" → dim). Mitigation is the short status line clients see.
 */
export interface ProjectRisk {
  id: string;
  title: string;
  /** What the team is doing about it (e.g. "Client review 16 May"). */
  mitigation?: string;
  severity: 'high' | 'medium' | 'low';
  /** Optional category for filtering on staff side. */
  category?: 'schedule' | 'cost' | 'design' | 'supplier';
}

/**
 * Per-phase rollup for an advisory programme. Used by the portal
 * Advisory dashboard's "Programme cost · committed vs forecast" pane
 * and the KPI strip. Percentages are 0–100; currency is project-level
 * UGX unless overridden per-row.
 */
export interface ProjectProgramme {
  /** "Phase 2 of 5 · Implementation" — primary status line. */
  phaseLabel: string;
  /** 0-100 — overall programme completion. */
  progress: number;
  /** Stores currently live (open to public). */
  storesLive: number;
  /** Total stores in the programme. */
  storesTotal: number;
  /** Stores currently in fit-out. */
  storesInFitOut: number;
  /** Total programme value in UGX (or `currency`). */
  totalValue: number;
  /** Capex committed via raised POs / sealed contracts. */
  committedCapex: number;
  /** Forecast total at completion — used to flag overruns. */
  forecastAtCompletion?: number;
  currency: string;
  /** Per-phase progress for the "Phase 1 · Design / Phase 2 · ..." bars. */
  phases?: ProgrammePhase[];
  /** Headline figure for an open BOQ / pack signoff. */
  openApproval?: {
    /** "BOQ pack v3" */
    label: string;
    /** "Naqaa-08 Riyadh · Naqaa-09 Jeddah" */
    sub: string;
    /** Combined contract value UGX. */
    value: number;
    /** Due date for the signoff. */
    dueDate?: Timestamp;
  };
  /** Procurement / Matflow rollup (cached on the project for cheap reads). */
  procurement?: {
    openPOs: number;
    pendingRFQs: number;
    costVariancePct: number;
    vettedVendors: number;
  };
}

export interface ProgrammePhase {
  /** "Phase 1 · Design" */
  label: string;
  /** 0-100 */
  progress: number;
}

export interface ProgrammeStore {
  id: string;
  /** "Naqaa-01" */
  code: string;
  /** "Dubai Mall" */
  name: string;
  /** "Flagship · 312 m²" */
  format?: string;
  /** "UAE" / "KSA" */
  region: string;
  /** "Live" / "Fit-out · Wk 6" / "BOQ approval" / "Schematic" */
  phaseStatus: string;
  /** "v4 sealed" / "v3 review" */
  boqStatus: string;
  /** Date of open / target open. Stored as ISO yyyy-mm-dd string for
   *  simplicity (no Timestamp serialisation churn). */
  openDateLabel?: string;
  /** Marks this store as currently awaiting client signoff. */
  signal?: boolean;
  /** Marks this store as not yet started. */
  dim?: boolean;
}

/**
 * A site photo curated for the client portal "Latest from site" gallery.
 * `tone` is a paper-warm placeholder identifier so the portal can render
 * before image URLs resolve; once URLs are wired through Drive sync we
 * read `url` directly.
 */
export interface ProjectSitePhoto {
  id: string;
  url?: string;
  thumbnailUrl?: string;
  label?: string;
  zone?: string;
  capturedAt?: Timestamp;
  tone?: 'site' | 'interior-warm' | 'interior' | 'fabric' | 'light' | 'render' | 'render-2' | 'stone';
}

// ============================================
// Location Types
// ============================================

/**
 * Google Maps pin / GPS location
 */
export interface GeoLocation {
  lat: number;
  lng: number;
  label?: string;
  googleMapsUrl?: string;
  plusCode?: string;
}

/**
 * Project location information
 */
export interface ProjectLocation {
  address?: string;
  city?: string;
  country?: string;
  geoLocation?: GeoLocation;
  notes?: string;
}

// ============================================
// Client Interaction Types
// ============================================

/**
 * Type of client interaction / engagement
 */
export type InteractionType =
  | 'meeting'
  | 'phone-call'
  | 'email'
  | 'site-visit'
  | 'presentation'
  | 'workshop'
  | 'approval-session'
  | 'delivery'
  | 'other';

/**
 * Interaction attendee
 */
export interface InteractionAttendee {
  name: string;
  role?: string;
  email?: string;
  isClient: boolean;
}

/**
 * Follow-up action item from an interaction
 */
export interface InteractionActionItem {
  id: string;
  description: string;
  assignedTo?: string;
  dueDate?: Timestamp;
  completed: boolean;
  completedAt?: Timestamp;
}

/**
 * Client interaction / engagement record
 */
export interface ClientInteraction {
  id: string;
  
  // Core
  type: InteractionType;
  title: string;
  date: Timestamp;
  duration?: number; // minutes
  
  // Details
  summary: string;
  notes?: string;
  
  // People
  attendees: InteractionAttendee[];
  
  // Location (for site visits, meetings, etc.)
  location?: string;
  geoLocation?: GeoLocation;
  
  // Follow-ups
  actionItems: InteractionActionItem[];
  nextSteps?: string;
  followUpDate?: Timestamp;
  
  // Attachments
  attachmentUrls?: string[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================
// Dashboard / Summary Types
// ============================================

/**
 * Summary statistics for dashboard
 */
export interface DesignDashboardStats {
  totalItems: number;
  byStage: Record<DesignStage, number>;
  byStatus: Record<RAGStatusValue, number>;
  byCategory: Record<DesignCategory, number>;
  averageReadiness: number;
  itemsNeedingAttention: number;
  recentlyUpdated: number;
}

/**
 * Filter options for design items
 */
export interface DesignItemFilters {
  projectId?: string;
  stage?: DesignStage | DesignStage[];
  category?: DesignCategory | DesignCategory[];
  status?: RAGStatusValue;
  search?: string;
  sortBy?: 'name' | 'updatedAt' | 'readiness' | 'stage';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Design Parameters Types (from Spec Section 3.4)
// ============================================

/**
 * Material specification
 */
export interface MaterialSpec {
  id: string;
  name: string;                        // "3/4 Baltic Birch Plywood"
  type: 'sheet' | 'solid' | 'veneer' | 'laminate' | 'other';
  thickness: number;                   // mm
  supplier: string | null;
  sku: string | null;
  grainDirection: boolean;             // Does grain matter?
  estimatedCostPerUnit: number | null;
}

/**
 * Hardware specification
 */
export interface HardwareSpec {
  id: string;
  name: string;                        // "Blum Tandem Plus 566H"
  category: 'hinges' | 'slides' | 'handles' | 'locks' | 'connectors' | 'other';
  quantity: number;
  supplier: string | null;
  sku: string | null;
  estimatedCostPerUnit: number | null;
}

/**
 * Finish specification
 */
export interface FinishSpec {
  type: 'paint' | 'stain' | 'lacquer' | 'oil' | 'veneer' | 'laminate' | 'none';
  color: string | null;
  sheen: 'flat' | 'matte' | 'satin' | 'semi-gloss' | 'gloss' | null;
  coats: number | null;
  brand: string | null;
  productCode: string | null;
}

/**
 * Edge banding specification
 */
export interface EdgeBandingSpec {
  material: string;
  thickness: number;                   // mm
  width: number;                       // mm
  color: string | null;
  supplier: string | null;
}

/**
 * Construction method types
 */
export type ConstructionMethod = 
  | 'frameless'          // European/32mm system
  | 'face-frame'         // Traditional American
  | 'post-and-rail'      // Frame and panel
  | 'solid-wood'         // Solid wood construction
  | 'mixed';             // Combination

/**
 * Joinery types
 */
export type JoineryType = 
  | 'dowel'
  | 'biscuit'
  | 'pocket-screw'
  | 'mortise-tenon'
  | 'dovetail'
  | 'rabbet-dado'
  | 'cam-lock'
  | 'confirmat'
  | 'glue-only';

/**
 * Complete design parameters interface
 */
export interface DesignParameters {
  // Dimensions
  dimensions: {
    width: number | null;              // mm
    height: number | null;             // mm
    depth: number | null;              // mm
    unit: 'mm' | 'inches';
  };
  
  // Materials
  primaryMaterial: MaterialSpec | null;
  secondaryMaterials: MaterialSpec[];
  edgeBanding: EdgeBandingSpec | null;
  
  // Hardware
  hardware: HardwareSpec[];
  
  // Finish
  finish: FinishSpec | null;
  
  // Construction
  constructionMethod: ConstructionMethod;
  joineryTypes: JoineryType[];
  
  // Quality
  awiGrade: 'economy' | 'custom' | 'premium';
  
  // Special Requirements
  specialRequirements: string[];
}

// ============================================
// Extended Design Item with Parameters
// ============================================

/**
 * Extended Design Item with full parameters (for detailed views)
 */
export interface DesignItemFull extends DesignItem {
  // Parameters (design specifications)
  parameters: DesignParameters;
  
  // Workflow flags
  hasBlockers: boolean;
  blockerNotes: string;
  requiresPrototype: boolean;
  prototypeStatus: 'not-required' | 'pending' | 'in-progress' | 'approved' | 'rejected';
  
  // Calculated/Derived
  estimatedCost: number | null;
  
  // External References
  notionPageId: string | null;
  
  // Stage timing
  stageEnteredAt: Timestamp;
  productionReleasedAt: Timestamp | null;
  
  // Assignment
  assignedTo?: string;           // User ID
}

// ============================================
// Approval Types (from Spec Section 3.6)
// ============================================

/**
 * Approval workflow types
 */
export type ApprovalType =
  | 'design-review'
  | 'manufacturing-review'
  | 'client-approval'
  | 'prototype-approval'
  | 'production-release'
  | 'construction-signoff';

/**
 * Full approval entity (subcollection)
 */
export interface Approval {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedAt: Timestamp;
  requestedBy: string;                 // User ID
  assignedTo: string;                  // User ID (approver)
  decidedAt: Timestamp | null;
  decision: string | null;             // Decision notes (set when responded)
  attachments: string[];               // Storage URLs
  /**
   * Notes attached at request time (separate from `decision` which is the
   * responder's notes). Written by `createApproval` in firestore.ts.
   */
  notes?: string | null;
  /**
   * Set by `respondToApproval` in firestore.ts in addition to `decidedAt`.
   * Older Firestore docs (pre-rich-Approval refactor) may carry this field
   * without `assignedTo` populated — kept optional for backwards compat
   * with the now-deleted ApprovalRecord shape.
   */
  respondedBy?: string;
}

// ============================================
// Deliverable Types (from Spec Section 3.7)
// ============================================

/**
 * Deliverable types
 */
export type DeliverableType =
  | 'concept-sketch'
  | 'mood-board'
  | '3d-model'
  | 'rendering'
  | 'shop-drawing'
  | 'cut-list'
  | 'bom'
  | 'assembly-instructions'
  | 'specification-sheet'
  | 'client-presentation'
  // Phase 3 — immutable ZIP snapshot generated at manufacturing handoff.
  // Produced by `handoffBundleService.createHandoffBundle()`.
  | 'handoff-bundle'
  | 'other';

/**
 * Design deliverable (subcollection)
 */
export interface Deliverable {
  id: string;
  stage: DesignStage;
  type: DeliverableType;
  name: string;
  description: string;
  
  // File reference
  storageUrl: string;                  // Firebase Storage URL
  storagePath?: string;                // Firebase Storage path for deletion
  googleDriveUrl: string | null;       // If synced to Drive
  fileType: string;                    // "pdf", "skp", "dxf", etc.
  fileSize: number;                    // bytes
  mimeType?: string;                   // e.g. "image/png", "application/pdf"
  fileName?: string;                   // Original filename from upload

  // Version control
  version: number;
  previousVersionId: string | null;
  
  // Status
  status: 'draft' | 'review' | 'approved' | 'superseded';
  
  // Client Portal Sharing
  sharedToPortal?: boolean;            // Whether shared to client portal
  sharedToPortalAt?: Timestamp | null; // When shared
  sharedToPortalBy?: string | null;    // Who shared it
  portalDisplayName?: string;          // Custom name for portal display
  
  // Metadata
  uploadedAt: Timestamp;
  uploadedBy: string;
  approvedAt: Timestamp | null;
  approvedBy: string | null;

  // Multi-type coverage: additional deliverable types this document also satisfies
  coversTypes?: DeliverableType[];

  // Auto-generation provenance
  isAutoGenerated?: boolean;
  autoGenSource?: 'parts-data' | 'production-optimization';
}

// ============================================
// AI Analysis Types (from Spec Section 3.8)
// ============================================

/**
 * AI analysis types
 */
export type AIAnalysisType = 'brief-parsing' | 'manufacturability' | 'cost-estimation' | 'dfm-check';

/**
 * Design for Manufacturing issue
 */
export interface DfMIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;                    // "tool-access", "material", "joinery", etc.
  description: string;
  affectedComponent: string | null;
  suggestedFix: string | null;
  ruleId?: string;
}

/**
 * Cost breakdown from AI analysis
 */
export interface CostBreakdown {
  materials: number;
  hardware: number;
  labor: number;
  finishing: number;
  overhead: number;
  total: number;
  confidence: number;
}

/**
 * AI Analysis entity (subcollection)
 */
export interface AIAnalysis {
  id: string;
  designItemId: string;
  analysisType: AIAnalysisType;
  
  // Request
  inputData: Record<string, unknown>;  // What was sent to AI
  requestedAt: Timestamp;
  requestedBy: string;
  
  // Response
  status: 'pending' | 'completed' | 'failed';
  completedAt: Timestamp | null;
  result: Record<string, unknown> | null;  // AI response
  confidence: number | null;           // 0-1 confidence score
  
  // DfM-specific
  dfmIssues?: DfMIssue[];
  
  // Cost-specific
  costBreakdown?: CostBreakdown;
  
  // Feedback loop
  userFeedback: 'accurate' | 'partially-accurate' | 'inaccurate' | null;
  feedbackNotes: string | null;
}

// ============================================
// Brief Analysis Result Types (for AI)
// ============================================

/**
 * Extracted design item from brief parsing
 */
export interface ExtractedDesignItem {
  name: string;
  category: DesignCategory;
  description: string;
  dimensions: {
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: 'mm' | 'inches';
  };
  suggestedMaterials: string[];
  suggestedFinish: string | null;
  specialRequirements: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  confidence: number;
}

/**
 * Brief analysis result
 */
export interface BriefAnalysisResult {
  extractedItems: ExtractedDesignItem[];
  projectNotes: string | null;
  ambiguities: string[];
  clientPreferences: string[];
}

// ============================================
// Stage History Types (from Spec Section 3.5)
// ============================================

/**
 * Stage transition with full audit data (subcollection)
 */
export interface StageHistoryEntry {
  id: string;
  fromStage: DesignStage | null;       // null for initial creation
  toStage: DesignStage;
  transitionedAt: Timestamp;
  transitionedBy: string;              // User ID
  ragSnapshot: RAGStatus;              // Snapshot at transition
  notes: string;
  gateCheckPassed: boolean;
  overrideUsed?: boolean;
}

// ============================================
// Gate Criteria Types
// ============================================

/**
 * Single gate criterion
 */
export interface GateCriterion {
  aspect: string;
  requiredStatus: RAGStatusValue | RAGStatusValue[];
  allowNA?: boolean;
  minimumStatus?: RAGStatusValue;
}

/**
 * Gate criteria set for a stage
 */
export interface GateCriteriaSet {
  mustMeet: GateCriterion[];
  shouldMeet: GateCriterion[];
  minimumReadiness: number;
}

// ============================================
// Parts Management Types (Phase 3)
// ============================================

/**
 * Rich per-edge specification — material, thickness, and computed length.
 * Populating this is optional; when absent, consumers fall back to the
 * shared `PartEdgeBanding.material` / `.thickness`.
 */
export interface PartEdgeBandingEdge {
  /** Edge tape material name (e.g. "ABS 0.45mm Oak") */
  material?: string;
  /** Tape thickness in mm (e.g. 0.45, 1.0, 2.0) */
  thickness?: number;
  /** Computed edge length in mm — enables accurate linear-meter totals
   *  without re-deriving from part dimensions. */
  length?: number;
  /** Ordered edge operations that must stay bound to this side. */
  operations?: EdgeOperationSpec[];
}

/**
 * Edge banding specification for parts.
 *
 * The boolean flags (`top`, `bottom`, …) indicate whether edge banding
 * is applied to each side. They are **kept for backward compatibility**
 * — all existing consumers (ShopTraveler, PartsTab, optimizer, etc.)
 * continue to work unchanged.
 *
 * The optional `edges` map adds per-edge richness: individual material,
 * thickness, and pre-computed length per side. New code should populate
 * `edges` alongside the booleans so downstream consumers can
 * progressively adopt the richer data.
 */
export interface PartEdgeBanding {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  /** 5th edge — profiled or shaped panels that have a machined front edge. */
  front?: boolean;
  /** Legacy shared material — applies to all flagged edges unless
   *  `edges.<side>.material` overrides per-edge. */
  material?: string;
  /** Legacy shared tape thickness (mm). */
  thickness?: number;
  /** Rich per-edge data. When present, overrides the shared
   *  `material` / `thickness` for the given side. */
  edges?: {
    top?: PartEdgeBandingEdge;
    bottom?: PartEdgeBandingEdge;
    left?: PartEdgeBandingEdge;
    right?: PartEdgeBandingEdge;
    front?: PartEdgeBandingEdge;
  };
}

/**
 * Grain direction for wood panels
 */
export type GrainDirection = 'length' | 'width' | 'none';

/**
 * Part source (how it was added)
 */
/**
 * Where this part entry came from. Used for audit + provenance badges
 * on the PartsTab.
 *   - `manual`       — user-authored via PartsTab
 *   - `csv-import`   — bulk import from CSV / PolyBoard dump
 *   - `polyboard`    — PolyBoard scene parse
 *   - `sketchup`     — SketchUp scene parse
 *   - `design-studio` — synced from a Design Studio scene (cabinets
 *                        bound to this DesignItem; see
 *                        `syncDesignItemPartsFromScene`)
 */
export type PartSource = 'manual' | 'csv-import' | 'polyboard' | 'sketchup' | 'design-studio';

/**
 * Individual part entry within a design item
 */
export interface PartEntry {
  id: string;

  // Identification
  partNumber: string;        // Part identifier within item (e.g., "P001")
  name: string;              // Descriptive name (e.g., "Left Side Panel")

  // Part type classification
  // sheet: 2D panels (plywood, MDF, melamine, etc.)
  // bar: linear/section material (metal bars, aluminium profiles)
  // timber: dimensional lumber / solid wood sections (rails, stiles, legs) — linear, has grain
  // slab: stone worktops (granite, quartz, marble) — area-based with slab yield
  // fabric: upholstery, leather, fabric — area-based, purchased by linear meter of roll
  // component: bought-out items priced per piece (no cutting/processing)
  partType?: 'sheet' | 'bar' | 'timber' | 'slab' | 'fabric' | 'component'; // defaults to 'sheet' when undefined

  // Dimensions (always stored in mm internally)
  length: number;            // Length in mm (0 for component parts)
  width: number;             // Width in mm (0 for bar/component parts)
  thickness: number;         // Thickness in mm (0 for bar/component parts)

  // Bar-specific: cross-section profile (e.g. "40x40", "25x3", "60x40x3")
  barProfile?: string;

  // Slab-specific: stock slab dimensions for yield calculation
  slabSize?: { length: number; width: number };  // mm

  // Fabric-specific: roll width for area-to-linear-meter conversion
  rollWidth?: number;  // mm

  // Component-specific: per-piece cost (no material calculation needed)
  componentUnitCost?: number;

  // Material
  materialId?: string;       // Reference to material library (finish library doc id)
  materialName: string;      // Denormalized material name
  materialCode?: string;     // Material code for ordering

  /**
   * P21.11 — material-mapper round-trip.
   *
   * When the Workshop Viewer's AI recognizes parts, its materialResolver
   * matches the detected material name against the Finish Library and the
   * project's material palette. These three fields capture that match so
   * Design Manager's PartsTab can show where the material came from (and
   * whether the link is trustworthy) without re-running resolution.
   *
   * `inventoryItemId` denormalizes the Finish Library's inventoryItemId so
   * procurement flows can skip a lookup. If the Finish has no inventory
   * backing (or the match was too weak to trust), it's left undefined and
   * the caller falls back to `materialId`.
   *
   * `materialResolutionSource`:
   *  - 'palette-exact'  → matched by material code against project palette
   *  - 'palette-fuzzy'  → matched by normalized name against project palette
   *  - 'ai-guess'       → matched against finish library outside the palette
   *  - 'manual'         → user set / edited the material in PartsTab
   *
   * `materialResolutionConfidence`: 0-1. Only meaningful for non-manual
   * sources; PartsTab uses it to pick a confidence pill color.
   */
  inventoryItemId?: string;
  materialResolutionSource?: 'palette-exact' | 'palette-fuzzy' | 'ai-guess' | 'manual';
  materialResolutionConfidence?: number;

  // Quantity
  quantity: number;
  
  // Processing
  grainDirection: GrainDirection;
  edgeBanding: PartEdgeBanding;
  
  // CNC/Machining
  hasCNCOperations: boolean;
  cncProgramRef?: string;

  /** P1.3 — canonical CNC boring specification. Contains all drilled
   *  holes (face, position, diameter, depth) and the hardware items
   *  they receive. Populated by the scene-sync pipeline from
   *  `ScenePart.boringSpec` and normalised at read-time via
   *  `normalizeBoringSpec()`. */
  boringSpec?: import('@/subsidiaries/finishes/design-studio/types/mdp.types').CNCBoringSpec;
  
  // Manufacturing priority (lower number = higher priority, made first)
  manufacturingPriority?: number;  // 1 = highest priority, null = default order
  manufacturingBatch?: string;     // Optional batch grouping (e.g., "Batch A", "Carcase parts")

  // Purchase priority (lower number = buy first, flows to manufacturing BOM & procurement)
  purchasePriority?: number;       // 0-based rank. Null = unranked.
  
  // Notes
  notes?: string;

  /**
   * Links to FeatureLibraryItem records (P17/F19). A part may carry
   * zero-to-many features — e.g. a door panel with both "soft-close
   * hinge prep" and "finger-pull rebate". Features contribute labor
   * time + cost-factor multipliers to the manufacturing roll-up via
   * `calculatePartFeatureCost` in `utils/featureCost.ts`; they do NOT
   * multiply material cost.
   *
   * Absent / empty array = no feature contribution, same as pre-P17
   * behaviour. The cost calc is purely additive so legacy parts stay
   * priced exactly as before.
   */
  featureIds?: string[];

  // Metadata
  source: PartSource;
  importedFrom?: string;     // Original filename if imported
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // ----------------------------------------------------------------
  // Design Studio scene linkage (optional)
  // ----------------------------------------------------------------
  // When this part originated from a Design Studio scene sync or a
  // scene-exported CSV import, these two fields preserve the back-
  // link to the 3D model. They let:
  //   - Re-syncs match this PartEntry to its source mesh (no
  //     duplicate creation when the cabinet's AI re-parses and
  //     re-emits the same part).
  //   - Design Studio's material resolver look up "what material
  //     does DM say this mesh should be?" so any material edit a
  //     procurement user makes in PartsTab shows up on the right
  //     mesh in the scene viewport.
  //
  // Absent for CSV-imported parts that pre-date scene sync, manual
  // entries, and Workshop Viewer AI recognition (single-model flow
  // has no cabinet context). Unification of DS-authored and CSV-
  // imported parts keys on `meshNodeId` when present, else on
  // partNumber + dimensions.
  /** Stable id of the Three.js mesh this part represents. Survives
   *  GLTF export sanitisation via `dawinMeshId` userData. */
  meshNodeId?: string;
  /** SceneCabinet id the part belongs to. A single DesignItem can
   *  span multiple cabinets (one "kitchen base" in DM, N physical
   *  units in the scene); the cabinet id lets procurement see which
   *  physical unit each part comes from. */
  cabinetId?: string;
  /** Scene id the part was sourced from. Lets re-syncs scope their
   *  replace/merge to the owning scene — cross-scene edits don't
   *  stomp each other. */
  sceneId?: string;
}

/**
 * Parts summary for a design item
 */
export interface PartsSummary {
  totalParts: number;
  uniqueMaterials: number;
  totalArea: number;          // Square meters
  lastUpdated: Timestamp;
  isComplete: boolean;        // All parts have materials assigned
}

/**
 * Extended DesignItem with parts
 */
export interface DesignItemWithParts extends DesignItem {
  parts: PartEntry[];
  partsSummary?: PartsSummary;
}

// ============================================
// Consolidated Cutlist Types (Phase 4)
// ============================================

/**
 * Aggregated part in consolidated cutlist
 */
export interface AggregatedPart {
  partId: string;
  designItemId: string;
  designItemName: string;
  partNumber: string;
  partName: string;
  length: number;
  width: number;
  thickness?: number;
  quantity: number;
  grainDirection: GrainDirection;
  edgeBanding: PartEdgeBanding;
  partType?: 'sheet' | 'bar' | 'timber' | 'slab' | 'fabric' | 'component';
  materialType?: import('@/shared/types').MaterialType;
  barProfile?: string;
  slabSize?: { length: number; width: number };
  rollWidth?: number;
  componentUnitCost?: number;
}

/**
 * Material group in consolidated cutlist
 */
export interface MaterialGroup {
  materialId: string;
  materialCode: string;
  materialName: string;
  thickness: number;
  sheetSize?: { length: number; width: number };
  parts: AggregatedPart[];
  totalParts: number;
  // Sheet goods: area and sheet count
  totalArea: number;        // sq meters (sheet/slab/fabric parts)
  estimatedSheets: number;  // sheet parts only
  // Bar/linear parts: linear length and bar count
  partType?: 'sheet' | 'bar' | 'timber' | 'slab' | 'fabric' | 'component';
  materialType?: import('@/shared/types').MaterialType;
  totalLength?: number;     // total linear meters (bar parts only)
  estimatedBars?: number;   // estimated full stock bars needed (bar parts only)
  // Timber parts: volumetric stock planning
  totalVolumeCubicMeters?: number; // m³ (timber parts only)
  // Slab-specific
  slabSize?: { length: number; width: number };  // stock slab dimensions (mm)
  estimatedSlabs?: number;  // estimated full slabs needed
  // Fabric-specific
  rollWidth?: number;              // roll width (mm)
  estimatedRollLength?: number;    // linear meters of roll needed
  // Component-specific
  totalQuantity?: number;          // total pieces (component parts only)
  // Pricing rule metadata (from MaterialPricingRule resolution)
  yieldFactor?: number;            // Effective yield used for stock estimation
  bufferMultiplier?: number;       // Effective buffer used for cost estimation
  pricingUnit?: string;            // Unit for pricing: 'sheet', 'm', 'sqm', 'cbm', 'ea'
}

/**
 * Consolidated cutlist at project level
 */
export interface ConsolidatedCutlist {
  generatedAt: Timestamp;
  generatedBy: string;
  isStale: boolean;
  staleReason?: string;
  materialGroups: MaterialGroup[];
  totalParts: number;
  totalUniquePartsCount: number;
  totalMaterials: number;
  totalArea: number;
  estimatedTotalSheets: number;
  lastDesignItemUpdate: Timestamp;
  lastExportedAt?: Timestamp;
  lastExportFormat?: 'csv' | 'pdf' | 'opticut';
}

/**
 * Line item in estimate
 */
export interface EstimateLineItem {
  id: string;
  description: string;
  category: 'material' | 'hardware' | 'labor' | 'finishing' | 'other';
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  linkedMaterialId?: string;
}

/**
 * Consolidated estimate at project level
 */
export interface ConsolidatedEstimate {
  generatedAt: Timestamp;
  generatedBy: string;
  isStale: boolean;
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  quickbooksInvoiceId?: string;
  quickbooksInvoiceNumber?: string;

  // Error checking
  hasErrors?: boolean;
  errorChecks?: { message: string; severity: string }[];
  designItemCount?: number;
  lineItemCount?: number;
}

// Re-export client portal types
export * from './clientPortal';

// Re-export deliverable types
export * from './deliverables';

// Re-export strategy types
export * from './strategy';

// Re-export strategy report types
export * from './strategyReport';

// Re-export bottom-up pricing types
export * from './bottomUpPricing';
