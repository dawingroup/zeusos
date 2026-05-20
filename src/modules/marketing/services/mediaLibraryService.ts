/**
 * Media Library Service
 * Firebase Storage + Firestore backed media asset management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  uploadFile,
  deleteFile,
} from '@/core/services/firebase/storage';
import type {
  MediaAsset,
  MediaFolder,
  MediaUploadRequest,
  MediaUploadProgress,
  MediaFilters,
  MediaAssetType,
  MediaSort,
} from '../types';
import {
  MEDIA_COLLECTION,
  MEDIA_FOLDERS_COLLECTION,
  MAX_FILE_SIZE,
} from '../types/media-library.types';

// ============================================
// Helper Functions
// ============================================

function detectAssetType(mimeType: string): MediaAssetType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation')
  ) {
    return 'document';
  }
  return 'other';
}

function generateStoragePath(companyId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `marketing/${companyId}/media/${timestamp}_${sanitizedName}`;
}

// ============================================
// Media Asset CRUD
// ============================================

/**
 * Upload a media asset to Firebase Storage and create Firestore record
 */
export async function uploadMediaAsset(
  companyId: string,
  request: MediaUploadRequest,
  userId: string,
  userName: string,
  onProgress?: (progress: MediaUploadProgress) => void
): Promise<MediaAsset> {
  const { file, name, description, folderId, tags, category } = request;

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  const displayName = name || file.name;
  const storagePath = generateStoragePath(companyId, file.name);
  const assetType = detectAssetType(file.type);

  // Report upload start
  onProgress?.({
    fileName: displayName,
    progress: 0,
    status: 'uploading',
  });

  try {
    // Upload to Firebase Storage
    const { url } = await uploadFile(storagePath, file, file.type);

    onProgress?.({
      fileName: displayName,
      progress: 80,
      status: 'processing',
    });

    // Get image dimensions if applicable
    let dimensions: { width: number; height: number } | undefined;
    if (assetType === 'image') {
      dimensions = await getImageDimensions(file);
    }

    // Create Firestore record
    const assetData = {
      companyId,
      name: displayName,
      originalFileName: file.name,
      description: description || '',
      storagePath,
      downloadUrl: url,
      thumbnailUrl: assetType === 'image' ? url : undefined,
      assetType,
      mimeType: file.type,
      fileSize: file.size,
      dimensions,
      folderId: folderId || null,
      tags: tags || [],
      category: category || null,
      status: 'ready' as const,
      usageCount: 0,
      usedInCampaigns: [],
      usedInPosts: [],
      createdBy: userId,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, MEDIA_COLLECTION), assetData);

    const asset: MediaAsset = {
      id: docRef.id,
      ...assetData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    } as MediaAsset;

    onProgress?.({
      fileName: displayName,
      progress: 100,
      status: 'complete',
      asset,
    });

    return asset;
  } catch (error) {
    onProgress?.({
      fileName: displayName,
      progress: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Upload failed',
    });
    throw error;
  }
}

/**
 * Get image dimensions from a File
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Batch upload multiple media assets
 */
export async function uploadMediaAssets(
  companyId: string,
  requests: MediaUploadRequest[],
  userId: string,
  userName: string,
  onProgress?: (progress: MediaUploadProgress[]) => void
): Promise<MediaAsset[]> {
  const progresses: MediaUploadProgress[] = requests.map((r) => ({
    fileName: r.name || r.file.name,
    progress: 0,
    status: 'pending' as const,
  }));

  const results: MediaAsset[] = [];

  for (let i = 0; i < requests.length; i++) {
    try {
      const asset = await uploadMediaAsset(
        companyId,
        requests[i],
        userId,
        userName,
        (p) => {
          progresses[i] = p;
          onProgress?.([...progresses]);
        }
      );
      results.push(asset);
    } catch (error) {
      progresses[i] = {
        fileName: requests[i].name || requests[i].file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
      };
      onProgress?.([...progresses]);
    }
  }

  return results;
}

/**
 * Get a single media asset by ID
 */
export async function getMediaAsset(assetId: string): Promise<MediaAsset | null> {
  const docSnap = await getDoc(doc(db, MEDIA_COLLECTION, assetId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as MediaAsset;
}

/**
 * Get media assets with filters
 */
export async function getMediaAssets(
  companyId: string,
  filters?: MediaFilters,
  sort?: MediaSort,
  maxResults = 50
): Promise<MediaAsset[]> {
  const constraints: any[] = [where('companyId', '==', companyId)];

  if (filters?.assetType) {
    constraints.push(where('assetType', '==', filters.assetType));
  }
  if (filters?.folderId) {
    constraints.push(where('folderId', '==', filters.folderId));
  }
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters?.tags && filters.tags.length > 0) {
    constraints.push(where('tags', 'array-contains-any', filters.tags));
  }

  // Sort
  const sortField = sort?.field || 'createdAt';
  const sortOrder = sort?.order || 'desc';
  constraints.push(orderBy(sortField, sortOrder));
  constraints.push(limit(maxResults));

  const q = query(collection(db, MEDIA_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  let assets = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaAsset));

  // Client-side search filter (Firestore doesn't support text search)
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    assets = assets.filter(
      (a) =>
        a.name.toLowerCase().includes(searchLower) ||
        a.originalFileName.toLowerCase().includes(searchLower) ||
        a.description?.toLowerCase().includes(searchLower) ||
        a.tags.some((t) => t.toLowerCase().includes(searchLower))
    );
  }

  return assets;
}

/**
 * Update a media asset's metadata
 */
export async function updateMediaAsset(
  assetId: string,
  updates: Partial<Pick<MediaAsset, 'name' | 'description' | 'tags' | 'category' | 'folderId' | 'status'>>
): Promise<void> {
  await updateDoc(doc(db, MEDIA_COLLECTION, assetId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a media asset (storage + Firestore)
 */
export async function deleteMediaAsset(assetId: string): Promise<void> {
  const asset = await getMediaAsset(assetId);
  if (!asset) throw new Error('Asset not found');

  // Delete from storage
  try {
    await deleteFile(asset.storagePath);
  } catch (error) {
    console.warn('Failed to delete storage file, continuing with Firestore cleanup:', error);
  }

  // Delete Firestore record
  await deleteDoc(doc(db, MEDIA_COLLECTION, assetId));
}

/**
 * Record usage of a media asset in a campaign or post
 */
export async function recordMediaUsage(
  assetId: string,
  usage: { campaignId?: string; postId?: string }
): Promise<void> {
  const asset = await getMediaAsset(assetId);
  if (!asset) return;

  const updates: any = {
    usageCount: asset.usageCount + 1,
    lastUsedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (usage.campaignId && !asset.usedInCampaigns.includes(usage.campaignId)) {
    updates.usedInCampaigns = [...asset.usedInCampaigns, usage.campaignId];
  }
  if (usage.postId && !asset.usedInPosts.includes(usage.postId)) {
    updates.usedInPosts = [...asset.usedInPosts, usage.postId];
  }

  await updateDoc(doc(db, MEDIA_COLLECTION, assetId), updates);
}

// ============================================
// Folder CRUD
// ============================================

/**
 * Create a media folder
 */
export async function createMediaFolder(
  companyId: string,
  name: string,
  parentId?: string,
  color?: string,
  userId?: string
): Promise<MediaFolder> {
  const folderData = {
    companyId,
    name,
    parentId: parentId || null,
    color: color || null,
    assetCount: 0,
    createdBy: userId || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, MEDIA_FOLDERS_COLLECTION), folderData);
  return {
    id: docRef.id,
    ...folderData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } as MediaFolder;
}

/**
 * Get all media folders for a company
 */
export async function getMediaFolders(companyId: string): Promise<MediaFolder[]> {
  const q = query(
    collection(db, MEDIA_FOLDERS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('name', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaFolder));
}

/**
 * Rename a media folder
 */
export async function renameMediaFolder(folderId: string, name: string): Promise<void> {
  await updateDoc(doc(db, MEDIA_FOLDERS_COLLECTION, folderId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a media folder (does not delete contained assets, moves them to root)
 */
export async function deleteMediaFolder(folderId: string, companyId: string): Promise<void> {
  // Move assets in this folder to root
  const assets = await getMediaAssets(companyId, { folderId });
  for (const asset of assets) {
    await updateMediaAsset(asset.id, { folderId: undefined });
  }

  await deleteDoc(doc(db, MEDIA_FOLDERS_COLLECTION, folderId));
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(companyId: string): Promise<{
  totalAssets: number;
  totalSize: number;
  byType: Record<MediaAssetType, { count: number; size: number }>;
}> {
  const assets = await getMediaAssets(companyId, undefined, undefined, 1000);

  const byType: Record<MediaAssetType, { count: number; size: number }> = {
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    document: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  };

  let totalSize = 0;

  for (const asset of assets) {
    totalSize += asset.fileSize;
    byType[asset.assetType].count++;
    byType[asset.assetType].size += asset.fileSize;
  }

  return {
    totalAssets: assets.length,
    totalSize,
    byType,
  };
}
