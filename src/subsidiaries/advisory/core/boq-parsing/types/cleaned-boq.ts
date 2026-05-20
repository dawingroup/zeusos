/**
 * Cleaned BOQ Types
 * Types for cleaned and enriched BOQ items after processing
 */

import type { ParsedBOQItem } from './parsed-boq';

/**
 * Governing specifications extracted from Level 3 (Element Section) items
 * These specs are inherited by Level 4 work items
 */
export interface GoverningSpecs {
  /** Material grade (e.g., "C25/30", "Grade 460B", "Class A") */
  materialGrade?: string;
  /** Brand specifications (e.g., "Grohe", "Danpal", "Crown Paints") */
  brand?: string;
  /** Standard/code reference (e.g., "BS 8110", "ASTM A615") */
  standardRef?: string;
  /** Finish specification (e.g., "Matt", "Satin", "Polished") */
  finish?: string;
  /** Color specification */
  color?: string;
  /** Size/dimensions (e.g., "600x600mm", "150mm thick") */
  size?: string;
  /** Material type (e.g., "Ceramic", "Porcelain", "Hardwood") */
  materialType?: string;
  /** Installation method (e.g., "Bonded", "Floating", "Mechanical fix") */
  installationMethod?: string;
  /** General specifications text */
  generalSpecs?: string;
  /** Source item code where specs were defined */
  sourceItemCode?: string;
}

/**
 * Enhanced specifications after AI processing
 */
export interface EnhancedSpecs extends GoverningSpecs {
  /** Whether specs were enhanced by AI */
  aiEnhanced: boolean;
  /** Combined description used for enhancement */
  combinedContext?: string;
  /** AI confidence in the extracted specs (0-1) */
  confidence: number;
  /** Missing critical specs that need manual input */
  missingCritical?: string[];
  /** Suggested products/materials based on specs */
  suggestedProducts?: string[];
}

/**
 * Material requirement calculated from formula
 */
export interface MaterialRequirement {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

/**
 * Cleaned BOQ Item with 4-level hierarchy and governing specs
 *
 * Hierarchical structure:
 * - Level 1 = Bill (categorization)
 * - Level 2 = Element (sub-categorization)
 * - Level 3 = Element Section (specification - governs work items)
 * - Level 4 = Work Item (inherits specs from level 3)
 */
export interface CleanedBOQItem extends ParsedBOQItem {
  /** Extracted item name (short, clean) */
  itemName: string;
  /** Extracted specifications (dimensions, materials, etc.) */
  specifications: string;
  /** Whether this row is a subtotal/total row */
  isSummaryRow: boolean;

  // 4-Level Hierarchy
  billNumber: string;      // Level 1: Bill (e.g., "1")
  billName?: string;       // Level 1: Bill name from description
  elementCode: string;     // Level 2: Element (e.g., "1")
  elementName?: string;    // Level 2: Element name from description
  sectionCode: string;     // Level 3: Element Section (e.g., "1")
  sectionName?: string;    // Level 3: Section name from description
  workItemCode: string;    // Level 4: Work Item (e.g., "1")

  /** Full hierarchical path for display */
  hierarchyPath: string;   // e.g., "1.1.1.1"
  /** Hierarchy level (1-4) */
  hierarchyLevel: number;

  /** Whether this is a specification row (Level 3) that governs work items */
  isSpecificationRow: boolean;
  /** Governing specs - either defined (Level 3) or inherited (Level 4) */
  governingSpecs?: GoverningSpecs;
  /** AI-enhanced specs (combining Level 3 + Level 4 info) */
  enhancedSpecs?: EnhancedSpecs;

  /** Whether this item needs manual enhancement before material extraction */
  needsEnhancement: boolean;
  /** Reasons why enhancement is needed */
  enhancementReasons?: string[];

  /** Suggested formula match */
  suggestedFormula?: {
    formulaId: string;
    formulaCode: string;
    formulaName: string;
    matchScore: number;
  };
  /** Generated material requirements based on formula */
  materialRequirements?: MaterialRequirement[];

  /** Cleanup notes/warnings */
  cleanupNotes: string[];
}

/**
 * Result of the cleanup process
 */
export interface CleanupResult {
  cleanedItems: CleanedBOQItem[];
  removedSummaryRows: CleanedBOQItem[];
  stats: {
    totalOriginal: number;
    totalCleaned: number;
    summaryRowsRemoved: number;
    formulasMatched: number;
    avgConfidence: number;
    needsEnhancement: number;
    specificationRows: number;
    workItems: number;
  };
}

/**
 * Get confidence color class based on score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 bg-green-50';
  if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
  if (confidence >= 0.4) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

/**
 * Get confidence label based on score
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.4) return 'Low';
  return 'Very Low';
}
