/**
 * useMediaLibrary Hook
 * React hook for media library operations with state management
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  MediaAsset,
  MediaFolder,
  MediaUploadRequest,
  MediaUploadProgress,
  MediaFilters,
  MediaSort,
  MediaAssetType,
} from '../types';
import {
  getMediaAssets,
  getMediaFolders,
  uploadMediaAsset,
  uploadMediaAssets,
  updateMediaAsset,
  deleteMediaAsset,
  createMediaFolder,
  renameMediaFolder,
  deleteMediaFolder,
  getStorageStats,
} from '../services/mediaLibraryService';

interface UseMediaLibraryReturn {
  // Data
  assets: MediaAsset[];
  folders: MediaFolder[];
  loading: boolean;
  error: Error | null;

  // Upload
  uploading: boolean;
  uploadProgress: MediaUploadProgress[];
  uploadAsset: (request: MediaUploadRequest) => Promise<MediaAsset | null>;
  uploadAssets: (requests: MediaUploadRequest[]) => Promise<MediaAsset[]>;

  // CRUD
  updateAsset: (assetId: string, updates: Partial<Pick<MediaAsset, 'name' | 'description' | 'tags' | 'category' | 'folderId' | 'status'>>) => Promise<void>;
  removeAsset: (assetId: string) => Promise<void>;

  // Folders
  addFolder: (name: string, parentId?: string, color?: string) => Promise<MediaFolder | null>;
  editFolderName: (folderId: string, name: string) => Promise<void>;
  removeFolder: (folderId: string) => Promise<void>;

  // Filters
  filters: MediaFilters;
  setFilters: (filters: MediaFilters) => void;
  sort: MediaSort;
  setSort: (sort: MediaSort) => void;

  // Stats
  stats: { totalAssets: number; totalSize: number; byType: Record<MediaAssetType, { count: number; size: number }> } | null;
  loadStats: () => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useMediaLibrary(companyId?: string): UseMediaLibraryReturn {
  const { user } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<MediaUploadProgress[]>([]);
  const [filters, setFilters] = useState<MediaFilters>({});
  const [sort, setSort] = useState<MediaSort>({ field: 'createdAt', order: 'desc' });
  const [stats, setStats] = useState<UseMediaLibraryReturn['stats']>(null);

  const effectiveCompanyId = companyId || user?.companyId;

  // Load assets and folders
  const loadData = useCallback(async () => {
    if (!effectiveCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      const [assetResults, folderResults] = await Promise.all([
        getMediaAssets(effectiveCompanyId, filters, sort),
        getMediaFolders(effectiveCompanyId),
      ]);
      setAssets(assetResults);
      setFolders(folderResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load media library'));
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, filters, sort]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Upload single asset
  const uploadAssetFn = useCallback(async (request: MediaUploadRequest): Promise<MediaAsset | null> => {
    if (!effectiveCompanyId || !user) return null;

    setUploading(true);
    try {
      const asset = await uploadMediaAsset(
        effectiveCompanyId,
        request,
        user.uid,
        user.displayName || 'Unknown',
        (progress) => setUploadProgress([progress])
      );
      await loadData();
      return asset;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Upload failed'));
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress([]), 3000);
    }
  }, [effectiveCompanyId, user, loadData]);

  // Upload multiple assets
  const uploadAssetsFn = useCallback(async (requests: MediaUploadRequest[]): Promise<MediaAsset[]> => {
    if (!effectiveCompanyId || !user) return [];

    setUploading(true);
    try {
      const results = await uploadMediaAssets(
        effectiveCompanyId,
        requests,
        user.uid,
        user.displayName || 'Unknown',
        (progress) => setUploadProgress(progress)
      );
      await loadData();
      return results;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Batch upload failed'));
      return [];
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress([]), 3000);
    }
  }, [effectiveCompanyId, user, loadData]);

  // Update asset
  const updateAssetFn = useCallback(async (
    assetId: string,
    updates: Partial<Pick<MediaAsset, 'name' | 'description' | 'tags' | 'category' | 'folderId' | 'status'>>
  ) => {
    await updateMediaAsset(assetId, updates);
    await loadData();
  }, [loadData]);

  // Delete asset
  const removeAssetFn = useCallback(async (assetId: string) => {
    await deleteMediaAsset(assetId);
    await loadData();
  }, [loadData]);

  // Create folder
  const addFolderFn = useCallback(async (name: string, parentId?: string, color?: string): Promise<MediaFolder | null> => {
    if (!effectiveCompanyId || !user) return null;
    const folder = await createMediaFolder(effectiveCompanyId, name, parentId, color, user.uid);
    await loadData();
    return folder;
  }, [effectiveCompanyId, user, loadData]);

  // Rename folder
  const editFolderNameFn = useCallback(async (folderId: string, name: string) => {
    await renameMediaFolder(folderId, name);
    await loadData();
  }, [loadData]);

  // Delete folder
  const removeFolderFn = useCallback(async (folderId: string) => {
    if (!effectiveCompanyId) return;
    await deleteMediaFolder(folderId, effectiveCompanyId);
    await loadData();
  }, [effectiveCompanyId, loadData]);

  // Load stats
  const loadStatsFn = useCallback(async () => {
    if (!effectiveCompanyId) return;
    const result = await getStorageStats(effectiveCompanyId);
    setStats(result);
  }, [effectiveCompanyId]);

  return {
    assets,
    folders,
    loading,
    error,
    uploading,
    uploadProgress,
    uploadAsset: uploadAssetFn,
    uploadAssets: uploadAssetsFn,
    updateAsset: updateAssetFn,
    removeAsset: removeAssetFn,
    addFolder: addFolderFn,
    editFolderName: editFolderNameFn,
    removeFolder: removeFolderFn,
    filters,
    setFilters,
    sort,
    setSort,
    stats,
    loadStats: loadStatsFn,
    refresh: loadData,
  };
}
