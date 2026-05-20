/**
 * Estimation Architecture Types
 * Types for cost estimation and work instance modes
 * 
 * @module shared/types/estimation
 */

import type { Timestamp } from './common';

// ============================================
// Estimation Mode
// ============================================

/**
 * Mode for work instances - affects how data is processed and stored
 */
export type EstimationMode = 
  | 'PRODUCTION'   // Real production run, affects inventory and scheduling
  | 'ESTIMATION';  // Quote/estimation only, no real-world side effects

// ============================================
// Cost Allocation Types
// ============================================

/**
 * Labor cost breakdown by department/function
 */
export interface LaborCostAllocation {
  cutting: number;      // CNC, panel saw, table saw time
  machining: number;    // Drilling, routing, shaping time
  edgeBanding: number;  // Edge treatment time
  assembly: number;     // Assembly labor time
  finishing: number;    // Sanding, painting, lacquering time
  installation: number; // On-site installation time
  total: number;
}

/**
 * Material cost breakdown
 */
export interface MaterialCostAllocation {
  sheets: number;       // Panel materials (MDF, plywood, etc.)
  hardware: number;     // Hinges, slides, handles, etc.
  edgeBanding: number;  // Edge banding materials
  finish: number;       // Paint, lacquer, veneer
  fasteners: number;    // Screws, cams, dowels
  total: number;
}

/**
 * Complete cost allocation for a work instance
 */
export interface CostAllocation {
  labor: LaborCostAllocation;
  materials: MaterialCostAllocation;
  overhead: number;     // Shop overhead percentage applied
  markup: number;       // Profit margin applied
  subtotal: number;     // Before markup
  total: number;        // Final price
  currency: string;     // e.g., "UGX", "USD"
  
  // Metadata
  calculatedAt: Timestamp;
  calculatedBy: 'manual' | 'ai' | 'formula';
  confidence: number;   // 0-1 confidence in estimate
  assumptions: string[]; // What assumptions were made
}

// ============================================
// Time Estimation Types
// ============================================

/**
 * Time allocation by department
 */
export interface TimeAllocation {
  cutting: number;      // Hours
  machining: number;
  edgeBanding: number;
  assembly: number;
  finishing: number;
  installation: number;
  total: number;
}

/**
 * Complexity factors for estimation
 */
export interface ComplexityFactors {
  materialComplexity: number;   // 1.0 = standard, higher = more complex
  joineryComplexity: number;
  finishComplexity: number;
  assemblyComplexity: number;
  overall: number;              // Weighted average
}

// ============================================
// Work Instance Extensions
// ============================================

/**
 * Extended work instance fields for estimation mode
 * These fields are added to the base WorkInstance type
 */
export interface WorkInstanceEstimation {
  mode: EstimationMode;
  
  // Cost tracking
  costAllocation?: CostAllocation;
  
  // Time tracking
  timeAllocation?: TimeAllocation;
  
  // Complexity assessment
  complexityFactors?: ComplexityFactors;
  
  // Quote info (if in ESTIMATION mode)
  quoteNumber?: string;
  quoteValidUntil?: Timestamp;
  quoteStatus?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  
  // Production linking (if quote accepted)
  linkedProductionInstanceId?: string;
}

// ============================================
// Estimation Presets
// ============================================

/**
 * Rate card for labor pricing
 */
export interface LaborRateCard {
  id: string;
  name: string;
  currency: string;
  rates: {
    cutting: number;      // Per hour
    machining: number;
    edgeBanding: number;
    assembly: number;
    finishing: number;
    installation: number;
  };
  overheadPercent: number;
  markupPercent: number;
  validFrom: Timestamp;
  validUntil?: Timestamp;
}

/**
 * Estimation preset for quick quotes
 */
export interface EstimationPreset {
  id: string;
  name: string;
  description?: string;
  
  // Default factors
  defaultComplexity: ComplexityFactors;
  defaultRateCardId: string;
  
  // Category-specific overrides
  categoryOverrides?: Record<string, Partial<ComplexityFactors>>;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}
