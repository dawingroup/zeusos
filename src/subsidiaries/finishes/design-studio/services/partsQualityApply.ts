/**
 * partsQualityApply — persist accepted name enhancements back to scene
 * cabinet parts.
 *
 * The audit report produced by `partsQualityHelper` is read-only; this
 * companion writer is the only path for mutating cabinets off the back
 * of it. Keeping it separate:
 *   - Keeps `partsQualityHelper` pure + unit-testable.
 *   - Ensures every write is explicitly scoped to name changes (we do
 *     NOT auto-fix flagged issues — those demand human judgement).
 *
 * We batch writes per-cabinet: each cabinet doc stores the full
 * `assemblies[].parts[]` array, so one cabinet = one updateDoc
 * irrespective of how many parts were renamed.
 */
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SceneCabinet } from '../types/scene.types';
import type { SceneAssembly, ScenePart } from '../types/assembly.types';

const SCENES_COLLECTION = 'designScenes';
const CABINETS_SUBCOLLECTION = 'cabinets';

/** Accepted rename targeting a specific part. */
export interface PartRename {
  cabinetId: string;
  partId: string;
  newName: string;
}

export interface ApplyResult {
  cabinetsUpdated: number;
  partsRenamed: number;
  skipped: number;         // parts not found (deleted between audit + apply)
}

/**
 * Apply a batch of name changes. Groups by cabinetId so each cabinet
 * doc is rewritten once with its full mutated assemblies array.
 */
export async function applyPartNameEnhancements(
  sceneId: string,
  renames: PartRename[],
): Promise<ApplyResult> {
  if (renames.length === 0) {
    return { cabinetsUpdated: 0, partsRenamed: 0, skipped: 0 };
  }

  // Group renames by cabinetId → map of partId → newName.
  const byCabinet = new Map<string, Map<string, string>>();
  for (const r of renames) {
    const inner = byCabinet.get(r.cabinetId) ?? new Map();
    inner.set(r.partId, r.newName);
    byCabinet.set(r.cabinetId, inner);
  }

  let cabinetsUpdated = 0;
  let partsRenamed = 0;
  let skipped = 0;

  for (const [cabinetId, partMap] of byCabinet) {
    const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
    const snap = await getDoc(cabRef);
    if (!snap.exists()) {
      skipped += partMap.size;
      continue;
    }
    const cab = snap.data() as SceneCabinet;
    const assemblies = cab.assemblies ?? [];

    let touched = 0;
    const nextAssemblies: SceneAssembly[] = assemblies.map(asm => {
      const nextParts: ScenePart[] = (asm.parts ?? []).map(p => {
        const newName = partMap.get(p.id);
        if (newName && newName !== p.partName) {
          touched++;
          return { ...p, partName: newName };
        }
        return p;
      });
      return { ...asm, parts: nextParts };
    });

    // Count unmatched renames (part was deleted after audit).
    const matchedIds = new Set<string>();
    for (const asm of assemblies) for (const p of asm.parts ?? []) matchedIds.add(p.id);
    for (const pid of partMap.keys()) if (!matchedIds.has(pid)) skipped++;

    if (touched === 0) continue;

    // Stamp `nameLocked` on every renamed part so a future revision
    // re-parse preserves the user's accepted name (the revision apply
    // flow reads `cabinet.partOverrides[partId].nameLocked`).
    const nextOverrides: SceneCabinet['partOverrides'] = { ...(cab.partOverrides ?? {}) };
    const lockedAt = Timestamp.now();
    for (const [pid] of partMap) {
      nextOverrides[pid] = {
        ...(nextOverrides[pid] ?? {}),
        nameLocked: true,
        lockedAt,
      };
    }

    await updateDoc(cabRef, {
      assemblies: nextAssemblies,
      partOverrides: nextOverrides,
      updatedAt: serverTimestamp(),
    });
    cabinetsUpdated++;
    partsRenamed += touched;
  }

  return { cabinetsUpdated, partsRenamed, skipped };
}
