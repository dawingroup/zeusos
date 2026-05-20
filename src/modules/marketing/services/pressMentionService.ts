/**
 * Press mention service — Firestore CRUD + subscriptions.
 *
 * Press mentions publish to dawinfinishes.com storefront as Shopify
 * `press_mention` metaobjects via functions/src/triggers/pressMentionShopifySync.js.
 */

import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  Timestamp, CollectionReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { uploadFile } from '@/shared/services/firebase/storage';
import type { PressMention, PressMentionFormData } from '../types';
import { PRESS_MENTIONS_COLLECTION } from '../constants';

const pressRef = collection(db, PRESS_MENTIONS_COLLECTION) as CollectionReference<Omit<PressMention, 'id'>>;

export async function uploadPublicationLogo(file: File, pressId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'svg').toLowerCase();
  const path = `press-mentions/${pressId}/logo-${Date.now()}.${ext}`;
  const { url } = await uploadFile(path, file);
  return url;
}

export async function createPressMention(data: PressMentionFormData, userId: string): Promise<string> {
  const now = serverTimestamp();
  const ref = await addDoc(pressRef, {
    ...data,
    createdAt: now as unknown as Timestamp,
    createdBy: userId,
    updatedAt: now as unknown as Timestamp,
    updatedBy: userId,
  } as PressMention);
  return ref.id;
}

export async function getPressMention(id: string): Promise<PressMention | null> {
  const snap = await getDoc(doc(pressRef, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as PressMention) : null;
}

export async function updatePressMention(id: string, data: Partial<PressMentionFormData>, userId: string): Promise<void> {
  await updateDoc(doc(pressRef, id), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function deletePressMention(id: string): Promise<void> {
  await deleteDoc(doc(pressRef, id));
}

export function subscribeToPressMentions(
  subsidiaryId: string,
  onChange: (rows: PressMention[]) => void,
  filter?: { featured?: boolean }
): () => void {
  const constraints = [where('subsidiaryId', '==', subsidiaryId)];
  if (filter?.featured !== undefined) constraints.push(where('featured', '==', filter.featured));
  const q = query(pressRef, ...constraints, orderBy('datePublished', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PressMention));
  });
}
