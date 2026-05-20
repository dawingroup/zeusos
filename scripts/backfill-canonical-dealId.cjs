/**
 * P16 phase 2: backfill canonical `dealId` on salesOrders and
 * designProjects so the legacy `crmDealId` / `linkedDealId` fields can
 * be dropped from the type surface.
 *
 * Context (P16 / F13):
 *   Phase 1 (commit 092e48f) added the canonical `dealId` field on both
 *   `SalesOrder` and `DesignProject`. Writers dual-stamp — they set BOTH
 *   the canonical and the legacy field during the transition window so
 *   readers on old builds keep working. Readers go through
 *   `resolveDealId()` in `@/shared/utils/fkResolvers` which prefers the
 *   canonical but falls back to the legacy field.
 *
 *   Phase 2 (this script) copies the legacy field forward on every
 *   pre-phase-1 doc so no row is legacy-only. Once applied, reader
 *   fallbacks can be deleted and the @deprecated fields dropped from
 *   the TS type without losing data.
 *
 * Collections scanned:
 *   - salesOrders       (legacy: crmDealId    → canonical: dealId)
 *   - designProjects    (legacy: linkedDealId → canonical: dealId)
 *
 * Operation (per collection):
 *   1. READ every doc.
 *   2. Bucket into:
 *        - canonical_only       → canonical present, legacy absent  (no action)
 *        - legacy_only          → legacy present, canonical absent  (BACKFILL)
 *        - both_match           → canonical === legacy              (no action)
 *        - both_drift           → canonical !== legacy              (FLAG — needs manual review;
 *                                                                     do NOT auto-resolve,
 *                                                                     we don't know which is right)
 *        - neither              → neither present                   (no action; orphan or
 *                                                                     never-linked doc)
 *   3. Dry-run by default: print the bucket sizes, sample up to 5 ids per
 *      bucket, and exit. Pass `--apply` to write `dealId = <legacy>` on
 *      the `legacy_only` bucket. Drift rows are NEVER written by this
 *      script — they need operator review.
 *
 * Usage:
 *   node scripts/backfill-canonical-dealId.cjs             # dry-run
 *   node scripts/backfill-canonical-dealId.cjs --apply     # write
 *   node scripts/backfill-canonical-dealId.cjs --collection=salesOrders
 *
 * Idempotent: re-running after an apply shows everything in
 * canonical_only / both_match / neither.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--collection=')) || '').split('=')[1];

/** @typedef {{ collection: string, legacyField: string }} Target */
/** @type {Target[]} */
const TARGETS = [
  { collection: 'salesOrders', legacyField: 'crmDealId' },
  { collection: 'designProjects', legacyField: 'linkedDealId' },
];

const sample = (arr, n = 5) => arr.slice(0, n);

async function scanCollection({ collection, legacyField }) {
  const snap = await db.collection(collection).get();
  const buckets = {
    canonical_only: [],
    legacy_only: [],
    both_match: [],
    both_drift: [],
    neither: [],
  };

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const canonical = data.dealId;
    const legacy = data[legacyField];
    if (canonical && !legacy) buckets.canonical_only.push(doc.id);
    else if (!canonical && legacy) buckets.legacy_only.push({ id: doc.id, legacy });
    else if (canonical && legacy && canonical === legacy) buckets.both_match.push(doc.id);
    else if (canonical && legacy && canonical !== legacy) {
      buckets.both_drift.push({ id: doc.id, canonical, legacy });
    } else buckets.neither.push(doc.id);
  });

  console.log(`\n=== ${collection} (legacy field: ${legacyField}) ===`);
  console.log(`  Total docs:        ${snap.size}`);
  console.log(`  canonical_only:    ${buckets.canonical_only.length}  (no action)`);
  console.log(`  legacy_only:       ${buckets.legacy_only.length}     (BACKFILL)`);
  console.log(`  both_match:        ${buckets.both_match.length}      (no action)`);
  console.log(`  both_drift:        ${buckets.both_drift.length}      (FLAG — manual review)`);
  console.log(`  neither:           ${buckets.neither.length}         (no action; never linked)`);

  if (buckets.legacy_only.length > 0) {
    console.log('\n  Sample legacy_only rows (would receive dealId = <legacy>):');
    sample(buckets.legacy_only).forEach(({ id, legacy }) => {
      console.log(`    ${id}  →  dealId=${legacy}`);
    });
  }

  if (buckets.both_drift.length > 0) {
    console.log('\n  ⚠️  DRIFT rows (NOT written by this script — needs review):');
    sample(buckets.both_drift).forEach(({ id, canonical, legacy }) => {
      console.log(`    ${id}  canonical=${canonical}  legacy=${legacy}`);
    });
  }

  if (APPLY && buckets.legacy_only.length > 0) {
    console.log(`\n  Applying ${buckets.legacy_only.length} backfill write(s)...`);
    // Batch in chunks of 400 (Firestore max is 500, buffer for safety).
    const CHUNK = 400;
    for (let i = 0; i < buckets.legacy_only.length; i += CHUNK) {
      const batch = db.batch();
      for (const { id, legacy } of buckets.legacy_only.slice(i, i + CHUNK)) {
        batch.update(db.collection(collection).doc(id), { dealId: legacy });
      }
      await batch.commit();
      console.log(
        `    committed ${Math.min(i + CHUNK, buckets.legacy_only.length)} / ${buckets.legacy_only.length}`,
      );
    }
    console.log('  ✅ Backfill complete for this collection.');
  } else if (!APPLY && buckets.legacy_only.length > 0) {
    console.log(`\n  (dry-run — pass --apply to write ${buckets.legacy_only.length} update(s))`);
  }

  return buckets;
}

async function main() {
  console.log('P16 phase 2 — canonical dealId backfill');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  if (ONLY) console.log(`Scoped to collection: ${ONLY}`);

  const targets = ONLY ? TARGETS.filter((t) => t.collection === ONLY) : TARGETS;
  if (targets.length === 0) {
    console.error(`\nNo target matched --collection=${ONLY}. Valid: ${TARGETS.map((t) => t.collection).join(', ')}`);
    process.exit(1);
  }

  const results = {};
  for (const target of targets) {
    results[target.collection] = await scanCollection(target);
  }

  console.log('\n=== Summary ===');
  let totalBackfill = 0;
  let totalDrift = 0;
  for (const [coll, b] of Object.entries(results)) {
    totalBackfill += b.legacy_only.length;
    totalDrift += b.both_drift.length;
    console.log(
      `  ${coll.padEnd(18)} backfill=${String(b.legacy_only.length).padStart(4)}  drift=${String(b.both_drift.length).padStart(4)}`,
    );
  }
  console.log(`\n  Total ${APPLY ? 'written' : 'would-write'}: ${totalBackfill}`);
  if (totalDrift > 0) {
    console.log(`  Total drift (unresolved): ${totalDrift}  ← investigate before dropping legacy fields`);
    process.exitCode = 2; // non-zero so CI / humans notice
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
