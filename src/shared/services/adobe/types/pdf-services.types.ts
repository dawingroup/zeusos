/**
 * Adobe PDF Services API Types
 *
 * Types for PDF creation, conversion, extraction, and manipulation operations.
 *
 * @see https://developer.adobe.com/document-services/docs/overview/pdf-services-api/
 */

import { AdobeFileRef, SupportedInputFormat, SupportedOutputFormat } from './common';

// =============================================================================
// Create PDF Options
// =============================================================================

export interface CreatePdfOptions {
  /** Input file reference */
  input: AdobeFileRef;
  /** Input format (auto-detected if not specified) */
  inputFormat?: SupportedInputFormat;
  /** Document language for OCR (default: en-US) */
  documentLanguage?: string;
}

export interface CreatePdfFromHtmlOptions {
  /** HTML content string */
  htmlContent: string;
  /** Page width in inches (default: 8.5) */
  pageWidth?: number;
  /** Page height in inches (default: 11) */
  pageHeight?: number;
  /** Include header/footer HTML */
  headerHtml?: string;
  footerHtml?: string;
}

// =============================================================================
// Export PDF Options
// =============================================================================

export interface ExportPdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Target output format */
  outputFormat: SupportedOutputFormat;
  /** Enable OCR for scanned documents */
  ocrEnabled?: boolean;
  /** OCR language (default: en-US) */
  ocrLanguage?: string;
}

// =============================================================================
// Combine PDF Options
// =============================================================================

export interface CombinePdfOptions {
  /** Array of PDF files to combine */
  inputs: AdobeFileRef[];
  /** Optional page ranges to include from each file */
  pageRanges?: PageRangeSpec[];
}

export interface PageRangeSpec {
  /** Index of the file in the inputs array (0-based) */
  fileIndex: number;
  /** Starting page (1-based, inclusive) */
  start?: number;
  /** Ending page (1-based, inclusive) */
  end?: number;
}

// =============================================================================
// Split PDF Options
// =============================================================================

export interface SplitPdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** How to split the PDF */
  splitType: 'byPageCount' | 'byPageRanges' | 'byFileSize';
  /** Number of pages per output file (for byPageCount) */
  pageCount?: number;
  /** Specific page ranges for each output file (for byPageRanges) */
  pageRanges?: Array<{ start: number; end: number }>;
  /** Maximum file size in bytes for each output file (for byFileSize) */
  fileSizeLimit?: number;
}

export interface SplitPdfResult {
  /** Array of generated PDF blobs */
  files: Blob[];
  /** Page counts for each generated file */
  pageCounts: number[];
}

// =============================================================================
// OCR Options
// =============================================================================

export interface OcrPdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** OCR language (default: en-US) */
  ocrLanguage?: string;
  /** OCR output type */
  ocrType?: 'searchable' | 'editable';
}

// =============================================================================
// Compress Options
// =============================================================================

export interface CompressPdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Compression level */
  compressionLevel?: 'low' | 'medium' | 'high';
}

export interface CompressPdfResult {
  /** Compressed PDF blob */
  file: Blob;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes */
  compressedSize: number;
  /** Compression ratio (0-1) */
  compressionRatio: number;
}

// =============================================================================
// Protect Options
// =============================================================================

export interface ProtectPdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Password required to open the document */
  userPassword?: string;
  /** Password required to change document permissions */
  ownerPassword?: string;
  /** Document permissions */
  permissions?: PdfPermissions;
  /** Encryption algorithm */
  encryptionAlgorithm?: 'AES_128' | 'AES_256';
}

export interface PdfPermissions {
  /** Printing permission level */
  printing?: 'none' | 'low' | 'high';
  /** Allow document editing */
  editing?: boolean;
  /** Allow content copying */
  copying?: boolean;
  /** Allow annotations */
  annotating?: boolean;
  /** Allow form filling */
  formFilling?: boolean;
}

// =============================================================================
// PDF Extract Types
// =============================================================================

export interface ExtractPdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Elements to extract from the PDF */
  elementsToExtract: Array<'text' | 'tables' | 'figures'>;
  /** Output format for tables */
  tableOutputFormat?: 'csv' | 'xlsx' | 'json';
  /** Include image renditions of extracted elements */
  includeRenditions?: boolean;
  /** Include styling information */
  includeStyling?: boolean;
}

export interface ExtractedTable {
  /** Page number where the table appears (1-based) */
  pageNumber: number;
  /** Index of the table on the page (0-based) */
  tableIndex: number;
  /** Table data as 2D array of strings */
  rows: string[][];
  /** Header row if detected */
  headers?: string[];
  /** Bounding box coordinates */
  boundingBox?: BoundingBox;
  /** Confidence score (0-1) */
  confidence?: number;
}

export interface ExtractedText {
  /** Page number (1-based) */
  pageNumber: number;
  /** Full text content of the page */
  text: string;
  /** Individual paragraphs with positioning */
  paragraphs?: ExtractedParagraph[];
}

export interface ExtractedParagraph {
  /** Paragraph text */
  text: string;
  /** Bounding box coordinates */
  boundingBox?: BoundingBox;
  /** Font information if styling was requested */
  font?: {
    name?: string;
    size?: number;
    weight?: string;
    style?: string;
  };
}

export interface ExtractedFigure {
  /** Page number (1-based) */
  pageNumber: number;
  /** Base64 encoded image data */
  imageData: string;
  /** Image format */
  format: 'png' | 'jpg';
  /** Bounding box coordinates */
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  /** X coordinate (left edge) */
  x: number;
  /** Y coordinate (top edge) */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
}

export interface PdfExtractResult {
  /** Extracted text by page */
  text: ExtractedText[];
  /** Extracted tables */
  tables: ExtractedTable[];
  /** Extracted figures/images */
  figures?: ExtractedFigure[];
  /** Document metadata */
  metadata?: PdfMetadata;
}

export interface PdfMetadata {
  /** Total page count */
  pageCount: number;
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Document subject */
  subject?: string;
  /** Document keywords */
  keywords?: string[];
  /** Creation date */
  creationDate?: string;
  /** Modification date */
  modificationDate?: string;
  /** PDF version */
  pdfVersion?: string;
}

// =============================================================================
// Linearize Options (Web Optimization)
// =============================================================================

export interface LinearizePdfOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
}

// =============================================================================
// Page Operations
// =============================================================================

export interface RotatePagesOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Rotation angle (clockwise) */
  angle: 90 | 180 | 270;
  /** Page ranges to rotate (all pages if not specified) */
  pageRanges?: Array<{ start: number; end: number }>;
}

export interface DeletePagesOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Pages to delete (1-based) */
  pages: number[];
}

export interface ReorderPagesOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** New page order (1-based page numbers) */
  pageOrder: number[];
}

// =============================================================================
// Watermark Options
// =============================================================================

export interface WatermarkOptions {
  /** Input PDF file reference */
  input: AdobeFileRef;
  /** Watermark type */
  type: 'text' | 'image';
  /** Watermark text (for text type) */
  text?: string;
  /** Watermark image (for image type) */
  image?: AdobeFileRef;
  /** Watermark opacity (0-1) */
  opacity?: number;
  /** Watermark rotation angle */
  rotation?: number;
  /** Watermark position */
  position?: 'center' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  /** Pages to apply watermark (all if not specified) */
  pageRanges?: Array<{ start: number; end: number }>;
}
