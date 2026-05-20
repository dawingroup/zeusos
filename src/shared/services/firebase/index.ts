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
