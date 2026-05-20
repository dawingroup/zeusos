/**
 * SyncService - Handles bidirectional sync between IndexedDB and Firebase
 * NOTE: Uses chrome.alarms instead of setInterval for service worker compatibility.
 */

import type { ClipRecord, SyncQueueItem } from '../types/database';
import {
  getDb,
  getStorageInstance,
  getCurrentUser,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  db as localDb,
  getPendingSync,
  updateClip,
  getClipById,
  saveClip,
} from './database';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export interface ConflictResolution {
  strategy: 'local-wins' | 'remote-wins' | 'merge' | 'manual';
  mergeFields?: string[];
}

const SYNC_ALARM_NAME = 'dawin-clipper-auto-sync';

class SyncService {
  private isSyncing = false;
  private autoSyncActive = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private retryDelays = [1000, 5000, 15000, 60000]; // Exponential backoff

  /**
   * Start automatic sync using chrome.alarms (service worker compatible)
   */
  startAutoSync(intervalMinutes: number = 0.5): void {
    if (this.autoSyncActive) return;

    this.autoSyncActive = true;

    // Use chrome.alarms for service worker compatibility
    chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: intervalMinutes });

    chrome.alarms.onAlarm.addListener((alarm: any) => {
      if (alarm.name === SYNC_ALARM_NAME) {
        this.sync();
      }
    });

    // Initial sync
    this.sync();
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.autoSyncActive) {
      chrome.alarms.clear(SYNC_ALARM_NAME);
      this.autoSyncActive = false;
    }
  }

  /**
   * Perform sync operation
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
    }

    const user = getCurrentUser();
    if (!user) {
      return { success: false, synced: 0, failed: 0, errors: ['Not authenticated'] };
    }

    this.isSyncing = true;
    this.notifyListeners({ status: 'syncing', progress: 0 });

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Get pending sync items
      const pendingItems = await getPendingSync();
      const total = pendingItems.length;

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i];

        try {
          await this.processSyncItem(item, user.uid);
          result.synced++;

          // Remove from sync queue
          await localDb.syncQueue.delete(item.id!);
        } catch (error) {
          result.failed++;
          result.errors.push(`${item.clipId}: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // Update retry count
          await this.handleSyncFailure(item);
        }

        this.notifyListeners({
          status: 'syncing',
          progress: Math.round(((i + 1) / total) * 100)
        });
      }

      // Pull remote changes
      await this.pullRemoteChanges(user.uid);

      result.success = result.failed === 0;
      this.notifyListeners({ status: result.success ? 'synced' : 'error', progress: 100 });
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Sync failed');
      this.notifyListeners({ status: 'error', progress: 0 });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Process a single sync item
   * Note: Uses flat 'designClips' collection with createdBy field for user filtering
   */
  private async processSyncItem(item: SyncQueueItem, userId: string): Promise<void> {
    const db = getDb();
    const storage = getStorageInstance();
    const clipRef = doc(db, 'designClips', item.clipId);

    switch (item.operation) {
      case 'create':
      case 'update': {
        const clip = await getClipById(item.clipId);
        if (!clip) throw new Error('Clip not found locally');

        // Upload image to Storage if exists
        let imageUrl = clip.imageUrl;
        let thumbnailUrl = '';

        if (clip.imageBlob) {
          const imagePath = `users/${userId}/clips/${clip.id}/image.jpg`;
          const imageRef = ref(storage, imagePath);
          await uploadBytes(imageRef, clip.imageBlob);
          imageUrl = await getDownloadURL(imageRef);
        }

        if (clip.thumbnailBlob) {
          const thumbPath = `users/${userId}/clips/${clip.id}/thumbnail.jpg`;
          const thumbRef = ref(storage, thumbPath);
          await uploadBytes(thumbRef, clip.thumbnailBlob);
          thumbnailUrl = await getDownloadURL(thumbRef);
        }

        // Prepare Firestore document (without blobs)
        // Include createdBy for user-based filtering in web app
        const firestoreDoc = {
          sourceUrl: clip.sourceUrl,
          imageUrl,
          thumbnailUrl,
          title: clip.title,
          description: clip.description || null,
          price: clip.price || null,
          dimensions: clip.dimensions || null,
          materials: clip.materials || [],
          colors: clip.colors || [],
          brand: clip.brand || null,
          sku: clip.sku || null,
          tags: clip.tags || [],
          projectId: clip.projectId || null,
          designItemId: clip.designItemId || null,
          roomType: clip.roomType || null,
          notes: clip.notes || null,
          aiAnalysis: clip.aiAnalysis || null,
          syncStatus: 'synced',
          createdBy: userId,
          version: (clip.version || 0) + 1,
          createdAt: clip.createdAt ? Timestamp.fromDate(clip.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(clipRef, firestoreDoc, { merge: item.operation === 'update' });

        // Update local record with Firebase ID and sync status
        await updateClip(clip.id, {
          firebaseId: clipRef.id,
          syncStatus: 'synced',
          syncError: undefined,
          version: firestoreDoc.version,
        });
        break;
      }

      case 'delete': {
        // Delete from Storage
        const deleteStorage = getStorageInstance();
        try {
          await deleteObject(ref(deleteStorage, `users/${userId}/clips/${item.clipId}/image.jpg`));
          await deleteObject(ref(deleteStorage, `users/${userId}/clips/${item.clipId}/thumbnail.jpg`));
        } catch {
          // Ignore storage deletion errors
        }

        // Delete from Firestore
        await deleteDoc(clipRef);
        break;
      }
    }
  }

  /**
   * Handle sync failure with retry logic
   */
  private async handleSyncFailure(item: SyncQueueItem): Promise<void> {
    const newRetryCount = (item.retryCount || 0) + 1;

    if (newRetryCount >= this.retryDelays.length) {
      // Max retries exceeded - mark clip as failed
      if (item.clipId) {
        await updateClip(item.clipId, {
          syncStatus: 'error',
          syncError: 'Max retries exceeded',
        });
      }
      await localDb.syncQueue.delete(item.id!);
    } else {
      // Update retry count and schedule retry
      await localDb.syncQueue.update(item.id!, {
        retryCount: newRetryCount,
        lastAttempt: new Date(),
      });
    }
  }

  /**
   * Pull remote changes from Firebase
   * Uses flat 'designClips' collection filtered by createdBy
   */
  private async pullRemoteChanges(userId: string): Promise<void> {
    const db = getDb();
    const clipsRef = collection(db, 'designClips');

    // Get last sync timestamp from settings
    const lastSync = await this.getLastSyncTime();

    // Filter by createdBy to get only this user's clips
    let q = query(clipsRef, where('createdBy', '==', userId), orderBy('updatedAt', 'desc'));
    if (lastSync) {
      q = query(clipsRef, where('createdBy', '==', userId), where('updatedAt', '>', Timestamp.fromDate(lastSync)), orderBy('updatedAt', 'desc'));
    }

    const snapshot = await getDocs(q);

    for (const docSnap of snapshot.docs) {
      const remoteClip = docSnap.data();
      const localClip = await getClipById(docSnap.id);

      if (!localClip) {
        // New clip from remote - create locally
        await this.createLocalFromRemote(docSnap.id, remoteClip, userId);
      } else if (this.shouldUpdateLocal(localClip, remoteClip)) {
        // Remote is newer - update local
        await this.updateLocalFromRemote(localClip, remoteClip);
      }
    }

    // Update last sync time
    await this.setLastSyncTime(new Date());
  }

  /**
   * Create local clip from remote data
   */
  private async createLocalFromRemote(
    firebaseId: string,
    remoteData: Record<string, unknown>,
    _userId: string
  ): Promise<void> {
    const clip: Partial<ClipRecord> & { id: string } = {
      id: firebaseId,
      firebaseId,
      sourceUrl: remoteData.sourceUrl as string,
      imageUrl: remoteData.imageUrl as string,
      title: remoteData.title as string,
      description: remoteData.description as string | undefined,
      price: remoteData.price as ClipRecord['price'],
      dimensions: remoteData.dimensions as ClipRecord['dimensions'],
      materials: (remoteData.materials as string[]) || [],
      colors: (remoteData.colors as string[]) || [],
      brand: remoteData.brand as string | undefined,
      sku: remoteData.sku as string | undefined,
      tags: (remoteData.tags as string[]) || [],
      projectId: remoteData.projectId as string | undefined,
      roomType: remoteData.roomType as string | undefined,
      notes: remoteData.notes as string | undefined,
      aiAnalysis: remoteData.aiAnalysis as ClipRecord['aiAnalysis'],
      syncStatus: 'synced',
      version: remoteData.version as number || 1,
      lastModified: (remoteData.updatedAt as Timestamp)?.toDate() || new Date(),
      createdAt: (remoteData.createdAt as Timestamp)?.toDate() || new Date(),
    };

    await saveClip(clip as ClipRecord);
  }

  /**
   * Update local clip from remote data
   */
  private async updateLocalFromRemote(
    localClip: ClipRecord,
    remoteData: Record<string, unknown>
  ): Promise<void> {
    await updateClip(localClip.id, {
      title: remoteData.title as string,
      description: remoteData.description as string | undefined,
      price: remoteData.price as ClipRecord['price'],
      dimensions: remoteData.dimensions as ClipRecord['dimensions'],
      materials: (remoteData.materials as string[]) || [],
      colors: (remoteData.colors as string[]) || [],
      tags: (remoteData.tags as string[]) || [],
      projectId: remoteData.projectId as string | undefined,
      notes: remoteData.notes as string | undefined,
      aiAnalysis: remoteData.aiAnalysis as ClipRecord['aiAnalysis'],
      syncStatus: 'synced',
      version: remoteData.version as number || 1,
    });
  }

  /**
   * Check if local should be updated from remote
   */
  private shouldUpdateLocal(local: ClipRecord, remote: Record<string, unknown>): boolean {
    const remoteVersion = remote.version as number || 0;
    const localVersion = local.version || 0;
    return remoteVersion > localVersion;
  }

  /**
   * Get last sync time from storage
   */
  private async getLastSyncTime(): Promise<Date | null> {
    const result = await chrome.storage.local.get(['lastSyncTime']);
    return result.lastSyncTime ? new Date(result.lastSyncTime) : null;
  }

  /**
   * Set last sync time
   */
  private async setLastSyncTime(time: Date): Promise<void> {
    await chrome.storage.local.set({ lastSyncTime: time.toISOString() });
  }

  /**
   * Subscribe to sync status updates
   */
  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify listeners of status change
   */
  private notifyListeners(status: SyncStatus): void {
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    }
  }

  /**
   * Force sync a specific clip
   */
  async syncClip(clipId: string): Promise<boolean> {
    const user = getCurrentUser();
    if (!user) return false;

    const clip = await getClipById(clipId);
    if (!clip) return false;

    try {
      await this.processSyncItem(
        { id: `sync_${Date.now()}`, clipId, operation: clip.firebaseId ? 'update' : 'create', retryCount: 0, createdAt: new Date() },
        user.uid
      );
      return true;
    } catch (error) {
      console.error('Failed to sync clip:', error);
      return false;
    }
  }
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  progress: number;
  error?: string;
}

export const syncService = new SyncService();
