/**
 * Voice (testimonial) service — Firestore CRUD + subscriptions.
 *
 * Voices publish to the dawinfinishes.com storefront as Shopify `voice`
 * metaobjects via a Firestore-trigger publisher in
 * functions/src/triggers/voiceShopifySync.js.
 */

import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  Timestamp, CollectionReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { uploadFile } from '@/shared/services/firebase/storage';
import type { Voice, VoiceFormData } from '../types';
import { VOICES_COLLECTION } from '../constants';

const voicesRef = collection(db, VOICES_COLLECTION) as CollectionReference<Omit<Voice, 'id'>>;

export async function uploadVoiceLogo(file: File, voiceId: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `voices/${voiceId}/logo-${Date.now()}.${ext}`;
  const { url } = await uploadFile(path, file);
  return url;
}

export async function createVoice(data: VoiceFormData, userId: string): Promise<string> {
  if (!data.consentGiven) throw new Error('Consent must be granted to publish a voice');
  const now = serverTimestamp();
  const ref = await addDoc(voicesRef, {
    ...data,
    createdAt: now as unknown as Timestamp,
    createdBy: userId,
    updatedAt: now as unknown as Timestamp,
    updatedBy: userId,
  } as Voice);
  return ref.id;
}

export async function getVoice(id: string): Promise<Voice | null> {
  const snap = await getDoc(doc(voicesRef, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Voice) : null;
}

export async function updateVoice(id: string, data: Partial<VoiceFormData>, userId: string): Promise<void> {
  await updateDoc(doc(voicesRef, id), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function deleteVoice(id: string): Promise<void> {
  await deleteDoc(doc(voicesRef, id));
}

export function subscribeToVoices(
  subsidiaryId: string,
  onChange: (voices: Voice[]) => void,
  filter?: { featured?: boolean }
): () => void {
  const constraints = [where('subsidiaryId', '==', subsidiaryId)];
  if (filter?.featured !== undefined) constraints.push(where('featured', '==', filter.featured));
  const q = query(voicesRef, ...constraints, orderBy('quoteDate', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Voice));
  });
}
