/**
 * Checklist service — CRUD for pre-production checklist items.
 *
 * Subcollection: production_jobs/{jobId}/checklist_items/{itemId}
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ChecklistItem } from '../types/production-checklist.types';

const JOBS_COLL      = 'production_jobs';
const CHECKLIST_SUBCOLL = 'checklist_items';

export async function addChecklistItem(
  jobId: string,
  input: Omit<ChecklistItem, 'id' | 'jobId' | 'completedAt' | 'completedBy'>,
): Promise<ChecklistItem> {
  const ref = await addDoc(collection(db, JOBS_COLL, jobId, CHECKLIST_SUBCOLL), {
    ...input,
    jobId,
  });
  return { id: ref.id, jobId, ...input };
}

export async function listChecklistItems(jobId: string): Promise<ChecklistItem[]> {
  const snap = await getDocs(
    query(collection(db, JOBS_COLL, jobId, CHECKLIST_SUBCOLL), orderBy('label')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChecklistItem, 'id'>) }));
}

export async function completeChecklistItem(
  jobId: string,
  itemId: string,
  completedBy: string,
): Promise<void> {
  await updateDoc(doc(db, JOBS_COLL, jobId, CHECKLIST_SUBCOLL, itemId), {
    completedAt: serverTimestamp(),
    completedBy,
  });
}

export async function uncompleteChecklistItem(
  jobId: string,
  itemId: string,
): Promise<void> {
  await updateDoc(doc(db, JOBS_COLL, jobId, CHECKLIST_SUBCOLL, itemId), {
    completedAt: null,
    completedBy: null,
  });
}

export async function deleteChecklistItem(jobId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, JOBS_COLL, jobId, CHECKLIST_SUBCOLL, itemId));
}
