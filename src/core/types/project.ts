/**
 * Project Types with Optimization State
 * Extended project schema for cutlist optimization workflow
 */

import type { Timestamp } from './common';

// ============================================
// Stock and Nesting Types
// ============================================

/**
 * Stock sheet configuration for optimization
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
  partName: string;
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
  sheetSummary: SheetSummary[];
  roughCost: number;
  wasteEstimate: number;    // percentage
  totalPartsCount: number;
  totalSheetsCount: number;
  validAt: Timestamp;
  invalidatedAt?: Timestamp;
  invalidationReasons?: string[];
}

/**
 * Production mode results (Stage 4 - Production Ready)
 */
export interface ProductionResult {
  nestingSheets: NestingSheet[];
  cutSequence: CutOperation[];
  optimizedYield: number;   // percentage
  totalCuttingLength: number; // mm
  estimatedCutTime: number; // minutes
  validAt: Timestamp;
  invalidatedAt?: Timestamp;
  invalidationReasons?: string[];
}

/**
 * Optimization configuration (persisted for re-runs)
 */
export interface OptimizationConfig {
  kerf: number;             // mm (blade width)
  stockSheets: OptimizationStockSheet[];
  grainMatching: boolean;
  edgeBandingSettings: EdgeBandConfig;
  targetYield: number;      // percentage target
  allowRotation: boolean;
  prioritizeGrain: boolean;
  minimumUsableCutoff: { length: number; width: number };
}

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
  | 'STONE';       // Stone slabs — granite, marble, quartz countertops

/**
 * Material palette entry - maps design materials to inventory
 */
export interface MaterialPaletteEntry {
  id: string;
  designName: string;        // From CSV/Polyboard (e.g., "18mm White Melamine")
  normalizedName: string;    // Cleaned for matching
  thickness: number;
  materialType: MaterialType;
  
  // Usage tracking
  usageCount: number;        // How many parts use this material
  designItemIds: string[];   // Which design items use this
  
  // Inventory mapping
  inventoryId?: string;      // Inventory item SKU
  inventoryName?: string;    // Display name from inventory
  inventorySku?: string;     // SKU code
  unitCost?: number;         // Cost per sheet/unit
  mappedAt?: Timestamp;
  mappedBy?: string;
  
  // Stock sheet options (for optimization)
  stockSheets: OptimizationStockSheet[];
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
