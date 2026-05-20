/**
 * Workshop Viewer Service — Firestore CRUD for viewer sessions
 * Collection: companies/{companyId}/workshop_viewer_sessions
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { uploadFile, getFileUrl, deleteFile } from '@/core/services/firebase/storage';
import type {
  ViewerSession,
  HiddenLineMode,
  PrintPackageProjectInfo,
  PrintPackageConfig,
  PrintPackageHistoryEntry,
} from '../types/workshop-viewer.types';
import type { ManagedDimension, DimensionOverrides } from '../types/dimension.types';

const COLLECTION_NAME = 'workshop_viewer_sessions';

function getCollectionRef() {
  return collection(db, COLLECTION_NAME);
}

// ============================================================================
// P4 — Session scope helpers
// ============================================================================

/**
 * Derive the effective scope of a session.
 *
 * New sessions always write `scope` explicitly. Legacy docs predate the
 * field; we derive it from the link presence so old sessions are classified
 * consistently without a migration.
 *
 * Bound = at least one of `linkedDesignItemId` / `linkedMoId` is set.
 * Standalone = neither is set (quick-review upload).
 */
export function deriveSessionScope(
  session: Pick<ViewerSession, 'scope' | 'linkedDesignItemId' | 'linkedMoId'>,
): 'bound' | 'standalone' {
  if (session.scope) return session.scope;
  return session.linkedDesignItemId || session.linkedMoId ? 'bound' : 'standalone';
}

/**
 * True iff the supplied opts would produce a session linked to at least
 * one of design-item / MO. Pulled out for reuse + testability.
 */
export function hasBoundContext(opts: {
  linkedDesignItemId?: string | null;
  linkedMoId?: string | null;
}): boolean {
  return Boolean(opts.linkedDesignItemId || opts.linkedMoId);
}

/**
 * Save a new **bound** viewer session.
 *
 * P4: requires at least one of `linkedDesignItemId` / `linkedMoId`. If the
 * caller has no context, use {@link createStandaloneSession} instead — that
 * path is intentionally separate so a missing FK fails loud rather than
 * silently producing an orphan session.
 */
export async function createSession(
  data: {
    name: string;
    modelFile: File;
    csvFile?: File;
    projectInfo: PrintPackageProjectInfo;
    hiddenLineMode: HiddenLineMode;
    linkedDesignProjectId?: string;
    linkedDesignItemId?: string;
    linkedMoId?: string;
  },
  userId: string,
): Promise<string> {
  if (!hasBoundContext(data)) {
    throw new Error(
      'createSession: refusing to create a bound workshop session with no linkedDesignItemId and no linkedMoId. ' +
        'Use createStandaloneSession() for quick-review uploads, or supply a DesignItem / MO to bind to.',
    );
  }

  const now = Timestamp.now();

  // Upload model file to Firebase Storage
  const modelPath = `workshop-viewer/${Date.now()}/${data.modelFile.name}`;
  await uploadFile(modelPath, data.modelFile);
  const modelFileUrl = await getFileUrl(modelPath);

  // Upload CSV if provided
  let csvFileUrl: string | undefined;
  if (data.csvFile) {
    const csvPath = `workshop-viewer/${Date.now()}/${data.csvFile.name}`;
    await uploadFile(csvPath, data.csvFile);
    csvFileUrl = await getFileUrl(csvPath);
  }

  const session = {
    name: data.name,
    modelFileUrl,
    csvFileUrl,
    projectInfo: data.projectInfo,
    hiddenLineMode: data.hiddenLineMode,
    linkedDesignProjectId: data.linkedDesignProjectId ?? null,
    linkedDesignItemId: data.linkedDesignItemId ?? null,
    linkedMoId: data.linkedMoId ?? null,
    scope: 'bound' as const,
    status: 'draft' as const,
    subsidiaryId: 'dawin-finishes',
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };

  const docRef = await addDoc(getCollectionRef(), session);
  return docRef.id;
}

/**
 * Save a new **standalone** viewer session — the quick-review scope for
 * users who drop in a model without a DesignItem or MO context.
 *
 * P4 contract: standalone sessions cannot have print packages attached
 * (see {@link attachPrintPackage}) and cannot propagate parts back to
 * design-manager. They exist as a scratch pad. To promote a standalone
 * session to a bound one, call {@link bindSessionToContext}.
 */
export async function createStandaloneSession(
  data: {
    name: string;
    modelFile?: File;
    modelFileUrl?: string;
    csvFile?: File;
    projectInfo?: PrintPackageProjectInfo;
    hiddenLineMode?: HiddenLineMode;
  },
  userId: string,
): Promise<string> {
  const now = Timestamp.now();

  // Model file: either uploaded here or already hosted elsewhere.
  let modelFileUrl = data.modelFileUrl;
  if (data.modelFile) {
    const modelPath = `workshop-viewer/standalone/${Date.now()}/${data.modelFile.name}`;
    await uploadFile(modelPath, data.modelFile);
    modelFileUrl = await getFileUrl(modelPath);
  }

  let csvFileUrl: string | undefined;
  if (data.csvFile) {
    const csvPath = `workshop-viewer/standalone/${Date.now()}/${data.csvFile.name}`;
    await uploadFile(csvPath, data.csvFile);
    csvFileUrl = await getFileUrl(csvPath);
  }

  const session = {
    name: data.name || 'Untitled Session',
    modelFileUrl: modelFileUrl ?? '',
    csvFileUrl: csvFileUrl ?? null,
    projectInfo: data.projectInfo ?? {
      projectName: '',
      client: '',
      address: '',
      projectNo: '',
      drawnBy: '',
      checkedBy: '',
      revision: 'A',
      stage: '',
      date: '',
    },
    hiddenLineMode: data.hiddenLineMode ?? 'faint',
    linkedDesignProjectId: null,
    linkedDesignItemId: null,
    linkedMoId: null,
    scope: 'standalone' as const,
    status: 'draft' as const,
    subsidiaryId: 'dawin-finishes',
    entryMode: 'upload' as const,
    lastAccessedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };

  const docRef = await addDoc(getCollectionRef(), session);
  return docRef.id;
}

/**
 * P4: promote a standalone session to a bound one by attaching it to a
 * DesignItem and/or MO. Fails loud if neither link is supplied.
 *
 * This is the primary recovery path when a user uploads a model without
 * context and later wants their work (dimensions, material swaps,
 * recognized parts) to flow back to design-manager.
 */
export async function bindSessionToContext(
  sessionId: string,
  context: {
    linkedDesignProjectId?: string;
    linkedDesignItemId?: string;
    linkedMoId?: string;
  },
  userId: string,
): Promise<void> {
  if (!hasBoundContext(context)) {
    throw new Error(
      `bindSessionToContext(${sessionId}): must supply linkedDesignItemId and/or linkedMoId — ` +
        'cannot bind a session with no context.',
    );
  }
  const ref = doc(db, COLLECTION_NAME, sessionId);
  await updateDoc(ref, {
    linkedDesignProjectId: context.linkedDesignProjectId ?? null,
    linkedDesignItemId: context.linkedDesignItemId ?? null,
    linkedMoId: context.linkedMoId ?? null,
    scope: 'bound',
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}

/**
 * Load a viewer session by ID.
 */
export async function getSession(sessionId: string): Promise<ViewerSession | null> {
  const docRef = doc(db, COLLECTION_NAME, sessionId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ViewerSession;
}

/**
 * List all viewer sessions.
 */
export async function listSessions(): Promise<ViewerSession[]> {
  const q = query(getCollectionRef(), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ViewerSession));
}

/**
 * Subscribe to session list changes (real-time).
 */
export function subscribeToSessions(
  callback: (sessions: ViewerSession[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(getCollectionRef(), orderBy('updatedAt', 'desc'));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ViewerSession)));
    },
    (err) => onError?.(err),
  );
}

/**
 * Update a viewer session.
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<ViewerSession,
    | 'name'
    | 'projectInfo'
    | 'hiddenLineMode'
    | 'status'
    | 'linkedDesignProjectId'
    | 'linkedDesignItemId'
    | 'linkedMoId'
    | 'lastPrintPackageUrl'
    | 'lastPrintPackageDate'
    | 'printPackageConfig'
    | 'printPackageHistory'
  >>,
  userId: string,
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, sessionId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}

/**
 * Delete a viewer session and its storage files.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  // Delete storage files (best effort)
  try {
    if (session.modelFileUrl) {
      const modelPath = extractStoragePath(session.modelFileUrl);
      if (modelPath) await deleteFile(modelPath);
    }
    if (session.csvFileUrl) {
      const csvPath = extractStoragePath(session.csvFileUrl);
      if (csvPath) await deleteFile(csvPath);
    }
  } catch (err) {
    console.warn('Failed to delete storage files for session:', sessionId, err);
  }

  const docRef = doc(db, COLLECTION_NAME, sessionId);
  await deleteDoc(docRef);
}

/**
 * Upload a generated PDF and link it to the session.
 *
 * When a `config` is supplied (P14), we also persist:
 *   - `printPackageConfig` — the latest config, restored on next dialog open
 *   - `printPackageHistory` — append-only list of previous exports (bounded to
 *     the 20 most recent entries to keep the document small)
 */
export async function attachPrintPackage(
  sessionId: string,
  pdfBlob: Blob,
  fileName: string,
  userId: string,
  config?: PrintPackageConfig,
): Promise<string> {
  // P4 gate: a standalone session (no DesignItem / MO link) cannot have a
  // print package attached — the output would never propagate anywhere
  // and the user would think their export was saved when it's orphaned.
  const existing = await getSession(sessionId);
  if (!existing) {
    throw new Error(`attachPrintPackage: session ${sessionId} not found.`);
  }
  if (deriveSessionScope(existing) === 'standalone') {
    throw new Error(
      `attachPrintPackage: session ${sessionId} is a standalone (quick-review) session — ` +
        'bind it to a DesignItem or MO first via bindSessionToContext() before attaching a print package.',
    );
  }

  const path = `workshop-viewer/${sessionId}/print-packages/${fileName}`;
  await uploadFile(path, pdfBlob);
  const url = await getFileUrl(path);

  const updates: Parameters<typeof updateSession>[1] = {
    lastPrintPackageUrl: url,
    lastPrintPackageDate: Timestamp.now(),
    status: 'issued',
  };

  if (config) {
    updates.printPackageConfig = config;

    // Append to history (bounded, newest first). Reuse the session snapshot
    // we already fetched for the P4 scope gate — avoids a second round trip.
    const prior = existing.printPackageHistory ?? [];
    const entry: PrintPackageHistoryEntry = {
      id: `pp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      config,
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      pdfUrl: url,
      fileName,
    };
    updates.printPackageHistory = [entry, ...prior].slice(0, 20);
  }

  await updateSession(sessionId, updates, userId);

  return url;
}

function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/o\/(.+?)\?/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function saveDimensionState(
  sessionId: string,
  userDimensions: ManagedDimension[],
  dimensionOverrides: DimensionOverrides,
): Promise<void> {
  const ref = doc(db, 'workshop_viewer_sessions', sessionId);
  await updateDoc(ref, {
    userDimensions,
    dimensionOverrides,
    updatedAt: serverTimestamp(),
  });
}

export async function loadDimensionState(
  sessionId: string,
): Promise<{ userDimensions: ManagedDimension[]; dimensionOverrides: DimensionOverrides }> {
  const ref = doc(db, 'workshop_viewer_sessions', sessionId);
  const snap = await getDoc(ref);
  const data = snap.data();
  return {
    userDimensions: data?.userDimensions ?? [],
    dimensionOverrides: data?.dimensionOverrides ?? {},
  };
}

/**
 * Load the persisted material swap overrides for a session. Returns an
 * empty object (not null) when the session has nothing stored — callers
 * pass that through to `useMaterialSwap({ initialOverrides })` to signal
 * "finished loading, map should be empty" vs `undefined` meaning "still
 * loading, leave map alone".
 */
export async function loadMaterialOverrides(
  sessionId: string,
): Promise<Record<string, string>> {
  const ref = doc(db, 'workshop_viewer_sessions', sessionId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const stored = data?.materialSwapOverrides;
  return (stored && typeof stored === 'object') ? stored as Record<string, string> : {};
}

// ============================================================================
// Session Management (UX Enhancement)
// ============================================================================

/**
 * Find an existing **bound** session by linked context, or create a new one.
 *
 * P4: requires at least one of `linkedDesignItemId` / `linkedMoId`. Callers
 * that legitimately have no context (a user dropping a model into the
 * viewer to poke at it) should go through {@link createStandaloneSession}
 * instead — that path is explicitly standalone and documents the trade-off,
 * rather than silently creating an orphan session whose work never
 * propagates back to design-manager.
 */
export async function getOrCreateSession(
  opts: {
    modelFileUrl: string;
    csvFileUrl?: string;
    name?: string;
    linkedDesignProjectId?: string;
    linkedDesignItemId?: string;
    linkedMoId?: string;
    entryMode?: 'upload' | 'project' | 'generate' | 'mo';
  },
  userId: string,
): Promise<string> {
  if (!hasBoundContext(opts)) {
    throw new Error(
      'getOrCreateSession: refusing to create a bound workshop session with no linkedDesignItemId and no linkedMoId. ' +
        'Use createStandaloneSession() for quick-review uploads, or supply a DesignItem / MO to bind to.',
    );
  }

  // Try to find existing session by linked item or MO
  try {
    if (opts.linkedDesignItemId) {
      const q = query(
        getCollectionRef(),
        where('linkedDesignItemId', '==', opts.linkedDesignItemId),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existingId = snap.docs[0].id;
        await updateDoc(doc(db, COLLECTION_NAME, existingId), {
          lastAccessedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return existingId;
      }
    }
    if (opts.linkedMoId) {
      const q = query(
        getCollectionRef(),
        where('linkedMoId', '==', opts.linkedMoId),
        orderBy('updatedAt', 'desc'),
        firestoreLimit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existingId = snap.docs[0].id;
        await updateDoc(doc(db, COLLECTION_NAME, existingId), {
          lastAccessedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return existingId;
      }
    }
  } catch (err) {
    console.warn('[workshopViewerService] Session lookup failed (index may be building), creating new:', err);
  }

  // Create new session — always bound, by virtue of the hasBoundContext guard above.
  const now = Timestamp.now();
  const docRef = await addDoc(getCollectionRef(), {
    name: opts.name || 'Untitled Session',
    modelFileUrl: opts.modelFileUrl,
    csvFileUrl: opts.csvFileUrl ?? null,
    projectInfo: { projectName: '', client: '', address: '', projectNo: '', drawnBy: '', checkedBy: '', revision: 'A', stage: '', date: '' },
    hiddenLineMode: 'faint',
    linkedDesignProjectId: opts.linkedDesignProjectId ?? null,
    linkedDesignItemId: opts.linkedDesignItemId ?? null,
    linkedMoId: opts.linkedMoId ?? null,
    scope: 'bound' as const,
    status: 'draft',
    subsidiaryId: 'dawin-finishes',
    entryMode: opts.entryMode ?? 'upload',
    lastAccessedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  });
  return docRef.id;
}

/**
 * List recent sessions for a user, ordered by last access.
 */
export async function listRecentSessions(
  userId: string,
  maxResults = 5,
): Promise<ViewerSession[]> {
  const q = query(
    getCollectionRef(),
    where('createdBy', '==', userId),
    orderBy('updatedAt', 'desc'),
    firestoreLimit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ViewerSession));
}

/**
 * Save workstream state to a session (material overrides, assemblies, etc.)
 */
export async function updateSessionWorkstreams(
  sessionId: string,
  workstreams: {
    materialSwapOverrides?: Record<string, string>;
    assemblyGroupsData?: unknown[];
    userDimensions?: ManagedDimension[];
    dimensionOverrides?: DimensionOverrides;
    generationResult?: { glbUrl: string; thumbnailUrl?: string; source: string };
  },
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, sessionId);
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (workstreams.materialSwapOverrides !== undefined) updates.materialSwapOverrides = workstreams.materialSwapOverrides;
  if (workstreams.assemblyGroupsData !== undefined) updates.assemblyGroupsData = workstreams.assemblyGroupsData;
  if (workstreams.userDimensions !== undefined) updates.userDimensions = workstreams.userDimensions;
  if (workstreams.dimensionOverrides !== undefined) updates.dimensionOverrides = workstreams.dimensionOverrides;
  if (workstreams.generationResult !== undefined) updates.generationResult = workstreams.generationResult;
  await updateDoc(ref, updates);
}
