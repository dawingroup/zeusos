/**
 * partReverseSyncService — reverse-sync PartEntry edits back to ScenePart.
 *
 * When procurement edits a material, corrects dimensions, or adds notes on
 * a PartEntry in PartsTab, those changes should flow back to the
 * Design Studio scene so the 3D viewport renders the updated finish and
 * cut-list data stays consistent.
 *
 * The back-links (`meshNodeId`, `cabinetId`, `sceneId`) on PartEntry make
 * this possible. This service:
 *
 *   1. Reads the cabinet doc from Firestore.
 *   2. Finds the ScenePart with matching `meshNodeId` (or `partId`).
 *   3. Diff-compares whitelisted fields.
 *   4. Writes only changed fields back.
 *
 * The scene workspace already has `onSnapshot` on cabinets — once the
 * cabinet doc updates, the Three.js material refreshes automatically.
 *
 * P3.1 + P3.2 of the Design Studio Gaps Plan.
 */

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SceneCabinet } from '../types/scene.types';
import type { SceneAssembly, ScenePart } from '../types/assembly.types';

const SCENES_COLLECTION = 'designScenes';
const CABINETS_SUBCOLLECTION = 'cabinets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields that are safe to sync backward from DM → Scene. */
export interface ReverseSyncFields {
  finishLibraryId?: string;
  materialDescription?: string;
  inventoryItemId?: string;
  inventoryItemName?: string;
  dimensions?: {
    length?: number;
    width?: number;
    thickness?: number;
    grainDirection?: 'length' | 'width' | 'none';
  };
  notes?: string;
  edgeBanding?: ScenePart['edgeBanding'];
}

/** Identifies a specific scene part to update. */
export interface ReverseSyncTarget {
  sceneId: string;
  cabinetId: string;
  /** Preferred lookup key — matches ScenePart.meshNodeId. */
  meshNodeId?: string;
  /** Fallback lookup key — matches ScenePart.id. */
  partId?: string;
}

export interface ReverseSyncInput {
  target: ReverseSyncTarget;
  fields: ReverseSyncFields;
  changedBy: string;
}

export interface ReverseSyncResult {
  success: boolean;
  /** Number of fields actually changed (0 = no-op). */
  fieldsChanged: number;
  /** Part was not found in the cabinet. */
  partNotFound?: boolean;
  /** Cabinet doc was not found. */
  cabinetNotFound?: boolean;
  /** Cabinet is locked — queued for later. */
  locked?: boolean;
}

/** Batch reverse sync input for propagating palette changes. */
export interface BatchReverseSyncInput {
  items: ReverseSyncInput[];
}

export interface BatchReverseSyncResult {
  total: number;
  succeeded: number;
  failed: number;
  noOps: number;
  results: ReverseSyncResult[];
}

// ---------------------------------------------------------------------------
// Field whitelist — only these fields may flow backward
// ---------------------------------------------------------------------------

/** Whitelisted top-level ScenePart fields that may be reverse-synced. */
const SYNCABLE_FIELDS = [
  'finishLibraryId',
  'materialDescription',
  'inventoryItemId',
  'inventoryItemName',
  'notes',
] as const;

// ---------------------------------------------------------------------------
// Core logic (pure — testable without Firestore)
// ---------------------------------------------------------------------------

/**
 * Compute the diff between a ScenePart and the incoming reverse-sync fields.
 * Returns only the fields that actually changed, or null if nothing differs.
 */
export function computeReverseSyncDiff(
  existing: ScenePart,
  incoming: ReverseSyncFields,
): Partial<ScenePart> | null {
  const patch: Record<string, unknown> = {};
  let changed = 0;

  // Top-level string fields
  for (const key of SYNCABLE_FIELDS) {
    const newVal = incoming[key];
    if (newVal !== undefined && newVal !== (existing as unknown as Record<string, unknown>)[key]) {
      patch[key] = newVal;
      changed++;
    }
  }

  // Dimensions — merge only changed sub-fields
  if (incoming.dimensions && existing.dimensions) {
    const dimPatch: Record<string, unknown> = {};
    let dimChanged = 0;
    const dimKeys = ['length', 'width', 'thickness', 'grainDirection'] as const;
    for (const dk of dimKeys) {
      const nv = incoming.dimensions[dk];
      if (nv !== undefined && nv !== existing.dimensions[dk]) {
        dimPatch[dk] = nv;
        dimChanged++;
      }
    }
    if (dimChanged > 0) {
      patch.dimensions = { ...existing.dimensions, ...dimPatch };
      changed += dimChanged;
    }
  } else if (incoming.dimensions && !existing.dimensions) {
    patch.dimensions = incoming.dimensions;
    changed++;
  }

  // Edge banding — replace entirely when provided
  if (incoming.edgeBanding !== undefined) {
    const same = JSON.stringify(incoming.edgeBanding) === JSON.stringify(existing.edgeBanding);
    if (!same) {
      patch.edgeBanding = incoming.edgeBanding;
      changed++;
    }
  }

  return changed > 0 ? (patch as Partial<ScenePart>) : null;
}

/**
 * Find a ScenePart within a cabinet's assemblies by meshNodeId or partId.
 */
export function findScenePart(
  assemblies: SceneAssembly[],
  meshNodeId?: string,
  partId?: string,
): { assemblyIndex: number; partIndex: number; part: ScenePart } | null {
  for (let ai = 0; ai < assemblies.length; ai++) {
    const parts = assemblies[ai].parts ?? [];
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      if (meshNodeId && p.meshNodeId === meshNodeId) {
        return { assemblyIndex: ai, partIndex: pi, part: p };
      }
      if (partId && p.id === partId) {
        return { assemblyIndex: ai, partIndex: pi, part: p };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Firestore write path
// ---------------------------------------------------------------------------

/**
 * Reverse-sync a single PartEntry's edits back to its source ScenePart.
 */
export async function syncPartBackToScene(
  input: ReverseSyncInput,
): Promise<ReverseSyncResult> {
  const { target, fields } = input;

  if (!target.sceneId || !target.cabinetId) {
    return { success: false, fieldsChanged: 0, partNotFound: true };
  }
  if (!target.meshNodeId && !target.partId) {
    return { success: false, fieldsChanged: 0, partNotFound: true };
  }

  const cabRef = doc(
    db,
    SCENES_COLLECTION,
    target.sceneId,
    CABINETS_SUBCOLLECTION,
    target.cabinetId,
  );

  const snap = await getDoc(cabRef);
  if (!snap.exists()) {
    return { success: false, fieldsChanged: 0, cabinetNotFound: true };
  }

  const cab = snap.data() as SceneCabinet;

  // Respect the lock — don't write to a cabinet that's in production.
  if (cab.isLocked) {
    return { success: false, fieldsChanged: 0, locked: true };
  }

  const assemblies: SceneAssembly[] = cab.assemblies ?? [];
  const found = findScenePart(assemblies, target.meshNodeId, target.partId);
  if (!found) {
    return { success: false, fieldsChanged: 0, partNotFound: true };
  }

  const diff = computeReverseSyncDiff(found.part, fields);
  if (!diff) {
    // No actual change — skip the write.
    return { success: true, fieldsChanged: 0 };
  }

  // Apply the patch to the part within the assemblies array.
  const updatedPart: ScenePart = { ...found.part, ...diff };
  const updatedAssemblies = assemblies.map((asm, ai) => {
    if (ai !== found.assemblyIndex) return asm;
    const updatedParts = (asm.parts ?? []).map((p, pi) =>
      pi === found.partIndex ? updatedPart : p,
    );
    return { ...asm, parts: updatedParts };
  });

  await updateDoc(cabRef, {
    assemblies: updatedAssemblies,
    updatedAt: serverTimestamp(),
  });

  return {
    success: true,
    fieldsChanged: Object.keys(diff).length,
  };
}

/**
 * Batch reverse-sync: propagate multiple part edits grouped by cabinet.
 * Groups writes so each cabinet doc is read + written at most once.
 */
export async function batchSyncPartsBackToScene(
  input: BatchReverseSyncInput,
): Promise<BatchReverseSyncResult> {
  const results: ReverseSyncResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let noOps = 0;

  // Group by sceneId|cabinetId to minimize reads.
  const groups = new Map<string, ReverseSyncInput[]>();
  for (const item of input.items) {
    const key = `${item.target.sceneId}|${item.target.cabinetId}`;
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }

  for (const [, items] of groups) {
    const { sceneId, cabinetId } = items[0].target;
    const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
    const snap = await getDoc(cabRef);

    if (!snap.exists()) {
      for (const _ of items) {
        const r: ReverseSyncResult = { success: false, fieldsChanged: 0, cabinetNotFound: true };
        results.push(r);
        failed++;
      }
      continue;
    }

    const cab = snap.data() as SceneCabinet;

    if (cab.isLocked) {
      for (const _ of items) {
        const r: ReverseSyncResult = { success: false, fieldsChanged: 0, locked: true };
        results.push(r);
        failed++;
      }
      continue;
    }

    let assemblies: SceneAssembly[] = cab.assemblies ?? [];
    let totalChanges = 0;

    for (const item of items) {
      const found = findScenePart(assemblies, item.target.meshNodeId, item.target.partId);
      if (!found) {
        results.push({ success: false, fieldsChanged: 0, partNotFound: true });
        failed++;
        continue;
      }

      const diff = computeReverseSyncDiff(found.part, item.fields);
      if (!diff) {
        results.push({ success: true, fieldsChanged: 0 });
        noOps++;
        continue;
      }

      // Apply patch in-memory
      const updatedPart: ScenePart = { ...found.part, ...diff };
      assemblies = assemblies.map((asm, ai) => {
        if (ai !== found.assemblyIndex) return asm;
        const updatedParts = (asm.parts ?? []).map((p, pi) =>
          pi === found.partIndex ? updatedPart : p,
        );
        return { ...asm, parts: updatedParts };
      });

      const changeCount = Object.keys(diff).length;
      totalChanges += changeCount;
      results.push({ success: true, fieldsChanged: changeCount });
      succeeded++;
    }

    // Single write per cabinet
    if (totalChanges > 0) {
      await updateDoc(cabRef, {
        assemblies,
        updatedAt: serverTimestamp(),
      });
    }
  }

  return {
    total: input.items.length,
    succeeded,
    failed,
    noOps,
    results,
  };
}
