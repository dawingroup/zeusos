/**
 * Asset Library module — Phase 4 P1.
 *
 * Owns: asset_library_items (+ versions / usages subcollections),
 *       asset_library_collections.
 *
 * Storage uploads are stubbed; Phase 5 wires the Cloud Storage path.
 * This module is staff-wide — no commercial-actor gate.
 */

export type {
  AssetItem,
  AssetCategory,
  AssetStatus,
  AssetFileType,
} from './types/asset-item.types';
export type { AssetVersion } from './types/asset-version.types';
export type { AssetUsage, AssetUsageSubjectType } from './types/asset-usage.types';
export type { AssetCollection } from './types/asset-collection.types';

export {
  createAsset,
  getAsset,
  listAssets,
  updateAsset,
  archiveAsset,
  recordAssetUsage,
  listAssetUsages,
  removeAssetUsage,
} from './services/asset-item.service';

export {
  addVersion,
  listVersions,
  rollbackToVersion,
} from './services/asset-version.service';

export {
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
  deleteCollection,
  addItemToCollection,
  removeItemFromCollection,
} from './services/asset-collection.service';

export { AssetCategoryBadge } from './components/AssetCategoryBadge';
export { AssetCard } from './components/AssetCard';
export { AssetGrid } from './components/AssetGrid';
export { AssetSearchBar } from './components/AssetSearchBar';
export { AssetVersionList } from './components/AssetVersionList';
export { AssetUsageList } from './components/AssetUsageList';
export { AssetUploadForm } from './components/AssetUploadForm';

export { default as AssetLibraryListPage } from './pages/AssetLibraryListPage';
export { default as AssetDetailPage } from './pages/AssetDetailPage';
export { default as AssetUploadPage } from './pages/AssetUploadPage';
export { default as CollectionsPage } from './pages/CollectionsPage';
export { default as CollectionDetailPage } from './pages/CollectionDetailPage';
