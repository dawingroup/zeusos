/**
 * ClipService - Manages clip lifecycle, CRUD operations, and events
 */

import type { ClipRecord, ExtractedMetadata } from '../types/database';
import type { ClipEvent, ClipSearchQuery, StorageUsage } from '../types/clip';
import {
  db,
  getClipById,
  saveClip,
  updateClip as dbUpdateClip,
  deleteClip as dbDeleteClip,
  getAllClips,
  getClipsByProject,
  getClipsBySyncStatus,
  searchClips as dbSearchClips,
  addToSyncQueue,
  generateClipId,
  getStorageStats,
} from './database';
import { imageCaptureService } from './image-capture';

type ClipEventListener = (event: ClipEvent) => void;

class ClipService {
  private listeners: ClipEventListener[] = [];
  private storageWarningThreshold = 0.9; // 90% of quota

  /**
   * Create a new clip from an image URL
   */
  async createClip(
    imageUrl: string,
    sourceUrl: string,
    metadata: ExtractedMetadata = {}
  ): Promise<ClipRecord> {
    // Capture image and generate thumbnail
    const captureResult = await imageCaptureService.capture(imageUrl);

    const clip: ClipRecord = {
      id: generateClipId(),
      sourceUrl,
      imageUrl,
      imageBlob: captureResult.imageBlob,
      thumbnailBlob: captureResult.thumbnailBlob,
      title: metadata.title || 'Untitled',
      description: metadata.description,
      price: metadata.price,
      dimensions: metadata.dimensions,
      materials: metadata.materials,
      colors: metadata.colors,
      brand: metadata.brand,
      sku: metadata.sku,
      tags: [],
      syncStatus: 'pending',
      version: 1,
      lastModified: new Date(),
      createdAt: new Date(),
    };

    // Save to IndexedDB
    await saveClip(clip);

    // Add to sync queue
    await addToSyncQueue({
      clipId: clip.id,
      operation: 'create',
      payload: this.getClipPayloadForSync(clip),
      retryCount: 0,
      createdAt: new Date(),
    });

    // Emit event
    this.emit({ type: 'clip-saved', clip });

    // Check storage usage
    await this.checkStorageUsage();

    return clip;
  }

  /**
   * Get a clip by ID
   */
  async getClip(id: string): Promise<ClipRecord | undefined> {
    return getClipById(id);
  }

  /**
   * Get all clips
   */
  async getAllClips(): Promise<ClipRecord[]> {
    return getAllClips();
  }

  /**
   * Get clips by project
   */
  async getClipsByProject(projectId: string): Promise<ClipRecord[]> {
    return getClipsByProject(projectId);
  }

  /**
   * Get clips by sync status
   */
  async getClipsBySyncStatus(status: ClipRecord['syncStatus']): Promise<ClipRecord[]> {
    return getClipsBySyncStatus(status);
  }

  /**
   * Search clips
   */
  async searchClips(query: ClipSearchQuery): Promise<ClipRecord[]> {
    if (query.text) {
      return dbSearchClips(query.text);
    }

    let clips = await getAllClips();

    if (query.projectId) {
      clips = clips.filter((c) => c.projectId === query.projectId);
    }

    if (query.syncStatus) {
      clips = clips.filter((c) => c.syncStatus === query.syncStatus);
    }

    if (query.tags && query.tags.length > 0) {
      clips = clips.filter((c) =>
        query.tags!.some((tag) => c.tags.includes(tag))
      );
    }

    if (query.dateRange) {
      clips = clips.filter(
        (c) =>
          c.createdAt >= query.dateRange!.start &&
          c.createdAt <= query.dateRange!.end
      );
    }

    return clips;
  }

  /**
   * Update a clip
   */
  async updateClip(id: string, updates: Partial<ClipRecord>): Promise<void> {
    const clip = await getClipById(id);
    if (!clip) {
      throw new Error(`Clip not found: ${id}`);
    }

    // Don't allow updating sync metadata directly
    const safeUpdates = { ...updates };
    delete safeUpdates.syncStatus;
    delete safeUpdates.firebaseId;
    delete safeUpdates.version;

    await dbUpdateClip(id, safeUpdates);

    // Get updated clip
    const updatedClip = await getClipById(id);
    if (!updatedClip) return;

    // Mark for sync if already synced
    if (clip.syncStatus === 'synced') {
      await dbUpdateClip(id, { syncStatus: 'pending' });
      await addToSyncQueue({
        clipId: id,
        operation: 'update',
        payload: this.getClipPayloadForSync(updatedClip),
        retryCount: 0,
        createdAt: new Date(),
      });
    }

    this.emit({ type: 'clip-updated', clip: updatedClip });
  }

  /**
   * Delete a clip
   */
  async deleteClip(id: string): Promise<void> {
    const clip = await getClipById(id);
    if (!clip) return;

    // If synced, queue deletion
    if (clip.syncStatus === 'synced' && clip.firebaseId) {
      await addToSyncQueue({
        clipId: id,
        operation: 'delete',
        retryCount: 0,
        createdAt: new Date(),
      });
    }

    await dbDeleteClip(id);
    this.emit({ type: 'clip-deleted', clipId: id });
  }

  /**
   * Add tags to a clip
   */
  async addTags(id: string, tags: string[]): Promise<void> {
    const clip = await getClipById(id);
    if (!clip) return;

    const newTags = [...new Set([...clip.tags, ...tags])];
    await this.updateClip(id, { tags: newTags });
  }

  /**
   * Remove tags from a clip
   */
  async removeTags(id: string, tags: string[]): Promise<void> {
    const clip = await getClipById(id);
    if (!clip) return;

    const newTags = clip.tags.filter((t) => !tags.includes(t));
    await this.updateClip(id, { tags: newTags });
  }

  /**
   * Assign clip to project
   */
  async assignToProject(id: string, projectId: string, roomType?: string): Promise<void> {
    await this.updateClip(id, { projectId, roomType });
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(
    id: string,
    status: ClipRecord['syncStatus'],
    firebaseId?: string,
    error?: string
  ): Promise<void> {
    const updates: Partial<ClipRecord> = { syncStatus: status };
    if (firebaseId) updates.firebaseId = firebaseId;
    if (error) updates.syncError = error;

    await dbUpdateClip(id, updates);
    this.emit({ type: 'sync-status-changed', clipId: id, status });
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<StorageUsage> {
    const stats = await getStorageStats();
    return {
      used: stats.totalSize,
      clips: stats.clipCount,
      averageSize: stats.averageClipSize,
    };
  }

  /**
   * Check storage usage and emit warning if needed
   */
  private async checkStorageUsage(): Promise<void> {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage) {
        const usageRatio = estimate.usage / estimate.quota;
        if (usageRatio > this.storageWarningThreshold) {
          this.emit({
            type: 'storage-warning',
            usage: estimate.usage,
            limit: estimate.quota,
          });
        }
      }
    } catch {
      // Storage API not available
    }
  }

  /**
   * Get clip payload for sync (without blobs)
   */
  private getClipPayloadForSync(clip: ClipRecord): Partial<ClipRecord> {
    const payload = { ...clip };
    delete (payload as Partial<ClipRecord>).imageBlob;
    delete (payload as Partial<ClipRecord>).thumbnailBlob;
    return payload;
  }

  /**
   * Subscribe to clip events
   */
  subscribe(listener: ClipEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: ClipEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Clip event listener error:', error);
      }
    }
  }

  /**
   * Bulk delete clips
   */
  async bulkDelete(ids: string[]): Promise<void> {
    await db.transaction('rw', [db.clips, db.syncQueue], async () => {
      for (const id of ids) {
        await this.deleteClip(id);
      }
    });
  }

  /**
   * Bulk assign to project
   */
  async bulkAssignToProject(ids: string[], projectId: string): Promise<void> {
    await db.transaction('rw', [db.clips, db.syncQueue], async () => {
      for (const id of ids) {
        await this.assignToProject(id, projectId);
      }
    });
  }

  /**
   * Bulk add tags
   */
  async bulkAddTags(ids: string[], tags: string[]): Promise<void> {
    await db.transaction('rw', [db.clips, db.syncQueue], async () => {
      for (const id of ids) {
        await this.addTags(id, tags);
      }
    });
  }
}

export const clipService = new ClipService();
