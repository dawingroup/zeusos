/**
 * AI Parsing Types
 * 
 * Types for AI-powered BOQ parsing workflow.
 */

import { Timestamp } from 'firebase/firestore';
import type { BOQCategory } from './boq';
import type { MaterialCategoryExtended } from './material';

// ============================================================================
// PARSING JOB
// ============================================================================

export type ParsingJobStatus =
  | 'queued'           // Job created, waiting to start
  | 'uploading'        // File being uploaded
  | 'preprocessing'    // File being prepared for AI
  | 'parsing'          // AI parsing in progress
  | 'matching'         // Material matching in progress
  | 'review_ready'     // Ready for human review
  | 'reviewing'        // Under human review
  | 'approved'         // Review complete, approved
  | 'applied'          // Applied to BOQ document
  | 'failed';          // Parsing failed

export interface ParsingJob {
  id: string;
  
  // Relationships
  projectId: string;
  engagementId: string;
  boqId?: string;        // Target BOQ (if updating existing)
  
  // Source file
  sourceFile: SourceFile;
  
  // Job status
  status: ParsingJobStatus;
  progress: ParsingProgress;
  
  // Results
  parsedSections?: ParsedSection[];
  parsingMetadata?: ParsingMetadata;
  
  // Review
  review?: ParsingReview;
  
  // Errors
  errors?: ParsingError[];
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface SourceFile {
  url: string;
  fileName: string;
  fileType: 'excel' | 'pdf' | 'csv' | 'image';
  mimeType: string;
  size: number;
  uploadedAt: Timestamp;
  
  // For Excel files
  sheets?: ExcelSheetInfo[];
  selectedSheet?: string;
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  hasHeaders: boolean;
  detectedType?: 'boq' | 'summary' | 'rates' | 'unknown';
}

export interface ParsingProgress {
  stage: ParsingJobStatus;
  percentage: number;
  currentOperation?: string;
  itemsParsed?: number;
  totalItems?: number;
  sectionsIdentified?: number;
}

// ============================================================================
// PARSED RESULTS
// ============================================================================

export interface ParsedSection {
  id: string;
  
  // Section info
  code: string;
  name: string;
  description?: string;
  category: BOQCategory;
  
  // Position
  order: number;
  parentSectionId?: string;
  
  // Items
  items: ParsedItem[];
  
  // AI metadata
  confidence: ConfidenceScore;
  sourceLocation: SourceLocation;
  suggestions?: AISuggestion[];
  
  // Review status
  reviewStatus: ItemReviewStatus;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
}

export interface ParsedItem {
  id: string;
  tempId: string;                   // Temporary ID until approved
  
  // Basic info
  itemNumber: string;
  description: string;
  specification?: string;
  
  // Quantities
  quantity: number;
  unit: string;
  
  // Rates
  laborRate?: number;
  materialRate?: number;
  equipmentRate?: number;
  unitRate: number;
  
  // Amounts
  laborAmount?: number;
  materialAmount?: number;
  equipmentAmount?: number;
  totalAmount: number;
  
  // Material matching
  materialMatch?: MaterialMatch;
  
  // AI metadata
  confidence: ConfidenceScore;
  sourceLocation: SourceLocation;
  extractedFields: ExtractedField[];
  suggestions?: AISuggestion[];
  
  // Review status
  reviewStatus: ItemReviewStatus;
  userEdits?: UserEdit[];
  reviewedBy?: string;
  reviewedAt?: Timestamp;
}

export type ItemReviewStatus =
  | 'pending'           // Not yet reviewed
  | 'auto_approved'     // High confidence, auto-approved
  | 'needs_review'      // Flagged for review
  | 'approved'          // Manually approved
  | 'modified'          // Approved with modifications
  | 'rejected';         // Rejected/removed

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

export interface ConfidenceScore {
  overall: number;                  // 0-1 overall confidence
  
  // Per-field confidence
  fields: {
    itemNumber?: number;
    description?: number;
    quantity?: number;
    unit?: number;
    laborRate?: number;
    materialRate?: number;
    equipmentRate?: number;
    unitRate?: number;
  };
  
  // Factors affecting confidence
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  reason: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low';

export const getConfidenceLevel = (score: number): ConfidenceLevel => {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  if (score >= 0.45) return 'low';
  return 'very_low';
};

export const CONFIDENCE_THRESHOLDS = {
  autoApprove: 0.90,      // Auto-approve above this
  review: 0.70,           // Flag for review below this
  reject: 0.30            // Auto-flag as problematic below this
};

// ============================================================================
// MATERIAL MATCHING
// ============================================================================

export interface MaterialMatch {
  materialId: string;
  materialName: string;
  materialCategory: MaterialCategoryExtended;
  
  // Match quality
  matchScore: number;         // 0-1 match quality
  matchType: MaterialMatchType;
  
  // Rate comparison
  libraryRate?: number;
  parsedRate?: number;
  rateVariance?: number;
  
  // Alternatives
  alternatives?: AlternativeMatch[];
  
  // Status
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: Timestamp;
}

export type MaterialMatchType =
  | 'exact'              // Exact match found
  | 'fuzzy'              // Fuzzy text match
  | 'category'           // Matched by category only
  | 'manual'             // Manually assigned
  | 'none';              // No match found

export interface AlternativeMatch {
  materialId: string;
  materialName: string;
  matchScore: number;
  matchReason: string;
}

// ============================================================================
// SOURCE LOCATION
// ============================================================================

export interface SourceLocation {
  sheet?: string;           // Excel sheet name
  startRow: number;
  endRow: number;
  columns: {
    field: string;
    column: string | number;
  }[];
  rawData?: Record<string, any>;
}

export interface ExtractedField {
  field: string;
  originalValue: string;
  parsedValue: any;
  confidence: number;
  transformations?: string[];
}

// ============================================================================
// AI SUGGESTIONS
// ============================================================================

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  field?: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
  applied: boolean;
}

export type SuggestionType =
  | 'correction'         // Fix an error
  | 'completion'         // Fill missing data
  | 'normalization'      // Standardize format
  | 'categorization'     // Suggest category
  | 'rate_adjustment'    // Suggest rate change
  | 'unit_conversion'    // Convert units
  | 'material_match';    // Suggest material

// ============================================================================
// USER EDITS
// ============================================================================

export interface UserEdit {
  field: string;
  originalValue: any;
  originalSource: 'ai' | 'suggestion' | 'user';
  newValue: any;
  editedAt: Timestamp;
  editedBy: string;
  reason?: string;
}

// ============================================================================
// PARSING METADATA
// ============================================================================

export interface ParsingMetadata {
  // Model info
  model: string;
  modelVersion: string;
  
  // Timing
  startTime: Timestamp;
  endTime: Timestamp;
  durationMs: number;
  
  // Token usage
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  
  // Template used
  templateId?: string;
  templateName?: string;
  
  // Statistics
  sectionsFound: number;
  itemsFound: number;
  averageConfidence: number;
  itemsAutoApproved: number;
  itemsNeedingReview: number;
  materialsMatched: number;
  
  // Source analysis
  sourceAnalysis: SourceAnalysis;
}

export interface SourceAnalysis {
  detectedFormat: string;
  headerRow?: number;
  dataStartRow?: number;
  columnMapping: Record<string, string>;
  currencyDetected?: string;
  unitsDetected: string[];
  languageDetected: string;
  qualityScore: number;
  issues: string[];
}

// ============================================================================
// PARSING REVIEW
// ============================================================================

export interface ParsingReview {
  status: 'pending' | 'in_progress' | 'completed';
  startedAt?: Timestamp;
  startedBy?: string;
  completedAt?: Timestamp;
  completedBy?: string;
  
  // Review statistics
  totalItems: number;
  reviewedItems: number;
  approvedItems: number;
  modifiedItems: number;
  rejectedItems: number;
  
  // Notes
  notes?: string;
}

// ============================================================================
// PARSING ERRORS
// ============================================================================

export interface ParsingError {
  code: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  location?: SourceLocation;
  timestamp: Timestamp;
  recoverable: boolean;
}

// ============================================================================
// PARSING TEMPLATE
// ============================================================================

export interface ParsingTemplate {
  id: string;
  
  // Basic info
  name: string;
  description?: string;
  version: number;
  
  // Source pattern
  sourceType: 'excel' | 'pdf' | 'csv';
  expectedFormat: ExpectedFormat;
  
  // Column mapping
  columnMapping: ColumnMapping;
  
  // Section patterns
  sectionPatterns: SectionPattern[];
  
  // Unit mappings
  unitMappings: UnitMapping[];
  
  // Validation rules
  validationRules: ValidationRule[];
  
  // Usage stats
  usageCount: number;
  successRate: number;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  isActive: boolean;
}

export interface ExpectedFormat {
  headerRowPattern?: string;
  dataStartRow?: number;
  sectionIndicators?: string[];
  subtotalIndicators?: string[];
  endIndicators?: string[];
}

export interface ColumnMapping {
  itemNumber?: ColumnPattern;
  description?: ColumnPattern;
  unit?: ColumnPattern;
  quantity?: ColumnPattern;
  laborRate?: ColumnPattern;
  materialRate?: ColumnPattern;
  equipmentRate?: ColumnPattern;
  unitRate?: ColumnPattern;
  totalAmount?: ColumnPattern;
}

export interface ColumnPattern {
  headerPatterns: string[];        // Regex patterns for header
  columnIndex?: number;             // Fixed column index
  dataType: 'string' | 'number' | 'currency';
  required: boolean;
  defaultValue?: any;
}

export interface SectionPattern {
  namePatterns: string[];          // Regex to identify section
  codePatterns?: string[];         // Regex to extract code
  category: BOQCategory;
  subSectionIndicators?: string[];
}

export interface UnitMapping {
  sourcePatterns: string[];
  targetUnit: string;
}

export interface ValidationRule {
  field: string;
  rule: 'required' | 'positive' | 'range' | 'regex' | 'custom';
  params?: Record<string, any>;
  message: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateParsingJobInput {
  projectId: string;
  engagementId: string;
  boqId?: string;
  fileName: string;
  fileUrl: string;
  fileType: SourceFile['fileType'];
  mimeType: string;
  size: number;
}

export interface StartParsingInput {
  jobId: string;
  selectedSheet?: string;
  templateId?: string;
}

export interface UpdateItemReviewInput {
  jobId: string;
  sectionId: string;
  itemId: string;
  status: ItemReviewStatus;
  edits?: Array<{ field: string; oldValue: any; newValue: any }>;
  userId: string;
}
