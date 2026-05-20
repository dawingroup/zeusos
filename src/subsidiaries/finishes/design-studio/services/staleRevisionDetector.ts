/**
 * staleRevisionDetector — raise a DesignItemIssue when a cabinet's
 * parts are out-of-date with the latest 3D revision for its project.
 *
 * Background: `DesignRevision` tracks every STEP / X_T / GLB upload
 * against an MO or project. The cabinet's parts array meanwhile lives
 * under `modelPackage/current` at a specific `version`. When someone
 * re-uploads a revised model from Shapr3D the revision counter goes
 * up, but the cabinet's parts stay pinned to the version they were
 * derived from until the model-processing pipeline re-runs.
 *
 * Until the full re-parse pipeline is wired up (future work), this
 * detector is a cheap early-warning: it compares
 *   max(designRevisions.revisionNumber for this project)
 * against each cabinet's `modelPackage.version` (proxied by a
 * `lastAppliedRevisionNumber` written alongside scene updates) and
 * raises a 'revision' issue when stale.
 *
 * Uses `findOpenIssue` for idempotency so re-running the detector
 * doesn't duplicate the same warning.
 */
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { DesignRevision } from '../types/designRevision.types';
import type { SceneCabinet } from '../types/scene.types';
import {
  findOpenIssue,
  createDesignItemIssue,
} from '@/modules/design-manager/services/designItemIssueService';

const REVISIONS_COLLECTION = 'designRevisions';

/**
 * A cabinet is considered stale if its `lastAppliedRevisionNumber`
 * (stamped when parts last flowed in from a revision) is lower than
 * the project's newest revision.
 */
interface StaleResult {
  cabinet: SceneCabinet;
  currentRevision: number;
  latestRevision: number;
  revisionId: string;
}

export async function detectStaleCabinets(
  projectId: string,
  cabinets: SceneCabinet[],
): Promise<StaleResult[]> {
  // Pull the single newest revision for this project.
  const snap = await getDocs(query(
    collection(db, REVISIONS_COLLECTION),
    where('projectId', '==', projectId),
    orderBy('revisionNumber', 'desc'),
    limit(1),
  ));
  if (snap.empty) return [];
  const latest = { id: snap.docs[0].id, ...snap.docs[0].data() } as DesignRevision;

  const out: StaleResult[] = [];
  for (const cab of cabinets) {
    // `lastAppliedRevisionNumber` is the forward-compatible field; if
    // missing we treat the cabinet as never having received a revision
    // update — but only flag when a revision actually exists and looks
    // like it should have reached this cabinet.
    const applied =
      (cab as unknown as { lastAppliedRevisionNumber?: number }).lastAppliedRevisionNumber ?? 0;
    if (applied < latest.revisionNumber) {
      out.push({
        cabinet: cab,
        currentRevision: applied,
        latestRevision: latest.revisionNumber,
        revisionId: latest.id,
      });
    }
  }
  return out;
}

/**
 * Idempotently raise "revision pending parts refresh" issues for
 * every stale cabinet that is bound to a DesignItem. Cabinets without
 * a designItemId are skipped (nothing to route the issue to).
 */
export async function raiseStaleRevisionIssues(
  projectId: string,
  sceneId: string,
  cabinets: SceneCabinet[],
  user: { uid: string; displayName?: string | null; email?: string | null },
): Promise<{ raised: number; skipped: number }> {
  const stale = await detectStaleCabinets(projectId, cabinets);
  let raised = 0;
  let skipped = 0;

  for (const s of stale) {
    if (!s.cabinet.designItemId) { skipped++; continue; }

    const scopeKey = `${s.cabinet.id}|rev${s.latestRevision}`;
    const existing = await findOpenIssue({
      designItemId: s.cabinet.designItemId,
      source: 'revision-detector',
      kind: 'revision',
      scopeKey,
    });
    if (existing) { skipped++; continue; }

    await createDesignItemIssue(
      {
        projectId,
        designItemId: s.cabinet.designItemId,
        kind: 'revision',
        severity: 'major',
        title: `Revision #${s.latestRevision} not yet applied to ${s.cabinet.cabinetCode || s.cabinet.id}`,
        body:
          `The latest 3D revision for this project is #${s.latestRevision}, ` +
          `but this cabinet's parts are still derived from revision #${s.currentRevision}.\n\n` +
          `Re-run the model-processing pipeline on revision ${s.revisionId} and re-sync ` +
          `parts to keep the Design Manager cutting list in lockstep with the 3D model.`,
        scope: {
          sceneId,
          cabinetId: s.cabinet.id,
          // scopeKey encoded in meshNodeId slot so findOpenIssue idempotency sees it.
          meshNodeId: scopeKey,
        },
        source: 'revision-detector',
      },
      user,
    );
    raised++;
  }

  return { raised, skipped };
}
