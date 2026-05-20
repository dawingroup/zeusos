/**
 * Client Document Types
 * Type definitions for client document uploads in design projects
 */

import type { Timestamp } from '@/shared/types';
import type { ExtractedDesignItem } from './index';

// ============================================
// Document Categories and Types
// ============================================

/**
 * Client document categories
 */
export type ClientDocumentCategory =
  | 'reference-images'
  | 'cad-drawings'
  | 'pdf-plans'
  | 'design-briefs'
  | 'other';

/**
 * AI analysis status for documents
 */
export type AIAnalysisStatus =
  | 'none'       // No AI analysis needed/requested
  | 'pending'    // Queued for analysis
  | 'running'    // Analysis in progress
  | 'completed'  // Analysis complete
  | 'failed';    // Analysis failed

/**
 * AI analysis type
 */
export type AIAnalysisType =
  | 'project-scoping'  // Project Scoping AI (design brief parsing)
  | 'image-analysis';  // Image Analysis AI (reference image analysis)

// ============================================
// AI Analysis Result Types
// ============================================

/**
 * Style analysis from Image Analysis AI
 */
export interface StyleAnalysis {
  primaryStyle: string;
  secondaryStyles: string[];
  aestheticNotes: string[];
  colorPalette: {
    name: string;
    hexCode?: string;
  }[];
  designApproach: string[];
}

/**
 * Material recommendation from Image Analysis AI
 */
export interface MaterialRecommendation {
  material: string;
  category: 'primary' | 'secondary' | 'hardware' | 'finish';
  notes?: string;
  estimatedCost?: {
    min: number;
    max: number;
    currency: string;
  };
}

/**
 * Manufacturing notes from Image Analysis AI
 */
export interface ManufacturingNotes {
  suitableForCNC: boolean;
  complexityLevel: 1 | 2 | 3 | 4 | 5;
  estimatedMaterialsCost?: {
    min: number;
    max: number;
    currency: string;
  };
  manufacturingChallenges?: string[];
}

/**
 * Image analysis AI result
 */
export interface ImageAnalysisResult {
  extractedItems: ExtractedDesignItem[];
  styleAnalysis: StyleAnalysis;
  materialRecommendations: MaterialRecommendation[];
  manufacturingNotes: ManufacturingNotes;
  featureLibraryMatches?: {
    featureId: string;
    featureName: string;
    confidence: number;
  }[];
  confidence: number; // Overall confidence 0-1
}

/**
 * Project scoping AI result
 */
export interface ProjectScopingResult {
  extractedItems: ExtractedDesignItem[];
  multiplierDetected: boolean;
  deliverables?: {
    name: string;
    category: string;
    quantity: number;
  }[];
  projectNotes?: string;
  ambiguities?: string[];
  confidence: number; // Overall confidence 0-1
}

/**
 * Combined AI analysis result
 */
export type AIAnalysisResult = ImageAnalysisResult | ProjectScopingResult;

// ============================================
// Client Document Entity
// ============================================

/**
 * Client document metadata
 */
export interface ClientDocument {
  id: string;

  // Basic info
  name: string;
  description?: string;
  category: ClientDocumentCategory;

  // File info
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;

  // Storage
  storagePath: string;
  downloadUrl: string;
  thumbnailUrl?: string; // For images

  // AI Analysis
  aiAnalysisStatus: AIAnalysisStatus;
  aiAnalysisType?: AIAnalysisType;
  aiAnalysisResult?: {
    // Image analysis results
    extractedItems?: ExtractedDesignItem[];
    styleAnalysis?: StyleAnalysis;
    materialRecommendations?: MaterialRecommendation[];
    manufacturingNotes?: ManufacturingNotes;
    featureLibraryMatches?: {
      featureId: string;
      featureName: string;
      confidence: number;
    }[];

    // Project scoping results
    multiplierDetected?: boolean;
    deliverables?: {
      name: string;
      category: string;
      quantity: number;
    }[];
    projectNotes?: string;
    ambiguities?: string[];

    // Common fields
    confidence?: number;
    appliedToProject?: boolean; // Whether AI suggestions were converted to design items
  };
  aiAnalysisError?: string;
  aiAnalyzedAt?: Timestamp;

  // Project context
  projectId: string;
  projectCode: string;

  // Metadata
  uploadedAt: Timestamp;
  uploadedBy: string;
  uploadedByName?: string;
  updatedAt?: Timestamp;
}

// ============================================
// Upload Types
// ============================================

/**
 * Document upload request
 */
export interface DocumentUploadRequest {
  file: File;
  category: ClientDocumentCategory;
  name?: string;
  description?: string;
  projectId: string;
  projectCode: string;
  triggerAI?: boolean; // Default: true
}

/**
 * Upload progress callback
 */
export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'error' | 'canceled';
}

/**
 * Upload result
 */
export interface UploadResult {
  success: boolean;
  document?: ClientDocument;
  error?: string;
  uploadDuration?: number;
}

/**
 * Batch upload request
 */
export interface BatchUploadRequest {
  files: File[];
  category: ClientDocumentCategory;
  projectId: string;
  projectCode: string;
  triggerAI?: boolean; // Default: true
}

/**
 * Batch upload result
 */
export interface BatchUploadResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    fileName: string;
    success: boolean;
    document?: ClientDocument;
    error?: string;
  }>;
}

// ============================================
// Validation Types
// ============================================

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * MIME type groups
 */
export const ALLOWED_MIME_TYPES = {
  images: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ],
  documents: [
    'application/pdf',
  ],
  cad: [
    'application/acad',
    'application/x-acad',
    'application/autocad_dwg',
    'image/vnd.dwg',
    'application/dwg',
    'application/dxf',
    '.dwg',
    '.dxf',
  ],
} as const;

/**
 * File size limits by category (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  'reference-images': 20 * 1024 * 1024,    // 20MB
  'cad-drawings': 100 * 1024 * 1024,       // 100MB
  'pdf-plans': 50 * 1024 * 1024,           // 50MB
  'design-briefs': 10 * 1024 * 1024,       // 10MB
  'other': 50 * 1024 * 1024,               // 50MB
  default: 50 * 1024 * 1024,               // 50MB
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: ClientDocumentCategory): string {
  const names: Record<ClientDocumentCategory, string> = {
    'reference-images': 'Reference Images',
    'cad-drawings': 'CAD Drawings',
    'pdf-plans': 'PDF Plans',
    'design-briefs': 'Design Briefs',
    'other': 'Other Documents',
  };
  return names[category];
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get AI analysis status display
 */
export function getAIStatusDisplay(status: AIAnalysisStatus): {
  label: string;
  color: string;
  icon: string;
} {
  const displays = {
    none: { label: 'No AI Analysis', color: 'gray', icon: '○' },
    pending: { label: 'AI Queued', color: 'blue', icon: '⏱' },
    running: { label: 'AI Running', color: 'yellow', icon: '⏳' },
    completed: { label: 'AI Complete', color: 'green', icon: '✓' },
    failed: { label: 'AI Failed', color: 'red', icon: '✗' },
  };
  return displays[status];
}

/**
 * Determine if AI should be triggered for a file
 */
export function shouldTriggerAI(
  category: ClientDocumentCategory,
  mimeType: string
): { trigger: boolean; analysisType?: AIAnalysisType } {
  // Reference images → Image Analysis AI
  if (
    category === 'reference-images' &&
    ALLOWED_MIME_TYPES.images.includes(mimeType as any)
  ) {
    return { trigger: true, analysisType: 'image-analysis' };
  }

  // Design briefs (PDFs) → Project Scoping AI
  if (
    category === 'design-briefs' &&
    mimeType === 'application/pdf'
  ) {
    return { trigger: true, analysisType: 'project-scoping' };
  }

  // No AI for other categories
  return { trigger: false };
}

/**
 * Check if MIME type is allowed for category
 */
export function isAllowedMimeType(
  mimeType: string,
  category: ClientDocumentCategory
): boolean {
  switch (category) {
    case 'reference-images':
      return ALLOWED_MIME_TYPES.images.includes(mimeType as any);
    case 'cad-drawings':
      return ALLOWED_MIME_TYPES.cad.some(type =>
        mimeType.includes(type) || mimeType === type
      );
    case 'pdf-plans':
    case 'design-briefs':
      return ALLOWED_MIME_TYPES.documents.includes(mimeType as any);
    case 'other':
      return true; // Allow any type for 'other'
    default:
      return false;
  }
}

/**
 * Get file size limit for category
 */
export function getFileSizeLimit(category: ClientDocumentCategory): number {
  return FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.default;
}

/**
 * Validate file for upload
 */
export function validateFile(
  file: File,
  category: ClientDocumentCategory
): FileValidationResult {
  // Check file size
  const sizeLimit = getFileSizeLimit(category);
  if (file.size > sizeLimit) {
    return {
      valid: false,
      error: `File size exceeds ${formatFileSize(sizeLimit)} limit`,
    };
  }

  // Check MIME type
  if (!isAllowedMimeType(file.type, category)) {
    return {
      valid: false,
      error: `File type not allowed for ${getCategoryDisplayName(category)}`,
    };
  }

  return { valid: true };
}

/**
 * Generate storage path for document
 */
export function generateStoragePath(
  projectId: string,
  category: ClientDocumentCategory,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 100);
  return `design-projects/${projectId}/client-documents/${category}/${timestamp}_${sanitizedName}`;
}

/**
 * Type guard for image analysis result
 */
export function isImageAnalysisResult(
  result: AIAnalysisResult
): result is ImageAnalysisResult {
  return 'styleAnalysis' in result;
}

/**
 * Type guard for project scoping result
 */
export function isProjectScopingResult(
  result: AIAnalysisResult
): result is ProjectScopingResult {
  return 'multiplierDetected' in result;
}
