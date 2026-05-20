/**
 * revisionPartsRefresh — orchestrates the Revision → Parts Refresh loop
 * a user triggers from `CabinetDetailPanel`.
 *
 *   previewRevisionApply(sceneId, cabinetId, revisionId)
 *     → fetches the revision's GLB, runs `processModel({ dryRun: true })`,
 *       diffs the AI-grouped result against the cabinet's current parts,
 *       returns a PartsDiff ready for the modal.
 *
 *   applyRevisionToCabinet(sceneId, cabinetId, revisionId, decisions, user)
 *     → re-runs the parse + groups (non-dry), merges via `mergeDiff`,
 *       writes the new parts into the cabinet's assemblies (preserving
 *       the assembly hierarchy), bumps `lastAppliedRevisionNumber` +
 *       `lastAppliedRevisionId`, and resolves any open
 *       revision-detector issue for this cabinet.
 *
 * The second call re-runs the AI pass rather than passing the preview's
 * result through — keeps the UX robust if the user lingered on the
 * modal and the revision got updated in the meantime.
 */
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getRevision } from './designRevisionService';
import { parseGLB } from './parserGlb';
import { parse3DS } from './parser3ds';
import { processModel } from './processModel.service';
import {
  diffCabinetParts, mergeDiff, defaultDecisionFor,
  type PartsDiff, type ChangeDecision,
} from './revisionPartsDiff';
import { createModelPackage, getModelPackageVersions } from './modelPackage.service';
import { resolveOpenIssuesBySource } from '@/modules/design-manager/services/designItemIssueService';
import type { SceneCabinet } from '../types/scene.types';
import type { SceneAssembly, ScenePart } from '../types/assembly.types';
import type { DesignRevision } from '../types/designRevision.types';
import type { ModelPackage } from '../types/modelPackage.types';

const SCENES_COLLECTION = 'designScenes';
const CABINETS_SUBCOLLECTION = 'cabinets';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function fetchRevisionAndCabinet(
  sceneId: string, cabinetId: string, revisionId: string,
): Promise<{ revision: DesignRevision; cabinet: SceneCabinet; cabRef: ReturnType<typeof doc> }> {
  const revision = await getRevision(revisionId);
  if (!revision) throw new Error(`Revision ${revisionId} not found.`);
  if (!pickParseableSource(revision)) {
    throw new Error(
      `Revision ${revisionId} has no client-parseable model yet. ` +
      `If it was uploaded as STEP/X_T, wait for the CAD→GLB Cloud ` +
      `Function to finish before applying.`,
    );
  }

  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found in scene ${sceneId}.`);
  const cabinet = { id: snap.id, ...(snap.data() as Omit<SceneCabinet, 'id'>) } as SceneCabinet;

  return { revision, cabinet, cabRef };
}

type ParseableSource = { kind: 'glb' | '3ds'; url: string };

/**
 * Pick the best client-parseable source off a revision. Preference
 * order: native .3ds (DawinOS authoring format) → .glb (bulk-import
 * interchange). STEP / X_T are not directly parseable client-side —
 * they need the CAD→GLB Cloud Function to populate glbUrl first.
 */
function pickParseableSource(revision: DesignRevision): ParseableSource | null {
  if (revision.files?.threeDsUrl) return { kind: '3ds', url: revision.files.threeDsUrl };
  if (revision.files?.glbUrl)     return { kind: 'glb', url: revision.files.glbUrl };
  return null;
}

async function fetchAndParseModel(revision: DesignRevision) {
  const src = pickParseableSource(revision);
  if (!src) {
    throw new Error('Revision has no client-parseable model source.');
  }
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`Failed to fetch revision model (HTTP ${res.status}).`);
  const buffer = await res.arrayBuffer();
  return {
    parsed: src.kind === '3ds' ? parse3DS(buffer) : await parseGLB(buffer),
    fileType: src.kind as 'glb' | '3ds',
  };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export interface PreviewResult {
  revision: DesignRevision;
  diff: PartsDiff;
  /** Default decisions the modal pre-selects. */
  defaultDecisions: Record<string, ChangeDecision>;
  /** AI grouping confidence + source so the UI can warn if confidence is low. */
  grouping: { source: string; confidence: number };
  durationMs: number;
}

export async function previewRevisionApply(
  sceneId: string,
  cabinetId: string,
  revisionId: string,
): Promise<PreviewResult> {
  const { revision, cabinet } = await fetchRevisionAndCabinet(sceneId, cabinetId, revisionId);

  const { parsed, fileType } = await fetchAndParseModel(revision);
  const result = await processModel({
    sceneId,
    cabinetId,
    cabinet,
    parsedModel: parsed,
    modelName: `revision-${revision.revisionNumber}`,
    fileType,
    dryRun: true,
  });

  const diff = diffCabinetParts(cabinet, result.grouping.parts);

  const defaultDecisions: Record<string, ChangeDecision> = {};
  for (const ch of diff.changes) {
    defaultDecisions[ch.id] = defaultDecisionFor(ch);
  }

  return {
    revision,
    diff,
    defaultDecisions,
    grouping: { source: result.grouping.source, confidence: result.grouping.confidence },
    durationMs: result.durationMs,
  };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyResult {
  revision: DesignRevision;
  partsWritten: number;
  fieldsPreserved: number;
  issuesResolved: number;
  durationMs: number;
}

/**
 * Commit the user's selections. Re-parses + re-groups so a concurrent
 * revision change can't smuggle stale parts into the cabinet.
 */
export async function applyRevisionToCabinet(
  sceneId: string,
  cabinetId: string,
  revisionId: string,
  decisions: Record<string, ChangeDecision>,
  user: { uid: string; displayName?: string | null; email?: string | null },
): Promise<ApplyResult> {
  const start = Date.now();
  const { revision, cabinet, cabRef } = await fetchRevisionAndCabinet(sceneId, cabinetId, revisionId);

  const { parsed, fileType } = await fetchAndParseModel(revision);
  // NOTE: non-dry — we want the new ModelPackage persisted as the new
  // `current` (the modelPackage service archives the prior to its
  // versions subcollection automatically).
  const result = await processModel({
    sceneId,
    cabinetId,
    cabinet,
    parsedModel: parsed,
    modelName: `revision-${revision.revisionNumber}`,
    fileType,
  });

  const diff = diffCabinetParts(cabinet, result.grouping.parts);
  const { parts: mergedParts, fieldsPreserved } = mergeDiff(diff, { decisions });

  // Rebuild the cabinet's assemblies from the AI grouping but carry
  // our merged parts (which respect user locks + decisions).
  const newAssemblies = rebuildAssembliesWithParts(result.grouping.assemblies, mergedParts);

  await updateDoc(cabRef, {
    assemblies: newAssemblies,
    lastAppliedRevisionNumber: revision.revisionNumber,
    lastAppliedRevisionId: revision.id,
    updatedAt: serverTimestamp(),
  });

  // Auto-resolve open revision-detector issues for this cabinet, if any.
  let issuesResolved = 0;
  if (cabinet.designItemId) {
    try {
      const scopeKey = `${cabinet.id}|rev${revision.revisionNumber}`;
      issuesResolved = await resolveOpenIssuesBySource({
        designItemId: cabinet.designItemId,
        source: 'revision-detector',
        kind: 'revision',
        scopeKey,
        auditComment:
          `Auto-resolved: revision #${revision.revisionNumber} applied. ` +
          `${mergedParts.length} parts committed, ${fieldsPreserved} user-locked ` +
          `fields preserved.`,
        user,
      });
    } catch {
      // Swallow — the revision apply already succeeded; issue resolution
      // is a nicety, not a correctness requirement.
    }
  }

  return {
    revision,
    partsWritten: mergedParts.length,
    fieldsPreserved,
    issuesResolved,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Scene-wide batch apply
// ---------------------------------------------------------------------------

export interface BatchApplyCabinetResult {
  cabinetId: string;
  cabinetLabel: string;
  status: 'applied' | 'skipped-up-to-date' | 'skipped-no-glb' | 'error';
  partsWritten?: number;
  fieldsPreserved?: number;
  issuesResolved?: number;
  error?: string;
}

export interface BatchApplyResult {
  cabinets: BatchApplyCabinetResult[];
  applied: number;
  skipped: number;
  errored: number;
}

/**
 * Apply a specific revision to every cabinet in the scene, skipping
 * cabinets already on that revision.
 *
 * Uses DEFAULT decisions per cabinet (accept AI-incoming for
 * added/changed, drop removed, keep unchanged, preserve user-locked
 * fields). This is the auto-pilot path — users who want granular
 * control should use the per-cabinet modal.
 *
 * Sequential processing — concurrent apply would race on
 * `modelPackage.version` in the archive-then-set flow.
 */
export async function batchApplyRevisionToScene(
  sceneId: string,
  revisionId: string,
  cabinets: Array<Pick<SceneCabinet, 'id' | 'cabinetCode' | 'displayName' | 'lastAppliedRevisionNumber' | 'designItemId'>>,
  user: { uid: string; displayName?: string | null; email?: string | null },
  onProgress?: (cabinetId: string, index: number, total: number) => void,
): Promise<BatchApplyResult> {
  const results: BatchApplyCabinetResult[] = [];

  for (let i = 0; i < cabinets.length; i++) {
    const cab = cabinets[i];
    const label = cab.cabinetCode || cab.displayName || cab.id;
    onProgress?.(cab.id, i, cabinets.length);

    try {
      const preview = await previewRevisionApply(sceneId, cab.id, revisionId);

      // Skip when the cabinet is already on this revision AND the diff
      // is empty (both conditions protect against a stale marker).
      if (
        (cab.lastAppliedRevisionNumber ?? 0) >= preview.revision.revisionNumber
        && preview.diff.summary.added + preview.diff.summary.changed + preview.diff.summary.removed === 0
      ) {
        results.push({ cabinetId: cab.id, cabinetLabel: label, status: 'skipped-up-to-date' });
        continue;
      }

      const res = await applyRevisionToCabinet(
        sceneId, cab.id, preview.revision.id, preview.defaultDecisions, user,
      );
      results.push({
        cabinetId: cab.id, cabinetLabel: label,
        status: 'applied',
        partsWritten: res.partsWritten,
        fieldsPreserved: res.fieldsPreserved,
        issuesResolved: res.issuesResolved,
      });
    } catch (err) {
      const msg = (err as Error).message || 'Apply failed';
      // Map the "no GLB yet" error into a distinct status for the UI.
      const status: BatchApplyCabinetResult['status'] = /no GLB URL/i.test(msg)
        ? 'skipped-no-glb'
        : 'error';
      results.push({
        cabinetId: cab.id, cabinetLabel: label,
        status,
        error: status === 'error' ? msg : undefined,
      });
    }
  }

  return {
    cabinets: results,
    applied: results.filter(r => r.status === 'applied').length,
    skipped: results.filter(r => r.status.startsWith('skipped')).length,
    errored: results.filter(r => r.status === 'error').length,
  };
}

/**
 * Given the AI-grouped assemblies (which come with their own
 * inferred parts list) and the user-merged parts array, rebuild the
 * assemblies so each one carries only the parts whose `assemblyId`
 * points at it. Parts without a matching assembly fall into a
 * synthetic "uncategorised" assembly so we never silently drop rows.
 */
function rebuildAssembliesWithParts(
  assemblies: SceneAssembly[],
  parts: ScenePart[],
): SceneAssembly[] {
  const byAssembly = new Map<string, ScenePart[]>();
  const orphaned: ScenePart[] = [];
  for (const p of parts) {
    if (p.assemblyId && assemblies.some(a => a.id === p.assemblyId)) {
      const bucket = byAssembly.get(p.assemblyId) ?? [];
      bucket.push(p);
      byAssembly.set(p.assemblyId, bucket);
    } else {
      orphaned.push(p);
    }
  }
  const rebuilt = assemblies.map(asm => ({
    ...asm,
    parts: byAssembly.get(asm.id) ?? [],
    totalPartCount: (byAssembly.get(asm.id) ?? []).length,
  }));
  if (orphaned.length > 0) {
    const fallback: SceneAssembly = assemblies[0] ?? {
      id: 'uncategorised',
      cabinetId: orphaned[0].cabinetId,
      assemblyType: 'custom',
      assemblyCode: 'UNCAT',
      displayName: 'Uncategorised',
      parts: [],
      meshNodeIds: [],
      boundingBox: {
        min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 },
      },
      jointSpec: [],
      assemblySequence: [],
      isComplete: false,
      totalPartCount: 0,
      totalArea: 0,
      totalCost: 0,
      sequence: 999,
    };
    rebuilt.push({
      ...fallback,
      id: 'uncategorised',
      parts: orphaned,
      totalPartCount: orphaned.length,
    });
  }
  return rebuilt;
}

// ---------------------------------------------------------------------------
// Rollback — restore an archived ModelPackage version
// ---------------------------------------------------------------------------

export interface RollbackResult {
  restoredVersion: number;
  newPackageVersion: number;
  partsWritten: number;
}

/** List every historical ModelPackage version for a cabinet. */
export async function listCabinetModelPackageVersions(
  sceneId: string,
  cabinetId: string,
): Promise<ModelPackage[]> {
  return getModelPackageVersions(sceneId, cabinetId, 50);
}

/**
 * Restore an archived ModelPackage version as the cabinet's new current.
 *
 * Doesn't re-run AI or re-parse — the version's grouping / materials /
 * BOM are the authoritative source. Goes through `createModelPackage`
 * so the current-at-time-of-rollback is archived to `versions/` before
 * being overwritten — rollback is itself reversible.
 *
 * Clears `lastAppliedRevisionNumber` / `lastAppliedRevisionId`: the
 * restored parts no longer match the project's latest revision, so
 * the stale-revision detector will re-flag them (which is correct —
 * the user explicitly chose an older state).
 */
export async function rollbackToModelPackageVersion(
  sceneId: string,
  cabinetId: string,
  targetVersion: ModelPackage,
  user: { uid: string; displayName?: string | null; email?: string | null },
): Promise<RollbackResult> {
  void user; // Reserved for future audit stamping on the cabinet doc.

  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found.`);

  // Re-create the current ModelPackage from the selected version's
  // content. createModelPackage archives the existing current to
  // versions/ before writing, so the rollback itself is reversible.
  const newPkgInput = {
    sceneId,
    cabinetId,
    sourceType: targetVersion.sourceType,
    sourceId: targetVersion.sourceId,
    modelRef: targetVersion.modelRef,
    grouping: targetVersion.grouping,
    materials: targetVersion.materials,
    renders: targetVersion.renders,
    bom: targetVersion.bom,
    pricing: targetVersion.pricing,
    context: targetVersion.context,
    metadata: {
      processedBy: targetVersion.metadata.processedBy,
      processingDurationMs: 0,
      errors: [`Rolled back to v${targetVersion.version}`],
      steps: [],
    },
  };
  await createModelPackage(newPkgInput);

  // Mirror the restored grouping onto cabinet.assemblies so downstream
  // readers (cut list, DM sync) see the correct parts immediately.
  const newAssemblies = targetVersion.grouping.assemblies;
  await updateDoc(cabRef, {
    assemblies: newAssemblies,
    // Clear revision tracking — the restored parts don't correspond to
    // any particular `designRevisions` entry, so forcing re-detection
    // is correct. The detector will re-raise a 'revision' issue if the
    // project has a newer revision, which is the honest signal.
    lastAppliedRevisionNumber: null,
    lastAppliedRevisionId: null,
    updatedAt: serverTimestamp(),
  });

  // Count restored parts for the UI toast.
  const partsWritten = (newAssemblies ?? []).reduce(
    (sum, a) => sum + (a.parts?.length ?? 0),
    0,
  );

  // Re-read to get the bumped version the create path assigned.
  // createModelPackage doesn't return the version number directly —
  // read back from the cabinet denormalised field.
  const afterSnap = await getDoc(cabRef);
  const newPackageVersion =
    ((afterSnap.data() as { packageVersion?: number })?.packageVersion) ?? (targetVersion.version + 1);

  return {
    restoredVersion: targetVersion.version,
    newPackageVersion,
    partsWritten,
  };
}
