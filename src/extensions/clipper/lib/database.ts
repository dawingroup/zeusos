/**
 * IndexedDB Database Layer using Dexie.js
 * CRITICAL: Never index Blob/ArrayBuffer fields
 */

import Dexie, { Table } from 'dexie';
import type { ClipRecord, SyncQueueItem, ProjectCache, SettingsRecord } from '../types/database';

export class ClipperDatabase extends Dexie {
  clips!: Table<ClipRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  projects!: Table<ProjectCache, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('DawinClipper');

    this.version(1).stores({
      // CRITICAL: imageBlob and thumbnailBlob are NOT indexed (omitted from schema)
      clips: 'id, sourceUrl, projectId, syncStatus, createdAt, lastModified, *tags',
      syncQueue: 'id, clipId, operation, createdAt, lastAttempt',
      projects: 'id, name, lastSynced',
      settings: 'key',
    });
  }
}

export const db = new ClipperDatabase();

// Helper functions for clips
export async function getClipById(id: string): Promise<ClipRecord | undefined> {
  return db.clips.get(id);
}

export async function saveClip(clip: ClipRecord): Promise<string> {
  return db.clips.put(clip);
}

export async function updateClip(
  id: string,
  updates: Partial<ClipRecord>
): Promise<number> {
  return db.clips.update(id, {
    ...updates,
    lastModified: new Date(),
    version: ((await db.clips.get(id))?.version ?? 0) + 1,
  });
}

export async function deleteClip(id: string): Promise<void> {
  await db.transaction('rw', [db.clips, db.syncQueue], async () => {
    await db.clips.delete(id);
    // Also remove any pending sync operations for this clip
    await db.syncQueue.where('clipId').equals(id).delete();
  });
}

export async function getClipsByProject(projectId: string): Promise<ClipRecord[]> {
  return db.clips.where('projectId').equals(projectId).toArray();
}

export async function getClipsBySyncStatus(
  status: ClipRecord['syncStatus']
): Promise<ClipRecord[]> {
  return db.clips.where('syncStatus').equals(status).toArray();
}

export async function getAllClips(): Promise<ClipRecord[]> {
  return db.clips.orderBy('createdAt').reverse().toArray();
}

export async function searchClips(query: string): Promise<ClipRecord[]> {
  const lowerQuery = query.toLowerCase();
  return db.clips
    .filter(
      (clip) =>
        clip.title.toLowerCase().includes(lowerQuery) ||
        clip.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        (clip.brand?.toLowerCase().includes(lowerQuery) ?? false)
    )
    .toArray();
}

// Sync queue helpers
export async function getPendingSync(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('createdAt').toArray();
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.syncQueue.add({ ...item, id });
  return id;
}

export async function updateSyncQueueItem(
  id: string,
  updates: Partial<SyncQueueItem>
): Promise<void> {
  await db.syncQueue.update(id, updates);
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

export async function getSyncQueueItemsByClipId(clipId: string): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('clipId').equals(clipId).toArray();
}

// Project cache helpers
export async function getProjects(): Promise<ProjectCache[]> {
  return db.projects.orderBy('name').toArray();
}

export async function getProjectById(id: string): Promise<ProjectCache | undefined> {
  return db.projects.get(id);
}

export async function saveProject(project: ProjectCache): Promise<string> {
  return db.projects.put(project);
}

export async function saveProjects(projects: ProjectCache[]): Promise<void> {
  await db.projects.bulkPut(projects);
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

// Settings helpers
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const record = await db.settings.get(key);
  return record ? (record.value as T) : defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

// Storage usage
export interface StorageStats {
  clipCount: number;
  totalSize: number;
  averageClipSize: number;
  pendingSyncCount: number;
}

export async function getStorageStats(): Promise<StorageStats> {
  const clips = await db.clips.toArray();
  const pendingSyncCount = await db.syncQueue.count();

  let totalSize = 0;
  for (const clip of clips) {
    if (clip.imageBlob) totalSize += clip.imageBlob.size;
    if (clip.thumbnailBlob) totalSize += clip.thumbnailBlob.size;
  }

  return {
    clipCount: clips.length,
    totalSize,
    averageClipSize: clips.length > 0 ? totalSize / clips.length : 0,
    pendingSyncCount,
  };
}

// Cleanup utilities
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.clips, db.syncQueue, db.projects, db.settings], async () => {
    await db.clips.clear();
    await db.syncQueue.clear();
    await db.projects.clear();
    await db.settings.clear();
  });
}

export async function clearOldClips(daysOld: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  return db.clips
    .where('createdAt')
    .below(cutoff)
    .filter((clip) => clip.syncStatus === 'synced')
    .delete();
}

// Generate unique clip ID
export function generateClipId(): string {
  return `clip_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}
