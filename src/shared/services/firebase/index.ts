/**
 * Firebase Services
 * Centralized Firebase service exports
 */

// App configuration
export { app } from './config';

// Authentication
export {
  auth,
  googleProvider,
  signInWithGoogle,
  signInWithEmail,
  signOut,
  getGoogleAccessToken,
  onAuthChange,
  type User
} from './auth';

// Firestore
export {
  db,
  getDocRef,
  getCollectionRef,
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument,
  subscribeToDocument,
  subscribeToCollection,
  where,
  orderBy,
  limit,
  type QueryConstraint
} from './firestore';

// Storage
export {
  storage,
  getStorageRef,
  uploadFile,
  uploadBase64,
  getFileUrl,
  deleteFile,
  listFiles
} from './storage';

// Functions
export { functions } from './functions';

// Analytics (Phase 5.F — opt-in via VITE_ANALYTICS_ENABLED + measurement ID)
export {
  initAnalytics,
  logAnalyticsEvent,
  setAnalyticsUserId,
  setAnalyticsUserProperty,
} from './analytics';
