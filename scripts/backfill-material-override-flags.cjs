/**
 * P12-8 backfill: flag legacy material rows that have BOTH a pinned
 * `pricing.unitCost` AND an `inventoryItemId` as `isOverride: true`.
 *
 * Context (F11 / P12):
 *   Before P12, `Material.pricing.unitCost` and the linked
 *   `InventoryItem.pricing.costPerUnit` were two separate truth sources
 *   for the same economic fact. P12 makes the InventoryItem the source
 *   of truth when a material has an `inventoryItemId`, UNLESS the
 *   material has `pricing.isOverride: true`, in which case the pinned
 *   value wins and the UI shows an "override" badge.
 *
 *   Rows written BEFORE the `isOverride` flag existed that happen to
 *   carry both fields today were, implicitly, overrides — the operator
 *   set a specific unitCost even though an inventory link was available.
 *   We treat them as such retroactively so the P12-4 drift badge stops
 *   lighting up every legacy material (false-positive storm).
 *
 *   "Best-effort" — this is conservative: we only flag rows where BOTH
 *   fields coexist. Materials with just pricing and no link stay alone;
 *   materials with just a link and no pinned cost stay alone.
 *
 * Scans:
 *   - global:   `materials` (top-level)
 *   - customer: `customers/{id}/materials` (subcollection)
 *   - project:  `designProjects/{id}/materials` (subcollection)
 *   Subcollections are reached via collectionGroup('materials') to
 *   avoid an O(customers + projects) roundtrip.
 *
 * Stamp applied (mirrors stampMaterialCostOverride's first-toggle path):
 *   pricing.isOverride      = true
 *   pricing.overrideReason  = 'P12-8 backfill: existing pinned price on
 *                              inventory-linked material treated as
 *                              explicit override.'
 *   pricing.overrideAt      = serverTimestamp()
 *   pricing.overrideBy      = 'p12-backfill-script'
 *
 * Pass --apply to write. Default is dry-run. Logs a sample of 10 rows
 * in both modes so humans can spot-check before committing.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const REASON =
  'P12-8 backfill: existing pinned price on inventory-linked material treated as explicit override.';

function isCandidate(data) {
  if (!data.inventoryItemId) return false;
  const pricing = data.pricing;
  if (!pricing) return false;
  if (typeof pricing.unitCost !== 'number') return false;
  // Already flagged — skip so we don't re-stamp overrideAt.
  if (pricing.isOverride === true) return false;
  return true;
}

(async () => {
  console.log(
    `\n=== P12-8 backfill: material override flags ${APPLY ? '(APPLY)' : '(DRY RUN)'} ===\n`,
  );

  const candidates = [];

  // Global + all subcollections named "materials" in one sweep.
  // Note: collectionGroup pulls everything named `materials` — including
  // the global top-level collection AND both subcollection variants.
  const snap = await db.collectionGroup('materials').get();
  console.log(`Scanned ${snap.size} material docs (global + subcollections)`);

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!isCandidate(data)) continue;
    candidates.push({
      ref: doc.ref,
      path: doc.ref.path,
      name: data.name || '(unnamed)',
      unitCost: data.pricing.unitCost,
      currency: data.pricing.currency,
      inventoryItemId: data.inventoryItemId,
    });
  }

  console.log(`Found ${candidates.length} rows to flag\n`);

  if (candidates.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  console.log('Sample (first 10):');
  for (const c of candidates.slice(0, 10)) {
    console.log(
      `  ${c.path} | ${c.name} | ${c.unitCost} ${c.currency || '?'} | inv=${c.inventoryItemId}`,
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
      batch.update(c.ref, {
        'pricing.isOverride': true,
        'pricing.overrideReason': REASON,
        'pricing.overrideAt': admin.firestore.FieldValue.serverTimestamp(),
        'pricing.overrideBy': 'p12-backfill-script',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'p12-backfill-script',
      });
    }

    await batch.commit();
    written += chunk.length;
    console.log(
      `  Committed batch ${i / BATCH_SIZE + 1}: ${chunk.length} items (total ${written}/${candidates.length})`,
    );
  }

  console.log(`\n✅ P12-8 backfill complete. Flagged ${written} materials.`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
