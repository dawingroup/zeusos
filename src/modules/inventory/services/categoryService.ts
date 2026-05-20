/**
 * Category Service
 * Firestore operations for inventoryCategories collection.
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  where,
  getDocs,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

export interface CategoryDoc {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentSlug: string | null;
  depth: number;
  path: string[];
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  allowItems: boolean;
  expenseOnIssue: boolean;
  defaultClassification?: string;
  itemCount: number;
  qboExpenseAccountId?: string;
  qboExpenseAccountName?: string;
  qboAssetAccountId?: string;
  qboAssetAccountName?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COLLECTION = 'inventoryCategories';

function docToCategory(id: string, data: DocumentData): CategoryDoc {
  return {
    slug: id,
    name: data.name ?? '',
    description: data.description ?? undefined,
    icon: data.icon ?? undefined,
    color: data.color ?? undefined,
    parentSlug: data.parentSlug ?? null,
    depth: data.depth ?? 0,
    path: data.path ?? [id],
    sortOrder: data.sortOrder ?? 0,
    isSystem: data.isSystem ?? false,
    isActive: data.isActive ?? true,
    allowItems: data.allowItems ?? true,
    expenseOnIssue: data.expenseOnIssue ?? false,
    defaultClassification: data.defaultClassification ?? undefined,
    itemCount: data.itemCount ?? 0,
    qboExpenseAccountId: data.qboExpenseAccountId ?? undefined,
    qboExpenseAccountName: data.qboExpenseAccountName ?? undefined,
    qboAssetAccountId: data.qboAssetAccountId ?? undefined,
    qboAssetAccountName: data.qboAssetAccountName ?? undefined,
    createdAt: data.createdAt ?? undefined,
    updatedAt: data.updatedAt ?? undefined,
  };
}

/**
 * Subscribe to all categories (real-time).
 */
export function subscribeToCategories(
  onData: (categories: CategoryDoc[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('sortOrder'));
  return onSnapshot(
    q,
    (snap) => {
      const cats = snap.docs.map((d) => docToCategory(d.id, d.data()));
      onData(cats);
    },
    (err) => onError?.(err),
  );
}

/**
 * Create a new category. Returns the slug.
 */
export async function createCategory(
  data: Omit<CategoryDoc, 'slug' | 'createdAt' | 'updatedAt' | 'itemCount'>,
): Promise<string> {
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const ref = doc(db, COLLECTION, slug);
  const { setDoc } = await import('firebase/firestore');
  // Strip undefined values — Firestore rejects them
  const clean: Record<string, unknown> = {
    itemCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v;
  }
  await setDoc(ref, clean);
  return slug;
}

/**
 * Update an existing category.
 */
export async function updateCategory(
  slug: string,
  data: Partial<CategoryDoc>,
): Promise<void> {
  const ref = doc(db, COLLECTION, slug);
  // Strip undefined values — Firestore rejects them
  const clean: Record<string, unknown> = { updatedAt: Timestamp.now() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v;
  }
  await updateDoc(ref, clean);
}

/**
 * Delete a category (only if not system and itemCount === 0).
 */
export async function deleteCategory(slug: string): Promise<void> {
  const ref = doc(db, COLLECTION, slug);
  await deleteDoc(ref);
}

/**
 * Check if a category has child categories.
 */
export async function hasChildCategories(slug: string): Promise<boolean> {
  const q = query(
    collection(db, COLLECTION),
    where('parentSlug', '==', slug),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}
