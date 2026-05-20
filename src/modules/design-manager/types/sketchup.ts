/**
 * Enhanced SketchUp Types
 * Extended type definitions for SketchUp 3D model integration
 * Includes upload functionality, enhanced annotations, and material visualization
 */

import type { Timestamp } from 'firebase/firestore';
import type { SketchUpModel } from './clientPortal';

// ============================================
// Upload & Processing Types
// ============================================

/**
 * Upload status for SketchUp models
 */
export type SketchUpUploadStatus =
  | 'pending'       // File selected, not yet uploaded
  | 'uploading'     // Uploading to Firebase Storage
  | 'processing'    // Processing model (thumbnail generation, etc.)
  | 'ready'         // Model ready for viewing
  | 'error';        // Upload or processing failed

/**
 * Model file type
 */
export type SketchUpFileType = 'skp' | 'skp-2023' | 'skp-2024' | 'collada' | 'obj' | 'fbx' | '3ds';

/**
 * Upload progress tracking
 */
export interface SketchUpUploadProgress {
  status: SketchUpUploadStatus;
  progress: number;         // 0-100
  message?: string;
  error?: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

// ============================================
// Enhanced Annotation Types
// ============================================

/**
 * Annotation category
 */
export type AnnotationCategory =
  | 'dimension'     // Measurement note
  | 'material'      // Material specification
  | 'note'          // General note
  | 'approval'      // Linked to approval item
  | 'comment'       // Client/team comment
  | 'warning'       // Issue or concern
  | 'instruction';  // Assembly/construction instruction

/**
 * 3D position in model space
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Comment on an annotation
 */
export interface AnnotationComment {
  id: string;
  authorId: string;
  authorName: string;
  authorType: 'team' | 'client';
  authorAvatar?: string;
  content: string;
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

/**
 * Enhanced 3D annotation
 */
export interface Annotation3D {
  id: string;

  // Position in 3D space
  position: Position3D;
  normal?: Position3D;      // Surface normal for positioning marker

  // Content
  label: string;
  description?: string;
  category: AnnotationCategory;

  // Visual style
  color?: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';

  // Linked entities
  linkedApprovalItemId?: string;
  linkedMaterialId?: string;
  linkedDesignItemId?: string;
  linkedDeliverableId?: string;

  // Measurement data (for dimension annotations)
  measurement?: {
    value: number;
    unit: 'mm' | 'cm' | 'm' | 'inches' | 'feet';
    type: 'length' | 'width' | 'height' | 'diameter' | 'area' | 'volume';
  };

  // Comments thread
  comments: AnnotationComment[];
  commentCount: number;

  // Status
  status: 'open' | 'resolved' | 'archived';
  resolvedAt?: Timestamp;
  resolvedBy?: string;

  // Author and timestamps
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================
// Material Visualization Types
// ============================================

/**
 * Material mapping between model and library
 */
export interface MaterialMapping {
  id: string;
  modelMaterialName: string;      // Material name in SketchUp model
  modelMaterialId?: string;       // Internal model material ID

  // Link to our material library
  linkedMaterialId?: string;
  linkedMaterialName?: string;

  // Link to procurement item
  linkedProcurementId?: string;
  linkedProcurementName?: string;

  // Fallback visual
  colorHex?: string;
  textureUrl?: string;

  // Status
  status: 'unmapped' | 'mapped' | 'approved';
  procurementStatus?: 'not-ordered' | 'ordered' | 'received';
}

/**
 * Model material information extracted from SketchUp
 */
export interface ModelMaterial {
  id: string;
  name: string;
  colorHex?: string;
  textureUrl?: string;
  opacity?: number;
  usageCount: number;         // How many faces use this material
  usageArea?: number;         // Approximate area in model units
}

// ============================================
// Viewer Configuration Types
// ============================================

/**
 * Viewer configuration options
 */
export interface SketchUpViewerConfig {
  measurementEnabled: boolean;
  annotationsEnabled: boolean;
  annotationsVisible: boolean;
  arEnabled: boolean;
  shadowsEnabled: boolean;
  edgesEnabled: boolean;
  backgroundType: 'sky' | 'solid' | 'gradient';
  backgroundColor?: string;
  initialScene?: string;
  autoRotate: boolean;
  autoRotateSpeed?: number;
}

/**
 * Viewer state
 */
export interface SketchUpViewerState {
  isLoading: boolean;
  isFullscreen: boolean;
  currentScene?: string;
  cameraPosition?: Position3D;
  cameraTarget?: Position3D;
  selectedAnnotationId?: string;
  hoveredAnnotationId?: string;
  measurementMode: boolean;
}

// ============================================
// Enhanced SketchUp Model Type
// ============================================

/**
 * Enhanced SketchUp model with additional features
 */
export interface EnhancedSketchUpModel extends SketchUpModel {
  // Trimble Connect integration (optional)
  trimbleModelId?: string;
  trimbleProjectId?: string;

  // Viewer configuration
  viewerConfig: SketchUpViewerConfig;

  // Enhanced annotations with 3D positions
  annotations3D: Annotation3D[];

  // Material mappings
  materialMappings: MaterialMapping[];

  // Extracted materials from model
  modelMaterials?: ModelMaterial[];

  // File information
  fileType?: SketchUpFileType;
  fileSize?: number;
  sketchUpVersion?: string;

  // Workflow integration
  approvalItemLinks: string[];    // IDs of linked approval items
  deliverableLinks?: string[];    // IDs of linked deliverables

  // Upload tracking
  uploadStatus: SketchUpUploadStatus;
  uploadProgress?: number;
  processingError?: string;

  // Statistics
  stats?: {
    faceCount?: number;
    edgeCount?: number;
    componentCount?: number;
    materialCount?: number;
    groupCount?: number;
  };

  // AR support
  arSupported?: boolean;
  arModelUrl?: string;            // USDZ for iOS, GLB for Android
  arQrCodeUrl?: string;           // QR code for AR viewing

  // Last viewed
  lastViewedAt?: Timestamp;
  lastViewedBy?: string;
  viewCount?: number;
}

// ============================================
// Scene Types
// ============================================

/**
 * Enhanced scene with camera information
 */
export interface EnhancedScene {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;

  // Camera position
  camera?: {
    position: Position3D;
    target: Position3D;
    up?: Position3D;
    fov?: number;
  };

  // Visibility settings
  hiddenLayers?: string[];
  hiddenComponents?: string[];

  // Style
  stylePreset?: string;
  shadowsEnabled?: boolean;

  // Ordering
  order: number;
}

// ============================================
// Measurement Types
// ============================================

/**
 * Measurement point in 3D space
 */
export interface MeasurementPoint {
  position: Position3D;
  snappedTo?: 'vertex' | 'edge' | 'face' | 'midpoint' | 'center';
}

/**
 * Measurement result
 */
export interface MeasurementResult {
  id: string;
  type: 'distance' | 'angle' | 'area';
  points: MeasurementPoint[];
  value: number;
  unit: 'mm' | 'cm' | 'm' | 'inches' | 'feet' | 'degrees' | 'sqm' | 'sqft';
  label?: string;
  visible: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================
// Service Types
// ============================================

/**
 * Upload options
 */
export interface SketchUpUploadOptions {
  generateThumbnail: boolean;
  extractMaterials: boolean;
  extractScenes: boolean;
  generateArModel: boolean;
  initialViewerConfig?: Partial<SketchUpViewerConfig>;
}

/**
 * Model update data
 */
export interface SketchUpModelUpdate {
  name?: string;
  description?: string;
  viewerConfig?: Partial<SketchUpViewerConfig>;
  isPublic?: boolean;
}

// ============================================
// Filter & Dashboard Types
// ============================================

/**
 * Filter options for SketchUp models
 */
export interface SketchUpModelFilters {
  projectId?: string;
  designItemId?: string;
  uploadStatus?: SketchUpUploadStatus | SketchUpUploadStatus[];
  hasAnnotations?: boolean;
  hasMaterialMappings?: boolean;
  search?: string;
  sortBy?: 'name' | 'updatedAt' | 'createdAt' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Model summary for listings
 */
export interface SketchUpModelSummary {
  id: string;
  projectId: string;
  designItemId?: string;
  name: string;
  thumbnailUrl?: string;
  uploadStatus: SketchUpUploadStatus;
  annotationCount: number;
  materialMappingCount: number;
  viewCount: number;
  version: number;
  updatedAt: Timestamp;
}

// ============================================
// Constants
// ============================================

/**
 * Default viewer configuration
 */
export const DEFAULT_VIEWER_CONFIG: SketchUpViewerConfig = {
  measurementEnabled: false,
  annotationsEnabled: true,
  annotationsVisible: true,
  arEnabled: false,
  shadowsEnabled: true,
  edgesEnabled: true,
  backgroundType: 'sky',
  autoRotate: false,
  autoRotateSpeed: 1,
};

/**
 * Annotation category labels
 */
export const ANNOTATION_CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  'dimension': 'Dimension',
  'material': 'Material',
  'note': 'Note',
  'approval': 'Approval',
  'comment': 'Comment',
  'warning': 'Warning',
  'instruction': 'Instruction',
};

/**
 * Annotation category colors
 */
export const ANNOTATION_CATEGORY_COLORS: Record<AnnotationCategory, string> = {
  'dimension': '#3b82f6',     // Blue
  'material': '#8b5cf6',      // Purple
  'note': '#6b7280',          // Gray
  'approval': '#f59e0b',      // Amber
  'comment': '#10b981',       // Emerald
  'warning': '#ef4444',       // Red
  'instruction': '#06b6d4',   // Cyan
};

/**
 * Supported file types for upload
 */
export const SUPPORTED_FILE_TYPES: SketchUpFileType[] = [
  'skp',
  'skp-2023',
  'skp-2024',
  'collada',
  'obj',
  'fbx',
  '3ds',
];

/**
 * Maximum file size for upload (in bytes) - 500MB
 */
export const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
