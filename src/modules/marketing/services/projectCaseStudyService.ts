/**
 * Project Case Study Service
 * Firestore CRUD for curated project write-ups that get published to Shopify.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  CollectionReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { uploadFile } from '@/shared/services/firebase/storage';
import type {
  ProjectCaseStudy,
  ProjectCaseStudyFormData,
  CaseStudyFilters,
  CaseStudyStatus,
} from '../types';
import { PROJECT_CASE_STUDIES_COLLECTION } from '../constants';

const caseStudiesRef = collection(
  db,
  PROJECT_CASE_STUDIES_COLLECTION
) as CollectionReference<ProjectCaseStudy>;

/**
 * Upload a case study image to Firebase Storage and return its public URL.
 *
 * Path: `case-studies/<id-or-session>/<kind>-<timestamp>-<rand>.<ext>`
 *
 * For new case studies that don't have an id yet, pass `sessionId` (a
 * stable per-form UUID) so all uploads from the same editing session
 * collect under one folder. Once the case study is saved, future uploads
 * use the real id.
 */
export async function uploadCaseStudyImage(params: {
  file: File;
  kind: 'hero' | 'gallery';
  caseStudyId?: string;
  sessionId?: string;
}): Promise<string> {
  const { file, kind, caseStudyId, sessionId } = params;
  if (!caseStudyId && !sessionId) {
    throw new Error('uploadCaseStudyImage: caseStudyId or sessionId required');
  }
  const folder = caseStudyId || `pending-${sessionId}`;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const path = `case-studies/${folder}/${filename}`;
  const { url } = await uploadFile(path, file);
  return url;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function createCaseStudy(
  subsidiaryId: string,
  data: ProjectCaseStudyFormData,
  userId: string,
  userName: string
): Promise<string> {
  const handle = data.handle || slugify(data.hero.title);

  const payload: Omit<ProjectCaseStudy, 'id'> = {
    ...data,
    subsidiaryId,
    handle,
    authorId: data.authorId || userId,
    authorName: data.authorName || userName,
    createdAt: serverTimestamp() as Timestamp,
    createdBy: userId,
    updatedAt: serverTimestamp() as Timestamp,
    updatedBy: userId,
  };

  const docRef = await addDoc(caseStudiesRef, payload as ProjectCaseStudy);
  return docRef.id;
}

export async function getCaseStudy(id: string): Promise<ProjectCaseStudy | null> {
  const snap = await getDoc(doc(db, PROJECT_CASE_STUDIES_COLLECTION, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ProjectCaseStudy) : null;
}

export async function getCaseStudies(
  subsidiaryId: string,
  filters: CaseStudyFilters = {}
): Promise<ProjectCaseStudy[]> {
  const constraints: any[] = [where('subsidiaryId', '==', subsidiaryId)];

  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.category) constraints.push(where('category', '==', filters.category));
  if (filters.authorId) constraints.push(where('authorId', '==', filters.authorId));

  constraints.push(orderBy('updatedAt', 'desc'));

  const snapshot = await getDocs(query(caseStudiesRef, ...constraints));
  let items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as ProjectCaseStudy));

  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter(
      (cs) =>
        cs.hero.title.toLowerCase().includes(q) ||
        (cs.hero.client || '').toLowerCase().includes(q) ||
        (cs.hero.location || '').toLowerCase().includes(q) ||
        cs.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return items;
}

export function subscribeCaseStudies(
  subsidiaryId: string,
  callback: (items: ProjectCaseStudy[]) => void
): () => void {
  const q = query(
    caseStudiesRef,
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as ProjectCaseStudy)))
  );
}

export async function updateCaseStudy(
  id: string,
  updates: Partial<ProjectCaseStudyFormData>,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, PROJECT_CASE_STUDIES_COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function setCaseStudyStatus(
  id: string,
  status: CaseStudyStatus,
  userId: string,
  userName?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };
  if (status === 'approved') {
    update.approverId = userId;
    update.approverName = userName || userId;
    update.approvedAt = serverTimestamp();
  }
  await updateDoc(doc(db, PROJECT_CASE_STUDIES_COLLECTION, id), update);
}

export async function deleteCaseStudy(id: string): Promise<void> {
  await deleteDoc(doc(db, PROJECT_CASE_STUDIES_COLLECTION, id));
}

/**
 * Publish (or unpublish) a case study to Shopify.
 *
 * Calls the `shopifyPublishCaseStudy` Cloud Function, which upserts an article
 * in the "projects" blog using the `article.project` theme template and writes
 * the structured fields as article metafields under the `project` namespace.
 *
 * On success the case study doc is updated server-side with shopifyArticleId,
 * shopifyPageHandle, shopifyPageUrl, lastPublishedAt, publishedBy. When
 * `publish=true` (default) the case study status is also set to 'published'.
 *
 * Setup prerequisites: see docs/integrations/shopify-case-study-publish.md.
 */
export interface PublishCaseStudyResult {
  articleId: string;
  handle: string;
  url: string;
  isUpdate: boolean;
}

export async function publishCaseStudyToShopify(
  id: string,
  publish: boolean = true
): Promise<PublishCaseStudyResult> {
  const { httpsCallable, getFunctions } = await import('firebase/functions');
  const fn = httpsCallable<
    { caseStudyId: string; publish: boolean },
    PublishCaseStudyResult
  >(getFunctions(undefined, 'us-central1'), 'shopifyPublishCaseStudy');
  const result = await fn({ caseStudyId: id, publish });
  return result.data;
}
