/**
 * BOQ Parsing Types
 * 
 * Types for BOQ document parsing and AI extraction.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// PARSED BOQ ITEM (Raw extraction output)
// ─────────────────────────────────────────────────────────────────

export interface ParsedBOQItem {
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  rate?: number;
  amount?: number;
  stage?: string;
  category?: string;
  suggestedFormulaCode?: string;
  confidence: number;
  rawText?: string;
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────────
// CLEANED BOQ ITEM (After AI enrichment)
// ─────────────────────────────────────────────────────────────────

export interface CleanedBOQItem extends ParsedBOQItem {
  itemName: string;
  specifications: string;
  isSummaryRow: boolean;
  
  // Hierarchy
  billNumber: string;
  billName?: string;
  elementCode: string;
  elementName?: string;
  sectionCode: string;
  sectionName?: string;
  workItemCode: string;
  hierarchyPath: string;
  hierarchyLevel: number;
  
  // Specs
  isSpecificationRow: boolean;
  governingSpecs?: {
    materialGrade?: string;
    brand?: string;
    standardRef?: string;
    finish?: string;
    color?: string;
    size?: string;
    materialType?: string;
    installationMethod?: string;
    generalSpecs?: string;
    sourceItemCode?: string;
  };
  
  // Enhancement flags
  needsEnhancement: boolean;
  enhancementReasons?: string[];
  
  // Formula matching
  suggestedFormula?: {
    formulaId: string;
    formulaCode: string;
    formulaName: string;
    matchScore: number;
  };
  
  // Material requirements
  materialRequirements?: {
    materialId: string;
    materialName: string;
    quantity: number;
    unit: string;
    wastagePercent: number;
  }[];
  
  cleanupNotes: string[];
}

// ─────────────────────────────────────────────────────────────────
// PARSING JOB
// ─────────────────────────────────────────────────────────────────

export type ParsingJobStatus =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ParsingJob {
  id: string;
  projectId: string;
  
  // Source file
  fileName: string;
  fileUrl: string;
  fileType: 'excel' | 'csv' | 'pdf';
  fileSize?: number;
  
  // Status
  status: ParsingJobStatus;
  progress: number;
  errorMessage?: string;
  
  // Results
  parsedItems?: ParsedBOQItem[];
  cleanedItems?: CleanedBOQItem[];
  
  // Stats
  itemsFound?: number;
  itemsImported?: number;
  averageConfidence?: number;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  completedAt?: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// PARSING RESULT
// ─────────────────────────────────────────────────────────────────

export interface ParsingResult {
  projectInfo?: {
    projectName?: string;
    projectCode?: string;
    client?: string;
    contractor?: string;
    preparedBy?: string;
    date?: string;
  };
  items: ParsedBOQItem[];
  summary: {
    totalItems: number;
    totalAmount?: number;
    stages: string[];
    categories: string[];
    averageConfidence: number;
    lowConfidenceCount: number;
  };
  metadata: {
    sourceFormat: 'excel' | 'pdf' | 'csv';
    fileName: string;
    sheetsProcessed?: string[];
    pagesProcessed?: number;
    processingTime: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// CLEANUP RESULT
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// CONFIDENCE HELPERS
// ─────────────────────────────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.4,
} as const;

export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'very_low' {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  if (score >= CONFIDENCE_THRESHOLDS.LOW) return 'low';
  return 'very_low';
}

export function getConfidenceColor(level: string): string {
  switch (level) {
    case 'high': return 'text-green-600 bg-green-100';
    case 'medium': return 'text-yellow-600 bg-yellow-100';
    case 'low': return 'text-orange-600 bg-orange-100';
    default: return 'text-red-600 bg-red-100';
  }
}
