/**
 * Library exports
 */

// Database
export { db, ClipperDatabase } from './database';
export {
  getClipById,
  saveClip,
  updateClip,
  deleteClip,
  getAllClips,
  getClipsByProject,
  getClipsBySyncStatus,
  searchClips,
  getPendingSync,
  addToSyncQueue,
  getProjects,
  getProjectById,
  saveProject,
  saveProjects,
  getStorageStats,
  clearAllData,
  generateClipId,
} from './database';

// Settings (renamed to avoid conflict)
export {
  getSettings,
  getSetting as getSettingValue,
  updateSettings,
  resetSettings,
  onSettingsChanged,
  DEFAULT_SETTINGS,
  type ClipperSettings,
} from './settings';

// Services
export { imageCaptureService, ImageCaptureService } from './image-capture';
export { clipService } from './clip-service';
export { sessionManager } from './session-manager';
export { syncService, type SyncStatus, type SyncResult } from './sync-service';
export { aiService } from './ai-service';

// Platform utilities
export { detectPlatform, isSafari, isIOS, getBrowserAPI, getPlatformCapabilities } from './platform';
