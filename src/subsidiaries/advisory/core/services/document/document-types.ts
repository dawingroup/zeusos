/**
 * DOCUMENT TYPES
 * 
 * Types and interfaces for document management service.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Document Categories and Types
// ============================================================================

/**
 * Top-level document categories
 */
export type DocumentCategory =
  | 'legal'
  | 'financial'
  | 'technical'
  | 'compliance'
  | 'operational'
  | 'reference'
  | 'deliverable';

/**
 * Specific document types within categories
 */
export type DocumentType =
  // Legal documents
  | 'contract'
  | 'agreement'
  | 'mou'
  | 'nda'
  | 'amendment'
  | 'addendum'
  | 'legal_opinion'
  | 'power_of_attorney'
  // Financial documents
  | 'budget'
  | 'valuation'
  | 'invoice'
  | 'payment_certificate'
  | 'ipc'
  | 'final_account'
  | 'bank_guarantee'
  | 'insurance_certificate'
  | 'tax_document'
  | 'financial_statement'
  | 'audit_report'
  // Technical documents
  | 'boq'
  | 'drawing'
  | 'specification'
  | 'design_report'
  | 'site_investigation'
  | 'environmental_assessment'
  | 'variation_order'
  | 'site_instruction'
  | 'rfi'
  // Compliance documents
  | 'progress_report'
  | 'completion_report'
  | 'compliance_certificate'
  | 'permit'
  | 'license'
  | 'approval_letter'
  | 'no_objection'
  | 'covenant_report'
  // Operational documents
  | 'meeting_minutes'
  | 'correspondence'
  | 'site_photo'
  | 'site_diary'
  | 'attendance_register'
  | 'requisition'
  | 'accountability'
  | 'goods_received_note'
  // Reference documents
  | 'template'
  | 'guideline'
  | 'standard'
  | 'policy'
  | 'manual'
  // Deliverables
  | 'inception_report'
  | 'interim_report'
  | 'draft_report'
  | 'final_report'
  | 'presentation'
  | 'other';

/**
 * Document access levels
 */
export type DocumentAccessLevel =
  | 'private'
  | 'team'
  | 'stakeholders'
  | 'public';

/**
 * Document status
 */
export type DocumentStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'archived';

/**
 * Engagement module type
 */
export type EngagementModule = 'delivery' | 'investment' | 'advisory' | 'matflow';

/**
 * MIME type groups for validation
 */
export const ALLOWED_MIME_TYPES = {
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  archives: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ],
  cad: [
    'application/acad',
    'application/x-acad',
    'application/autocad_dwg',
    'image/vnd.dwg',
    'application/dwg',
  ],
} as const;

/**
 * File size limits by type (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  documents: 50 * 1024 * 1024,
  images: 20 * 1024 * 1024,
  archives: 100 * 1024 * 1024,
  cad: 200 * 1024 * 1024,
  default: 50 * 1024 * 1024,
} as const;

// ============================================================================
// Document Entity
// ============================================================================

/**
 * Document metadata stored in Firestore
 */
export interface Document {
  id: string;
  
  /** Basic info */
  name: string;
  description?: string;
  category: DocumentCategory;
  type: DocumentType;
  
  /** File info */
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  
  /** Storage */
  storagePath: string;
  downloadUrl: string;
  thumbnailUrl?: string;
  
  /** Versioning */
  version: number;
  versionLabel?: string;
  previousVersionId?: string;
  isLatest: boolean;
  
  /** Context */
  engagementId: string;
  module?: EngagementModule;
  entityType?: string;
  entityId?: string;
  folderId?: string;
  
  /** Access control */
  accessLevel: DocumentAccessLevel;
  allowedUsers?: string[];
  allowedRoles?: string[];
  
  /** Status */
  status: DocumentStatus;
  requiresApproval: boolean;
  approvalRequestId?: string;
  
  /** Metadata */
  tags: string[];
  referenceNumber?: string;
  externalId?: string;
  
  /** Audit */
  uploadedBy: string;
  uploadedAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
  
  /** Review info */
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  reviewComments?: string;
  
  /** Offline support */
  availableOffline: boolean;
  offlineSyncedAt?: Timestamp;
  
  /** Checksums */
  md5Hash?: string;
  sha256Hash?: string;
}

/**
 * Document version for version history
 */
export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  versionLabel?: string;
  
  /** File info at this version */
  fileName: string;
  fileSize: number;
  storagePath: string;
  downloadUrl: string;
  
  /** Changes */
  changeDescription?: string;
  
  /** Audit */
  createdBy: string;
  createdAt: Timestamp;
  
  /** Checksums */
  md5Hash?: string;
}

/**
 * Document activity log entry
 */
export interface DocumentActivity {
  id: string;
  documentId: string;
  
  action: DocumentAction;
  
  /** Actor */
  userId: string;
  userName: string;
  
  /** Details */
  details?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
  
  /** Timestamp */
  timestamp: Timestamp;
}

/**
 * Document actions for activity log
 */
export type DocumentAction =
  | 'uploaded'
  | 'downloaded'
  | 'viewed'
  | 'updated'
  | 'version_created'
  | 'status_changed'
  | 'access_changed'
  | 'shared'
  | 'unshared'
  | 'approved'
  | 'rejected'
  | 'archived'
  | 'restored'
  | 'deleted';

// ============================================================================
// Document Folder/Structure
// ============================================================================

/**
 * Virtual folder for organizing documents
 */
export interface DocumentFolder {
  id: string;
  name: string;
  description?: string;
  
  /** Hierarchy */
  parentId?: string;
  path: string;
  depth: number;
  
  /** Context */
  engagementId: string;
  module?: EngagementModule;
  
  /** Access */
  accessLevel: DocumentAccessLevel;
  
  /** Metadata */
  color?: string;
  icon?: string;
  
  /** Counts */
  documentCount: number;
  subfolderCount: number;
  
  /** Audit */
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// Upload Types
// ============================================================================

/**
 * Document upload request
 */
export interface DocumentUploadRequest {
  file: File;
  
  /** Metadata */
  name?: string;
  description?: string;
  category: DocumentCategory;
  type: DocumentType;
  
  /** Context */
  engagementId: string;
  module?: EngagementModule;
  entityType?: string;
  entityId?: string;
  folderId?: string;
  
  /** Access */
  accessLevel?: DocumentAccessLevel;
  allowedUsers?: string[];
  allowedRoles?: string[];
  
  /** Options */
  tags?: string[];
  referenceNumber?: string;
  versionLabel?: string;
  requiresApproval?: boolean;
  availableOffline?: boolean;
  
  /** Version info (if creating new version) */
  previousDocumentId?: string;
  changeDescription?: string;
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
  document?: Document;
  error?: string;
  uploadDuration?: number;
}

/**
 * Batch upload request
 */
export interface BatchUploadRequest {
  files: File[];
  
  /** Common metadata */
  category: DocumentCategory;
  type: DocumentType;
  engagementId: string;
  module?: EngagementModule;
  entityType?: string;
  entityId?: string;
  folderId?: string;
  accessLevel?: DocumentAccessLevel;
  tags?: string[];
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
    document?: Document;
    error?: string;
  }>;
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Document list filters
 */
export interface DocumentFilters {
  engagementId?: string;
  module?: EngagementModule;
  category?: DocumentCategory;
  type?: DocumentType;
  status?: DocumentStatus;
  accessLevel?: DocumentAccessLevel;
  folderId?: string;
  entityType?: string;
  entityId?: string;
  uploadedBy?: string;
  tags?: string[];
  isLatest?: boolean;
  requiresApproval?: boolean;
  availableOffline?: boolean;
  
  /** Date filters */
  uploadedAfter?: Date;
  uploadedBefore?: Date;
  
  /** Search */
  searchTerm?: string;
}

/**
 * Document sort options
 */
export interface DocumentSort {
  field: 'name' | 'uploadedAt' | 'updatedAt' | 'fileSize' | 'version' | 'status';
  direction: 'asc' | 'desc';
}

/**
 * Paginated document list
 */
export interface DocumentList {
  documents: Document[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================================================
// Share Types
// ============================================================================

/**
 * Document share link
 */
export interface DocumentShareLink {
  id: string;
  documentId: string;
  
  /** Link settings */
  token: string;
  expiresAt?: Timestamp;
  maxDownloads?: number;
  downloadCount: number;
  requiresPassword: boolean;
  passwordHash?: string;
  
  /** Permissions */
  allowDownload: boolean;
  allowView: boolean;
  
  /** Audit */
  createdBy: string;
  createdAt: Timestamp;
  
  /** Access log */
  accessedBy?: Array<{
    ip?: string;
    userAgent?: string;
    accessedAt: Timestamp;
  }>;
}

/**
 * Create share link request
 */
export interface CreateShareLinkRequest {
  documentId: string;
  expiresIn?: number;
  maxDownloads?: number;
  password?: string;
  allowDownload?: boolean;
  allowView?: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isDocument(obj: unknown): obj is Document {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'category' in obj &&
    'storagePath' in obj
  );
}

export function isValidCategory(category: string): category is DocumentCategory {
  const categories: DocumentCategory[] = [
    'legal', 'financial', 'technical', 'compliance',
    'operational', 'reference', 'deliverable'
  ];
  return categories.includes(category as DocumentCategory);
}

export function isValidDocumentType(type: string): type is DocumentType {
  const types: DocumentType[] = [
    'contract', 'agreement', 'mou', 'nda', 'amendment', 'addendum',
    'legal_opinion', 'power_of_attorney', 'budget', 'valuation',
    'invoice', 'payment_certificate', 'ipc', 'final_account',
    'bank_guarantee', 'insurance_certificate', 'tax_document',
    'financial_statement', 'audit_report', 'boq', 'drawing',
    'specification', 'design_report', 'site_investigation',
    'environmental_assessment', 'variation_order', 'site_instruction',
    'rfi', 'progress_report', 'completion_report', 'compliance_certificate',
    'permit', 'license', 'approval_letter', 'no_objection', 'covenant_report',
    'meeting_minutes', 'correspondence', 'site_photo', 'site_diary',
    'attendance_register', 'requisition', 'accountability',
    'goods_received_note', 'template', 'guideline', 'standard',
    'policy', 'manual', 'inception_report', 'interim_report',
    'draft_report', 'final_report', 'presentation', 'other'
  ];
  return types.includes(type as DocumentType);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get category for a document type
 */
export function getCategoryForType(type: DocumentType): DocumentCategory {
  const categoryMap: Record<DocumentType, DocumentCategory> = {
    contract: 'legal',
    agreement: 'legal',
    mou: 'legal',
    nda: 'legal',
    amendment: 'legal',
    addendum: 'legal',
    legal_opinion: 'legal',
    power_of_attorney: 'legal',
    budget: 'financial',
    valuation: 'financial',
    invoice: 'financial',
    payment_certificate: 'financial',
    ipc: 'financial',
    final_account: 'financial',
    bank_guarantee: 'financial',
    insurance_certificate: 'financial',
    tax_document: 'financial',
    financial_statement: 'financial',
    audit_report: 'financial',
    boq: 'technical',
    drawing: 'technical',
    specification: 'technical',
    design_report: 'technical',
    site_investigation: 'technical',
    environmental_assessment: 'technical',
    variation_order: 'technical',
    site_instruction: 'technical',
    rfi: 'technical',
    progress_report: 'compliance',
    completion_report: 'compliance',
    compliance_certificate: 'compliance',
    permit: 'compliance',
    license: 'compliance',
    approval_letter: 'compliance',
    no_objection: 'compliance',
    covenant_report: 'compliance',
    meeting_minutes: 'operational',
    correspondence: 'operational',
    site_photo: 'operational',
    site_diary: 'operational',
    attendance_register: 'operational',
    requisition: 'operational',
    accountability: 'operational',
    goods_received_note: 'operational',
    template: 'reference',
    guideline: 'reference',
    standard: 'reference',
    policy: 'reference',
    manual: 'reference',
    inception_report: 'deliverable',
    interim_report: 'deliverable',
    draft_report: 'deliverable',
    final_report: 'deliverable',
    presentation: 'deliverable',
    other: 'operational',
  };
  return categoryMap[type];
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: DocumentCategory): string {
  const names: Record<DocumentCategory, string> = {
    legal: 'Legal',
    financial: 'Financial',
    technical: 'Technical',
    compliance: 'Compliance',
    operational: 'Operational',
    reference: 'Reference',
    deliverable: 'Deliverable',
  };
  return names[category];
}

/**
 * Get document type display name
 */
export function getDocumentTypeDisplayName(type: DocumentType): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * Get MIME type group for validation
 */
export function getMimeTypeGroup(mimeType: string): keyof typeof ALLOWED_MIME_TYPES | null {
  for (const [group, types] of Object.entries(ALLOWED_MIME_TYPES)) {
    if ((types as readonly string[]).includes(mimeType)) {
      return group as keyof typeof ALLOWED_MIME_TYPES;
    }
  }
  return null;
}

/**
 * Check if MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return getMimeTypeGroup(mimeType) !== null;
}

/**
 * Get file size limit for MIME type
 */
export function getFileSizeLimit(mimeType: string): number {
  const group = getMimeTypeGroup(mimeType);
  return group ? FILE_SIZE_LIMITS[group] : FILE_SIZE_LIMITS.default;
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
 * Generate storage path for document
 */
export function generateStoragePath(
  engagementId: string,
  category: DocumentCategory,
  fileName: string,
  documentId: string
): string {
  const sanitizedName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 100);
  return `engagements/${engagementId}/documents/${category}/${documentId}/${sanitizedName}`;
}

/**
 * Get access level display name
 */
export function getAccessLevelDisplayName(level: DocumentAccessLevel): string {
  const names: Record<DocumentAccessLevel, string> = {
    private: 'Private',
    team: 'Team Only',
    stakeholders: 'Stakeholders',
    public: 'Public',
  };
  return names[level];
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: DocumentStatus): string {
  const names: Record<DocumentStatus, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    superseded: 'Superseded',
    archived: 'Archived',
  };
  return names[status];
}

/**
 * Get status color
 */
export function getStatusColor(status: DocumentStatus): string {
  const colors: Record<DocumentStatus, string> = {
    draft: 'gray',
    pending_review: 'yellow',
    approved: 'green',
    rejected: 'red',
    superseded: 'purple',
    archived: 'gray',
  };
  return colors[status];
}
