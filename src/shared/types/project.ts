/**
 * Project Types with Optimization State
 * Extended project schema for cutlist optimization workflow
 */

import type { Timestamp } from './common';
import type { MaterialProcessingSummary, ProjectProcessingOverrides, ProcessingCostBreakdown } from './processingSteps';
import type { UsedOffcut, GeneratedOffcut } from './offcut';
import type { EdgeOperationSpec, EdgeOperationsBySide } from './edgeOperations';

// ============================================
// Stock and Nesting Types
// ============================================

/**
 * Stock sheet configuration for optimization (PANEL materials)
 */
export interface OptimizationStockSheet {
  id: string;
  materialId: string;
  materialName: string;
  length: number;           // mm
  width: number;            // mm
  thickness: number;        // mm
  quantity: number;
  costPerSheet: number;
  supplier?: string;
  sku?: string;
}

/**
 * Timber stock definition for dimensional lumber (TIMBER materials)
 * Represents available cross-sections and lengths for solid timber
 */
export interface TimberStockDefinition {
  id: string;
  materialId: string;
  materialName: string;     // e.g., "Meranti", "Pine PAR", "Oak"

  // Cross-section (the "profile")
  thickness: number;        // mm (e.g., 38mm, 50mm)
  width: number;            // mm (e.g., 100mm, 150mm, 200mm)

  // Available lengths for this cross-section
  availableLengths: number[]; // [2400, 3000, 3600, 4800, 5400, 6000] mm

  // Pricing
  costPerLinearMeter?: number;    // Cost per running meter
  costPerPiece?: {                // Or cost per standard length
    length: number;
    cost: number;
  }[];
  costPerCubicMeter?: number;     // Price per m³ (volumetric — thickness × width × length)

  // Processing capabilities
  isDressed: boolean;       // PAR (Planed All Round) vs rough sawn
  canBeRipped: boolean;     // Can this be ripped to narrower widths?

  // Metadata
  species?: string;         // Wood species (e.g., "Meranti", "Oak", "Pine")
  grade?: string;           // Structural grade, appearance grade
  supplier?: string;
  sku?: string;
  quantity?: number;        // Available pieces in stock
}

/**
 * Linear stock definition for metal bars, tubes, and aluminium profiles
 * (METAL_BAR and ALUMINIUM materials)
 */
export interface LinearStockDefinition {
  id: string;
  materialId: string;
  materialName: string;     // e.g., "Steel", "Aluminium 6063"

  // Profile specification
  profile: string;          // e.g., "50x50 SHS", "25mm Round Bar", "40x40 Angle"
  profileDimensions: {      // Structured dimensions
    type: 'round' | 'square' | 'rectangle' | 'angle' | 'channel' | 'flat' | 'tube';
    dimension1: number;     // mm (diameter for round, width for others)
    dimension2?: number;    // mm (height for rectangle, thickness for flat)
    wallThickness?: number; // mm (for tubes)
  };

  // Available lengths
  availableLengths: number[]; // [3000, 6000] mm (typical metal stock lengths)

  // Pricing
  costPerLinearMeter: number;
  costPerPiece?: {
    length: number;
    cost: number;
  }[];

  // Metadata
  material: 'steel' | 'aluminium' | 'stainless' | 'brass' | 'copper' | 'other';
  finish?: string;          // e.g., "Mill finish", "Anodized", "Powder coated"
  supplier?: string;
  sku?: string;
  quantity?: number;
}

/**
 * Glass sheet configuration with fragility handling (GLASS materials)
 */
export interface GlassStockDefinition extends OptimizationStockSheet {
  // Glass-specific properties
  glassType: 'clear' | 'tinted' | 'frosted' | 'laminated' | 'tempered' | 'low-e';
  safetyMargin: number;     // mm - minimum margin from edges for cuts
  minimumCutSize: {         // Minimum practical cut size
    length: number;
    width: number;
  };
  requiresPolishing: boolean; // Edges need polishing after cutting
  fragile: true;            // Always true for glass
}

// FabricRollDefinition — full definition lives further down with the
// other fabric/upholstery types so it sits next to FabricBay /
// FabricPlacement / FabricSummary.

/**
 * Sheet summary from estimation
 */
export interface SheetSummary {
  materialId: string;
  materialName: string;
  thickness: number;
  sheetSize: { length: number; width: number };
  sheetsRequired: number;
  partsOnSheet: number;
  utilizationPercent: number;
  wasteArea: number;        // sq mm
  estimatedCost: number;
}

/**
 * Individual nesting sheet result
 */
export interface NestingSheet {
  id: string;
  sheetIndex: number;
  stockSheetId: string;
  materialId: string;
  materialName: string;
  sheetSize: { length: number; width: number };
  placements: PartPlacement[];
  utilizationPercent: number;
  wasteArea: number;
  wasteRegions: WasteRegion[];
}

/**
 * Part placement on a sheet
 */
export interface PartPlacement {
  partId: string;
  /** Human-facing part name (often short, from PartEntry.name). */
  partName: string;
  /** Stable part number / code for cut maps (PartEntry.partNumber). */
  partNumber?: string;
  designItemId: string;
  designItemName: string;
  x: number;                // mm from left
  y: number;                // mm from bottom
  length: number;           // mm
  width: number;            // mm
  rotated: boolean;         // 90° rotation applied
  rotationQuarterTurns?: number; // explicit clockwise quarter-turns from source orientation
  grainAligned: boolean;
  edgeBanding?: {           // Edge banding from source part
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    front?: boolean;
    material?: string;
    thickness?: number;
    edges?: {
      top?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      bottom?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      left?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      right?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      front?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
    };
  };
  /** Operations projected by side for downstream manufacturing steps. */
  edgeOperationsBySide?: EdgeOperationsBySide;
}

/**
 * Waste region on a sheet
 */
export interface WasteRegion {
  x: number;
  y: number;
  length: number;
  width: number;
  area: number;
  reusable: boolean;        // Large enough for future use
}

// ============================================
// Timber and Linear Stock Types
// ============================================

/**
 * Linear cutting result for timber/metal bars/aluminium (1D optimization)
 */
export interface LinearCuttingResult {
  id: string;
  stockIndex: number;
  stockId: string;
  materialId: string;
  materialName: string;

  // Stock dimensions
  crossSection: {
    thickness: number;      // mm
    width: number;          // mm (for timber/flat stock)
  };
  stockLength: number;      // mm - original length of the stick/bar

  // Cuts on this stick
  cuts: LinearCutPlacement[];
  utilizationPercent: number;
  wasteLength: number;      // mm
  wasteSegments: LinearWasteSegment[];

  // Offcut tracking (if this stick came from the offcut library)
  isOffcut?: boolean;
  offcutId?: string;

  /** Per-stick processing sequence (timber only — plane/rip/crosscut/route). */
  operations?: TimberStickOperation[];
}

/**
 * Part placement on linear stock (1D)
 */
export interface LinearCutPlacement {
  partId: string;
  partName: string;
  designItemId: string;
  designItemName: string;
  startPosition: number;    // mm from left end of stock
  cutLength: number;        // mm - length of this cut
  quantity: number;         // How many of this part from this position
}

/**
 * Waste segment on linear stock
 */
export interface LinearWasteSegment {
  startPosition: number;    // mm from left end
  length: number;           // mm
  reusable: boolean;        // Large enough for future use (e.g., > 300mm)
}

/**
 * Timber-specific summary
 */
/**
 * One ordered operation in a timber processing sequence for a single stick.
 * The nester emits these so the shop floor has a concrete work instruction
 * per stock piece rather than just summary totals.
 */
export interface TimberStickOperation {
  sequence: number;                                     // 1-based ordering
  stepId: 'planing' | 'rip' | 'crosscut' | 'routing';
  label: string;                                        // Human-readable (e.g. "Plane 4 sides")
  /** Primary quantity for this op (metres for plane/rip/routing; cuts for crosscut). */
  quantity: number;
  unit: 'mm' | 'linear_meters' | 'cuts';
  note?: string;                                        // Free-form detail (dimensions, part names)
}

/**
 * How the nester decided to go from a raw inventory stock piece to the
 * finished cross-section a design group needs. Surfaced per timber summary
 * so the user can see why a particular stock size was chosen.
 */
export interface TimberStockChoiceRationale {
  /**
   * - 'par_exact'     : stock already matches finished dimensions (no plane, no rip)
   * - 'par_plane'     : dressed stock bigger than finished → plane only
   * - 'rough_plane'   : rough-sawn stock → plane all sides to finished
   * - 'rip_only'      : one dressed board ripped into several finished strips
   * - 'rip_and_plane' : rough-sawn wider board ripped into strips then planed
   */
  mode: 'par_exact' | 'par_plane' | 'rough_plane' | 'rip_only' | 'rip_and_plane';
  stripsPerBoard: number;         // How many finished strips one raw piece yields
  wasteRatio: number;             // (stock volume − useful volume) / stock volume, 0..1
  rationale: string;              // Short sentence for UI tooltip
}

export interface TimberSummary {
  materialId: string;
  materialName: string;
  crossSection: {
    thickness: number;
    width: number;
  };
  /** Pre-planing raw cross-section (if stock is rough-sawn) */
  rawCrossSection?: {
    thickness: number;
    width: number;
  };
  stockLength: number;
  sticksRequired: number;
  totalLinearMeters: number;
  totalVolumeCubicMeters?: number;  // Total m³ of stock consumed (when volumetric pricing used)
  pricingMethod?: 'linear' | 'volumetric' | 'per-piece';
  partsOnSticks: number;
  averageUtilizationPercent: number;
  totalWasteLength: number; // mm
  estimatedCost: number;

  // Processing step breakdown
  processingSteps?: ProcessingCostBreakdown[];
  totalProcessingCost?: number;

  // Offcut usage
  offcutsUsed?: number;          // Count of offcuts consumed instead of new stock

  // Nesting decision
  stockChoice?: TimberStockChoiceRationale;
  /** Ordered operations list — one sequence per stick / stock piece consumed. */
  operationsPerStick?: TimberStickOperation[][];
}

/**
 * Upholstery / fabric roll definition.
 *
 * Fabric isn't sold as fixed-area sheets — it's a roll with a fixed width
 * (set by the manufacturer) and length-on-demand. Workshop practice is to
 * cut the roll in "bays" of a manageable length so the upholsterer can
 * physically move and cut a section without unrolling 50m at a time.
 *
 * The optimizer packs parts into bays of (rollWidth × bayLength). One
 * bay = one cut section from the roll. Total fabric consumed =
 * baysRequired × bayLength (you have to take the whole bay even if it's
 * not 100% packed).
 */
export interface FabricRollDefinition {
  id: string;
  materialId: string;
  materialName: string;       // e.g. "Premium Velvet Charcoal"
  rollWidth: number;          // mm — fixed by manufacturer (e.g. 1400)
  defaultBayLength: number;   // mm — manageable cut section (e.g. 3000)
  costPerLinearMeter: number; // UGX per running meter of roll consumed
  /** When true, parts can be rotated 90°. Default false because most
   *  upholstery has a nap / pattern direction that must be preserved. */
  allowRotation?: boolean;
  /** Pattern repeat for matched-pattern fabrics. Future use. */
  patternRepeat?: { length: number; width: number };
}

/**
 * One placed part within a fabric bay.
 *
 * Carries an optional polygon outline for production-mode tight nesting
 * (week 4+ work — the bbox path uses just length/width). When polygons
 * arrive the same placement type carries them through.
 */
export interface FabricPlacement {
  partId: string;
  partName: string;
  partNumber?: string;
  designItemId: string;
  designItemName: string;
  x: number;                  // mm from left edge of bay (along roll length)
  y: number;                  // mm from one edge across roll width
  length: number;             // placed length (along roll)
  width: number;              // placed width (across roll)
  rotated: boolean;
  /** Local polygon outline, origin at bbox corner. Optional — only
   *  populated when the design studio provides detailed shapes. */
  polygon?: Array<[number, number]>;
}

/**
 * One bay = one cut section from a fabric roll.
 */
export interface FabricBay {
  id: string;
  bayIndex: number;
  materialId: string;
  materialName: string;
  rollWidth: number;
  bayLength: number;          // length of THIS bay
  placements: FabricPlacement[];
  utilizationPercent: number;
  wasteRegions?: WasteRegion[];
}

/**
 * Fabric / upholstery summary — analog of TimberSummary for rolls.
 */
export interface FabricSummary {
  materialId: string;
  materialName: string;
  rollWidth: number;
  bayLength: number;          // The bay length used for nesting
  baysRequired: number;
  totalLinearMetersConsumed: number;  // baysRequired * bayLength / 1000
  partsOnRoll: number;
  averageUtilizationPercent: number;
  estimatedCost: number;
}

/**
 * Linear stock summary (metal bars, aluminium)
 */
export interface LinearStockSummary {
  materialId: string;
  materialName: string;
  profile: string;
  stockLength: number;
  barsRequired: number;
  totalLinearMeters: number;
  partsOnBars: number;
  averageUtilizationPercent: number;
  totalWasteLength: number;
  estimatedCost: number;
}

/**
 * Cut operation in sequence
 */
export interface CutOperation {
  id: string;
  sheetId: string;
  sequence: number;
  type: 'rip' | 'crosscut' | 'trim';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
  resultingParts: string[]; // Part IDs created by this cut
}

/**
 * Edge banding configuration
 */
export interface EdgeBandConfig {
  defaultMaterial: string;
  defaultThickness: number;
  defaultWidth: number;
  applyToAllExposed: boolean;
  materialMappings: Record<string, string>; // materialId -> edgeBandMaterial
}

// ============================================
// Optimization State
// ============================================

/**
 * Estimation mode results (Stage 3 - Pre-production)
 */
export interface EstimationResult {
  // Panel materials (sheet goods)
  sheetSummary: SheetSummary[];

  // Visualizable per-sheet layouts (panel materials only). Populated by
  // the quick-pack estimator so the studio can render the same kind of
  // cutting-map visualization that production mode does. Same shape as
  // ProductionResult.nestingSheets so the renderer can be shared.
  nestingSheets?: NestingSheet[];

  // Timber materials (dimensional lumber)
  timberSummary?: TimberSummary[];

  // Linear stock (metal bars, aluminium)
  linearStockSummary?: LinearStockSummary[];

  // Fabric / upholstery (roll-based)
  fabricSummary?: FabricSummary[];
  fabricBays?: FabricBay[];

  // Cost breakdown
  roughCost: number;              // Sheet materials cost (with buffer)
  timberCost?: number;            // Timber materials cost
  linearStockCost?: number;       // Metal/aluminium materials cost
  fabricCost?: number;            // Upholstery / fabric materials cost
  edgeMaterialCost?: number;      // Edge banding tape/strip material cost
  standardPartsCost?: number;     // Consumables cost (hinges, screws, etc)
  specialPartsCost?: number;      // Luxury/approved items cost
  totalCost?: number;             // Total of all costs

  // Processing costs (timber planing/cutting/routing, board cutting/edging)
  processingSummary?: MaterialProcessingSummary[];
  totalProcessingCost?: number;

  // Offcut library usage
  offcutsUsed?: UsedOffcut[];
  offcutSavings?: number;

  // Statistics
  wasteEstimate: number;          // percentage (for sheet goods)
  totalPartsCount: number;
  totalSheetsCount: number;
  totalTimberSticks?: number;
  totalLinearBars?: number;
  totalFabricBays?: number;
  totalStandardParts?: number;
  totalSpecialParts?: number;

  // Audit trail — non-fatal observations the optimizer surfaced
  // (e.g. unpriced parts, ignored material types, default-substituted
  // costs). Empty / undefined when everything resolved cleanly.
  warnings?: string[];

  // Metadata
  validAt: Timestamp;
  invalidatedAt?: Timestamp;
  invalidationReasons?: string[];
}

/**
 * Production mode results (Stage 4 - Production Ready)
 */
export interface ProductionResult {
  // Panel materials (sheet goods)
  nestingSheets: NestingSheet[];
  cutSequence: CutOperation[];

  // Timber materials (dimensional lumber)
  timberCuttingResults?: LinearCuttingResult[];

  // Linear stock (metal bars, aluminium)
  linearStockCuttingResults?: LinearCuttingResult[];

  // Optimization metrics
  optimizedYield: number;         // percentage (average across all materials)
  sheetYield?: number;            // percentage (panels only)
  timberYield?: number;           // percentage (timber only)
  linearStockYield?: number;      // percentage (metal/aluminium only)

  totalCuttingLength: number;     // mm (total for all cuts)
  estimatedCutTime: number;       // minutes

  // Processing costs (timber planing/cutting/routing, board cutting/edging)
  processingSummary?: MaterialProcessingSummary[];
  totalProcessingCost?: number;

  // Offcut library usage
  offcutsUsed?: UsedOffcut[];
  offcutsGenerated?: GeneratedOffcut[];

  // Audit trail — non-fatal observations the optimizer surfaced.
  warnings?: string[];

  // Metadata
  validAt: Timestamp;
  invalidatedAt?: Timestamp;
  invalidationReasons?: string[];
}

/**
 * Optimization configuration (persisted for re-runs)
 */
export interface OptimizationConfig {
  // Cutting parameters
  kerf: number;                   // mm (blade width / saw kerf)

  // Stock definitions by material type
  stockSheets: OptimizationStockSheet[];      // Panel materials
  timberStock?: TimberStockDefinition[];      // Timber materials
  linearStock?: LinearStockDefinition[];      // Metal bars, aluminium
  glassStock?: GlassStockDefinition[];        // Glass materials

  // Panel-specific settings
  grainMatching: boolean;
  edgeBandingSettings: EdgeBandConfig;
  allowRotation: boolean;
  prioritizeGrain: boolean;
  minimumUsableCutoff: { length: number; width: number };

  // Linear stock settings (timber, metal, aluminium)
  minimumUsableOffcut?: number;   // mm - minimum length to consider reusable (default: 300mm)
  allowCrossGrain?: boolean;      // For timber - allow cross-grain cuts if needed

  // Target optimization
  targetYield: number;            // percentage target (applies to all material types)

  // Processing step overrides (per-project, overrides workshop defaults)
  processingOverrides?: ProjectProcessingOverrides;

  // Offcut library integration
  useOffcutLibrary?: boolean;     // Default: true — try to use offcuts before new stock
}

/**
 * Shop Traveler PDF section settings
 */
export interface ShopTravelerSettings {
  includeCoverPage: boolean;
  includeCuttingMaps: boolean;
  includeTimberCuttingDiagrams: boolean;
  includeLinearStockCuttingDiagrams: boolean;
  includeEdgeBandingSchedule: boolean;
  includeRemnantRegister: boolean;
  includePartLabels: boolean;
  // Future sections
  includeAssemblyInstructions?: boolean;
  includeMaterialsList?: boolean;
}

/**
 * Default shop traveler settings
 */
export const DEFAULT_SHOP_TRAVELER_SETTINGS: ShopTravelerSettings = {
  includeCoverPage: true,
  includeCuttingMaps: true,
  includeTimberCuttingDiagrams: true,
  includeLinearStockCuttingDiagrams: true,
  includeEdgeBandingSchedule: true,
  includeRemnantRegister: true,
  includePartLabels: true,
};

/**
 * Complete optimization state for a project
 */
export interface OptimizationState {
  // Estimation Mode Results (Stage 3)
  estimation: EstimationResult | null;
  
  // Production Mode Results (Stage 4)
  production: ProductionResult | null;
  
  // Configuration (persisted for re-runs)
  config: OptimizationConfig;
  
  // Shop Traveler settings (which sections to include)
  shopTravelerSettings?: ShopTravelerSettings;
  
  // Last run metadata
  lastEstimationRun?: Timestamp;
  lastProductionRun?: Timestamp;
}

// ============================================
// Material Palette Types
// ============================================

/**
 * Material type classification
 */
export type MaterialType =
  | 'PANEL'        // Sheet goods (MDF, Plywood, Melamine, etc.)
  | 'SOLID'        // Solid wood (legacy - use TIMBER for dimensional lumber)
  | 'VENEER'       // Veneers for finishing
  | 'EDGE'         // Edge banding materials
  | 'TIMBER'       // Dimensional lumber with varying cross-sections (thickness × width × length)
  | 'GLASS'        // Glass sheets with fragility handling
  | 'METAL_BAR'    // Metal bars, tubes, and linear stock
  | 'ALUMINIUM'    // Aluminium extrusions and profiles
  | 'STONE'        // Stone slabs — granite, marble, quartz countertops
  | 'FABRIC'       // Fabric, leather, upholstery — sold by linear meter of fixed-width roll
  | 'COMPONENT';   // Bought-out items priced per piece (no cutting/processing)

/**
 * Per-cross-section usage for timber palette entries.
 * Timber entries aggregate by species so that all cross-sections
 * of a given timber (e.g. all Mahogany) share a single mapping, price,
 * and inventory family link. This breakdown preserves the cross-section
 * demand so nesting / BOM can still plan against raw stock.
 */
export interface TimberCrossSectionUsage {
  thickness: number;      // mm (finished)
  width: number;          // mm (finished)
  partCount: number;      // total quantity across all design items
  totalLinearMm: number;  // sum of length × quantity
  totalVolumeM3: number;  // sum of length × width × thickness × qty, in cubic metres
}

/**
 * Material palette entry - maps design materials to inventory
 */
export interface MaterialPaletteEntry {
  id: string;
  designName: string;        // From CSV/Polyboard (e.g., "18mm White Melamine")
  normalizedName: string;    // Cleaned for matching
  thickness: number;         // 0 for TIMBER entries (aggregated by species, see timberCrossSections)
  materialType: MaterialType;

  // Timber aggregation: filled when materialType === 'TIMBER'. Entries are keyed
  // by species only, so this carries the full cross-section demand the project
  // placed on this timber species.
  timberCrossSections?: TimberCrossSectionUsage[];
  // When mapped to an inventory family (isFamily=true), references the family
  // parent id so downstream flows can fan out to individual SKUs for nesting.
  inventoryFamilyId?: string;
  
  // Usage tracking
  usageCount: number;        // How many parts use this material
  designItemIds: string[];   // Which design items use this
  
  // Inventory mapping
  inventoryId?: string;      // Inventory item SKU
  inventoryName?: string;    // Display name from inventory
  inventorySku?: string;     // SKU code
  inventoryItemId?: string;  // Inventory item document ID

  /**
   * P21.12 — Finish Library binding.
   * Populated in two ways:
   * (1) User picked a finish directly in the palette's "Finish" mapping tab,
   *     and the finish's own `inventoryItemId` was propagated to
   *     `inventoryItemId` above.
   * (2) User picked an inventory item and `mapMaterialToInventory` auto-
   *     attached the finish whose `inventoryItemId` matched. In both cases
   *     `finishCode` / `finishName` are denormalised snapshots so table
   *     rows render without a second fetch.
   */
  finishId?: string;
  finishCode?: string;
  finishName?: string;

  unitCost?: number;         // Cost per unit (see costUnit for what the unit is)
  costUnit?: string;         // Unit the cost is measured in: 'sheet', 'm', 'sqm', 'cbm', 'ea', etc.
  currency?: string;         // Currency code (e.g., 'UGX', 'USD')

  // Purchase-to-consumption unit conversion (palette-level, applies to all parts using this material)
  purchaseUnit?: string;     // Unit material is bought in: 'slab', 'linear_meter', 'roll', 'sheet', 'piece'
  consumptionUnit?: string;  // Unit material is consumed in: 'sqm', 'lm', 'piece'
  conversionFactor?: number; // consumptionUnits per purchaseUnit
                             // e.g., slab 3000×1500mm = 4.5 sqm → factor = 4.5
                             // e.g., fabric 1500mm-wide roll = 1.5 sqm/lm → factor = 1.5
  yieldFactor?: number;      // Usable fraction of material (0-1). Defaults per type:
                             // panels: 0.70, stone: 0.82, fabric: 0.85, timber: 0.90, bar: 0.90
  materialId?: string;       // Reference to material library ID
  mappedAt?: Timestamp;
  mappedBy?: string;

  // Offcut library links (when mapped from offcut library)
  offcutIds?: string[];          // Offcut doc IDs reserved for this mapping

  // Stock options (for optimization) - type-specific
  stockSheets: OptimizationStockSheet[];          // For PANEL materials
  timberStock?: TimberStockDefinition[];          // For TIMBER materials
  linearStock?: LinearStockDefinition[];          // For METAL_BAR and ALUMINIUM materials
  glassStock?: GlassStockDefinition[];            // For GLASS materials
  fabricStock?: FabricRollDefinition[];           // For FABRIC materials

  // Quality tier alternatives for budget-based quoting
  alternatives?: MaterialAlternativeMapping[];
  baseQualityTier?: MaterialQualityTier;          // Defaults to 'standard'

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Material quality tier for budget-based alternatives.
 * Distinct from MaterialTier which is scope-based (global/customer/project).
 */
export type MaterialQualityTier = 'economy' | 'standard' | 'premium' | 'luxury';

export const MATERIAL_QUALITY_TIER_LABELS: Record<MaterialQualityTier, string> = {
  economy: 'Economy',
  standard: 'Standard',
  premium: 'Premium',
  luxury: 'Luxury',
};

/**
 * A material alternative mapped to a specific quality tier
 */
export interface MaterialAlternativeMapping {
  qualityTier: MaterialQualityTier;
  inventoryId: string;
  inventoryName: string;
  inventorySku?: string;
  unitCost: number;
  costUnit?: string;         // Unit the cost is measured in: 'sheet', 'm', 'sqm', 'cbm', 'ea', etc.
  currency: string;
  notes?: string;
  mappedAt: Timestamp;
  mappedBy: string;
}

/**
 * Material palette for a project
 */
export interface MaterialPalette {
  entries: MaterialPaletteEntry[];
  lastHarvestedAt?: Timestamp;
  unmappedCount: number;
  mappedCount: number;
}

// ============================================
// Extended Project Interface
// ============================================

/**
 * RAG status for optimization
 */
export interface OptimizationRAGStatus {
  estimation: {
    status: 'red' | 'amber' | 'green' | 'grey';
    message: string;
  };
  production: {
    status: 'red' | 'amber' | 'green' | 'grey';
    message: string;
  };
}

/**
 * Project with optimization state
 */
export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  
  // Client info
  customerId?: string;
  customerName?: string;
  
  // Status
  status: 'active' | 'on-hold' | 'completed' | 'cancelled';
  
  // Dates
  startDate?: Timestamp;
  dueDate?: Timestamp;
  completedDate?: Timestamp;
  
  // Optimization state (new)
  optimizationState?: OptimizationState;
  optimizationRAG?: OptimizationRAGStatus;
  
  // Material palette for inventory mapping
  materialPalette?: MaterialPalette;

  // Consolidated estimate (generated by estimateService)
  consolidatedEstimate?: any;

  // Snapshot for change detection
  lastSnapshot?: ProjectSnapshot;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Project snapshot for change detection
 */
export interface ProjectSnapshot {
  takenAt: Timestamp;
  
  // Part-level data
  partsHash: string;        // Hash of all parts data
  totalParts: number;
  
  // Material mappings
  materialMappingsHash: string;
  
  // Configuration
  configHash: string;
  
  // Design items
  designItemIds: string[];
  designItemsHash: string;
}

// ============================================
// Default Values
// ============================================

/**
 * Default optimization configuration
 */
export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  kerf: 3.2,                // Standard 3.2mm kerf
  stockSheets: [],
  grainMatching: true,
  edgeBandingSettings: {
    defaultMaterial: 'PVC',
    defaultThickness: 0.5,
    defaultWidth: 22,
    applyToAllExposed: true,
    materialMappings: {},
  },
  targetYield: 85,          // 85% target yield
  allowRotation: true,
  prioritizeGrain: true,
  minimumUsableCutoff: { length: 150, width: 75 },
};

/**
 * Create default optimization state
 */
export function createDefaultOptimizationState(): OptimizationState {
  return {
    estimation: null,
    production: null,
    config: { ...DEFAULT_OPTIMIZATION_CONFIG },
  };
}
