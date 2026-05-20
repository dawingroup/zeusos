/**
 * Clipper Types
 * Shared type definitions for the clipper module
 */

/**
 * Clip Type - Primary intent when clipping
 */
export type ClipType = 
  | 'inspiration'      // General inspiration for project/design
  | 'reference'        // Design reference image
  | 'parts-source'     // Source for parts extraction
  | 'procurement'      // Item to procure
  | 'material'         // Material sample for library
  | 'asset'            // Hardware/fitting for registry
  | 'product-idea';    // Product ideation for launch pipeline

/**
 * Clip Context - Where the clip was created from
 */
export interface ClipContext {
  module: 'clipper' | 'design-manager' | 'materials' | 'assets' | 'launch-pipeline';
  triggeredFrom?: string;  // URL or page identifier
}

/**
 * Clip Linkage - Links a clip to various entities
 */
export interface ClipLinkage {
  type: 'project' | 'design-item' | 'material' | 'asset' | 'product';
  targetId: string;
  targetName?: string;  // Display name for quick reference
  role: 'inspiration' | 'reference' | 'source' | 'procurement';
  createdAt: Date;
}

/**
 * Analysis Status - Tracks AI analysis progress
 */
export type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface DesignClip {
  id: string;
  sourceUrl: string;
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  
  // NEW: Clip Type and Context
  clipType: ClipType;
  clipContext: ClipContext;
  
  // NEW: Linkages (one clip, multiple uses)
  linkages: ClipLinkage[];
  
  // NEW: Analysis Status
  analysisStatus: AnalysisStatus;
  
  // Extracted metadata (from page scraping)
  price?: {
    amount: number;
    currency: string;
    formatted: string;
  };
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    unit: 'in' | 'cm' | 'mm';
  };
  materials?: string[];
  colors?: string[];
  brand?: string;
  sku?: string;
  
  // Organization
  tags: string[];
  notes?: string;
  projectId?: string;      // Primary project (for backward compatibility)
  designItemId?: string;   // Primary design item (for backward compatibility)
  roomType?: string;
  
  // AI Analysis (populated by background Cloud Function)
  aiAnalysis?: ClipAIAnalysis;
  
  // Upload source tracking
  uploadSource?: string;         // How the clip was uploaded (e.g., 'manual-upload', 'extension', 'api')

  // Sync metadata
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;

  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClipAIAnalysis {
  analyzedAt: Date;
  confidence: number;
  productType?: string;
  style?: string;
  primaryMaterials?: string[];
  colors?: string[];
  estimatedDimensions?: {
    width?: string;
    height?: string;
    depth?: string;
    unit?: string;
  };
  suggestedTags: string[];
  millworkAssessment?: {
    isCustomCandidate: boolean;
    complexity: 'simple' | 'moderate' | 'complex' | 'highly-complex';
    keyFeatures?: string[];
    estimatedHours?: number;
    considerations?: string[];
  };
}

export interface ClipFilter {
  search?: string;
  tags?: string[];
  projectId?: string;
  syncStatus?: DesignClip['syncStatus'];
  dateRange?: { start: Date; end: Date };
}

export interface ClipStats {
  total: number;
  synced: number;
  pending: number;
  byProject: Record<string, number>;
}

/**
 * Reverse Image Search Match
 * Result from Google Vision API reverse image search
 */
export interface ReverseSearchMatch {
  url: string;
  pageUrl?: string;
  title?: string;
  pageTitle?: string;
  score?: number;
}
