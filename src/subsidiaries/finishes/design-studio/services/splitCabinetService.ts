/**
 * splitCabinetService — given a source SceneCabinet + clusters from
 * `detectSubCabinets`, create one new SceneCabinet per cluster and
 * archive the source.
 *
 * Preservation rules:
 *   - Source GLB stays the same on every child (bulk-import scenes
 *     share one GLB across cabinets — `sourceMeshNames` is the
 *     filter). New per-cabinet GLBs are not regenerated here; the
 *     revision pipeline handles that when the user uploads a fresh
 *     model.
 *   - `designItemId` stays on the biggest cluster only (cluster 0).
 *     Other children start unbound — the user re-assigns via the
 *     existing Reassign button. Splitting a 1→N cabinet doesn't
 *     fan-out the DM binding automatically; that's a judgement call
 *     for the user.
 *   - `finishSelections` + `requiredQuantity` + `archetypeIds` copy
 *     to every child (they usually apply to all).
 *   - `assemblies[]` is partitioned by each part's `meshNodeId` —
 *     assemblies whose parts all fall in cluster K go to child K;
 *     assemblies spanning clusters split, with each half staying on
 *     the child it covers. Orphan parts (no cluster match) follow
 *     the cabinet they came from.
 *   - Positions computed from cluster centroids so the split-out
 *     cabinets land in the same places they occupied inside the
 *     merged cabinet.
 *   - Source cabinet is DELETED after successful child creation.
 *     Re-run safety: the caller can pass `{ dryRun: true }` to get
 *     the preview payload without touching Firestore.
 */
import {
  addDoc, collection, doc, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { SceneCabinet } from '../types/scene.types';
import type { SceneAssembly } from '../types/assembly.types';
import type { SubCabinetCluster } from './splitCabinetDetection';

const SCENES_COLLECTION = 'designScenes';
const CABINETS_SUBCOLLECTION = 'cabinets';

export interface SplitChildPreview {
  cabinetCode: string;
  displayName: string;
  meshNames: string[];
  assemblyCount: number;
  partCount: number;
  position: { x: number; y: number; z: number };
  size: { width: number; depth: number; height: number };
  inheritsDesignItemId: boolean;
}

export interface SplitResult {
  children: SplitChildPreview[];
  /** Meshes that didn't land in any cluster — stay on cluster 0 as
   *  a safety net so they're never dropped. Surfaced for the UI. */
  orphans: string[];
  /** True when `{ dryRun: true }` was set — no Firestore writes fired. */
  dryRun: boolean;
}

export interface SplitOptions {
  dryRun?: boolean;
  /** Delete the source cabinet after children are created. Default
   *  true — the source is replaced by the children, not kept. */
  deleteSource?: boolean;
}

/**
 * Split the cabinet into one child per cluster. Returns the
 * preview / dry-run result either way.
 */
export async function splitCabinet(
  sceneId: string,
  cabinet: SceneCabinet,
  clusters: ReadonlyArray<SubCabinetCluster>,
  opts: SplitOptions = {},
): Promise<SplitResult> {
  if (clusters.length < 2) {
    throw new Error('splitCabinet: expected at least two clusters.');
  }
  if (cabinet.isLocked) {
    throw new Error('Cannot split a locked cabinet — unlock before committing.');
  }

  const clusterByMesh = new Map<string, number>();
  for (const c of clusters) {
    for (const m of c.meshNames) clusterByMesh.set(m, c.index);
  }

  // ── Partition assemblies / parts per cluster. ───────────────────
  // Orphan parts (mesh not in any cluster) fall to cluster 0.
  const assembliesPerCluster: SceneAssembly[][] = clusters.map(() => []);
  const orphanMeshes = new Set<string>();

  for (const asm of cabinet.assemblies ?? []) {
    // Bucket parts by cluster.
    const partsBy = new Map<number, SceneAssembly['parts']>();
    for (const p of asm.parts ?? []) {
      const mesh = p.meshNodeId;
      const clusterIdx = mesh ? clusterByMesh.get(mesh) : undefined;
      const bucketKey = clusterIdx ?? 0;
      if (mesh && clusterIdx === undefined) orphanMeshes.add(mesh);
      const list = partsBy.get(bucketKey) ?? [];
      list.push(p);
      partsBy.set(bucketKey, list);
    }

    // Split assembly meshNodeIds too.
    const meshByCluster = new Map<number, string[]>();
    for (const m of asm.meshNodeIds ?? []) {
      const clusterIdx = clusterByMesh.get(m) ?? 0;
      const list = meshByCluster.get(clusterIdx) ?? [];
      list.push(m);
      meshByCluster.set(clusterIdx, list);
    }

    for (const [clusterIdx, parts] of partsBy) {
      const meshes = meshByCluster.get(clusterIdx) ?? [];
      const suffix = clusters.length > 1 ? `-${clusterIdx + 1}` : '';
      assembliesPerCluster[clusterIdx].push({
        ...asm,
        id: `${asm.id}${suffix}`,
        parts,
        meshNodeIds: meshes,
        totalPartCount: parts.length,
      });
    }
  }

  // ── Build the child SceneCabinet payloads. ──────────────────────
  const baseCode = cabinet.cabinetCode || 'CAB';
  const baseName = cabinet.displayName || 'Cabinet';
  const childPayloads = clusters.map((cluster, i) => {
    const codeSuffix = `-${i + 1}`;
    const childCode = `${baseCode}${codeSuffix}`;
    const childName = `${baseName} (Part ${i + 1})`;

    // Position: translate cabinet.position by the delta from the
    // source bbox centroid to this cluster's centroid. Keeps the
    // split-out cabinets in their original world positions.
    const position = {
      x: cabinet.position.x + cluster.centroid.x,
      y: cabinet.position.y,
      z: cabinet.position.z + cluster.centroid.z,
    };

    return {
      // id is set by Firestore via addDoc
      sceneId,
      pddId: cabinet.pddId,
      archetypeId: cabinet.archetypeId,
      archetypeIds: cabinet.archetypeIds,
      cabinetCode: childCode,
      displayName: childName,
      configuration: cabinet.configuration,
      finishSelections: cabinet.finishSelections,
      position,
      rotation: cabinet.rotation,
      anchorPoint: cabinet.anchorPoint,
      glbUrl: cabinet.glbUrl,
      thumbnailUrl: cabinet.thumbnailUrl,
      renderUrl: cabinet.renderUrl,
      sourceModelUrl: cabinet.sourceModelUrl,
      sourceMeshNames: cluster.meshNames,
      assemblies: assembliesPerCluster[i],
      computedBOM: i === 0 ? cabinet.computedBOM : [],  // approximate; rollup recompute on save
      estimatedPrice: i === 0
        ? cabinet.estimatedPrice
        : { total: 0, currency: cabinet.estimatedPrice?.currency ?? 'UGX' } as SceneCabinet['estimatedPrice'],
      // Only the biggest cluster inherits the DesignItem binding —
      // user re-assigns the others.
      designItemId: i === 0 ? cabinet.designItemId : undefined,
      mdpId: i === 0 ? cabinet.mdpId : undefined,
      isLocked: false,
      notes: cabinet.notes,
      requiredQuantity: cabinet.requiredQuantity,
      sequence: (cabinet.sequence ?? 0) + i,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  });

  const previews: SplitChildPreview[] = childPayloads.map((p, i) => ({
    cabinetCode: p.cabinetCode,
    displayName: p.displayName,
    meshNames: p.sourceMeshNames ?? [],
    assemblyCount: p.assemblies.length,
    partCount: p.assemblies.reduce((s, a) => s + (a.parts?.length ?? 0), 0),
    position: p.position,
    size: clusters[i].size,
    inheritsDesignItemId: i === 0 && !!cabinet.designItemId,
  }));

  if (opts.dryRun) {
    return {
      children: previews,
      orphans: Array.from(orphanMeshes).sort(),
      dryRun: true,
    };
  }

  // ── Commit. Sequential writes to keep the scene doc's linked
  //    DesignItem cache recompute simple.
  const cabinetsColl = collection(
    db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION,
  );
  for (const payload of childPayloads) {
    // `id` is not part of the payload — addDoc assigns it. Cast
    // because our Omit<..., 'id'> isn't expressible against the
    // runtime structure cleanly.
    await addDoc(cabinetsColl, payload as unknown as Record<string, unknown>);
  }

  // Mark the source sequence to move it behind the children
  // (stable ordering in the roster until delete commits).
  const sourceRef = doc(
    db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinet.id,
  );
  if (opts.deleteSource !== false) {
    await deleteDoc(sourceRef);
  } else {
    await updateDoc(sourceRef, {
      notes: [
        cabinet.notes ?? '',
        `[split] replaced by ${clusters.length} child cabinets on ${new Date().toISOString().slice(0, 10)}`,
      ].filter(Boolean).join('\n'),
      updatedAt: serverTimestamp(),
    });
  }

  return {
    children: previews,
    orphans: Array.from(orphanMeshes).sort(),
    dryRun: false,
  };
}
