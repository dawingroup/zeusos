/**
 * Database type definitions for IndexedDB via Dexie
 */

export interface ClipRecord {
  id: string;
  sourceUrl: string;
  imageUrl: string;
  imageBlob: Blob;
  thumbnailBlob: Blob;
  title: string;
  description?: string;
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
  tags: string[];
  notes?: string;
  
  // Organization
  projectId?: string;
  designItemId?: string;
  roomType?: string;
  
  // AI Analysis
  aiAnalysis?: AIAnalysis;
  
  // Sync metadata
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  firebaseId?: string;
  version: number;
  lastModified: Date;
  createdAt: Date;
}

export interface AIAnalysis {
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

export interface SyncQueueItem {
  id: string;
  clipId: string;
  operation: 'create' | 'update' | 'delete';
  payload?: Partial<ClipRecord>;
  retryCount: number;
  lastAttempt?: Date;
  createdAt: Date;
}

export interface ProjectCache {
  id: string;
  name: string;
  clientName?: string;
  rooms: string[];
  lastSynced: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

export interface ExtractedMetadata {
  title?: string;
  description?: string;
  price?: {
    amount: number;
    currency: string;
    formatted: string;
    confidence: number;
  };
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    unit: 'in' | 'cm' | 'mm';
    confidence: number;
  };
  brand?: string;
  sku?: string;
  materials?: string[];
  colors?: string[];
  category?: string;
  imageAlt?: string;
}

export interface DetectedImage {
  element: HTMLElement;
  imageUrl: string;
  highResUrl?: string;
  width: number;
  height: number;
  alt?: string;
  sourceType: 'img' | 'picture' | 'background' | 'lazy';
  boundingRect: DOMRect;
}
