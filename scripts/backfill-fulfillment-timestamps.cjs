/**
 * P7 phase 5 prep: backfill `fulfillment.{receivedAt,packedAt,dispatchedAt,
 * deliveredAt,installedAt,completedAt}` on legacy design items that only
 * carry the deprecated flat `fulfillmentStatus` field.
 *
 * Context (F10 / P7):
 *   P7 phase 3 made timestamps the source of truth for the fulfillment
 *   pipeline and stopped writing the flat `fulfillmentStatus` field on
 *   transitions. Phase 4 migrated readers off the flat field via
 *   `deriveFulfillmentStatus`. That leaves a residue of pre-phase-3 rows
 *   that still only advertise their state through the flat field — the
 *   derivation has a backward-compat fallback for those, but it's
 *   scoped to the 'complete' terminal and pre-packing pre-`received`
 *   states. Legacy rows that are mid-pipeline (received / packing /
 *   ready_for_dispatch / dispatched / delivered / installed) appear
 *   as 'not_released' through the derivation because no timestamp was
 *   ever written — a silent regression.
 *
 *   This script stamps a timestamp for the CURRENT flat-field state using
 *   `updatedAt` as a best-effort proxy for when the state was reached.
 *   Timestamps for earlier states in the pipeline are NOT backfilled —
 *   the derivation takes the most-advanced timestamp present, so a
 *   single stamp at the current level is sufficient for the reader.
 *   (If auditing later wants full history we'd need a write-log sweep;
 *   that's out of scope here.)
 *
 *   Once this has been applied in production, phase 5 can drop the
 *   @deprecated flat fields from the type entirely.
 *
 * Mapping (flat → timestamp):
 *   'received'           → fulfillment.receivedAt
 *   'packing'            → fulfillment.receivedAt    (packing is post-received,
 *                                                     pre-packedAt; receivedAt
 *                                                     is the gate and matches
 *                                                     the derivation fallback)
 *   'ready_for_dispatch' → fulfillment.packedAt
 *   'dispatched'         → fulfillment.dispatchedAt
 *   'delivered'          → fulfillment.deliveredAt
 *   'installed'          → fulfillment.installedAt
 *   'complete'           → fulfillment.completedAt
 *
 * Upstream pre-'received' states (not_released, in_production,
 * awaiting_receipt) need no timestamp — the derivation falls through
 * to the flat field for those and that path is permanent by design.
 *
 * Default dry-run; pass --apply to write.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

// Only these flat-field states need a timestamp backfill. The others
// ('not_released', 'in_production', 'awaiting_receipt') are permanently
// served by the flat-field fallback in deriveFulfillmentStatus.
const FLAT_TO_TIMESTAMP_KEY = {
  received: 'receivedAt',
  packing: 'receivedAt',
  ready_for_dispatch: 'packedAt',
  dispatched: 'dispatchedAt',
  delivered: 'deliveredAt',
  installed: 'installedAt',
  complete: 'completedAt',
};

function needsBackfill(data) {
  const flat = data.fulfillmentStatus;
  if (!flat) return null;
  const tsKey = FLAT_TO_TIMESTAMP_KEY[flat];
  if (!tsKey) return null;
  const existing = data.fulfillment?.[tsKey];
  if (existing) return null; // already stamped — nothing to do
  return tsKey;
}

(async () => {
  console.log(
    `\n=== P7 phase 5 prep: fulfillment timestamp backfill ${APPLY ? '(APPLY)' : '(DRY RUN)'} ===\n`,
  );

  // Scan every designItems collectionGroup — top-level + nested.
  const snap = await db.collectionGroup('designItems').get();
  console.log(`Scanned ${snap.size} design item docs`);

  const candidates = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const tsKey = needsBackfill(data);
    if (!tsKey) continue;

    // Fall back to serverTimestamp if updatedAt is missing — better than
    // skipping, since the derivation only needs presence (truthy) to
    // pick the state.
    const stamp = data.updatedAt || null;
    candidates.push({
      ref: doc.ref,
      path: doc.ref.path,
      name: data.name || '(unnamed)',
      flatStatus: data.fulfillmentStatus,
      tsKey,
      proxyStamp: stamp,
    });
  }

  console.log(`Found ${candidates.length} rows needing a timestamp backfill\n`);

  if (candidates.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  // Group by status so the human eyeballing the dry-run can sanity-check.
  const byStatus = {};
  for (const c of candidates) {
    byStatus[c.flatStatus] = (byStatus[c.flatStatus] || 0) + 1;
  }
  console.log('Breakdown:');
  for (const [s, n] of Object.entries(byStatus)) {
    console.log(`  ${s}: ${n}`);
  }
  console.log();

  console.log('Sample (first 10):');
  for (const c of candidates.slice(0, 10)) {
    console.log(
      `  ${c.path} | ${c.name} | flat=${c.flatStatus} → fulfillment.${c.tsKey}`,
    );
  }
  console.log();

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write changes.');
    process.exit(0);
  }

  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const c of chunk) {
      // Use the proxy stamp if we have one; otherwise serverTimestamp.
      const stamp =
        c.proxyStamp || admin.firestore.FieldValue.serverTimestamp();
      batch.update(c.ref, {
        [`fulfillment.${c.tsKey}`]: stamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'p7-phase5-backfill-script',
      });
    }

    await batch.commit();
    written += chunk.length;
    console.log(
      `  Committed batch ${i / BATCH_SIZE + 1}: ${chunk.length} items (total ${written}/${candidates.length})`,
    );
  }

  console.log(`\n✅ P7 phase 5 prep complete. Backfilled ${written} items.`);
  console.log(
    'Next: verify deriveFulfillmentStatus returns the expected state for a',
  );
  console.log(
    'sample of the backfilled rows, then schedule the type-level removal',
  );
  console.log('of the @deprecated flat fields.');
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
