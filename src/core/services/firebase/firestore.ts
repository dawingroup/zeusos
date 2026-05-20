/**
 * Firestore Service
 * Re-exports from shared/services/firebase/firestore to ensure a single
 * Firestore instance with persistent cache is used everywhere.
 */

export {
  db,
  getDocRef,
  getCollectionRef,
  fetchDocument,
  fetchCollection,
  fetchCollectionGroup,
  saveDocument,
  updateDocument,
  removeDocument,
  subscribeToDocument,
  subscribeToCollection,
  where,
  orderBy,
  limit,
} from '@/shared/services/firebase/firestore';

export type { QueryConstraint } from 'firebase/firestore';
