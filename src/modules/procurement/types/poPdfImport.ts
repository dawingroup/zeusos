/**
 * PO PDF Import Types
 * Pipeline types for importing purchase orders from supplier PDFs
 */

import type { POLineItemCategory } from './purchaseOrder';
import type { UnifiedSearchResult } from '../hooks/usePOItemSearch';

// ============================================
// Pipeline Stages
// ============================================

export type POImportStage =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'parsing'
  | 'matching'
  | 'reviewing'
  | 'creating'
  | 'complete'
  | 'error';

// ============================================
// AI Parse Output
// ============================================

/** Supplier/header info extracted from the PDF */
export interface ParsedPOHeader {
  supplierName?: string;
  supplierAddress?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  currency: string;
  subtotal?: number;
  tax?: number;
  grandTotal?: number;
  confidence: number;
}

/** A single line item parsed from the PDF by the AI */
export interface ParsedPOLineItem {
  lineNumber: number;
  rawDescription: string;
  description: string;
  sku?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  suggestedCategory: POLineItemCategory;
  confidence: number;
}

/** Full result from the parsePurchaseOrderPdf Cloud Function */
export interface POPdfParseResult {
  header: ParsedPOHeader;
  lineItems: ParsedPOLineItem[];
  rawTextPreview?: string;
  model: string;
  processingTimeMs: number;
}

// ============================================
// Review Stage
// ============================================

export type MatchStatus = 'pending' | 'matched' | 'no-match' | 'manual' | 'skipped';

/** A line item in the review stage — parsed data + match info + editable fields */
export interface POImportLineItemDraft {
  key: string;
  parsed: ParsedPOLineItem;

  // Editable fields
  description: string;
  sku: string;
  quantity: string;
  unitCost: string;
  unit: string;
  weight: string;
  category: POLineItemCategory;

  // Match state
  matchStatus: MatchStatus;
  bestMatch?: UnifiedSearchResult;
  matchCandidates: UnifiedSearchResult[];

  // Resolved IDs (populated when match is accepted)
  inventoryItemId: string;
  materialId: string;
  assetId: string;
  assetCategory: string;

  // Packaging (populated from matched item's supplier pricing)
  packagingQty: string;
  packagingUnit: string;
  derivedUnitCost: string;
  baseUnit: string;
}

// ============================================
// Import Metadata (stored on PO for audit)
// ============================================

export interface POImportMetadata {
  source: 'pdf-import';
  fileName: string;
  fileSize: number;
  importedAt: string;
  storagePath?: string;
  parsedHeader: ParsedPOHeader;
  parsedLineCount: number;
  keptLineCount: number;
  avgConfidence: number;
}
