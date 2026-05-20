/**
 * Material Processing Step Types
 *
 * Defines the processing pipeline for different material types:
 * - Timber: Raw Stock → Planing → Cross-cut → Rip → Routing → Final
 * - Board Sheets: Stock Sheet → Panel Saw Cut → Edge Banding → Final
 *
 * Each step has configurable rates (global defaults + per-project overrides).
 */

// ============================================
// Processing Step Definitions
// ============================================

/**
 * Processing step identifiers.
 * Each represents a distinct machine operation with its own costing.
 */
export type ProcessingStepId =
  | 'planing'              // Timber: plane all sides (rough-sawn → PAR)
  | 'crosscut'             // Timber: cross-cut to length on table saw
  | 'rip'                  // Timber: rip to width on table saw
  | 'routing'              // Timber: profile/shape on router table
  | 'panel_saw_cut'        // Board: cut to size on panel saw
  | 'edge_banding'         // Board: apply edge banding to specified edges
  | 'edge_banding_material' // Board: edge banding tape/strip material cost
  | 'glass_scoring'        // Glass: scoring and snap cutting
  | 'metal_saw_cut';       // Metal: saw cutting linear stock

/**
 * How a processing step is costed.
 */
export type CostingMethod =
  | 'per_linear_meter'           // Planing, ripping, routing (rate × total meters)
  | 'per_cut'                    // Cross-cut, panel saw cut (rate × number of cuts)
  | 'per_linear_meter_per_edge'; // Edge banding (rate × total edge meters)

// ============================================
// Rate Configuration
// ============================================

/**
 * Rate configuration for a single processing step.
 * Defines cost, time, and machine for a workshop operation.
 */
export interface ProcessingStepRate {
  stepId: ProcessingStepId;
  label: string;
  costingMethod: CostingMethod;
  ratePerUnit: number;           // UGX per meter / per cut / per edge-meter
  setupTimeMinutes: number;      // One-time setup per material batch
  timePerUnit: number;           // Minutes per meter / per cut
  machineId?: string;            // Reference to manufacturing asset
}

/**
 * Workshop-wide default processing rates.
 * Stored in organization settings.
 */
export interface WorkshopProcessingRates {
  rates: ProcessingStepRate[];
  planingAllowancePerSide: number;    // mm removed per side when planing (default: 3)
  defaultEdgeBandingMaterial: string;  // Default edge banding material name
  edgeBandMaterialCostPerMeter: number; // UGX per linear meter of edge band tape (default: 2000)
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * Per-project overrides for processing rates.
 * Stored in OptimizationConfig.processingOverrides.
 */
export interface ProjectProcessingOverrides {
  rateOverrides?: Partial<Record<ProcessingStepId, Partial<ProcessingStepRate>>>;
  planingAllowanceOverride?: number;   // Override workshop default planing allowance
}

// ============================================
// Calculated Processing Costs
// ============================================

/**
 * Calculated cost breakdown for a single processing step.
 * Generated during estimation/production optimization.
 */
export interface ProcessingCostBreakdown {
  stepId: ProcessingStepId;
  label: string;
  quantity: number;              // Total meters, cuts, or edge-meters processed
  unit: string;                  // 'linear meters' | 'cuts' | 'edge meters'
  ratePerUnit: number;           // Applied rate
  totalCost: number;             // quantity × ratePerUnit
  totalTimeMinutes: number;      // Processing time (excl. setup)
  setupTimeMinutes: number;      // One-time setup for this batch
}

/**
 * Processing summary for a material group.
 * One summary per material name per material type.
 */
export interface MaterialProcessingSummary {
  materialName: string;
  materialType: 'TIMBER' | 'PANEL' | 'GLASS' | 'LINEAR' | 'STONE';
  steps: ProcessingCostBreakdown[];
  totalProcessingCost: number;
  totalProcessingTimeMinutes: number;
}

// ============================================
// Default Rates
// ============================================

/**
 * Default workshop processing rates.
 * Used when no rates are configured in organization settings.
 * Rates in UGX (Ugandan Shillings).
 */
export const DEFAULT_WORKSHOP_PROCESSING_RATES: WorkshopProcessingRates = {
  rates: [
    {
      stepId: 'planing',
      label: 'Planing (All Sides)',
      costingMethod: 'per_linear_meter',
      ratePerUnit: 3000,           // UGX per linear meter
      setupTimeMinutes: 10,
      timePerUnit: 0.5,            // 0.5 min per meter
    },
    {
      stepId: 'crosscut',
      label: 'Cross-cut (Table Saw)',
      costingMethod: 'per_cut',
      ratePerUnit: 500,            // UGX per cut
      setupTimeMinutes: 5,
      timePerUnit: 0.25,           // 0.25 min per cut
    },
    {
      stepId: 'rip',
      label: 'Rip Cut (Table Saw)',
      costingMethod: 'per_linear_meter',
      ratePerUnit: 2000,           // UGX per linear meter
      setupTimeMinutes: 5,
      timePerUnit: 0.4,            // 0.4 min per meter
    },
    {
      stepId: 'routing',
      label: 'Routing (Router Table)',
      costingMethod: 'per_linear_meter',
      ratePerUnit: 5000,           // UGX per linear meter
      setupTimeMinutes: 15,
      timePerUnit: 1.0,            // 1 min per meter
    },
    {
      stepId: 'panel_saw_cut',
      label: 'Panel Saw Cut',
      costingMethod: 'per_cut',
      ratePerUnit: 1000,           // UGX per cut
      setupTimeMinutes: 5,
      timePerUnit: 0.3,            // 0.3 min per cut
    },
    {
      stepId: 'edge_banding',
      label: 'Edge Banding (Labour)',
      costingMethod: 'per_linear_meter_per_edge',
      ratePerUnit: 4000,           // UGX per linear meter of edge
      setupTimeMinutes: 10,
      timePerUnit: 0.8,            // 0.8 min per meter
    },
    {
      stepId: 'edge_banding_material',
      label: 'Edge Banding (Material)',
      costingMethod: 'per_linear_meter_per_edge',
      ratePerUnit: 2000,           // UGX per linear meter of edge tape
      setupTimeMinutes: 0,
      timePerUnit: 0,
    },
    {
      stepId: 'glass_scoring',
      label: 'Glass Scoring & Snap',
      costingMethod: 'per_cut',
      ratePerUnit: 2000,           // UGX per score/cut
      setupTimeMinutes: 5,
      timePerUnit: 1.0,            // 1 min per cut
    },
    {
      stepId: 'metal_saw_cut',
      label: 'Metal Saw Cut',
      costingMethod: 'per_cut',
      ratePerUnit: 1500,           // UGX per cut
      setupTimeMinutes: 10,
      timePerUnit: 0.5,            // 0.5 min per cut
    },
  ],
  planingAllowancePerSide: 3,     // 3mm removed per side
  defaultEdgeBandingMaterial: 'PVC',
  edgeBandMaterialCostPerMeter: 2000, // UGX per linear meter of edge tape
};

/**
 * Get a specific rate from a rates array, with fallback to defaults.
 */
export function getProcessingRate(
  stepId: ProcessingStepId,
  rates: ProcessingStepRate[]
): ProcessingStepRate | undefined {
  return rates.find(r => r.stepId === stepId);
}

/**
 * Processing step display order and which material types they apply to.
 */
export const PROCESSING_STEP_APPLICABILITY: Record<ProcessingStepId, {
  materialTypes: ('TIMBER' | 'PANEL' | 'GLASS' | 'LINEAR' | 'STONE')[];
  order: number;
}> = {
  planing:                { materialTypes: ['TIMBER'], order: 1 },
  crosscut:               { materialTypes: ['TIMBER'], order: 2 },
  rip:                    { materialTypes: ['TIMBER'], order: 3 },
  routing:                { materialTypes: ['TIMBER'], order: 4 },
  panel_saw_cut:          { materialTypes: ['PANEL', 'STONE'], order: 5 },
  edge_banding:           { materialTypes: ['PANEL'], order: 6 },
  edge_banding_material:  { materialTypes: ['PANEL'], order: 7 },
  glass_scoring:          { materialTypes: ['GLASS'], order: 8 },
  metal_saw_cut:          { materialTypes: ['LINEAR'], order: 9 },
};
