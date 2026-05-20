/**
 * Review Helper Utilities
 * Functions for managing BOQ item review workflow
 */

import type { ParsedBOQItem } from '../ai/schemas/boqSchema';

// Measurement units enum (local definition)
export enum MeasurementUnit {
  M = 'm',
  M2 = 'm²',
  M3 = 'm³',
  KG = 'kg',
  TONNE = 'tonne',
  NO = 'No',
  ITEM = 'item',
  SUM = 'sum',
  LOT = 'lot',
  LITRE = 'litre',
  BAG = 'bag',
  LENGTH = 'length',
  PIECES = 'pcs',
}

// Construction stages enum (local definition)
export enum ConstructionStage {
  PRELIMINARIES = 'preliminaries',
  SUBSTRUCTURE = 'substructure',
  SUPERSTRUCTURE = 'superstructure',
  FINISHES = 'finishes',
  SERVICES = 'services',
  EXTERNAL_WORKS = 'external_works',
}

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.4,
} as const;

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'very_low';
}

/**
 * Confidence level display config
 */
export const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}> = {
  high: {
    label: 'High Confidence',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle',
    description: 'AI is confident about this extraction',
  },
  medium: {
    label: 'Medium Confidence',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: 'AlertCircle',
    description: 'Review recommended before approval',
  },
  low: {
    label: 'Low Confidence',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: 'AlertTriangle',
    description: 'Manual verification required',
  },
  very_low: {
    label: 'Very Low Confidence',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'XCircle',
    description: 'Likely extraction errors - please correct',
  },
};

// ============================================================================
// REVIEW TYPES
// ============================================================================

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface ReviewableItem extends ParsedBOQItem {
  reviewId: string;
  reviewStatus: ReviewStatus;
  originalData: ParsedBOQItem;
  modifications: Partial<ParsedBOQItem>;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

// ============================================================================
// REVIEWABLE ITEM CREATION
// ============================================================================

/**
 * Create reviewable items from parsed items
 */
export function createReviewableItems(
  parsedItems: ParsedBOQItem[]
): ReviewableItem[] {
  return parsedItems.map((item, index) => ({
    ...item,
    reviewId: `review-${index}-${Date.now()}`,
    reviewStatus: 'pending' as const,
    originalData: { ...item },
    modifications: {},
  }));
}

/**
 * Check if item has been modified
 */
export function hasModifications(item: ReviewableItem): boolean {
  return Object.keys(item.modifications).length > 0;
}

/**
 * Apply modifications to get current item state
 */
export function getCurrentItemState(item: ReviewableItem): ParsedBOQItem {
  return {
    ...item.originalData,
    ...item.modifications,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate item for import
 */
export function validateItemForImport(item: ReviewableItem): ValidationResult {
  const current = getCurrentItemState(item);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!current.itemCode?.trim()) {
    errors.push('Item code is required');
  }
  if (!current.description?.trim()) {
    errors.push('Description is required');
  }
  if (!current.unit?.trim()) {
    errors.push('Unit of measurement is required');
  }
  if (current.quantity === undefined || current.quantity <= 0) {
    errors.push('Valid quantity is required');
  }

  // Validate unit
  const validUnits = Object.values(MeasurementUnit);
  if (current.unit && !validUnits.includes(current.unit as MeasurementUnit)) {
    warnings.push(`Unit "${current.unit}" may need standardization`);
  }

  // Check for formula assignment
  if (!current.suggestedFormulaCode) {
    warnings.push('No formula assigned - material calculation will be skipped');
  }

  // Check for rate/amount
  if (!current.rate && !current.amount) {
    warnings.push('No rate or amount specified');
  }

  // Low confidence warning
  if (current.confidence && current.confidence < CONFIDENCE_THRESHOLDS.LOW) {
    warnings.push('Low AI confidence - please verify all fields');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  modified: number;
  highConfidence: number;
  lowConfidence: number;
  withFormula: number;
  withErrors: number;
}

/**
 * Calculate review statistics
 */
export function calculateReviewStats(items: ReviewableItem[]): ReviewStats {
  const initialStats: ReviewStats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    modified: 0,
    highConfidence: 0,
    lowConfidence: 0,
    withFormula: 0,
    withErrors: 0,
  };

  return items.reduce<ReviewStats>((stats, item) => {
    stats.total++;
    stats[item.reviewStatus]++;
    
    const confidence = getCurrentItemState(item).confidence || 0;
    if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) stats.highConfidence++;
    if (confidence < CONFIDENCE_THRESHOLDS.LOW) stats.lowConfidence++;
    
    if (getCurrentItemState(item).suggestedFormulaCode) stats.withFormula++;
    
    const validation = validateItemForImport(item);
    if (!validation.isValid) stats.withErrors++;
    
    return stats;
  }, initialStats);
}

// ============================================================================
// SORTING AND FILTERING
// ============================================================================

/**
 * Sort items by review priority (low confidence first, then pending)
 */
export function sortByReviewPriority(items: ReviewableItem[]): ReviewableItem[] {
  return [...items].sort((a, b) => {
    // Pending items first
    if (a.reviewStatus === 'pending' && b.reviewStatus !== 'pending') return -1;
    if (b.reviewStatus === 'pending' && a.reviewStatus !== 'pending') return 1;
    
    // Then by confidence (lower first)
    const aConf = getCurrentItemState(a).confidence || 0;
    const bConf = getCurrentItemState(b).confidence || 0;
    return aConf - bConf;
  });
}

export interface FilterCriteria {
  status?: ReviewStatus[];
  confidenceLevel?: ConfidenceLevel[];
  hasFormula?: boolean;
  hasErrors?: boolean;
  stage?: ConstructionStage[];
  searchTerm?: string;
}

/**
 * Filter review items by criteria
 */
export function filterReviewItems(
  items: ReviewableItem[],
  criteria: FilterCriteria
): ReviewableItem[] {
  return items.filter((item) => {
    const current = getCurrentItemState(item);
    
    if (criteria.status?.length && !criteria.status.includes(item.reviewStatus)) {
      return false;
    }
    
    if (criteria.confidenceLevel?.length) {
      const level = getConfidenceLevel(current.confidence || 0);
      if (!criteria.confidenceLevel.includes(level)) return false;
    }
    
    if (criteria.hasFormula !== undefined) {
      const hasFormula = !!current.suggestedFormulaCode;
      if (hasFormula !== criteria.hasFormula) return false;
    }
    
    if (criteria.hasErrors !== undefined) {
      const validation = validateItemForImport(item);
      if ((!validation.isValid) !== criteria.hasErrors) return false;
    }
    
    if (criteria.stage?.length && current.stage) {
      if (!criteria.stage.includes(current.stage as ConstructionStage)) return false;
    }
    
    if (criteria.searchTerm) {
      const term = criteria.searchTerm.toLowerCase();
      const searchable = `${current.itemCode} ${current.description}`.toLowerCase();
      if (!searchable.includes(term)) return false;
    }
    
    return true;
  });
}
