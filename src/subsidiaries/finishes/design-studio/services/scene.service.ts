/**
 * Scene Service — CRUD and scene-specific operations for multi-cabinet projects
 *
 * Manages DesignScene documents and their SceneCabinet subcollections.
 * Coordinates with the constraint engine (validation), MDP generator (GLB/BOM),
 * and Design Manager estimation engine (pricing) when adding cabinets.
 */
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  deleteField,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, listAll, deleteObject, getStorage, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/firebase/config';
import { app } from '@/shared/services/firebase/config';
import type {
  DesignScene,
  SceneCabinet,
  CabinetPosition,
  GroundPlane,
  CameraState,
} from '../types/scene.types';
import { StaleRevisionError } from '../types/cabinetGroup.types';
import type { CreateSceneInput, AddCabinetInput } from '../schemas/scene.schemas';
import { GROUND_PLANE_SIZE_MM, GROUND_PLANE_GRID_MM } from '../constants/scene.constants';
import { isProjectBoundCabinet, isStandaloneProjectId } from '../utils/sceneProjectUtils';

const SCENES_COLLECTION = 'designScenes';
const CABINETS_SUBCOLLECTION = 'cabinets';

/**
 * P10 — trigger the DesignItem cost aggregator for one or more DesignItems
 * after a cabinet-mutating scene operation. Best-effort: a rollup failure
 * never aborts the user's action, we just log it (same posture as
 * `updateDesignItem`'s MO auto-sync).
 *
 * Dynamic import avoids the `scene.service ↔ designItemCostAggregator`
 * circular dependency (the aggregator uses `getCabinetsForDesignItem`
 * from this module).
 *
 * No-ops when:
 *   - `projectId` is missing or refers to a standalone scene (standalone
 *     cabinets have no DesignItem FK; nothing to roll up).
 *   - `designItemIds` is empty or contains only falsy values.
 */
async function triggerDesignItemRollup(
  projectId: string | undefined,
  ...designItemIds: Array<string | undefined | null>
): Promise<void> {
  if (isStandaloneProjectId(projectId)) return;
  const ids = designItemIds.filter((id): id is string => !!id);
  if (ids.length === 0) return;
  try {
    const { recomputeDesignItemRollups } = await import(
      './designItemCostAggregator'
    );
    await recomputeDesignItemRollups(projectId as string, ids);
  } catch (err) {
    console.warn('[scene.service] DesignItem rollup trigger failed:', err);
  }
}

// ── Default values ──

const DEFAULT_GROUND_PLANE: GroundPlane = {
  width: GROUND_PLANE_SIZE_MM,
  depth: GROUND_PLANE_SIZE_MM,
  showGrid: true,
  gridSize: GROUND_PLANE_GRID_MM,
  showWalls: false,
};

const DEFAULT_CAMERA_STATE: CameraState = {
  position: { x: 3000, y: 2000, z: 3000 },
  target: { x: 0, y: 0, z: 0 },
  fov: 50,
  zoom: 1,
};

const DEFAULT_POSITION: CabinetPosition = {
  x: 0,
  y: 0,
  z: 0,
  anchoredTo: 'floor',
};

// ── Scene CRUD ──

/**
 * Create a new design scene.
 */
export async function createScene(input: CreateSceneInput): Promise<string> {
  // P21.1 — scenes must be project-backed at creation. The legacy
  // `projectId: 'standalone'` escape hatch created by the old SceneBrowser
  // "New Scene" dialog is the root cause of F2 (cabinets orphaned from
  // DesignItems) — it bypasses the DesignItem FK requirement in
  // `addCabinetToScene` because standalone scenes are exempt. Reject the
  // sentinel here so the UI can't silently opt out. Existing standalone
  // scenes are left alone; they remain readable/editable until operators
  // rebind them via the migration tool.
  if (isStandaloneProjectId(input.projectId)) {
    throw new Error(
      'Scene must be attached to a Design Manager project. ' +
        'Pick a project in the create dialog (or bind an existing scene ' +
        'via the rebind flow).',
    );
  }

  const sceneData = {
    name: input.name,
    projectId: input.projectId,
    customerId: input.customerId,
    description: input.description ?? '',
    groundPlane: DEFAULT_GROUND_PLANE,
    cameraState: DEFAULT_CAMERA_STATE,
    status: input.status ?? 'draft',
    totalCabinetCount: 0,
    totalEstimatedValue: 0,
    currency: 'UGX',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: '', // Set by auth context in caller
  };

  const docRef = await addDoc(collection(db, SCENES_COLLECTION), sceneData);
  return docRef.id;
}

/**
 * Get a scene by ID.
 * If includeFullCabinets, hydrates the cabinets subcollection.
 */
export async function getScene(
  sceneId: string,
  includeFullCabinets = false,
): Promise<DesignScene | null> {
  const docRef = doc(db, SCENES_COLLECTION, sceneId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  let cabinets: SceneCabinet[] = [];

  if (includeFullCabinets) {
    cabinets = await getSceneCabinets(sceneId);
  }

  return {
    id: snapshot.id,
    ...data,
    cabinets,
  } as DesignScene;
}

/**
 * Update a scene's metadata.
 */
export async function updateScene(
  sceneId: string,
  updates: Partial<Pick<
    DesignScene,
    'name' | 'description' | 'status' | 'groundPlane' | 'cameraState'
    | 'materialOverrides'
    // projectId + customerId are included so standalone scenes can bind
    // to a real Design Manager project via `SceneContextCard`. Downstream
    // rollup queries key off `projectId` so the moment this write lands,
    // production / PDF / DesignItem flows start working for the scene.
    | 'projectId' | 'customerId'
  >>,
): Promise<void> {
  const docRef = doc(db, SCENES_COLLECTION, sceneId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Archive a scene (soft-delete).
 */
export async function archiveScene(sceneId: string): Promise<void> {
  await updateScene(sceneId, { status: 'archived' });
}

/**
 * Hard-delete a scene — removes:
 *   - All cabinets in the `cabinets` subcollection (and their `modelPackage`
 *     subcollections, including archived versions)
 *   - The scene document itself
 *   - All Storage objects under `scenes/{sceneId}/**`
 *
 * Unlike `archiveScene`, this cannot be undone.
 */
export async function deleteScene(sceneId: string): Promise<void> {
  // 1. Delete per-cabinet modelPackage subcollections (current + archived versions)
  const cabinetsCol = collection(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION);
  const cabinetsSnap = await getDocs(cabinetsCol);

  for (const cabDoc of cabinetsSnap.docs) {
    const cabId = cabDoc.id;
    // Archived versions under modelPackage/current/versions
    const versionsCol = collection(
      db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabId,
      'modelPackage', 'current', 'versions',
    );
    const versionsSnap = await getDocs(versionsCol);
    if (!versionsSnap.empty) {
      const vBatch = writeBatch(db);
      versionsSnap.docs.forEach(v => vBatch.delete(v.ref));
      await vBatch.commit();
    }
    // The current modelPackage doc itself
    await deleteDoc(doc(
      db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabId,
      'modelPackage', 'current',
    )).catch(() => { /* ignore — not every cabinet has one */ });
  }

  // 2. Delete all cabinet docs in one batch (Firestore caps at 500 ops / batch)
  if (!cabinetsSnap.empty) {
    const chunks: typeof cabinetsSnap.docs[] = [];
    for (let i = 0; i < cabinetsSnap.docs.length; i += 400) {
      chunks.push(cabinetsSnap.docs.slice(i, i + 400));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // 3. Delete the scene document
  await deleteDoc(doc(db, SCENES_COLLECTION, sceneId));

  // 4. Best-effort Storage cleanup — everything under scenes/{sceneId}/**
  try {
    const storage = getStorage(app);
    const prefix = storageRef(storage, `scenes/${sceneId}`);
    await deleteFolderRecursive(prefix);
  } catch (err) {
    // Storage failures shouldn't block deletion — Firestore truth is already gone.
    console.warn(`[deleteScene] Storage cleanup failed for scenes/${sceneId}:`, err);
  }
}

/**
 * Recursively delete every object under a Storage prefix.
 */
async function deleteFolderRecursive(folderRef: ReturnType<typeof storageRef>): Promise<void> {
  const listing = await listAll(folderRef);
  await Promise.all([
    ...listing.items.map(item => deleteObject(item).catch(() => { /* swallow individual failures */ })),
    ...listing.prefixes.map(sub => deleteFolderRecursive(sub)),
  ]);
}

/**
 * List all scenes for a project.
 */
export async function getScenesForProject(projectId: string): Promise<DesignScene[]> {
  const q = query(
    collection(db, SCENES_COLLECTION),
    where('projectId', '==', projectId),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data(), cabinets: [] }) as unknown as DesignScene);
}

/**
 * List all active scenes (for scene browser).
 */
export async function listActiveScenes(): Promise<DesignScene[]> {
  const q = query(
    collection(db, SCENES_COLLECTION),
    where('status', 'in', ['draft', 'active']),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data(), cabinets: [] }) as unknown as DesignScene);
}

// ── Cabinet operations ──

/**
 * Get all cabinets for a scene, ordered by sequence.
 */
export async function getSceneCabinets(sceneId: string): Promise<SceneCabinet[]> {
  const q = query(
    collection(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION),
    orderBy('sequence', 'asc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data() as Partial<SceneCabinet>;
    return {
      id: d.id,
      ...data,
      // Assemblies are stored on the cabinet doc itself (written by
      // `saveCabinetAssemblies`). Preserve whatever's there — the older
      // "loaded on demand" stub forced `[]` and silently starved every
      // caller that needs parts (Design Manager parts sync, BOM rollup,
      // cut-list generation). Default to [] only when truly absent.
      assemblies: data.assemblies ?? [],
    } as SceneCabinet;
  });
}

/**
 * Add a cabinet to a scene.
 * Validates configuration, generates BOM and pricing via constraint engine.
 *
 * P2 (Slice 6): when the parent scene is project-backed, `designItemId` is
 * required. Mirrors the Firestore rule — surfacing the check client-side
 * gives a friendlier error than the generic permission denial and stops
 * well-formed writes that would otherwise round-trip before failing.
 */
export async function addCabinetToScene(
  sceneId: string,
  input: AddCabinetInput,
): Promise<string> {
  // Load the parent scene so we can decide whether the DesignItem FK is
  // required for this write.
  const sceneRef = doc(db, SCENES_COLLECTION, sceneId);
  const sceneSnap = await getDoc(sceneRef);
  if (!sceneSnap.exists()) throw new Error(`Scene ${sceneId} not found`);
  const sceneData = sceneSnap.data();
  const isStandalone = isStandaloneProjectId(sceneData?.projectId);
  if (!isStandalone && !input.designItemId) {
    throw new Error(
      'addCabinetToScene: designItemId is required for cabinets in a project-backed scene. ' +
        'Pass an existing DesignItem id, or create one first.',
    );
  }

  // Get current cabinet count for sequence
  const existingCabinets = await getSceneCabinets(sceneId);
  const sequence = existingCabinets.length;

  // Verify cabinet code is unique within scene
  const codeExists = existingCabinets.some(c => c.cabinetCode === input.cabinetCode);
  if (codeExists) {
    throw new Error(`Cabinet code "${input.cabinetCode}" already exists in this scene`);
  }

  const cabinetData: Record<string, unknown> = {
    sceneId,
    pddId: input.pddId,
    cabinetCode: input.cabinetCode,
    displayName: input.displayName,
    configuration: input.configuration,
    finishSelections: input.finishSelections,
    position: input.position ?? DEFAULT_POSITION,
    rotation: input.rotation ?? 0,
    anchorPoint: 'bottom_back_left',
    // When a source model is provided (AI detection path) we reuse it as the
    // cabinet's glbUrl — the viewport will filter to sourceMeshNames at render
    // time. Generated/per-cabinet GLBs can still override this later.
    glbUrl: input.sourceModelUrl ?? '',
    thumbnailUrl: '',
    assemblies: [],
    computedBOM: [],
    estimatedPrice: {},
    isLocked: false,
    notes: input.notes ?? '',
    sequence,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.sourceModelUrl) cabinetData.sourceModelUrl = input.sourceModelUrl;
  if (input.sourceMeshNames && input.sourceMeshNames.length > 0) {
    cabinetData.sourceMeshNames = input.sourceMeshNames;
  }

  // P2 (Slice 2): persist the FK when present. Field stays optional until
  // slice 6 flips it to required + rule-enforced.
  if (input.designItemId) {
    cabinetData.designItemId = input.designItemId;
  }

  const cabRef = await addDoc(
    collection(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION),
    cabinetData,
  );

  // Update scene totals and maintain the denormalized DesignItem cache.
  const sceneUpdates: Record<string, unknown> = {
    totalCabinetCount: sequence + 1,
    updatedAt: serverTimestamp(),
  };
  if (input.designItemId) {
    sceneUpdates.linkedDesignItemIds = arrayUnion(input.designItemId);
  }
  await updateDoc(doc(db, SCENES_COLLECTION, sceneId), sceneUpdates);

  // P10: roll the new cabinet's cost into its DesignItem.
  await triggerDesignItemRollup(sceneData?.projectId as string | undefined, input.designItemId);

  return cabRef.id;
}

/**
 * Duplicate a cabinet with a new code and optional position.
 * Increments the letter suffix: KB600-A → KB600-B.
 */
export async function duplicateCabinet(
  sceneId: string,
  sourceCabinetId: string,
  newPosition?: Partial<CabinetPosition>,
): Promise<string> {
  const sourceCabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, sourceCabinetId);
  const sourceSnap = await getDoc(sourceCabRef);
  if (!sourceSnap.exists()) throw new Error(`Cabinet ${sourceCabinetId} not found`);

  const source = sourceSnap.data() as SceneCabinet;

  // P2 (Slice 6): duplicating a legacy orphan cabinet in a project-backed
  // scene would produce another orphan that the Firestore rule rejects on
  // create. Surface the cause before we get there so the user can assign
  // a DesignItem on the source first.
  const sceneRef = doc(db, SCENES_COLLECTION, sceneId);
  const sceneSnap = await getDoc(sceneRef);
  if (!sceneSnap.exists()) throw new Error(`Scene ${sceneId} not found`);
  const sceneData = sceneSnap.data();
  if (!isStandaloneProjectId(sceneData?.projectId) && !source.designItemId) {
    throw new Error(
      'duplicateCabinet: the source cabinet has no DesignItem linked. ' +
        'Assign a DesignItem on the source cabinet, then duplicate.',
    );
  }

  const existingCabinets = await getSceneCabinets(sceneId);

  // Generate new cabinet code by incrementing letter suffix
  const newCode = generateNextCabinetCode(source.cabinetCode, existingCabinets);
  const sequence = existingCabinets.length;

  const duplicateData: Record<string, unknown> = {
    sceneId,
    pddId: source.pddId,
    archetypeId: source.archetypeId ?? null,
    cabinetCode: newCode,
    displayName: `${source.displayName} (Copy)`,
    configuration: source.configuration ?? {},
    finishSelections: source.finishSelections ?? {},
    position: newPosition
      ? { ...DEFAULT_POSITION, ...newPosition }
      : offsetPosition(source.position, 650), // Default: 650mm to the right
    rotation: source.rotation ?? 0,
    anchorPoint: source.anchorPoint ?? 'bottom_back_left',
    glbUrl: source.glbUrl ?? '',
    thumbnailUrl: source.thumbnailUrl ?? '',
    assemblies: [],
    computedBOM: source.computedBOM ?? [],
    estimatedPrice: source.estimatedPrice ?? {},
    isLocked: false,
    notes: '',
    sequence,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // Propagate the shared source GLB so the duplicate renders identically.
  if (source.sourceModelUrl) duplicateData.sourceModelUrl = source.sourceModelUrl;
  if (source.sourceMeshNames && source.sourceMeshNames.length > 0) {
    duplicateData.sourceMeshNames = source.sourceMeshNames;
  }

  // Strip any remaining undefined values — Firestore throws on undefined and
  // old pre-schema cabinets can still have missing fields that spread as such.
  for (const key of Object.keys(duplicateData)) {
    if (duplicateData[key] === undefined) delete duplicateData[key];
  }

  // P2 (Slice 2): copies inherit the source's DesignItem grouping. User can
  // reassign later via `assignCabinetToDesignItem`.
  if (source.designItemId) {
    duplicateData.designItemId = source.designItemId;
  }

  const cabRef = await addDoc(
    collection(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION),
    duplicateData,
  );

  // arrayUnion is idempotent — if the source's designItemId is already on
  // the scene cache (it should be), this is a no-op; defensive either way.
  const sceneUpdates: Record<string, unknown> = {
    totalCabinetCount: sequence + 1,
    updatedAt: serverTimestamp(),
  };
  if (source.designItemId) {
    sceneUpdates.linkedDesignItemIds = arrayUnion(source.designItemId);
  }
  await updateDoc(doc(db, SCENES_COLLECTION, sceneId), sceneUpdates);

  // P10: the duplicate inherits the source's DesignItem, so re-roll that one.
  await triggerDesignItemRollup(sceneData?.projectId as string | undefined, source.designItemId);

  return cabRef.id;
}

/**
 * Update a cabinet's position and rotation.
 *
 * If `expectedRevision` is supplied, a CAS check runs: when the stored
 * `revision` differs, the write is rejected with `StaleRevisionError`
 * so the caller can re-fetch and decide whether to retry. When
 * `expectedRevision` is omitted (legacy callers), the write proceeds
 * unconditionally — but `revision` is still incremented so future
 * CAS-aware callers see a consistent counter.
 *
 * Returns the new revision so optimistic-update stores can update
 * their local baseline without another read.
 */
export async function updateCabinetPosition(
  sceneId: string,
  cabinetId: string,
  position: CabinetPosition,
  rotation?: number,
  expectedRevision?: number,
): Promise<number> {
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found`);

  const cabinet = snap.data() as SceneCabinet;
  if (cabinet.isLocked) {
    throw new Error('Cannot update position of a locked cabinet (MO created). Unlock first.');
  }

  const currentRev = typeof cabinet.revision === 'number' ? cabinet.revision : 0;
  if (expectedRevision !== undefined && expectedRevision !== currentRev) {
    throw new StaleRevisionError(expectedRevision, currentRev, cabRef.path);
  }

  const nextRev = currentRev + 1;
  const updates: Record<string, unknown> = {
    position,
    revision: nextRev,
    updatedAt: serverTimestamp(),
  };
  if (rotation !== undefined) {
    updates.rotation = rotation;
  }

  await updateDoc(cabRef, updates);
  return nextRev;
}

/**
 * Assign one or more cabinets to a group. Writes every cabinet's
 * `groupId` and the group's `cabinetIds` list in a single batched
 * transaction so membership stays consistent. Increments `revision`
 * on each cabinet and on the group.
 *
 * When cabinets are already in another group, they are silently
 * removed from the old group's `cabinetIds` list (but the old group
 * doc is kept — ungroup semantics remove groups explicitly).
 */
export async function assignToGroup(
  sceneId: string,
  cabinetIds: string[],
  groupId: string,
): Promise<void> {
  if (cabinetIds.length === 0) return;
  const batch = writeBatch(db);

  // Track which old groups need their cabinetIds lists updated.
  const oldGroupMembers = new Map<string, Set<string>>();

  for (const cabinetId of cabinetIds) {
    const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
    const snap = await getDoc(cabRef);
    if (!snap.exists()) continue;
    const cabinet = snap.data() as SceneCabinet;
    if (cabinet.groupId && cabinet.groupId !== groupId) {
      if (!oldGroupMembers.has(cabinet.groupId)) oldGroupMembers.set(cabinet.groupId, new Set());
      oldGroupMembers.get(cabinet.groupId)!.add(cabinetId);
    }
    const nextRev = (typeof cabinet.revision === 'number' ? cabinet.revision : 0) + 1;
    batch.update(cabRef, {
      groupId,
      revision: nextRev,
      updatedAt: serverTimestamp(),
    });
  }

  // Read target group + old groups so we can merge cabinetIds lists.
  const groupRef = doc(db, SCENES_COLLECTION, sceneId, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    throw new Error(`Group ${groupId} not found in scene ${sceneId}`);
  }
  const groupData = groupSnap.data() as { cabinetIds?: string[]; revision?: number };
  const mergedIds = Array.from(new Set([...(groupData.cabinetIds ?? []), ...cabinetIds]));
  batch.update(groupRef, {
    cabinetIds: mergedIds,
    revision: (groupData.revision ?? 0) + 1,
    updatedAt: serverTimestamp(),
  });

  for (const [oldId, removed] of oldGroupMembers.entries()) {
    const oldRef = doc(db, SCENES_COLLECTION, sceneId, 'groups', oldId);
    const oldSnap = await getDoc(oldRef);
    if (!oldSnap.exists()) continue;
    const oldData = oldSnap.data() as { cabinetIds?: string[]; revision?: number };
    const kept = (oldData.cabinetIds ?? []).filter(id => !removed.has(id));
    batch.update(oldRef, {
      cabinetIds: kept,
      revision: (oldData.revision ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * Remove a cabinet from its group. Clears `cabinet.groupId` and pulls
 * the id out of the group's `cabinetIds`. Does NOT delete the group
 * even if it ends up empty — explicit ungroup deletes the doc.
 */
export async function removeFromGroup(
  sceneId: string,
  cabinetId: string,
): Promise<void> {
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const cabSnap = await getDoc(cabRef);
  if (!cabSnap.exists()) return;
  const cabinet = cabSnap.data() as SceneCabinet;
  const oldGroupId = cabinet.groupId;
  if (!oldGroupId) return;

  const batch = writeBatch(db);
  batch.update(cabRef, {
    groupId: null,
    revision: (typeof cabinet.revision === 'number' ? cabinet.revision : 0) + 1,
    updatedAt: serverTimestamp(),
  });

  const groupRef = doc(db, SCENES_COLLECTION, sceneId, 'groups', oldGroupId);
  const groupSnap = await getDoc(groupRef);
  if (groupSnap.exists()) {
    const groupData = groupSnap.data() as { cabinetIds?: string[]; revision?: number };
    const kept = (groupData.cabinetIds ?? []).filter(id => id !== cabinetId);
    batch.update(groupRef, {
      cabinetIds: kept,
      revision: (groupData.revision ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * Ungroup every member of a group atomically: clears `groupId` on each
 * cabinet, then deletes the group doc. Callers typically apply the
 * group's composed transform to each member's local transform *before*
 * calling this so visible positions don't jump.
 */
export async function ungroup(
  sceneId: string,
  groupId: string,
): Promise<void> {
  const groupRef = doc(db, SCENES_COLLECTION, sceneId, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) return;
  const groupData = groupSnap.data() as { cabinetIds?: string[] };
  const memberIds = groupData.cabinetIds ?? [];

  const batch = writeBatch(db);
  for (const memberId of memberIds) {
    const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, memberId);
    const cabSnap = await getDoc(cabRef);
    if (!cabSnap.exists()) continue;
    const cab = cabSnap.data() as SceneCabinet;
    batch.update(cabRef, {
      groupId: null,
      revision: (typeof cab.revision === 'number' ? cab.revision : 0) + 1,
      updatedAt: serverTimestamp(),
    });
  }
  batch.delete(groupRef);
  await batch.commit();
}

/**
 * Remove a cabinet from a scene.
 */
export async function removeCabinetFromScene(
  sceneId: string,
  cabinetId: string,
): Promise<void> {
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found`);

  const cabinet = snap.data() as SceneCabinet;
  if (cabinet.manufacturingOrderId) {
    throw new Error('Cannot remove cabinet with linked Manufacturing Order');
  }

  // P10: capture the DesignItem FK + project context BEFORE delete so the
  // rollup trigger can fire on the now-abandoned DesignItem after.
  const removedDesignItemId = cabinet.designItemId;
  const sceneSnap = await getDoc(doc(db, SCENES_COLLECTION, sceneId));
  const sceneProjectId = sceneSnap.exists()
    ? (sceneSnap.data()?.projectId as string | undefined)
    : undefined;

  await deleteDoc(cabRef);

  // Update scene totals and recompute the DesignItem cache from the
  // remaining set (P2, Slice 2). Recomputing is simpler than arrayRemove-
  // with-guards and keeps the cache honest even if prior writes drifted.
  const remaining = await getSceneCabinets(sceneId);
  const linkedDesignItemIds = Array.from(
    new Set(remaining.filter(isProjectBoundCabinet).map(c => c.designItemId)),
  );
  await updateDoc(doc(db, SCENES_COLLECTION, sceneId), {
    totalCabinetCount: remaining.length,
    linkedDesignItemIds,
    updatedAt: serverTimestamp(),
  });

  // P10: re-roll the item that just lost a cabinet. If that was its last
  // cabinet, the aggregator clears the rollup field; otherwise totals
  // drop by the removed contribution.
  await triggerDesignItemRollup(sceneProjectId, removedDesignItemId);
}

/**
 * P2 (Slice 2): collection-group lookup of every cabinet that belongs to a
 * given DesignItem, regardless of which scene holds it. Ordered by the
 * cabinet's per-scene sequence so callers get stable ordering within each
 * scene (cross-scene order is unspecified).
 *
 * Backed by the `cabinets` collection-group index
 * (designItemId ASC, sequence ASC) declared in firestore.indexes.json.
 */
export async function getCabinetsForDesignItem(
  designItemId: string,
): Promise<SceneCabinet[]> {
  if (!designItemId) return [];
  const q = query(
    collectionGroup(db, CABINETS_SUBCOLLECTION),
    where('designItemId', '==', designItemId),
    orderBy('sequence', 'asc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data() as Partial<SceneCabinet>;
    return {
      id: d.id,
      ...data,
      assemblies: data.assemblies ?? [],
    } as SceneCabinet;
  });
}

/**
 * P2 (Slice 2): reassign an existing cabinet to a different DesignItem.
 *
 * Updates both the cabinet's FK and the `linkedDesignItemIds` cache on the
 * containing scene (recomputed from the post-change cabinet set so the
 * cache is always consistent). No-op if the cabinet is already pointing at
 * the same DesignItem.
 *
 * Locked cabinets (MO-released) cannot be reassigned; surface a clear error
 * so the caller knows to unlock first.
 */
export async function assignCabinetToDesignItem(
  sceneId: string,
  cabinetId: string,
  designItemId: string,
): Promise<void> {
  if (!designItemId) {
    throw new Error('assignCabinetToDesignItem: designItemId is required');
  }
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found`);

  const cabinet = snap.data() as SceneCabinet;
  if (cabinet.designItemId === designItemId) return; // no-op
  if (cabinet.isLocked) {
    throw new Error('Cannot reassign a locked cabinet. Unlock first.');
  }

  // P10: capture the old FK + project context BEFORE the update so we can
  // invalidate both the source and destination DesignItem rollups after.
  const previousDesignItemId = cabinet.designItemId;
  const sceneSnap = await getDoc(doc(db, SCENES_COLLECTION, sceneId));
  const sceneProjectId = sceneSnap.exists()
    ? (sceneSnap.data()?.projectId as string | undefined)
    : undefined;

  await updateDoc(cabRef, {
    designItemId,
    updatedAt: serverTimestamp(),
  });

  // Recompute the scene cache from the post-update cabinet set.
  const remaining = await getSceneCabinets(sceneId);
  const linkedDesignItemIds = Array.from(
    new Set(remaining.filter(isProjectBoundCabinet).map(c => c.designItemId)),
  );
  await updateDoc(doc(db, SCENES_COLLECTION, sceneId), {
    linkedDesignItemIds,
    updatedAt: serverTimestamp(),
  });

  // P10: both the losing and gaining DesignItem need fresh rollups.
  await triggerDesignItemRollup(sceneProjectId, previousDesignItemId, designItemId);
}

/**
 * Set `requiredQuantity` on a cabinet — how many physical units this
 * SceneCabinet represents. Passed through the project rollup so
 * downstream DM cost / parts sync / cut list view the multiplied
 * figures.
 *
 * Rules:
 *   - Must be an integer ≥ 1.
 *   - Rejects locked cabinets (production snapshot frozen — can't
 *     retroactively change how many units you committed to build).
 *   - Triggers a DesignItem rollup recompute when the cabinet is
 *     project-bound so the MM total reflects the new quantity.
 */
export async function setCabinetRequiredQuantity(
  sceneId: string,
  cabinetId: string,
  requiredQuantity: number,
): Promise<void> {
  if (!Number.isFinite(requiredQuantity) || requiredQuantity < 1 || Math.floor(requiredQuantity) !== requiredQuantity) {
    throw new Error('setCabinetRequiredQuantity: value must be an integer ≥ 1.');
  }
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found`);

  const cabinet = snap.data() as SceneCabinet;
  if (cabinet.isLocked) {
    throw new Error('Cannot change requiredQuantity on a locked cabinet. Unlock first.');
  }
  if ((cabinet.requiredQuantity ?? 1) === requiredQuantity) return; // no-op

  await updateDoc(cabRef, {
    requiredQuantity,
    updatedAt: serverTimestamp(),
  });

  // Bump DM rollup so the cost / unit count reflects the new quantity.
  const sceneSnap = await getDoc(doc(db, SCENES_COLLECTION, sceneId));
  const sceneProjectId = sceneSnap.exists()
    ? (sceneSnap.data()?.projectId as string | undefined)
    : undefined;
  await triggerDesignItemRollup(sceneProjectId, cabinet.designItemId);
}

/**
 * Set the cabinet's archetype list. Drives AI grouping context —
 * every archetype's expectedAssemblies + coverPanelHints merge into
 * the prompt so multi-domain fixtures (e.g. workstation + retail
 * display) are understood as such.
 *
 * Writes both the canonical `archetypeIds` array and the legacy
 * `archetypeId` singular (= first id) so older readers see the
 * primary archetype without needing to migrate.
 */
export async function setCabinetArchetypes(
  sceneId: string,
  cabinetId: string,
  archetypeIds: string[],
): Promise<void> {
  const sanitized = Array.from(new Set(
    archetypeIds.map(id => id?.trim()).filter((id): id is string => !!id),
  ));

  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found`);
  const cabinet = snap.data() as SceneCabinet;
  if (cabinet.isLocked) {
    throw new Error('Cannot change archetypes on a locked cabinet. Unlock first.');
  }

  await updateDoc(cabRef, {
    archetypeIds: sanitized,
    archetypeId: sanitized[0] ?? null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lock a cabinet for production (after MO creation).
 *
 * P3 invariant: a cabinet can only be locked against a non-empty `moId`.
 * This is the ONLY code path that flips `isLocked=true` (audited via grep
 * across the repo), so enforcing the MO reference here closes the loop —
 * no more "locked to nothing" orphans that the original audit flagged.
 *
 * `mdpId` is allowed to be empty (some legacy cabinets never got an MDP
 * generated), but `moId` is required.
 */
export async function lockCabinetForProduction(
  sceneId: string,
  cabinetId: string,
  mdpId: string,
  moId: string,
): Promise<void> {
  if (!moId || !moId.trim()) {
    throw new Error(
      `lockCabinetForProduction(${sceneId}/${cabinetId}): refusing to lock without a manufacturing-order id.`,
    );
  }
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);

  // P21.8 — freeze the cabinet's BOM + pricing at lock moment so the
  // DesignItem rollup can report a production-authoritative contribution
  // regardless of any later drift on the live `computedBOM` /
  // `estimatedPrice` fields. `aggregateRollup` reads the snapshot when
  // `isLocked` is true.
  const snap = await getDoc(cabRef);
  if (!snap.exists()) {
    throw new Error(`Cabinet ${cabinetId} not found in scene ${sceneId}`);
  }
  const cabinet = snap.data() as SceneCabinet;

  await updateDoc(cabRef, {
    isLocked: true,
    mdpId,
    manufacturingOrderId: moId,
    lockedSnapshot: {
      computedBOM: cabinet.computedBOM ?? [],
      estimatedPrice: cabinet.estimatedPrice,
      lockedAt: Timestamp.now(),
      manufacturingOrderId: moId,
    },
    updatedAt: serverTimestamp(),
  });

  // Re-roll the DesignItem so `lockedCabinetCount` and the frozen
  // contribution are reflected immediately.
  const sceneSnap = await getDoc(doc(db, SCENES_COLLECTION, sceneId));
  const sceneProjectId = sceneSnap.exists()
    ? (sceneSnap.data()?.projectId as string | undefined)
    : undefined;
  await triggerDesignItemRollup(sceneProjectId, cabinet.designItemId);
}

/**
 * Unlock a cabinet (requires explicit action after MO cancellation).
 *
 * P21.8 — clears the frozen `lockedSnapshot`; subsequent rollups fall
 * back to the live `computedBOM` / `estimatedPrice`.
 */
export async function unlockCabinet(
  sceneId: string,
  cabinetId: string,
): Promise<void> {
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  const cabinet = snap.exists() ? (snap.data() as SceneCabinet) : null;

  await updateDoc(cabRef, {
    isLocked: false,
    lockedSnapshot: deleteField(),
    updatedAt: serverTimestamp(),
  });

  if (cabinet?.designItemId) {
    const sceneSnap = await getDoc(doc(db, SCENES_COLLECTION, sceneId));
    const sceneProjectId = sceneSnap.exists()
      ? (sceneSnap.data()?.projectId as string | undefined)
      : undefined;
    await triggerDesignItemRollup(sceneProjectId, cabinet.designItemId);
  }
}

// ── Helpers ──

/**
 * Generate the next cabinet code by incrementing the letter suffix.
 * KB600-A → KB600-B, KB600-Z → KB600-AA
 */
function generateNextCabinetCode(baseCode: string, existing: SceneCabinet[]): string {
  const dashIdx = baseCode.lastIndexOf('-');
  const prefix = dashIdx > 0 ? baseCode.slice(0, dashIdx) : baseCode;

  // Find all existing codes with same prefix
  const usedSuffixes = new Set(
    existing
      .filter(c => c.cabinetCode.startsWith(prefix))
      .map(c => {
        const idx = c.cabinetCode.lastIndexOf('-');
        return idx > 0 ? c.cabinetCode.slice(idx + 1) : '';
      })
      .filter(Boolean),
  );

  // Try A-Z
  for (let i = 0; i < 26; i++) {
    const suffix = String.fromCharCode(65 + i);
    if (!usedSuffixes.has(suffix)) return `${prefix}-${suffix}`;
  }

  // Fallback: AA, AB, etc.
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const suffix = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
      if (!usedSuffixes.has(suffix)) return `${prefix}-${suffix}`;
    }
  }

  throw new Error('Exhausted cabinet code suffixes');
}

/**
 * Offset a position along the X axis (for duplicate placement).
 * Explicitly drops `alignedWithCabinetId` / `alignmentEdge` (duplicates break
 * alignment by design) — without this, Firestore rejects the write because
 * undefined field values aren't allowed.
 */
function offsetPosition(position: CabinetPosition, offsetX: number): CabinetPosition {
  const { alignedWithCabinetId: _a, alignmentEdge: _e, ...rest } = position;
  void _a; void _e;
  return {
    ...rest,
    x: position.x + offsetX,
  };
}

// ---------------------------------------------------------------------------
// Architectural plans / sections — scene-level uploads rendered into the
// PDF when `includeSheets.architecturalPlans` is on.
// ---------------------------------------------------------------------------

import type { SceneArchitecturalAsset } from '../types/scene.types';

const ARCH_ASSET_TYPES = new Set<SceneArchitecturalAsset['kind']>([
  'plan', 'section', 'elevation', 'detail', 'other',
]);

function newAssetId(): string {
  return `aa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Upload an architectural drawing file + attach it to the scene.
 * Input must be an image (PNG/JPEG) — jsPDF embeds those natively.
 * PDFs are rejected with a clear error (user can export to PNG first).
 *
 * Storage path: `scenes/{sceneId}/architectural/{timestamp}.{ext}`.
 * The returned asset URL is written into
 * `scene.architecturalAssets[]` via arrayUnion so concurrent uploads
 * don't race each other.
 */
export async function addSceneArchitecturalAsset(
  sceneId: string,
  file: File,
  meta: { label: string; kind: SceneArchitecturalAsset['kind']; caption?: string; userId: string },
): Promise<SceneArchitecturalAsset> {
  if (!ARCH_ASSET_TYPES.has(meta.kind)) {
    throw new Error(`Unknown architectural asset kind: ${meta.kind}`);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(
      `Unsupported file type ${file.type || 'unknown'}. ` +
      `Architectural plans must be PNG or JPEG — export from your CAD tool first.`,
    );
  }

  const app = (await import('@/shared/services/firebase/config')).app;
  const storage = getStorage(app);
  const ext = file.name.split('.').pop() || 'png';
  const path = `scenes/${sceneId}/architectural/${Date.now()}.${ext}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  const url = await getDownloadURL(ref);

  const asset: SceneArchitecturalAsset = {
    id: newAssetId(),
    label: meta.label.trim() || file.name,
    caption: meta.caption?.trim() || undefined,
    kind: meta.kind,
    fileUrl: url,
    fileName: file.name,
    mimeType: file.type,
    uploadedBy: meta.userId,
    uploadedAt: serverTimestamp() as unknown as SceneArchitecturalAsset['uploadedAt'],
  };

  const sceneRef = doc(db, SCENES_COLLECTION, sceneId);
  await updateDoc(sceneRef, {
    architecturalAssets: arrayUnion(asset),
    updatedAt: serverTimestamp(),
  });
  return asset;
}

/**
 * Remove an architectural asset by id. Rewrites the array (arrayRemove
 * requires exact match including the serverTimestamp, which breaks for
 * already-persisted docs).
 */
export async function removeSceneArchitecturalAsset(
  sceneId: string,
  assetId: string,
): Promise<void> {
  const sceneRef = doc(db, SCENES_COLLECTION, sceneId);
  const snap = await getDoc(sceneRef);
  if (!snap.exists()) throw new Error(`Scene ${sceneId} not found`);
  const data = snap.data() as { architecturalAssets?: SceneArchitecturalAsset[] };
  const next = (data.architecturalAssets ?? []).filter(a => a.id !== assetId);
  await updateDoc(sceneRef, {
    architecturalAssets: next,
    updatedAt: serverTimestamp(),
  });
}
