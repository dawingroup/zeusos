/**
 * Offline-Aware Service Wrapper
 * Firestore operations with automatic offline queueing
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  getDocs,
  QueryConstraint,
  Timestamp,
  getDocFromCache,
  getDocsFromCache,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import syncQueueService from './syncQueueService';

interface OfflineOptions {
  forceCache?: boolean;
  queueIfOffline?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Get a document with offline support
 */
export async function getDocOffline<T extends DocumentData>(
  collectionPath: string,
  documentId: string,
  options: OfflineOptions = {}
): Promise<T | null> {
  const { forceCache = false } = options;
  const docRef = doc(db, collectionPath, documentId);

  try {
    if (forceCache) {
      const snapshot = await getDocFromCache(docRef);
      return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as unknown as T) : null;
    }

    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as unknown as T) : null;
  } catch (error: unknown) {
    const err = error as { code?: string };
    // If offline, try cache
    if (err.code === 'unavailable') {
      try {
        const snapshot = await getDocFromCache(docRef);
        return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as unknown as T) : null;
      } catch {
        return null;
      }
    }
    throw error;
  }
}

/**
 * Query documents with offline support
 */
export async function queryDocsOffline<T extends DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  options: OfflineOptions = {}
): Promise<T[]> {
  const { forceCache = false } = options;
  const collectionRef = collection(db, collectionPath);
  const q = query(collectionRef, ...constraints);

  try {
    if (forceCache) {
      const snapshot = await getDocsFromCache(q);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as unknown as T));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as unknown as T));
  } catch (error: unknown) {
    const err = error as { code?: string };
    // If offline, try cache
    if (err.code === 'unavailable') {
      try {
        const snapshot = await getDocsFromCache(q);
        return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as unknown as T));
      } catch {
        return [];
      }
    }
    throw error;
  }
}

/**
 * Set a document with offline queueing
 */
export async function setDocOffline(
  collectionPath: string,
  documentId: string,
  data: DocumentData,
  options: OfflineOptions = {}
): Promise<void> {
  const { queueIfOffline = true, priority = 'normal' } = options;
  const docRef = doc(db, collectionPath, documentId);

  const dataWithTimestamp = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  try {
    await setDoc(docRef, dataWithTimestamp, { merge: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'unavailable' && queueIfOffline) {
      // Queue for later sync
      syncQueueService.queueOperation(
        'update',
        collectionPath,
        documentId,
        dataWithTimestamp as Record<string, unknown>,
        priority
      );
      // Firestore handles local cache automatically with offline persistence
    } else {
      throw error;
    }
  }
}

/**
 * Create a document with offline queueing
 */
export async function createDocOffline(
  collectionPath: string,
  documentId: string,
  data: DocumentData,
  options: OfflineOptions = {}
): Promise<void> {
  const { queueIfOffline = true, priority = 'normal' } = options;
  const docRef = doc(db, collectionPath, documentId);

  const dataWithTimestamp = {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  try {
    await setDoc(docRef, dataWithTimestamp);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'unavailable' && queueIfOffline) {
      syncQueueService.queueOperation(
        'create',
        collectionPath,
        documentId,
        dataWithTimestamp as Record<string, unknown>,
        priority
      );
    } else {
      throw error;
    }
  }
}

/**
 * Update a document with offline queueing
 */
export async function updateDocOffline(
  collectionPath: string,
  documentId: string,
  data: Partial<DocumentData>,
  options: OfflineOptions = {}
): Promise<void> {
  const { queueIfOffline = true, priority = 'normal' } = options;
  const docRef = doc(db, collectionPath, documentId);

  const dataWithTimestamp = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  try {
    await updateDoc(docRef, dataWithTimestamp);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'unavailable' && queueIfOffline) {
      syncQueueService.queueOperation(
        'update',
        collectionPath,
        documentId,
        dataWithTimestamp as Record<string, unknown>,
        priority
      );
    } else {
      throw error;
    }
  }
}

/**
 * Delete a document with offline queueing
 */
export async function deleteDocOffline(
  collectionPath: string,
  documentId: string,
  options: OfflineOptions = {}
): Promise<void> {
  const { queueIfOffline = true, priority = 'normal' } = options;
  const docRef = doc(db, collectionPath, documentId);

  try {
    await deleteDoc(docRef);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'unavailable' && queueIfOffline) {
      syncQueueService.queueOperation(
        'delete',
        collectionPath,
        documentId,
        undefined,
        priority
      );
    } else {
      throw error;
    }
  }
}

export const offlineAwareService = {
  getDoc: getDocOffline,
  queryDocs: queryDocsOffline,
  setDoc: setDocOffline,
  createDoc: createDocOffline,
  updateDoc: updateDocOffline,
  deleteDoc: deleteDocOffline,
};

export default offlineAwareService;
