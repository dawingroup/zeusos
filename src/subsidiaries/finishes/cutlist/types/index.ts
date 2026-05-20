/**
 * Cutlist Processor Types
 * TypeScript type definitions for the cutlist processor module
 */

import type { 
  Timestamp, 
  EstimationMode, 
  CostAllocation, 
  TimeAllocation, 
  ComplexityFactors 
} from '@/shared/types';

/**
 * Panel/Part in a cutlist
 */
export interface CutlistPanel {
  id: string;
  label: string;
  cabinet?: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  quantity: number;
  grain: number; // 0 = horizontal, 1 = vertical
  edges?: EdgeBanding;
  partId?: string;
  _isSplit?: boolean;
  _isGrouped?: boolean;
  _originalIndex?: number;
}

/**
 * Edge banding configuration
 */
export interface EdgeBanding {
  top?: string | null;
  bottom?: string | null;
  left?: string | null;
  right?: string | null;
}

/**
 * Material mapping between imported and stock materials
 */
export interface MaterialMapping {
  [importedMaterial: string]: {
    stockMaterial: string;
    confidence: number;
    isConfirmed: boolean;
  };
}

/**
 * Stock sheet configuration
 */
export interface StockSheet {
  id?: string;
  material: string;
  length: number;
  width: number;
  thickness: number;
  cost?: number;
  quantity?: number;
}

/**
 * Panel placement on a sheet
 */
export interface PanelPlacement {
  panel: CutlistPanel;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  label: string;
}

/**
 * Cut line for cutting diagram
 */
export interface CutLine {
  type: 'horizontal' | 'vertical';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Sheet layout result from optimization
 */
export interface SheetLayout {
  id: string;
  sheetNumber: number;
  material: string;
  thickness: number;
  stockSheet: StockSheet;
  width: number;
  height: number;
  placements: PanelPlacement[];
  cuts: CutLine[];
  usedArea: number;
  wastedArea: number;
  utilization: number;
  freeRects?: FreeRect[];
}

/**
 * Free rectangle (waste/offcut area)
 */
export interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  sheets: SheetLayout[];
  totalSheets: number;
  totalPanels: number;
  totalUsedArea: number;
  totalWastedArea: number;
  averageUtilization: number;
  materialSummary: Record<string, MaterialSummary>;
}

/**
 * Material summary in optimization result
 */
export interface MaterialSummary {
  sheets: number;
  usedArea: number;
  wastedArea: number;
  panels: number;
}

/**
 * Offcut/remnant piece
 */
export interface Offcut {
  id: string;
  material: string;
  thickness: number;
  length: number;
  width: number;
  sourceSheet?: string;
  createdAt: Timestamp;
  isUsed: boolean;
}

/**
 * Work instance (saved optimization session)
 */
export interface WorkInstance {
  id: string;
  name: string;
  projectId?: string;
  projectCode?: string;
  rawData: CutlistPanel[];
  materialMapping: MaterialMapping;
  stockSheets: Record<string, StockSheet>;
  optimizationResult?: OptimizationResult;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  
  // Estimation Mode (v2.1)
  mode: EstimationMode;
  
  // Cost & Time Allocation (v2.1)
  costAllocation?: CostAllocation;
  timeAllocation?: TimeAllocation;
  complexityFactors?: ComplexityFactors;
  
  // Quote tracking (for ESTIMATION mode)
  quoteNumber?: string;
  quoteValidUntil?: Timestamp;
  quoteStatus?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  
  // Link to production instance (if quote accepted)
  linkedProductionInstanceId?: string;
}

/**
 * Cutlist processor configuration
 */
export interface CutlistConfig {
  kerf: number; // blade width in mm
  defaultThickness: number;
  defaultMaterial: string;
  stockSheets: Record<string, StockSheet>;
  outputFormat: 'pgbison' | 'cutlistopt';
}

/**
 * CSV parse result
 */
export interface CSVParseResult {
  rows: CutlistPanel[];
  stats: {
    totalRows: number;
    originalRows: number;
    splitRows: number;
    groupedRows: number;
  };
}

/**
 * PDF export options
 */
export interface PDFExportOptions {
  includeSheetLayouts: boolean;
  includeSummary: boolean;
  includeEdgeBanding: boolean;
  includeCutList: boolean;
}
