/**
 * Unified File Manager — public API
 */

export type {
  ManagedFile,
  FileUploadContext,
  FileQueryFilters,
  FileUploadProgress,
  FileCategory,
  FileModule,
} from './types';

export {
  FILE_SIZE_LIMITS,
  CATEGORY_LABELS,
  CAD_MODEL_EXTENSIONS,
  formatFileSize,
  getFileIconType,
  isCadModelFileName,
  getCategoryFromFileName,
} from './types';

export {
  uploadManagedFile,
  replaceFile,
  overwriteFile,
  updateFileStatus,
  togglePortalSharing,
  deleteManagedFile,
  deleteManagedFiles,
  getProjectFiles,
  subscribeToProjectFiles,
  getFileVersions,
  downloadFilesAsZip,
  validateFile,
} from './fileManagerService';

// Phase 3b — pure derivation helpers
export {
  summariseRevisions,
  formatRelativeDate,
  type ItemRevisionSummary,
} from './revisionSummary';
