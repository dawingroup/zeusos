/**
 * Orphan field cleanup — delete dead top-level `costPrice` and `currency`
 * fields from a known set of inventory documents whose canonical pricing
 * already lives in the nested `pricing.costPerUnit` / `pricing.currency`
 * shape.
 *
 * Background: an earlier (now-fixed) bug in the MCP `update_inventory_item`
 * handler wrote price updates to top-level fields. The 150-item batch from
 * that broken sweep has since been re-applied correctly into `pricing.*`,
 * so the top-level orphans are dead weight.
 *
 * This script ONLY deletes the two top-level field names. It never touches
 * the nested `pricing` object.
 *
 * Usage:
 *   node scripts/orphan-field-cleanup.cjs              # dry-run
 *   node scripts/orphan-field-cleanup.cjs --apply      # commit deletes
 *   node scripts/orphan-field-cleanup.cjs --verify     # global scan only
 */

const path = require('path');
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const APPLY = process.argv.includes('--apply');
const VERIFY_ONLY = process.argv.includes('--verify');
const COLLECTION = 'inventoryItems';
const BATCH_SIZE = 400;

async function spotCheck(ids) {
  const sample = ids.slice(0, Math.min(5, ids.length));
  console.log(`\nSpot check (${sample.length} samples):`);
  for (const id of sample) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) {
      console.warn(`  [${id}] NOT FOUND`);
      continue;
    }
    const data = snap.data() || {};
    console.log(`  [${id}]`);
    console.log(`    top-level costPrice: ${JSON.stringify(data.costPrice)}`);
    console.log(`    top-level currency:  ${JSON.stringify(data.currency)}`);
    console.log(`    pricing.costPerUnit: ${JSON.stringify(data.pricing?.costPerUnit)}`);
    console.log(`    pricing.currency:    ${JSON.stringify(data.pricing?.currency)}`);
  }
}

async function commitDeletes(ids) {
  console.log(`\nCommitting deletes on ${ids.length} items in batches of ${BATCH_SIZE}...`);
  let committed = 0;
  let skipped = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const slice = ids.slice(i, i + BATCH_SIZE);

    // Pre-check existence to avoid one missing doc nuking the whole batch.
    // Firestore batch.update on a nonexistent doc fails the entire commit.
    const refs = slice.map((id) => db.collection(COLLECTION).doc(id));
    const snaps = await db.getAll(...refs);
    const presentRefs = [];
    for (let j = 0; j < snaps.length; j++) {
      if (snaps[j].exists) {
        presentRefs.push(refs[j]);
      } else {
        skipped++;
        console.warn(`  [${slice[j]}] not found — skipping`);
      }
    }

    if (presentRefs.length === 0) continue;

    const batch = db.batch();
    for (const ref of presentRefs) {
      batch.update(ref, {
        costPrice: FieldValue.delete(),
        currency: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'orphan-cleanup-script',
      });
    }

    try {
      await batch.commit();
      committed += presentRefs.length;
      console.log(`  Committed ${committed}/${ids.length - skipped}`);
    } catch (err) {
      console.error(`  Batch ${i}-${i + slice.length} FAILED:`, err.message);
      // Per-item fallback so a single bad doc doesn't sink the slice.
      for (const ref of presentRefs) {
        try {
          await ref.update({
            costPrice: FieldValue.delete(),
            currency: FieldValue.delete(),
            updatedAt: new Date().toISOString(),
            updatedBy: 'orphan-cleanup-script',
          });
          committed++;
        } catch (e) {
          skipped++;
          console.warn(`    [${ref.id}] failed: ${e.message}`);
        }
      }
    }
  }

  return { committed, skipped };
}

async function verifySamples(ids) {
  const sample = ids.slice(0, Math.min(5, ids.length));
  console.log(`\nPost-commit verification (${sample.length} samples):`);
  for (const id of sample) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const topCost = 'costPrice' in data ? `STILL PRESENT: ${data.costPrice}` : 'deleted ✓';
    const topCurr = 'currency' in data ? `STILL PRESENT: ${data.currency}` : 'deleted ✓';
    console.log(`  [${id}]`);
    console.log(`    costPrice: ${topCost}`);
    console.log(`    currency:  ${topCurr}`);
    console.log(`    pricing.costPerUnit: ${data.pricing?.costPerUnit} (unchanged)`);
    console.log(`    pricing.currency:    ${data.pricing?.currency} (unchanged)`);
  }
}

async function globalVerify() {
  console.log(`\nGlobal scan: looking for any remaining top-level orphans across ${COLLECTION}...`);
  const snap = await db.collection(COLLECTION).get();
  const orphans = snap.docs.filter((d) => {
    const data = d.data();
    return data.costPrice !== undefined || data.currency !== undefined;
  });
  console.log(`  Total docs scanned: ${snap.size}`);
  console.log(`  Docs with orphan top-level costPrice/currency: ${orphans.length}`);
  if (orphans.length > 0) {
    const sample = orphans.slice(0, 10);
    console.log(`  Sample orphan IDs:`);
    for (const d of sample) {
      const data = d.data();
      console.log(
        `    [${d.id}] costPrice=${JSON.stringify(data.costPrice)} currency=${JSON.stringify(data.currency)}`
      );
    }
  }
  return orphans.length;
}

(async () => {
  console.log(`\n=== Orphan field cleanup ${APPLY ? '(APPLY)' : VERIFY_ONLY ? '(VERIFY ONLY)' : '(DRY RUN)'} ===`);

  if (VERIFY_ONLY) {
    const remaining = await globalVerify();
    process.exit(remaining === 0 ? 0 : 1);
  }

  const ids = require(path.join(__dirname, 'orphan_cleanup_ids.json'));
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('orphan_cleanup_ids.json is empty or not an array');
  }
  console.log(`Loaded ${ids.length} target IDs`);

  await spotCheck(ids);

  if (!APPLY) {
    console.log(`\nDry-run only — pass --apply to commit deletes.`);
    process.exit(0);
  }

  const { committed, skipped } = await commitDeletes(ids);
  console.log(`\nDone. Committed: ${committed}. Skipped (missing/failed): ${skipped}.`);

  await verifySamples(ids);
  await globalVerify();
})().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
