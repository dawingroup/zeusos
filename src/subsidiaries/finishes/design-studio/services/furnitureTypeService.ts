/**
 * Furniture Type Service
 *
 * CRUD operations for the `furniture_types` Firestore collection.
 * This is the continuously-updated knowledge base that powers
 * AI part recognition with type-specific context.
 */

import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { FurnitureType, FurnitureTypeContext } from '../types/furniture-type.types';

const COLLECTION = 'furniture_types';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch all active furniture types, sorted by sortOrder */
export async function getFurnitureTypes(): Promise<FurnitureType[]> {
  // Simple query without composite index requirement — sort client-side
  const q = query(collection(db, COLLECTION), where('isActive', '==', true));
  const snap = await getDocs(q);
  const types = snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureType));
  return types.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}

/** Fetch a single furniture type by ID */
export async function getFurnitureType(typeId: string): Promise<FurnitureType | null> {
  const snap = await getDoc(doc(db, COLLECTION, typeId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FurnitureType;
}

/** Real-time subscription to active furniture types */
export function subscribeFurnitureTypes(
  callback: (types: FurnitureType[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLLECTION), where('isActive', '==', true));
  return onSnapshot(q, (snap) => {
    const types = snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureType));
    callback(types.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)));
  }, onError);
}

/** Extract the context subset needed by the Cloud Function */
export function extractTypeContext(type: FurnitureType): FurnitureTypeContext {
  return {
    name: type.name,
    category: type.category,
    expectedParts: type.expectedParts,
    assemblyGroups: type.assemblyGroups,
    namingPatterns: type.namingPatterns,
    constructionMethod: type.constructionMethod,
  };
}

// ---------------------------------------------------------------------------
// Write (admin only)
// ---------------------------------------------------------------------------

/** Create a new furniture type */
export async function createFurnitureType(
  data: Omit<FurnitureType, 'createdAt' | 'updatedAt'>,
  userId: string,
): Promise<void> {
  const ref = doc(db, COLLECTION, data.id);
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  });
}

/** Update an existing furniture type */
export async function updateFurnitureType(
  typeId: string,
  updates: Partial<FurnitureType>,
  userId: string,
): Promise<void> {
  const ref = doc(db, COLLECTION, typeId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/** Soft-delete a furniture type (set isActive: false) */
export async function deactivateFurnitureType(typeId: string): Promise<void> {
  const ref = doc(db, COLLECTION, typeId);
  await updateDoc(ref, { isActive: false, updatedAt: serverTimestamp() });
}
