/**
 * groupRepo — CRUD for the `designScenes/{sceneId}/groups` subcollection.
 *
 * Groups bind multiple cabinets together so that drag / rotate / numeric
 * edits apply to the whole set. Every mutation bumps `revision` and passes
 * through a CAS check: callers pass the revision they read; the repo
 * rejects writes that race with newer data by throwing `StaleRevisionError`.
 *
 * Membership is stored redundantly on each cabinet (`SceneCabinet.groupId`)
 * and on the group (`group.cabinetIds`). This repo only maintains the
 * group doc — syncing `cabinet.groupId` is the caller's responsibility
 * (typically via `scene.service.assignToGroup` / `removeFromGroup`, which
 * wraps both writes in a batch).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  CabinetGroup,
  CreateGroupInput,
  UpdateGroupInput,
} from '../types/cabinetGroup.types';
import { StaleRevisionError } from '../types/cabinetGroup.types';

const SCENES_COLLECTION = 'designScenes';
const GROUPS_SUBCOLLECTION = 'groups';

function groupsColRef(sceneId: string) {
  return collection(db, SCENES_COLLECTION, sceneId, GROUPS_SUBCOLLECTION);
}

function groupDocRef(sceneId: string, groupId: string) {
  return doc(db, SCENES_COLLECTION, sceneId, GROUPS_SUBCOLLECTION, groupId);
}

/** Firestore snapshot → domain type. */
function mapGroup(sceneId: string, id: string, data: Record<string, unknown>): CabinetGroup {
  return {
    id,
    sceneId,
    name: (data.name as string) ?? '',
    cabinetIds: Array.isArray(data.cabinetIds) ? (data.cabinetIds as string[]) : [],
    locked: !!data.locked,
    revision: typeof data.revision === 'number' ? data.revision : 0,
    createdAt: (data.createdAt as Timestamp) ?? Timestamp.now(),
    updatedAt: (data.updatedAt as Timestamp) ?? Timestamp.now(),
  };
}

/** Create a new group. Returns the generated group id. */
export async function createGroup(input: CreateGroupInput): Promise<string> {
  const docRef = await addDoc(groupsColRef(input.sceneId), {
    name: input.name ?? 'Group',
    cabinetIds: input.cabinetIds,
    locked: input.locked ?? false,
    revision: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Fetch a single group. Returns null when it doesn't exist. */
export async function getGroup(
  sceneId: string,
  groupId: string,
): Promise<CabinetGroup | null> {
  const snap = await getDoc(groupDocRef(sceneId, groupId));
  if (!snap.exists()) return null;
  return mapGroup(sceneId, snap.id, snap.data());
}

/** List every group on a scene, sorted by creation time. */
export async function listGroupsForScene(sceneId: string): Promise<CabinetGroup[]> {
  const q = query(groupsColRef(sceneId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => mapGroup(sceneId, d.id, d.data()));
}

/** Realtime listener for a scene's groups. Returns the unsubscribe fn. */
export function subscribeToGroups(
  sceneId: string,
  onChange: (groups: CabinetGroup[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(groupsColRef(sceneId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map(d => mapGroup(sceneId, d.id, d.data())));
    },
    (err) => {
      console.warn(`[groupRepo] subscribe failed for scene ${sceneId}:`, err);
      onError?.(err);
    },
  );
}

/**
 * Update a group with CAS. Caller passes the revision they read; if the
 * stored revision differs, we throw `StaleRevisionError` so the caller
 * can reconcile (re-fetch, diff, re-apply).
 */
export async function updateGroup(
  sceneId: string,
  groupId: string,
  updates: UpdateGroupInput,
  expectedRevision: number,
): Promise<number> {
  const ref = groupDocRef(sceneId, groupId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error(`Group ${groupId} not found in scene ${sceneId}`);
  }
  const current = snap.data() as { revision?: number };
  const currentRev = typeof current.revision === 'number' ? current.revision : 0;
  if (currentRev !== expectedRevision) {
    throw new StaleRevisionError(expectedRevision, currentRev, ref.path);
  }
  const nextRev = currentRev + 1;
  await updateDoc(ref, {
    ...updates,
    revision: nextRev,
    updatedAt: serverTimestamp(),
  });
  return nextRev;
}

/** Delete a group. Callers must clear `groupId` on each member first
 *  (typically done by scene.service.ungroup). */
export async function deleteGroup(sceneId: string, groupId: string): Promise<void> {
  await deleteDoc(groupDocRef(sceneId, groupId));
}
