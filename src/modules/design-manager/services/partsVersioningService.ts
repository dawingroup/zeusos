/**
 * Parts Versioning Service — P6
 *
 * Adds optimistic-concurrency control to writes on
 * `designProjects/{projectId}/designItems/{itemId}.parts`.
 *
 * Why: before P6, a design-studio parts-sync would blindly `updateDoc` the
 * parts array. If a design-manager user edited parts in parallel, the last
 * writer silently won — no audit trail, no conflict signal, no rollback.
 * See finding F7 in the audit plan.
 *
 * Contract:
 *
 *   - Every successful write bumps `partsVersion` (starting from 1 on the
 *     first write; legacy docs are treated as version 0 on read).
 *   - Every successful write stamps `partsLastSyncedAt`.
 *   - A snapshot is appended to the `parts_history` subcollection so any
 *     write can be reconstructed / rolled back.
 *   - If the caller supplies `baseVersion`, we reject when the server has
 *     moved past it (`PartsConcurrencyError`). Callers without a
 *     `baseVersion` opt out of conflict detection (e.g. direct UI edits
 *     inside the design-manager, where the component state IS the latest
 *     read — the version field still gets bumped so the next studio sync
 *     will detect the drift).
 *
 * This service is intentionally shared between design-manager's own
 * `partsService` and design-studio's `partsSyncService` so both sides
 * agree on the versioning contract.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { PartEntry } from '../types';

/** Raised when a write is rejected because the server moved past `baseVersion`. */
export class PartsConcurrencyError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly baseVersion: number,
    public readonly currentVersion: number,
  ) {
    super(
      `Parts write rejected for designItem ${itemId}: ` +
        `baseVersion ${baseVersion} is stale — server is at ${currentVersion}. ` +
        'Another editor modified this item; re-read before retrying.',
    );
    this.name = 'PartsConcurrencyError';
  }
}

/**
 * Source tag on each history entry — helps UI and audit tooling explain
 * where a given revision came from. Free-form strings are allowed, but
 * prefer these canonical values for consistency.
 */
export type PartsWriteSource =
  | 'studio-sync-replace'
  | 'studio-sync-merge'
  | 'design-manager-add'
  | 'design-manager-update'
  | 'design-manager-delete'
  | 'design-manager-bulk-update'
  | 'design-manager-bulk-delete'
  | 'design-manager-bulk-add'
  | 'design-manager-replace-all'
  | string;

/**
 * Which namespace the caller is writing into. Enforced at write time —
 * `scene-origin` writes must carry only `source: 'design-studio'` rows,
 * `procurement` writes must carry only non-`design-studio` rows. The
 * OTHER namespace on the DesignItem passes through untouched. This is
 * the invariant that prevents scene syncs and procurement edits from
 * clobbering each other (see design doc: cozy-zooming-stream).
 */
export type WriteScope = 'scene-origin' | 'procurement';

export interface WritePartsOptions {
  /**
   * Expected current `partsVersion`. If the server is ahead, the write is
   * rejected with `PartsConcurrencyError`. Omit to opt out of conflict
   * detection (version still bumps).
   */
  baseVersion?: number;
  /** Who initiated the write — stamped on the doc and the history entry. */
  userId: string;
  /** What caused this write — for the audit trail. */
  source: PartsWriteSource;
  /**
   * Namespace the write targets. When set, `writePartsWithVersion`
   * reads existing parts, partitions by source, and merges the caller's
   * array with the OTHER namespace untouched. When omitted, the caller
   * is fully responsible for the final array (legacy full-replace
   * path) — eventually every caller must supply this, but a soft
   * rollout keeps older callers working.
   */
  writeScope?: WriteScope;
  /** Optional caller-computed parts summary to include in the same write. */
  partsSummary?: unknown;
  /** Extra fields to merge into the `updateDoc` call alongside parts. */
  additionalUpdates?: Record<string, unknown>;
  /**
   * By default we append a history entry on every successful write. Set
   * to `false` for callers that write to a high-churn path where the
   * history subcollection would dominate storage (none currently, but
   * this is the escape hatch).
   */
  writeHistory?: boolean;
}

/**
 * Namespace predicate — a PartEntry is scene-origin when `source ===
 * 'design-studio'`. Every other source (including missing/undefined)
 * is procurement. The invariant is asymmetric: we positively tag
 * scene-origin, procurement is "everything else", so legacy untagged
 * data lands in procurement (the safe bucket) by default.
 */
export function isSceneOriginPart(p: Pick<PartEntry, 'source'>): boolean {
  return (p as { source?: string }).source === 'design-studio';
}

export interface WritePartsResult {
  /** The new `partsVersion` after the bump. */
  version: number;
  /** The parts array as it was written. */
  parts: PartEntry[];
  /** Convenience: parts.length. */
  writtenCount: number;
}

/**
 * Read the current `partsVersion` of a DesignItem. Legacy docs default to 0.
 * Throws if the doc doesn't exist.
 */
export async function readPartsVersion(projectId: string, itemId: string): Promise<number> {
  const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) {
    throw new Error(`readPartsVersion: designItem ${projectId}/${itemId} not found.`);
  }
  const data = snap.data() as { partsVersion?: number };
  return typeof data.partsVersion === 'number' ? data.partsVersion : 0;
}

/**
 * Core primitive: write `parts` to a DesignItem with version bump + history.
 *
 * The caller supplies the **final** parts array (already merged / diffed
 * / whatever). This helper does not care about merge semantics — it only
 * owns the versioning + history concern. This keeps the policy (merge
 * vs. replace, diffing rules) with the caller, and the mechanics
 * (version bump, audit trail, conflict detection) here.
 */
export async function writePartsWithVersion(
  projectId: string,
  itemId: string,
  parts: PartEntry[],
  options: WritePartsOptions,
): Promise<WritePartsResult> {
  const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) {
    throw new Error(`writePartsWithVersion: designItem ${projectId}/${itemId} not found.`);
  }
  const data = snap.data() as { partsVersion?: number; parts?: PartEntry[] };
  const currentVersion = typeof data.partsVersion === 'number' ? data.partsVersion : 0;

  if (options.baseVersion !== undefined && options.baseVersion !== currentVersion) {
    throw new PartsConcurrencyError(itemId, options.baseVersion, currentVersion);
  }

  // Namespace enforcement — when caller supplies a writeScope, the
  // input `parts` MUST consist entirely of rows in that namespace, and
  // we splice them into the other namespace rather than overwriting
  // the whole array. This is the invariant that makes scene syncs and
  // procurement edits non-colliding. Without writeScope the caller
  // takes full responsibility (legacy path) — we still write what
  // they gave us.
  let finalParts: PartEntry[];
  if (options.writeScope) {
    const existing: PartEntry[] = data.parts ?? [];
    const callerScope = options.writeScope;
    for (const p of parts) {
      const pIsScene = isSceneOriginPart(p);
      if (callerScope === 'scene-origin' && !pIsScene) {
        throw new Error(
          `writePartsWithVersion (scene-origin): caller passed a non-design-studio part ` +
            `("${p.name}" source=${(p as { source?: string }).source ?? 'undefined'}). ` +
            `Scene-origin writes must only contain parts with source: 'design-studio'.`,
        );
      }
      if (callerScope === 'procurement' && pIsScene) {
        throw new Error(
          `writePartsWithVersion (procurement): caller passed a design-studio part ` +
            `("${p.name}"). Procurement writes must not contain scene-origin rows — ` +
            `those are owned by the Design Studio sync flow.`,
        );
      }
    }
    // Splice: keep the OTHER namespace's existing rows, replace OURS.
    const otherNamespace = existing.filter(p =>
      callerScope === 'scene-origin' ? !isSceneOriginPart(p) : isSceneOriginPart(p),
    );
    finalParts = callerScope === 'scene-origin'
      ? [...otherNamespace, ...parts]  // procurement first, then fresh scene
      : [...otherNamespace, ...parts]; // scene first, then fresh procurement
  } else {
    finalParts = parts;
  }

  const nextVersion = currentVersion + 1;
  const now = Timestamp.now();

  const updates: Record<string, unknown> = {
    parts: finalParts,
    partsVersion: nextVersion,
    partsLastSyncedAt: now,
    updatedAt: serverTimestamp(),
    updatedBy: options.userId,
  };
  if (options.partsSummary !== undefined) {
    updates.partsSummary = options.partsSummary;
  }
  if (options.additionalUpdates) {
    Object.assign(updates, options.additionalUpdates);
  }

  await updateDoc(itemRef, updates);

  if (options.writeHistory !== false) {
    const historyCol = collection(
      db,
      'designProjects',
      projectId,
      'designItems',
      itemId,
      'parts_history',
    );
    await addDoc(historyCol, {
      partsVersion: nextVersion,
      parts: finalParts,
      partCount: finalParts.length,
      source: options.source,
      writtenBy: options.userId,
      writtenAt: now,
    });
  }

  return {
    version: nextVersion,
    parts: finalParts,
    writtenCount: finalParts.length,
  };
}
