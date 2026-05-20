/**
 * Backfill: promote orphan top-level `costPrice` / `currency` fields into the
 * nested `pricing.costPerUnit` / `pricing.currency` shape that the frontend
 * actually reads.
 *
 * Cause: a now-fixed bug in the MCP `update_inventory_item` /
 * `batch_update_inventory` handlers wrote price updates to top-level fields
 * instead of into the `pricing` map. Today's AED→UGX FX batch hit ~150 items.
 *
 * For each item that has a top-level `costPrice` or `currency`:
 *   - copy the value into pricing.costPerUnit / pricing.currency
 *   - delete the top-level orphan
 *
 * Pass --apply to actually write. Default is dry-run.
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

(async () => {
  console.log(`\n=== Backfill orphan pricing fields ${APPLY ? '(APPLY)' : '(DRY RUN)'} ===\n`);

  const snap = await db.collection('inventoryItems').get();
  console.log(`Scanned ${snap.size} inventory items`);

  const orphans = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const hasOrphanCost = data.costPrice !== undefined;
    const hasOrphanCurrency = data.currency !== undefined;
    if (!hasOrphanCost && !hasOrphanCurrency) continue;

    const currentPricing = data.pricing || {};
    orphans.push({
      id: doc.id,
      sku: data.sku,
      name: data.name,
      orphanCostPrice: data.costPrice,
      orphanCurrency: data.currency,
      pricingCostPerUnit: currentPricing.costPerUnit,
      pricingCurrency: currentPricing.currency,
    });
  }

  console.log(`Found ${orphans.length} items with orphan top-level pricing fields\n`);

  if (orphans.length === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  // Show first 10 + sample
  console.log('Sample (first 10):');
  for (const o of orphans.slice(0, 10)) {
    console.log(
      `  ${o.id} | ${o.sku || '?'} | orphan: ${o.orphanCostPrice} ${o.orphanCurrency} | nested: ${o.pricingCostPerUnit} ${o.pricingCurrency}`
    );
  }
  console.log();

  if (!APPLY) {
    console.log('DRY RUN — pass --apply to write changes.');
    process.exit(0);
  }

  // Apply in batches of 400 (Firestore batch limit is 500)
  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < orphans.length; i += BATCH_SIZE) {
    const chunk = orphans.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const o of chunk) {
      const ref = db.collection('inventoryItems').doc(o.id);
      const update = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'mcp-backfill-script',
      };
      // Promote the orphan values into the nested pricing object
      if (o.orphanCostPrice !== undefined) {
        update['pricing.costPerUnit'] = o.orphanCostPrice;
        update['costPrice'] = admin.firestore.FieldValue.delete();
      }
      if (o.orphanCurrency !== undefined) {
        update['pricing.currency'] = o.orphanCurrency;
        update['currency'] = admin.firestore.FieldValue.delete();
      }
      batch.update(ref, update);
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  Committed batch ${i / BATCH_SIZE + 1}: ${chunk.length} items (total ${written}/${orphans.length})`);
  }

  console.log(`\n✅ Backfill complete. Updated ${written} items.`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
