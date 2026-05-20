/**
 * Design Revision Service — CRUD for the designRevisions Firestore collection
 *
 * Manages revision history for 3D models with automatic versioning,
 * diff computation triggers, and file management.
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { db } from '@/firebase/config';
import { app } from '@/shared/services/firebase/config';

const storage = getStorage(app);
import type {
  DesignRevision,
  CreateRevisionInput,
  RevisionFilter,
  RevisionFiles,
} from '../types/designRevision.types';

const COLLECTION = 'designRevisions';

/**
 * Get the next revision number for an MO or project.
 */
async function getNextRevisionNumber(moId?: string, projectId?: string): Promise<number> {
  const constraints = [];
  if (moId) constraints.push(where('moId', '==', moId));
  else if (projectId) constraints.push(where('projectId', '==', projectId));
  else return 1;

  constraints.push(orderBy('revisionNumber', 'desc'), limit(1));

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  if (snap.empty) return 1;
  return (snap.docs[0].data().revisionNumber || 0) + 1;
}

/**
 * Create a new design revision.
 */
export async function createRevision(
  input: CreateRevisionInput,
  userId: string,
): Promise<string> {
  const revisionNumber = await getNextRevisionNumber(input.moId, input.projectId);

  const docRef = await addDoc(collection(db, COLLECTION), {
    moId: input.moId || null,
    projectId: input.projectId || null,
    revisionNumber,
    status: 'draft',
    source: input.source,
    files: input.files,
    materialMapping: input.materialMapping || {},
    editNotes: input.editNotes || null,
    annotations: [],
    diffFromPrevious: null,
    createdBy: userId,
    createdAt: serverTimestamp(),
    editedBy: null,
    editedAt: null,
  });

  return docRef.id;
}

/**
 * Get a single revision by ID.
 */
export async function getRevision(revisionId: string): Promise<DesignRevision | null> {
  const snap = await getDoc(doc(db, COLLECTION, revisionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DesignRevision;
}

/**
 * Update a revision's fields (partial update).
 */
export async function updateRevision(
  revisionId: string,
  updates: Partial<Pick<DesignRevision, 'status' | 'editNotes' | 'materialMapping' | 'annotations'>>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, revisionId), updates);
}

/**
 * List revisions with optional filters, ordered by revision number descending.
 */
export async function listRevisions(
  filter: RevisionFilter,
  maxResults = 20,
): Promise<DesignRevision[]> {
  const constraints = [];
  if (filter.moId) constraints.push(where('moId', '==', filter.moId));
  if (filter.projectId) constraints.push(where('projectId', '==', filter.projectId));
  if (filter.status) constraints.push(where('status', '==', filter.status));
  if (filter.source) constraints.push(where('source', '==', filter.source));
  constraints.push(orderBy('revisionNumber', 'desc'), limit(maxResults));

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DesignRevision));
}

/**
 * Get the latest revision for an MO.
 */
export async function getLatestForMO(moId: string): Promise<DesignRevision | null> {
  const revisions = await listRevisions({ moId }, 1);
  return revisions[0] || null;
}

/**
 * Subscribe to revisions for an MO or project (real-time).
 */
export function subscribeToRevisions(
  filter: { moId?: string; projectId?: string },
  callback: (revisions: DesignRevision[]) => void,
): Unsubscribe {
  const constraints = [];
  if (filter.moId) constraints.push(where('moId', '==', filter.moId));
  if (filter.projectId) constraints.push(where('projectId', '==', filter.projectId));
  constraints.push(orderBy('revisionNumber', 'desc'));

  const q = query(collection(db, COLLECTION), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DesignRevision)));
  });
}

/**
 * Upload a revised model file and create a new revision (N+1).
 * Used when a designer returns a STEP/X_T file from Shapr3D.
 */
export async function uploadRevisedModel(
  file: File,
  sourceRevisionId: string,
  userId: string,
  editNotes?: string,
): Promise<string> {
  const sourceRevision = await getRevision(sourceRevisionId);
  if (!sourceRevision) throw new Error('Source revision not found');

  // Upload file to Firebase Storage
  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'step';
  const storagePath = `workshop-viewer/revisions/${userId}/${timestamp}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  // Determine file type and build revision files
  const files: RevisionFiles = {
    glbUrl: sourceRevision.files.glbUrl, // will be regenerated by Cloud Function trigger
  };
  if (ext === 'step' || ext === 'stp') {
    files.stepUrl = fileUrl;
  } else if (ext === 'x_t' || ext === 'x_b') {
    files.xtUrl = fileUrl;
  }

  // Create new revision
  return createRevision(
    {
      moId: sourceRevision.moId,
      projectId: sourceRevision.projectId,
      source: 'external_edit',
      files,
      materialMapping: sourceRevision.materialMapping,
      editNotes,
    },
    userId,
  );
}

/**
 * Upload a new model file + create a revision in one call. Designed
 * for the "Upload updated model" flow on CabinetDetailPanel — the
 * user picks a file, we stamp the project's next revision number,
 * and hand the caller a revisionId they can feed straight into
 * `previewRevisionApply` / the RevisionDiffModal.
 *
 * Accepts:
 *   - .glb — ready for preview immediately.
 *   - .step / .stp / .x_t / .x_b — revision created with the CAD URL
 *     only; `isGlbReady` returns false so the UI can wait for the
 *     server-side CAD→GLB regeneration before offering a preview.
 *
 * Returns { revisionId, isGlbReady } so the caller can decide:
 *   isGlbReady === true  → open RevisionDiffModal straight away.
 *   isGlbReady === false → show a "waiting for GLB conversion" toast
 *                          and let the user apply later via the
 *                          existing Apply-revision button.
 */
export async function uploadRevisionFromFile(
  file: File,
  opts: {
    projectId?: string;
    moId?: string;
    userId: string;
    sourceRevisionId?: string;
    editNotes?: string;
  },
): Promise<{ revisionId: string; isPreviewReady: boolean; revisionNumber: number }> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const SUPPORTED = ['glb', '3ds', 'step', 'stp', 'x_t', 'x_b'];
  if (!SUPPORTED.includes(ext)) {
    throw new Error(
      `Unsupported file type "${ext}". Accepted: .3ds, .glb, .step, .stp, .x_t, .x_b.`,
    );
  }

  // Preserve context from the source revision if the caller pointed to
  // one — matches the Shapr3D round-trip semantics in uploadRevisedModel.
  let sourceRevision: DesignRevision | null = null;
  if (opts.sourceRevisionId) {
    sourceRevision = await getRevision(opts.sourceRevisionId);
  }

  const timestamp = Date.now();
  const storagePath = `workshop-viewer/revisions/${opts.userId}/${timestamp}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);

  // Client-parseable formats are ready for preview immediately; CAD
  // formats need the server-side regeneration Cloud Function first.
  const isClientParseable = ext === 'glb' || ext === '3ds';
  const files: RevisionFiles = {
    // `glbUrl` is typed as required on RevisionFiles. For non-GLB
    // uploads, carry the source revision's GLB forward so readers that
    // only know about glbUrl (legacy viewers) still have something to
    // point at. When there's no source and the file isn't a GLB, the
    // empty string is a cue for the apply flow's "no parseable model"
    // gate.
    glbUrl: ext === 'glb' ? fileUrl : (sourceRevision?.files.glbUrl ?? ''),
  };
  if (ext === '3ds')                       files.threeDsUrl = fileUrl;
  else if (ext === 'step' || ext === 'stp') files.stepUrl = fileUrl;
  else if (ext === 'x_t' || ext === 'x_b')  files.xtUrl = fileUrl;

  const revisionId = await createRevision(
    {
      moId: opts.moId ?? sourceRevision?.moId,
      projectId: opts.projectId ?? sourceRevision?.projectId,
      source: isClientParseable ? 'manual_upload' : 'external_edit',
      files,
      materialMapping: sourceRevision?.materialMapping,
      editNotes: opts.editNotes,
    },
    opts.userId,
  );

  // Read back the just-created revision for its revisionNumber (the
  // call above doesn't return it; we need it for the UX message).
  const justCreated = await getRevision(revisionId);

  return {
    revisionId,
    isPreviewReady: isClientParseable,
    revisionNumber: justCreated?.revisionNumber ?? 0,
  };
}

/**
 * Mark a revision for Shapr3D export (sets status to 'editing').
 */
export async function exportForShapr3D(revisionId: string): Promise<string | null> {
  const revision = await getRevision(revisionId);
  if (!revision) return null;

  await updateRevision(revisionId, { status: 'editing' });

  // Return the best format for Shapr3D: Parasolid X_T preferred, STEP as fallback
  return revision.files.xtUrl || revision.files.stepUrl || null;
}
