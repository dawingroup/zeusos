/**
 * Cabinet Group types — multi-cabinet group entity for the Cabinet
 * Alignment System.
 *
 * A group binds several cabinets into one logical unit for selection,
 * drag, rotate, and numeric edits. Groups live in the subcollection
 * `designScenes/{sceneId}/groups/{groupId}`. Each cabinet also stores
 * its `groupId` so viewport queries can resolve group membership
 * without a second read.
 *
 * The membership list is intentionally redundant with the per-cabinet
 * `groupId`: `group.cabinetIds` enables O(1) "which cabinets are in
 * this group" lookups for list views, while `cabinet.groupId` enables
 * O(1) "what group is this cabinet in" during rendering and selection.
 * Both are written atomically by `assignToGroup` / `removeFromGroup`.
 */
import type { Timestamp } from 'firebase/firestore';

/** A user-defined group of cabinets within a scene. */
export interface CabinetGroup {
  id: string;
  sceneId: string;
  /** User-editable label, e.g. "Kitchen run", "Wardrobe cluster". */
  name: string;
  /** Redundant with each member's `SceneCabinet.groupId` for fast reads. */
  cabinetIds: string[];
  /** When true, the group (and every member) is locked for production —
   *  no drag, rotate, numeric edit, or regroup. */
  locked: boolean;
  /** CAS token. Incremented on every write; callers pass the value they
   *  read as `expectedRevision` so concurrent edits don't silently
   *  overwrite each other. */
  revision: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Input shape for `groupRepo.createGroup`. `id` is assigned by the
 *  repo; `revision` is initialised to 0; timestamps are filled by the
 *  repo from `serverTimestamp()`. */
export interface CreateGroupInput {
  sceneId: string;
  name?: string;
  cabinetIds: string[];
  locked?: boolean;
}

/** Partial update shape for `groupRepo.updateGroup`. Callers must pass
 *  `expectedRevision` for CAS; the repo will reject if stale. */
export interface UpdateGroupInput {
  name?: string;
  cabinetIds?: string[];
  locked?: boolean;
}

/** Thrown when a CAS-guarded write sees a revision mismatch. The caller
 *  is expected to re-fetch and decide whether to retry or surface the
 *  conflict. */
export class StaleRevisionError extends Error {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
    public readonly path: string,
  ) {
    super(
      `Stale revision at ${path}: expected ${expected}, found ${actual}. ` +
      'The document was updated by another writer; re-fetch and retry.',
    );
    this.name = 'StaleRevisionError';
  }
}
