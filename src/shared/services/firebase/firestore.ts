/**
 * Firestore Service
 * Generic Firestore operations and utilities
 */

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
  type DocumentData,
  type QueryConstraint,
  type DocumentReference,
  type CollectionReference,
  type Unsubscribe
} from 'firebase/firestore';
import { app } from './config';
import { deepStripUndefined } from '@/subsidiaries/advisory/core/firebase/converters';

// Initialize Firestore with persistent IndexedDB cache for faster module loads.
// Data is served from local cache while revalidating in the background.
//
// `ignoreUndefinedProperties: true` matches what the saveDocument/updateDocument
// helpers already do via deepStripUndefined — services that call setDoc/updateDoc
// directly (e.g. payroll-batch) used to fail on optional fields left as
// undefined. Strip them globally instead of patching every call site.
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  ignoreUndefinedProperties: true,
});

/**
 * Get a document reference
 */
export function getDocRef<T = DocumentData>(
  collectionPath: string, 
  docId: string
): DocumentReference<T> {
  return doc(db, collectionPath, docId) as DocumentReference<T>;
}

/**
 * Get a collection reference
 */
export function getCollectionRef<T = DocumentData>(
  collectionPath: string
): CollectionReference<T> {
  return collection(db, collectionPath) as CollectionReference<T>;
}

/**
 * Fetch a single document
 */
export async function fetchDocument<T>(
  collectionPath: string, 
  docId: string
): Promise<T | null> {
  const docRef = getDocRef<T>(collectionPath, docId);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

/**
 * Fetch all documents in a collection
 */
export async function fetchCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const collectionRef = getCollectionRef<T>(collectionPath);
  const q = query(collectionRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

/**
 * Create or update a document
 */
export async function saveDocument<T extends DocumentData>(
  collectionPath: string,
  docId: string,
  data: T
): Promise<void> {
  const docRef = getDocRef(collectionPath, docId);
  await setDoc(docRef, deepStripUndefined(data) as T, { merge: true });
}

/**
 * Update specific fields in a document
 */
export async function updateDocument(
  collectionPath: string,
  docId: string,
  data: Partial<DocumentData>
): Promise<void> {
  const docRef = getDocRef(collectionPath, docId);
  await updateDoc(docRef, deepStripUndefined(data));
}

/**
 * Delete a document
 */
export async function removeDocument(
  collectionPath: string,
  docId: string
): Promise<void> {
  const docRef = getDocRef(collectionPath, docId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to document changes
 */
export function subscribeToDocument<T>(
  collectionPath: string,
  docId: string,
  callback: (data: T | null) => void
): Unsubscribe {
  const docRef = getDocRef<T>(collectionPath, docId);
  return onSnapshot(docRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as T) : null);
  });
}

/**
 * Subscribe to collection changes
 */
export function subscribeToCollection<T>(
  collectionPath: string,
  callback: (data: T[]) => void,
  constraints: QueryConstraint[] = [],
  onError?: (error: Error) => void
): Unsubscribe {
  const collectionRef = getCollectionRef<T>(collectionPath);
  const q = query(collectionRef, ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      callback(data);
    },
    (error) => {
      console.error(`Firestore subscription error on "${collectionPath}":`, error);
      if (onError) {
        onError(error);
      } else {
        callback([]);
      }
    }
  );
}

/**
 * Fetch documents across all subcollections with the same name (collectionGroup query)
 */
export async function fetchCollectionGroup<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const groupRef = collectionGroup(db, collectionName);
  const q = query(groupRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as T));
}

// Re-export commonly used Firestore utilities
export { where, orderBy, limit, type QueryConstraint };
