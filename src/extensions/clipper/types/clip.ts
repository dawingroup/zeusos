/**
 * Clip-related type definitions
 */

import type { ClipRecord, ExtractedMetadata, AIAnalysis } from './database';

export type { ClipRecord, ExtractedMetadata, AIAnalysis };

export interface CaptureResult {
  imageBlob: Blob;
  thumbnailBlob: Blob;
  originalWidth: number;
  originalHeight: number;
  format: string;
  size: number;
}

export interface ClipSessionData {
  id: string;
  clips: SessionClip[];
  projectId?: string;
  startedAt: Date;
  lastUpdated: Date;
}

export interface SessionClip {
  id: string;
  imageUrl: string;
  thumbnailDataUrl?: string;
  metadata: ExtractedMetadata;
  status: 'capturing' | 'ready' | 'error';
  error?: string;
}

export type ClipEvent =
  | { type: 'clip-saved'; clip: ClipRecord }
  | { type: 'clip-updated'; clip: ClipRecord }
  | { type: 'clip-deleted'; clipId: string }
  | { type: 'sync-status-changed'; clipId: string; status: ClipRecord['syncStatus'] }
  | { type: 'storage-warning'; usage: number; limit: number };

export interface ClipSearchQuery {
  text?: string;
  tags?: string[];
  projectId?: string;
  syncStatus?: ClipRecord['syncStatus'];
  dateRange?: { start: Date; end: Date };
}

export interface ClipExportOptions {
  format: 'zip' | 'json';
  includeImages: boolean;
  includeThumbnails: boolean;
}

export interface StorageUsage {
  used: number;
  clips: number;
  averageSize: number;
}
