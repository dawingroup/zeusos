/**
 * Media Library Types
 * Type definitions for the marketing media library (Firebase Storage backed)
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Media Asset Types
// ============================================

export type MediaAssetType = 'image' | 'video' | 'document' | 'audio' | 'other';
export type MediaAssetStatus = 'uploading' | 'processing' | 'ready' | 'archived' | 'failed';

export interface MediaAsset {
  id: string;
  companyId: string;

  // File Identity
  name: string;
  originalFileName: string;
  description?: string;

  // Storage
  storagePath: string;
  downloadUrl: string;
  thumbnailUrl?: string;

  // File Metadata
  assetType: MediaAssetType;
  mimeType: string;
  fileSize: number; // bytes
  dimensions?: { width: number; height: number };
  duration?: number; // seconds, for video/audio

  // Organization
  folderId?: string;
  tags: string[];
  category?: string;
  status: MediaAssetStatus;

  // Usage Tracking
  usageCount: number;
  lastUsedAt?: Timestamp;
  usedInCampaigns: string[];
  usedInPosts: string[];

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Folder Organization
// ============================================

export interface MediaFolder {
  id: string;
  companyId: string;
  name: string;
  parentId?: string;
  color?: string;
  assetCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Upload Types
// ============================================

export interface MediaUploadRequest {
  file: File;
  name?: string;
  description?: string;
  folderId?: string;
  tags?: string[];
  category?: string;
}

export interface MediaUploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
  asset?: MediaAsset;
}

// ============================================
// Filter & Query Types
// ============================================

export interface MediaFilters {
  assetType?: MediaAssetType;
  folderId?: string;
  tags?: string[];
  category?: string;
  search?: string;
  status?: MediaAssetStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export type MediaSortField = 'name' | 'createdAt' | 'fileSize' | 'usageCount';
export type MediaSortOrder = 'asc' | 'desc';

export interface MediaSort {
  field: MediaSortField;
  order: MediaSortOrder;
}

export type MediaViewMode = 'grid' | 'list';

// ============================================
// Constants
// ============================================

export const MEDIA_ASSET_TYPES: Record<MediaAssetType, { label: string; extensions: string[] }> = {
  image: { label: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'] },
  video: { label: 'Videos', extensions: ['mp4', 'mov', 'avi', 'webm', 'mkv'] },
  document: { label: 'Documents', extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'] },
  audio: { label: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] },
  other: { label: 'Other', extensions: [] },
};

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_BATCH_UPLOAD = 20;
export const MEDIA_COLLECTION = 'marketingMediaAssets';
export const MEDIA_FOLDERS_COLLECTION = 'marketingMediaFolders';
