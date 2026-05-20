/**
 * Parsed BOQ Types
 * Types for parsed BOQ items from AI extraction
 */

/**
 * A single BOQ item extracted by AI
 */
export interface ParsedBOQItem {
  /** The item code or reference number (e.g., "1.01", "A.1.2") */
  itemCode: string;
  /** Full description of the work item */
  description: string;
  /** Unit of measurement (e.g., "m³", "m²", "nr", "kg", "l.m") */
  unit: string;
  /** Contract quantity as a number */
  quantity: number;
  /** Unit rate in UGX if provided */
  rate?: number;
  /** Total amount (quantity × rate) if provided */
  amount?: number;
  /** Construction stage (e.g., "Substructure", "Superstructure", "Finishes") */
  stage?: string;
  /** Material category (e.g., "Concrete", "Masonry", "Steel") */
  category?: string;
  /** Suggested formula code based on description */
  suggestedFormulaCode?: string;
  /** Confidence score for this extraction (0-1) */
  confidence: number;
  /** Original text from the document */
  rawText?: string;
  /** Any parsing warnings or issues */
  warnings?: string[];
}

/**
 * Project info extracted from BOQ header
 */
export interface ProjectInfo {
  projectName?: string;
  projectCode?: string;
  client?: string;
  contractor?: string;
  preparedBy?: string;
  date?: string;
}

/**
 * Summary statistics for parsed BOQ
 */
export interface ParsingSummary {
  totalItems: number;
  totalAmount?: number;
  stages: string[];
  categories: string[];
  averageConfidence: number;
  lowConfidenceCount: number;
}

/**
 * Metadata about the parsing job
 */
export interface ParsingMetadata {
  sourceFormat: 'excel' | 'pdf' | 'csv';
  fileName: string;
  sheetsProcessed?: string[];
  pagesProcessed?: number;
  processingTime: number;
}

/**
 * Complete BOQ parsing result from AI
 */
export interface BOQParsingResult {
  projectInfo?: ProjectInfo;
  items: ParsedBOQItem[];
  summary: ParsingSummary;
  metadata: ParsingMetadata;
}

// Confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
} as const;

// Helper to classify confidence level
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'very_low' {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'very_low';
}

// Construction stages for classification
export const CONSTRUCTION_STAGES = [
  'preliminaries',
  'substructure',
  'superstructure',
  'roofing',
  'finishes',
  'services',
  'external_works',
] as const;

// Material categories for classification
export const MATERIAL_CATEGORIES = [
  'concrete',
  'masonry',
  'steel',
  'timber',
  'finishes',
  'roofing',
  'plumbing',
  'electrical',
  'doors_windows',
  'earthworks',
] as const;

export type MaterialCategory = typeof MATERIAL_CATEGORIES[number];
