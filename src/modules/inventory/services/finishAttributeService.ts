/**
 * Finish Attribute Service
 * CRUD operations for the finishAttributeDefinitions collection.
 * Manages the registry of attribute schemas per material category.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Timestamp } from 'firebase/firestore';
import type { AttributeDefinition } from '../types';
import type { FinishCategory } from '../types';
import { ALL_ATTRIBUTE_SEEDS } from '../types/finishAttributes';

const COLLECTION_NAME = 'finishAttributeDefinitions';
const attrRef = collection(db, COLLECTION_NAME);

/**
 * Strip undefined values before Firestore writes.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        result[key] = stripUndefined(value as Record<string, unknown>);
        continue;
      }
    }
    result[key] = value;
  }
  return result as T;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new attribute definition.
 */
export async function createAttributeDefinition(
  data: Omit<AttributeDefinition, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const docData = stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });
  const docRef = await addDoc(attrRef, docData);
  return docRef.id;
}

/**
 * Update an existing attribute definition.
 * ⚠️ The `key` field is IMMUTABLE — it is stripped from updates.
 */
export async function updateAttributeDefinition(
  defId: string,
  updates: Partial<AttributeDefinition>,
  userId: string
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, defId);
  const docData = stripUndefined({
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  // Prevent key mutation
  delete (docData as Record<string, unknown>).id;
  delete (docData as Record<string, unknown>).key;
  delete (docData as Record<string, unknown>).createdAt;
  delete (docData as Record<string, unknown>).createdBy;
  await updateDoc(ref, docData);
}

/**
 * Get a single attribute definition by ID.
 */
export async function getAttributeDefinition(defId: string): Promise<AttributeDefinition | null> {
  const ref = doc(db, COLLECTION_NAME, defId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AttributeDefinition;
}

/**
 * Get attribute definitions for a category, ordered by sortOrder.
 */
export async function getAttributeDefinitions(
  organizationId: string,
  category?: FinishCategory
): Promise<AttributeDefinition[]> {
  const constraints = [
    where('organizationId', '==', organizationId),
    orderBy('sortOrder'),
  ];

  if (category) {
    constraints.splice(1, 0, where('category', 'array-contains', category));
  }

  const q = query(attrRef, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttributeDefinition));
}

/**
 * Subscribe to attribute definitions (real-time).
 */
export function subscribeToAttributeDefinitions(
  organizationId: string,
  callback: (defs: AttributeDefinition[]) => void,
  category?: FinishCategory
): Unsubscribe {
  const constraints = [
    where('organizationId', '==', organizationId),
    orderBy('sortOrder'),
  ];

  if (category) {
    constraints.splice(1, 0, where('category', 'array-contains', category));
  }

  const q = query(attrRef, ...constraints);
  return onSnapshot(q, (snap) => {
    const defs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttributeDefinition));
    callback(defs);
  });
}

/**
 * Seed default attribute definitions. Idempotent — checks by key before creating.
 * Call once per organization to populate standard board/paint/tile attributes.
 */
export async function seedDefaultAttributes(
  organizationId: string,
  userId: string
): Promise<{ created: number; skipped: number }> {
  // Fetch existing definitions for this org
  const existing = await getAttributeDefinitions(organizationId);
  const existingKeys = new Set(existing.map(d => d.key));

  let created = 0;
  let skipped = 0;

  for (const seed of ALL_ATTRIBUTE_SEEDS) {
    if (existingKeys.has(seed.key)) {
      skipped++;
      continue;
    }

    await createAttributeDefinition(
      { ...seed, organizationId } as Omit<AttributeDefinition, 'id' | 'createdAt' | 'updatedAt'>,
      userId
    );
    created++;
  }

  return { created, skipped };
}
