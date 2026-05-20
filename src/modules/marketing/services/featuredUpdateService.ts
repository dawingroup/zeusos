/**
 * Featured Update service — Firestore CRUD + subscriptions.
 *
 * Featured updates drive the "Today in the studio" section on
 * dawinfinishes.com. Publish to Shopify `featured_update` metaobjects via
 * functions/src/triggers/featuredUpdateShopifySync.js.
 */

import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  Timestamp, CollectionReference, limit,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { uploadFile } from '@/shared/services/firebase/storage';
import type { FeaturedUpdate, FeaturedUpdateFormData } from '../types';
import { FEATURED_UPDATES_COLLECTION } from '../constants';

const ref = collection(db, FEATURED_UPDATES_COLLECTION) as CollectionReference<Omit<FeaturedUpdate, 'id'>>;

export async function uploadFeaturedImage(file: File, updateId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `featured-updates/${updateId}/image-${Date.now()}.${ext}`;
  const { url } = await uploadFile(path, file);
  return url;
}

export async function createFeaturedUpdate(data: FeaturedUpdateFormData, userId: string): Promise<string> {
  const now = serverTimestamp();
  const created = await addDoc(ref, {
    ...data,
    createdAt: now as unknown as Timestamp,
    createdBy: userId,
    updatedAt: now as unknown as Timestamp,
    updatedBy: userId,
  } as FeaturedUpdate);
  return created.id;
}

export async function getFeaturedUpdate(id: string): Promise<FeaturedUpdate | null> {
  const snap = await getDoc(doc(ref, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as FeaturedUpdate) : null;
}

export async function updateFeaturedUpdate(id: string, data: Partial<FeaturedUpdateFormData>, userId: string): Promise<void> {
  await updateDoc(doc(ref, id), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function deleteFeaturedUpdate(id: string): Promise<void> {
  await deleteDoc(doc(ref, id));
}

export function subscribeToFeaturedUpdates(
  subsidiaryId: string,
  onChange: (rows: FeaturedUpdate[]) => void,
  opts?: { activeOnly?: boolean; maxCount?: number }
): () => void {
  const constraints = [where('subsidiaryId', '==', subsidiaryId)];
  if (opts?.activeOnly) constraints.push(where('published', '==', true));
  const tail: any[] = [orderBy('priority', 'desc'), orderBy('liveFrom', 'desc')];
  if (opts?.maxCount) tail.push(limit(opts.maxCount));
  const q = query(ref, ...constraints, ...tail);
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FeaturedUpdate));
  });
}
