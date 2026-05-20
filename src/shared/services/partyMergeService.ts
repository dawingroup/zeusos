/**
 * Party Merge Service (P8/F1 follow-up — dedupe utility).
 *
 * When the same real-world party ends up with two records — e.g. an
 * operator created "Acme Ltd" in the finishes customer list, then later
 * a Shopify webhook auto-created "Acme Limited" from an order — the
 * cross-module FKs (CRMDeals, SalesOrders, DesignProjects, …) scatter
 * across both records. This service consolidates them into one.
 *
 * Scope:
 *   - Same-kind only: a `finishes_customer` can be merged into a
 *     `finishes_customer`, and an `advisory_client` into an
 *     `advisory_client`. Cross-subsidiary merges are a different
 *     operation (split a Customer into both, or link them via a
 *     shared external id) and are out of scope here.
 *   - Dry-run by default. Every caller must opt in with `apply: true`
 *     to execute writes. Dry-run returns the full plan so operators
 *     can eyeball the blast radius before committing.
 *   - Writes happen in Firestore batches (≤ 450 ops/batch, under the
 *     500 hard limit to leave headroom for the audit doc).
 *   - Source doc is marked merged rather than deleted, so audit trails
 *     and historical reports that reference the old id keep working.
 *     The source gets `{ mergedInto, mergedAt, mergedBy }` stamped;
 *     readers can filter it out by checking `mergedInto`.
 *   - An audit doc is written to `partyMerges` with the full plan +
 *     result, keyed by a server-generated id.
 *
 * What this service deliberately does NOT do:
 *   - Field-by-field reconciliation of the two source records (e.g.
 *     deciding whose address to keep). That's a UI concern that
 *     should happen BEFORE calling this service: update the target
 *     record first, then merge the source in. This service only
 *     rewrites pointers, not content.
 *   - Cascading deletes. Nothing is deleted; nothing is hard-removed.
 *   - Cross-subsidiary "Party unification". That requires an explicit
 *     shared external id and is a different slice.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  addDoc,
  serverTimestamp,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type WhereFilterOp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { PartyKind, PartyRef } from '@/shared/types/party';
import { partyRefEquals } from '@/shared/types/party';

// ---------------------------------------------------------------------------
// Collection targets — where we need to rewrite FKs
// ---------------------------------------------------------------------------

/**
 * One collection we'll scan + rewrite during a merge.
 *
 * `legacyIdField` is the pre-P8 FK name (`customerId` for finishes,
 * `clientId` for advisory). `partyField` is the new P8 composite field
 * (`party.partyId` match) — optional because not every collection has
 * been upgraded yet.
 *
 * The service always queries on `legacyIdField` because every extant
 * row still carries it. `partyField` is only used to decide what the
 * UPDATE writes back (stamp the new `party` as well when the target
 * doc already carries one).
 */
interface TargetCollection {
  name: string;
  legacyIdField: string;
  partyField?: 'party';
}

const FINISHES_TARGETS: TargetCollection[] = [
  { name: 'crmDeals', legacyIdField: 'customerId', partyField: 'party' },
  { name: 'crmActivities', legacyIdField: 'customerId', partyField: 'party' },
  { name: 'crmTasks', legacyIdField: 'customerId', partyField: 'party' },
  { name: 'salesOrders', legacyIdField: 'customerId', partyField: 'party' },
  { name: 'designProjects', legacyIdField: 'customerId' },
  { name: 'clientQuotes', legacyIdField: 'customerId' },
  { name: 'customerContacts', legacyIdField: 'customerId' },
];

const ADVISORY_TARGETS: TargetCollection[] = [
  { name: 'engagements', legacyIdField: 'clientId' },
  { name: 'contacts', legacyIdField: 'clientId' },
];

const SOURCE_COLLECTION: Record<PartyKind, string> = {
  finishes_customer: 'customers',
  advisory_client: 'clients',
};

const AUDIT_COLLECTION = 'partyMerges';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MergeItem {
  /** Collection the doc lives in. */
  collectionName: string;
  /** The doc to rewrite. */
  docId: string;
  /** Why this doc was included (useful for dry-run review). */
  reason:
    | 'legacy id match'
    | 'party.partyId match'
    | 'source record';
  /** Field-level updates that would be applied. */
  updates: Record<string, unknown>;
}

export interface MergePlan {
  source: PartyRef;
  target: PartyRef;
  items: MergeItem[];
  /** Total docs that would be touched, including the source record itself. */
  totalDocs: number;
  /** Per-collection counts for quick review. */
  breakdown: Record<string, number>;
}

export interface MergeOptions {
  /** User initiating the merge (stamped on every rewrite + audit). */
  userId: string;
  /** Must be explicitly true to execute writes. Defaults to dry-run. */
  apply?: boolean;
  /** Free-text reason captured in the audit doc. */
  reason?: string;
}

export interface MergeResult {
  plan: MergePlan;
  /** True iff writes were actually committed. */
  applied: boolean;
  /** Audit doc id (only set when `applied` is true). */
  auditId?: string;
  /** Number of Firestore batches committed. */
  batchCount: number;
}

export class PartyMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PartyMergeError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge `source` into `target`. Every cross-module doc pointing at
 * `source` is rewritten to point at `target` instead, and the source
 * record is stamped `mergedInto`.
 *
 * Rules enforced:
 *   - source and target must share the same `partyKind` — merging
 *     across subsidiaries is not supported here.
 *   - source and target must be different ids.
 *   - both source and target must exist in their canonical collection
 *     (we don't merge into a missing target — that would silently
 *     orphan every rewritten row).
 *   - source must not already have been merged elsewhere (prevents
 *     double-merge loops and ensures the audit trail is a tree).
 *
 * Returns a `MergeResult` with the plan. For a dry-run (default), no
 * writes happen and `applied: false`. When `apply: true`, writes are
 * committed in batches and an audit doc is written to `partyMerges`.
 */
export async function mergeParty(
  source: PartyRef,
  target: PartyRef,
  options: MergeOptions,
): Promise<MergeResult> {
  validateMergeArgs(source, target);

  const sourceSnap = await getDoc(doc(db, SOURCE_COLLECTION[source.partyKind], source.partyId));
  const targetSnap = await getDoc(doc(db, SOURCE_COLLECTION[target.partyKind], target.partyId));
  validateSourceAndTarget(source, target, sourceSnap, targetSnap);

  const plan = await buildPlan(source, target);

  if (!options.apply) {
    return { plan, applied: false, batchCount: 0 };
  }

  const batchCount = await commitPlan(plan, options.userId);
  const auditId = await writeAudit(plan, options);

  return { plan, applied: true, auditId, batchCount };
}

/**
 * Build the plan without touching Firestore for writes. Useful for
 * admin UIs that want to preview the blast radius before confirming.
 *
 * Exposed as its own export because some callers want to surface the
 * plan in a confirmation modal and then separately call `mergeParty`
 * with `apply: true`. Both paths re-scan because the data can shift
 * between preview and apply — plans are cheap.
 */
export async function previewMerge(
  source: PartyRef,
  target: PartyRef,
): Promise<MergePlan> {
  validateMergeArgs(source, target);
  return buildPlan(source, target);
}

// ---------------------------------------------------------------------------
// Internal — validation
// ---------------------------------------------------------------------------

function validateMergeArgs(source: PartyRef, target: PartyRef): void {
  if (source.partyKind !== target.partyKind) {
    throw new PartyMergeError(
      `Cross-subsidiary merge not supported: source is ${source.partyKind}, ` +
        `target is ${target.partyKind}.`,
    );
  }
  if (partyRefEquals(source, target)) {
    throw new PartyMergeError(
      `Cannot merge ${source.partyKind}:${source.partyId} into itself.`,
    );
  }
}

function validateSourceAndTarget(
  source: PartyRef,
  target: PartyRef,
  sourceSnap: DocumentSnapshot,
  targetSnap: DocumentSnapshot,
): void {
  if (!sourceSnap.exists()) {
    throw new PartyMergeError(
      `Source ${source.partyKind}:${source.partyId} does not exist.`,
    );
  }
  if (!targetSnap.exists()) {
    throw new PartyMergeError(
      `Target ${target.partyKind}:${target.partyId} does not exist.`,
    );
  }
  const sourceData = sourceSnap.data() as { mergedInto?: string } | undefined;
  if (sourceData?.mergedInto) {
    throw new PartyMergeError(
      `Source ${source.partyKind}:${source.partyId} is already merged into ` +
        `${sourceData.mergedInto}. Merge the downstream record instead.`,
    );
  }
  const targetData = targetSnap.data() as { mergedInto?: string } | undefined;
  if (targetData?.mergedInto) {
    throw new PartyMergeError(
      `Target ${target.partyKind}:${target.partyId} is itself merged ` +
        `(into ${targetData.mergedInto}). Point at the surviving record.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal — plan construction
// ---------------------------------------------------------------------------

function targetsFor(kind: PartyKind): TargetCollection[] {
  return kind === 'finishes_customer' ? FINISHES_TARGETS : ADVISORY_TARGETS;
}

async function buildPlan(source: PartyRef, target: PartyRef): Promise<MergePlan> {
  const items: MergeItem[] = [];
  const breakdown: Record<string, number> = {};

  for (const spec of targetsFor(source.partyKind)) {
    const hits = await scanCollection(spec, source, target);
    for (const hit of hits) items.push(hit);
    if (hits.length > 0) breakdown[spec.name] = (breakdown[spec.name] || 0) + hits.length;
  }

  // Source record itself — mark it merged. Always last item so that the
  // audit flow reads naturally (rewrite pointers, then retire source).
  const sourceCol = SOURCE_COLLECTION[source.partyKind];
  items.push({
    collectionName: sourceCol,
    docId: source.partyId,
    reason: 'source record',
    updates: {
      mergedInto: target.partyId,
      // `mergedAt` / `mergedBy` are stamped at commit time using
      // serverTimestamp and the caller's userId; here they're left
      // as placeholders so dry-run output still reads cleanly.
      mergedAt: '<serverTimestamp>',
      mergedBy: '<caller>',
    },
  });
  breakdown[sourceCol] = (breakdown[sourceCol] || 0) + 1;

  return {
    source,
    target,
    items,
    totalDocs: items.length,
    breakdown,
  };
}

/**
 * Scan one collection for rows pointing at `source` and construct the
 * updates that would point them at `target`.
 *
 * We query on the legacy id field (`customerId` / `clientId`) because
 * every row still carries it — both pre-P8 rows and P8-2 rows. That
 * gives us one query per collection regardless of migration state.
 *
 * For collections that also have a `party` composite field, we detect
 * its presence on the doc and rewrite both fields atomically. Rows
 * that don't yet carry `party` stay legacy — a future P8-4 sweep will
 * flip them, not this service.
 */
async function scanCollection(
  spec: TargetCollection,
  source: PartyRef,
  target: PartyRef,
): Promise<MergeItem[]> {
  const items: MergeItem[] = [];

  // Primary query — legacy id match. This catches every row.
  const q: Query = query(
    collection(db, spec.name),
    where(spec.legacyIdField, '==' as WhereFilterOp, source.partyId),
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data();
    const updates: Record<string, unknown> = {
      [spec.legacyIdField]: target.partyId,
    };
    // If the row already carries a composite party ref AND it points at
    // the source (defensive: ids could collide across kinds), rewrite
    // it too. We never INTRODUCE a party ref on a legacy row here —
    // doing so would quietly assume `finishes_customer` kind even when
    // running an `advisory_client` merge, which would be a bug. P8-4
    // is the slice that should populate `party` on legacy rows.
    if (spec.partyField && data.party && typeof data.party === 'object') {
      const existing = data.party as PartyRef;
      if (existing.partyId === source.partyId && existing.partyKind === source.partyKind) {
        updates.party = { partyId: target.partyId, partyKind: target.partyKind };
      }
    }
    // Denormalized customer-name caches: when the target has a known
    // display name on this doc, we *could* refresh it, but that
    // requires a read of the target record here and risks drift. Skip:
    // a subsequent read-time hydration will rebuild the denorm.
    items.push({
      collectionName: spec.name,
      docId: d.id,
      reason: 'legacy id match',
      updates,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Internal — commit
// ---------------------------------------------------------------------------

/**
 * Commit the plan in Firestore batches. Uses 450 ops/batch to stay
 * under the 500 hard limit with room for the audit doc (written
 * separately via `addDoc` so it can get a server-generated id).
 *
 * Returns the batch count so callers can log it.
 */
async function commitPlan(plan: MergePlan, userId: string): Promise<number> {
  const BATCH_SIZE = 450;
  let batchCount = 0;
  const now = serverTimestamp();

  for (let i = 0; i < plan.items.length; i += BATCH_SIZE) {
    const chunk = plan.items.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const ref: DocumentReference = doc(db, item.collectionName, item.docId);
      const updates: Record<string, unknown> = { ...item.updates };
      if (item.reason === 'source record') {
        // Replace placeholders with live sentinels at commit time.
        updates.mergedAt = now;
        updates.mergedBy = userId;
      } else {
        updates.updatedAt = now;
        updates.updatedBy = userId;
      }
      batch.update(ref, updates);
    }
    await batch.commit();
    batchCount += 1;
  }

  return batchCount;
}

/**
 * Write an audit doc capturing the merge for later forensic review.
 *
 * We store the full plan (every touched doc) rather than a summary
 * because the cost of the extra bytes is dwarfed by how valuable the
 * audit is when something needs to be un-done. Includes `appliedAt`
 * and `performedBy` for accountability.
 */
async function writeAudit(plan: MergePlan, options: MergeOptions): Promise<string> {
  const docRef = await addDoc(collection(db, AUDIT_COLLECTION), {
    source: plan.source,
    target: plan.target,
    totalDocs: plan.totalDocs,
    breakdown: plan.breakdown,
    items: plan.items.map((it) => ({
      collectionName: it.collectionName,
      docId: it.docId,
      reason: it.reason,
      // Strip placeholder sentinels so the audit reflects what was
      // actually written.
      updates: Object.fromEntries(
        Object.entries(it.updates).filter(([, v]) => v !== '<serverTimestamp>' && v !== '<caller>'),
      ),
    })),
    reason: options.reason ?? null,
    performedBy: options.userId,
    performedAt: serverTimestamp(),
  });
  return docRef.id;
}
